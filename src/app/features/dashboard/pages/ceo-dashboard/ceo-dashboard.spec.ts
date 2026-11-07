import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { CeoDashboard } from './ceo-dashboard';
import { AuthService } from '../../../../core/services/auth.service';
import { TaskService } from '../../../../core/services/task.service';
import { ReminderService } from '../../../../core/services/reminder.service';
import { RequestService } from '../../../../core/services/request.service';
import { MeetingService } from '../../../../core/services/meeting.service';
import { NotificationService } from '../../../../core/services/notification.service';
import { User } from '../../../../core/models/user.model';
import { Task } from '../../../../core/models/task.model';
import { Reminder } from '../../../../core/models/reminder.model';
import { Request } from '../../../../core/models/request.model';
import { Meeting } from '../../../../core/models/meeting.model';

const currentUser: User = {
  id: 'current-user',
  firstName: 'Current',
  lastName: 'User',
  email: 'current@example.com',
  role: 'EMPLOYEE'
};
const currentUserSignal = signal<User | null>(null);

function user(id: string): User {
  return {
    id,
    firstName: id,
    lastName: 'User',
    email: `${id}@example.com`,
    role: 'EMPLOYEE'
  };
}

function makeTask(
  id: string,
  assignedToId: string,
  status: Task['status'],
  createdById = 'creator'
): Task {
  return {
    id,
    title: id,
    assignedTo: user(assignedToId),
    participants: [],
    createdBy: user(createdById),
    priority: 'MEDIUM',
    category: 'General',
    dueDate: '2099-01-01',
    status,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    commentsCount: 0,
    attachmentsCount: 0
  };
}

function makeReminder(
  id: string,
  recipientId: string,
  status: Reminder['status'],
  createdById = 'creator'
): Reminder {
  return {
    id,
    title: id,
    recipient: user(recipientId),
    participants: [],
    createdBy: user(createdById),
    priority: 'MEDIUM',
    category: 'General',
    reminderDate: '2099-01-01',
    reminderTime: '09:00',
    recurrence: 'ONCE',
    status,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    commentsCount: 0,
    attachmentsCount: 0
  };
}

function makeRequest(
  id: string,
  assignedToId: string,
  priority: Request['priority'],
  requesterId = 'requester',
  status: Request['status'] = 'PENDING'
): Request {
  return {
    id,
    title: id,
    type: 'GENERAL',
    priority,
    requester: user(requesterId),
    assignedTo: user(assignedToId),
    status,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    commentsCount: 0,
    attachmentsCount: 0
  };
}

function makeMeeting(
  id: string,
  organizerId: string,
  participantIds: string[],
  status: Meeting['status'] = 'SCHEDULED'
): Meeting {
  const date = new Date();
  const meetingDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return {
    id,
    title: id,
    organizer: user(organizerId),
    participants: participantIds.map(user),
    meetingDate,
    startTime: '09:00',
    endTime: '10:00',
    meetingType: 'IN_PERSON',
    status,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    commentsCount: 0,
    attachmentsCount: 0
  };
}

