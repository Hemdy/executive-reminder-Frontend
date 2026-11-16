import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { Notification } from '../models/notification.model';
import { User } from '../models/user.model';
import { AuthService } from './auth.service';
import {
  NOTIFICATION_POLL_INTERVAL_MS,
  NotificationService,
} from './notification.service';

function makeNotification(id: string, isRead = false, title = id): Notification {
  return {
    id,
    title,
    message: `${title} body`,
    type: 'TASK_ASSIGNED',
    priority: 'MEDIUM',
    isRead,
    createdAt: '2026-10-26T09:00:00.000Z',
  };
}

describe('NotificationService', () => {
  let service: NotificationService;
  let http: HttpTestingController;
  let currentUserSignal: ReturnType<typeof signal<User | null>>;
  let sessionVersionSignal: ReturnType<typeof signal<number>>;
  let sessionEndedSubject: Subject<void>;

  const userA: User = {
    id: 'user-a',
    email: 'a@example.com',
    firstName: 'Alice',
    lastName: 'Executive',
    role: 'CEO',
  };
  const userB: User = {
    id: 'user-b',
    email: 'b@example.com',
    firstName: 'Bob',
    lastName: 'Director',
    role: 'DIRECTOR',
  };

  beforeEach(() => {
    vi.useFakeTimers();
    currentUserSignal = signal<User | null>(userA);
    sessionVersionSignal = signal(1);
    sessionEndedSubject = new Subject<void>();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            currentUser: currentUserSignal.asReadonly(),
            sessionVersion: sessionVersionSignal.asReadonly(),
            sessionEnded$: sessionEndedSubject.asObservable(),
          },
        },
      ],
    });

    service = TestBed.inject(NotificationService);
    http = TestBed.inject(HttpTestingController);
    TestBed.flushEffects();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  it('resolves a request notification to its detail page', () => {
    http.expectOne(`${API_BASE_URL}/notifications`).flush([]);

    expect(
      service.resourceRoute({
        id: 'notification-1',
        title: 'Request approved',
        message: 'Request updated',
        type: 'REQUEST',
        priority: 'MEDIUM',
        isRead: false,
        createdAt: '2026-10-26T09:00:00.000Z',
        referenceId: 'request-1',
      }),
    ).toBe('/requests/request-1');
  });

  it('clears notifications and stops polling on logout, then loads fresh notifications on account switch', () => {
    const reqA = http.expectOne(`${API_BASE_URL}/notifications`);
    reqA.flush([
      makeNotification('n-a1', false, 'Alice Alert 1'),
      makeNotification('n-a2', false, 'Alice Alert 2'),
    ]);

    expect(service.notifications().length).toBe(2);
    expect(service.unreadCount()).toBe(2);

    // Logout User A
    sessionVersionSignal.update(v => v + 1);
    sessionEndedSubject.next();
    currentUserSignal.set(null);
    TestBed.flushEffects();

    expect(service.notifications()).toEqual([]);
    expect(service.unreadCount()).toBe(0);

    // Polling timer must not fire while logged out
    vi.advanceTimersByTime(NOTIFICATION_POLL_INTERVAL_MS * 2);
    http.expectNone(`${API_BASE_URL}/notifications`);

    // Login User B without browser refresh
    sessionVersionSignal.update(v => v + 1);
    sessionEndedSubject.next();
    currentUserSignal.set(userB);
    TestBed.flushEffects();

    const reqB = http.expectOne(`${API_BASE_URL}/notifications`);
    reqB.flush([makeNotification('n-b1', false, 'Bob Alert')]);

    expect(service.notifications().map(n => n.title)).toEqual(['Bob Alert']);
    expect(service.unreadCount()).toBe(1);
  });

  it('cancels stale in-flight requests when switching accounts before User A responds', () => {
    const reqA = http.expectOne(`${API_BASE_URL}/notifications`);
    expect(reqA.cancelled).toBe(false);

    // Switch straight to User B before User A's request finishes
    sessionVersionSignal.update(v => v + 1);
    sessionEndedSubject.next();
    currentUserSignal.set(userB);
    TestBed.flushEffects();

    expect(reqA.cancelled).toBe(true);

    const reqB = http.expectOne(`${API_BASE_URL}/notifications`);
    reqB.flush([makeNotification('n-b1', false, 'Bob Fresh Alert')]);

    expect(service.notifications().map(n => n.id)).toEqual(['n-b1']);
    expect(service.unreadCount()).toBe(1);
  });

  it('polls silently every 30s and refreshes when the tab becomes visible', () => {
    http.expectOne(`${API_BASE_URL}/notifications`).flush([
      makeNotification('n-1', false),
    ]);
    expect(service.unreadCount()).toBe(1);
    expect(service.listLoading()).toBe(false);

    // Advance 30s for automatic background poll
    vi.advanceTimersByTime(NOTIFICATION_POLL_INTERVAL_MS);
    const pollReq = http.expectOne(`${API_BASE_URL}/notifications`);
    expect(service.listLoading()).toBe(false);
    pollReq.flush([
      makeNotification('n-1', false),
      makeNotification('n-2', false),
    ]);
    expect(service.unreadCount()).toBe(2);

    // Advance past throttle window and simulate tab becoming visible
    vi.advanceTimersByTime(6_000);
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));

    const focusReq = http.expectOne(`${API_BASE_URL}/notifications`);
    focusReq.flush([
      makeNotification('n-1', true),
      makeNotification('n-2', false),
      makeNotification('n-3', false),
    ]);
    expect(service.unreadCount()).toBe(2);
  });
});
