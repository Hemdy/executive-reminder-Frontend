import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { API_BASE_URL } from '../config/api.config';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthService } from './auth.service';
import { MeetingService } from './meeting.service';
import { NotificationService } from './notification.service';
import { ReminderService } from './reminder.service';
import { RequestService } from './request.service';
import { RoleService } from './role.service';
import { TaskService } from './task.service';

describe('Auth & Notification Session Isolation', () => {
  let auth: AuthService;
  let notifications: NotificationService;
  let tasks: TaskService;
  let reminders: ReminderService;
  let requests: RequestService;
  let meetings: MeetingService;
  let roles: RoleService;
  let http: HttpTestingController;
  let router: Router;

  const userA = {
    id: 'user-a',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'CEO',
    role: 'CEO' as const,
  };

  const userB = {
    id: 'user-b',
    email: 'bob@example.com',
    firstName: 'Bob',
    lastName: 'Manager',
    role: 'DIRECTOR' as const,
  };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    auth = TestBed.inject(AuthService);
    notifications = TestBed.inject(NotificationService);
    tasks = TestBed.inject(TaskService);
    reminders = TestBed.inject(ReminderService);
    requests = TestBed.inject(RequestService);
    meetings = TestBed.inject(MeetingService);
    roles = TestBed.inject(RoleService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('does not issue data requests while unauthenticated and isolates User A and User B on account switch', () => {
    TestBed.flushEffects();
    http.expectNone(`${API_BASE_URL}/notifications`);
    http.expectNone(`${API_BASE_URL}/tasks`);

    // 1. Login as User A
    auth.login({ email: 'alice@example.com', password: 'pw' }).subscribe();
    http.expectOne(`${API_BASE_URL}/auth/login`).flush({
      accessToken: 'token-a',
      user: userA,
    });
    TestBed.flushEffects();

    const notifReqA = http.expectOne(`${API_BASE_URL}/notifications`);
    expect(notifReqA.request.headers.get('Authorization')).toBe('Bearer token-a');
    notifReqA.flush([
      {
        id: 'n-a',
        title: 'Alice Notification',
        message: 'For Alice only',
        type: 'SYSTEM',
        priority: 'HIGH',
        isRead: false,
        createdAt: '2026-11-01T10:00:00.000Z',
      },
    ]);

    const taskReqA = http.expectOne(`${API_BASE_URL}/tasks`);
    expect(taskReqA.request.headers.get('Authorization')).toBe('Bearer token-a');
    taskReqA.flush([
      {
        id: 't-a',
        title: 'Alice Task',
        assignedTo: userA,
        createdBy: userA,
        priority: 'HIGH',
        category: 'General',
        dueDate: '2026-11-20',
        status: 'PENDING',
        createdAt: '2026-11-01',
        updatedAt: '2026-11-01',
      },
    ]);

    http.expectOne(`${API_BASE_URL}/reminders`).flush([]);
    http.expectOne(`${API_BASE_URL}/requests`).flush([]);
    http.expectOne(`${API_BASE_URL}/meetings`).flush([]);

    expect(notifications.unreadCount()).toBe(1);
    expect(tasks.tasks().map(t => t.id)).toEqual(['t-a']);

    // 2. Logout User A -> all cached data clears synchronously
    auth.logout();
    TestBed.flushEffects();

    expect(notifications.notifications()).toEqual([]);
    expect(notifications.unreadCount()).toBe(0);
    expect(tasks.tasks()).toEqual([]);
    expect(reminders.reminders()).toEqual([]);
    expect(requests.requests()).toEqual([]);
    expect(meetings.meetings()).toEqual([]);
    expect(roles.users()).toEqual([]);

    // 3. Login as User B without refreshing
    auth.login({ email: 'bob@example.com', password: 'pw' }).subscribe();
    http.expectOne(`${API_BASE_URL}/auth/login`).flush({
      accessToken: 'token-b',
      user: userB,
    });
    TestBed.flushEffects();

    const notifReqB = http.expectOne(`${API_BASE_URL}/notifications`);
    expect(notifReqB.request.headers.get('Authorization')).toBe('Bearer token-b');
    notifReqB.flush([
      {
        id: 'n-b1',
        title: 'Bob Notification 1',
        message: 'For Bob',
        type: 'REQUEST',
        priority: 'MEDIUM',
        isRead: false,
        createdAt: '2026-11-01T11:00:00.000Z',
      },
      {
        id: 'n-b2',
        title: 'Bob Notification 2',
        message: 'For Bob',
        type: 'MEETING',
        priority: 'LOW',
        isRead: true,
        createdAt: '2026-11-01T11:05:00.000Z',
      },
    ]);

    const taskReqB = http.expectOne(`${API_BASE_URL}/tasks`);
    expect(taskReqB.request.headers.get('Authorization')).toBe('Bearer token-b');
    taskReqB.flush([]);
    http.expectOne(`${API_BASE_URL}/reminders`).flush([]);
    http.expectOne(`${API_BASE_URL}/requests`).flush([]);
    http.expectOne(`${API_BASE_URL}/meetings`).flush([]);

    expect(notifications.notifications().map(n => n.id)).toEqual(['n-b1', 'n-b2']);
    expect(notifications.unreadCount()).toBe(1);
    expect(tasks.tasks()).toEqual([]);
  });

  it('prevents a stale 401 from an invalidated session from logging out the new user', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    // Log in User A and leave a pending request open
    auth.login({ email: 'alice@example.com', password: 'pw' }).subscribe();
    http.expectOne(`${API_BASE_URL}/auth/login`).flush({
      accessToken: 'token-a',
      user: userA,
    });
    TestBed.flushEffects();

    const staleTaskReq = http.expectOne(`${API_BASE_URL}/tasks`);
    http.expectOne(`${API_BASE_URL}/notifications`).flush([]);
    http.expectOne(`${API_BASE_URL}/reminders`).flush([]);
    http.expectOne(`${API_BASE_URL}/requests`).flush([]);
    http.expectOne(`${API_BASE_URL}/meetings`).flush([]);

    // Log in User B before User A's request returns
    auth.login({ email: 'bob@example.com', password: 'pw' }).subscribe();
    http.expectOne(`${API_BASE_URL}/auth/login`).flush({
      accessToken: 'token-b',
      user: userB,
    });
    TestBed.flushEffects();

    // User A's request was cancelled by takeUntil(sessionEnded$)
    expect(staleTaskReq.cancelled).toBe(true);

    http.expectOne(`${API_BASE_URL}/notifications`).flush([]);
    http.expectOne(`${API_BASE_URL}/tasks`).flush([]);
    http.expectOne(`${API_BASE_URL}/reminders`).flush([]);
    http.expectOne(`${API_BASE_URL}/requests`).flush([]);
    http.expectOne(`${API_BASE_URL}/meetings`).flush([]);

    // User B remains authenticated and wasn't kicked back to /login
    expect(auth.currentUser()?.id).toBe('user-b');
    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