describe('CeoDashboard', () => {
  let component: CeoDashboard;
  let fixture: ComponentFixture<CeoDashboard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CeoDashboard],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { currentUser: currentUserSignal.asReadonly() }
        }
      ]
    })
    .compileComponents();

    currentUserSignal.set(null);
    fixture = TestBed.createComponent(CeoDashboard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('scopes dashboard records and metrics to the current user', () => {
    const taskService = TestBed.inject(TaskService);
    const reminderService = TestBed.inject(ReminderService);
    const requestService = TestBed.inject(RequestService);
    const meetingService = TestBed.inject(MeetingService);
    const todayMeeting = makeMeeting('participant-meeting', 'another-user', ['current-user']);

    vi.spyOn(taskService, 'tasks').mockReturnValue([
      makeTask('assigned-task', 'current-user', 'PENDING'),
      makeTask('created-task', 'another-user', 'PENDING', 'current-user'),
      makeTask('other-task', 'another-user', 'PENDING')
    ]);
    vi.spyOn(reminderService, 'reminders').mockReturnValue([
      makeReminder('recipient-reminder', 'current-user', 'PENDING'),
      makeReminder('created-reminder', 'another-user', 'PENDING', 'current-user'),
      makeReminder('other-reminder', 'another-user', 'PENDING')
    ]);
    vi.spyOn(requestService, 'requests').mockReturnValue([
      makeRequest('assigned-request', 'current-user', 'HIGH'),
      makeRequest('created-request', 'another-user', 'HIGH', 'current-user'),
      makeRequest('other-request', 'another-user', 'URGENT')
    ]);
    vi.spyOn(meetingService, 'meetings').mockReturnValue([
      todayMeeting,
      makeMeeting('organized-meeting', 'current-user', ['someone-else']),
      makeMeeting('other-meeting', 'another-user', ['someone-else'])
    ]);
    vi.spyOn(meetingService, 'upcomingMeetings').mockReturnValue([
      todayMeeting,
      makeMeeting('organized-meeting', 'current-user', ['someone-else']),
      makeMeeting('other-upcoming', 'another-user', ['someone-else'])
    ]);
    currentUserSignal.set(currentUser);

    expect(component.assignedTasks().map(task => task.id)).toEqual([
      'assigned-task',
      'created-task'
    ]);
    expect(component.assignedReminders().map(reminder => reminder.id)).toEqual([
      'recipient-reminder',
      'created-reminder'
    ]);
    expect(component.assignedRequests().map(request => request.id)).toEqual([
      'assigned-request',
      'created-request'
    ]);
    expect(component.assignedMeetings().map(meeting => meeting.id)).toEqual([
      'participant-meeting',
      'organized-meeting'
    ]);
    expect(component.pendingTasks().map(task => task.id)).toEqual(['assigned-task', 'created-task']);
    expect(component.upcomingReminders().map(reminder => reminder.id)).toEqual([
      'recipient-reminder',
      'created-reminder'
    ]);
    expect(component.schedule().map(item => item.title)).toEqual(['participant-meeting', 'organized-meeting']);
    expect(component.attentionItems().map(item => item.title)).toEqual([
      'assigned-request',
      'created-request'
    ]);
    expect(component.summary().find(item => item.label === 'Pending')?.value).toBe(6);
    expect(component.summary().find(item => item.label === 'Today')?.value).toBe(2);
  });

  it('aggregates only in-progress and completed items across all modules with detail links', () => {
    const taskService = TestBed.inject(TaskService);
    const reminderService = TestBed.inject(ReminderService);
    const requestService = TestBed.inject(RequestService);
    const meetingService = TestBed.inject(MeetingService);
    const notificationService = TestBed.inject(NotificationService);

    vi.spyOn(taskService, 'tasks').mockReturnValue([
      makeTask('active-task', 'current-user', 'IN_PROGRESS'),
      makeTask('completed-task', 'another-user', 'COMPLETED', 'current-user'),
      makeTask('closed-task', 'current-user', 'CLOSED'),
      makeTask('unrelated-task', 'another-user', 'IN_PROGRESS')
    ]);
    vi.spyOn(reminderService, 'reminders').mockReturnValue([
      makeReminder('active-reminder', 'current-user', 'TRIGGERED'),
      makeReminder('completed-reminder', 'another-user', 'COMPLETED', 'current-user'),
      makeReminder('pending-reminder', 'current-user', 'PENDING')
    ]);
    vi.spyOn(requestService, 'requests').mockReturnValue([
      makeRequest('active-request', 'current-user', 'HIGH', 'requester', 'IN_REVIEW'),
      makeRequest('completed-request', 'another-user', 'MEDIUM', 'current-user', 'COMPLETED'),
      makeRequest('pending-request', 'current-user', 'LOW')
    ]);
    vi.spyOn(meetingService, 'meetings').mockReturnValue([
      makeMeeting('active-meeting', 'current-user', [], 'RESCHEDULED'),
      makeMeeting('completed-meeting', 'another-user', ['current-user'], 'COMPLETED'),
      makeMeeting('cancelled-meeting', 'current-user', [], 'CANCELLED')
    ]);
    for (const service of [taskService, reminderService, requestService, meetingService, notificationService]) {
      service.listLoading.set(false);
      service.listError.set('');
    }
    currentUserSignal.set(currentUser);
    const scrollToSection = vi.spyOn(component, 'scrollToSection').mockImplementation(() => {});
    fixture.detectChanges();

    expect(component.inProgressItems().map(item => item.id)).toEqual([
      'active-task',
      'active-reminder',
      'active-request',
      'active-meeting'
    ]);
    expect(component.completedItems().map(item => item.id)).toEqual([
      'completed-task',
      'closed-task',
      'completed-reminder',
      'completed-request',
      'completed-meeting'
    ]);
    expect(component.summary().find(item => item.label === 'In Progress')?.value).toBe(4);

    const cards = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.dashboard-card')
    );
    const inProgressCard = cards.find(card => card.querySelector('h2')?.textContent?.trim() === 'In Progress');
    const completedCard = cards.find(card => card.querySelector('h2')?.textContent?.trim() === 'Completed');
    expect(inProgressCard?.querySelector('.status-count')?.textContent?.trim()).toBe('4');
    expect(completedCard?.querySelector('.status-count')?.textContent?.trim()).toBe('5');
    const inProgressSummary = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.summary-card')
    ).find(card => card.textContent?.includes('In Progress'));
    expect(inProgressSummary).toBeDefined();
    inProgressSummary?.click();
    expect(scrollToSection).toHaveBeenCalledWith('in-progress-items');
    expect(fixture.nativeElement.querySelector('#in-progress-items h2')?.textContent?.trim())
      .toBe('In Progress');
    expect(
      Array.from(inProgressCard?.querySelectorAll<HTMLAnchorElement>('.dashboard-status-item') ?? [])
        .map(link => link.getAttribute('href'))
    ).toEqual([
      '/tasks/active-task',
      '/reminders/active-reminder',
      '/requests/active-request',
      '/meetings/active-meeting'
    ]);
    expect(
      Array.from(completedCard?.querySelectorAll<HTMLAnchorElement>('.dashboard-status-item') ?? [])
        .map(link => link.getAttribute('href'))
    ).toEqual([
      '/tasks/completed-task',
      '/tasks/closed-task',
      '/reminders/completed-reminder',
      '/requests/completed-request',
      '/meetings/completed-meeting'
    ]);
  });
});
