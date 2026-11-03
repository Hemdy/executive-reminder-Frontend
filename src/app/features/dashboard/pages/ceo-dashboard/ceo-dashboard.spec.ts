import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { CeoDashboard } from './ceo-dashboard';
import { AuthService } from '../../../../core/services/auth.service';
import { TaskService } from '../../../../core/services/task.service';
import { ReminderService } from '../../../../core/services/reminder.service';
import { RequestService } from '../../../../core/services/request.service';
import { MeetingService } from '../../../../core/services/meeting.service';
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

function makeTask(id: string, assignedToId: string, status: Task['status']): Task {
  return {
    id,
    title: id,
    assignedTo: user(assignedToId),
    participants: [],
    createdBy: user('creator'),
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

function makeReminder(id: string, recipientId: string, status: Reminder['status']): Reminder {
  return {
    id,
    title: id,
    recipient: user(recipientId),
    participants: [],
    createdBy: user('creator'),
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

function makeRequest(id: string, assignedToId: string, priority: Request['priority']): Request {
  return {
    id,
    title: id,
    type: 'GENERAL',
    priority,
    requester: user('requester'),
    assignedTo: user(assignedToId),
    status: 'PENDING',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    commentsCount: 0,
    attachmentsCount: 0
  };
}

function makeMeeting(id: string, organizerId: string, participantIds: string[]): Meeting {
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
    status: 'SCHEDULED',
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
      providers: [{
        provide: AuthService,
        useValue: { currentUser: currentUserSignal.asReadonly() }
      }]
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
      makeTask('other-task', 'another-user', 'PENDING')
    ]);
    vi.spyOn(reminderService, 'reminders').mockReturnValue([
      makeReminder('recipient-reminder', 'current-user', 'PENDING'),
      makeReminder('other-reminder', 'another-user', 'PENDING')
    ]);
    vi.spyOn(requestService, 'requests').mockReturnValue([
      makeRequest('assigned-request', 'current-user', 'HIGH'),
      makeRequest('other-request', 'another-user', 'URGENT')
    ]);
    vi.spyOn(meetingService, 'meetings').mockReturnValue([
      todayMeeting,
      makeMeeting('other-meeting', 'another-user', ['someone-else'])
    ]);
    vi.spyOn(meetingService, 'upcomingMeetings').mockReturnValue([
      todayMeeting,
      makeMeeting('other-upcoming', 'another-user', ['someone-else'])
    ]);
    currentUserSignal.set(currentUser);

    expect(component.assignedTasks().map(task => task.id)).toEqual(['assigned-task']);
    expect(component.assignedReminders().map(reminder => reminder.id)).toEqual(['recipient-reminder']);
    expect(component.assignedRequests().map(request => request.id)).toEqual(['assigned-request']);
    expect(component.assignedMeetings().map(meeting => meeting.id)).toEqual(['participant-meeting']);
    expect(component.pendingTasks().map(task => task.id)).toEqual(['assigned-task']);
    expect(component.upcomingReminders().map(reminder => reminder.id)).toEqual(['recipient-reminder']);
    expect(component.schedule().map(item => item.title)).toEqual(['participant-meeting']);
    expect(component.attentionItems().map(item => item.title)).toEqual(['assigned-request']);
    expect(component.summary().find(item => item.label === 'Pending')?.value).toBe(3);
    expect(component.summary().find(item => item.label === 'Today')?.value).toBe(1);
  });
});
