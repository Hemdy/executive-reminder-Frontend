import { Meeting } from '../models/meeting.model';
import { Reminder } from '../models/reminder.model';
import { Request } from '../models/request.model';
import { Task } from '../models/task.model';
import { User } from '../models/user.model';
import {
  sortMeetingsDesc,
  sortRemindersDesc,
  sortRequestsDesc,
  sortTasksDesc,
} from './date-sort';

const user: User = {
  id: 'u-1',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.com',
  role: 'CEO',
};

describe('date-sort utilities', () => {
  it('sorts tasks latest-first by dueDate, dueTime, and createdAt', () => {
    const tasks: Task[] = [
      {
        id: 't-old',
        title: 'Old',
        assignedTo: user,
        createdBy: user,
        priority: 'MEDIUM',
        category: 'General',
        dueDate: '2026-11-10',
        dueTime: '09:00',
        status: 'PENDING',
        createdAt: '2026-11-01T08:00:00Z',
        updatedAt: '2026-11-01T08:00:00Z',
        commentsCount: 0,
        attachmentsCount: 0,
      },
      {
        id: 't-same-day-early',
        title: 'Same Day Early',
        assignedTo: user,
        createdBy: user,
        priority: 'MEDIUM',
        category: 'General',
        dueDate: '2026-11-18',
        dueTime: '08:00',
        status: 'PENDING',
        createdAt: '2026-11-01T09:00:00Z',
        updatedAt: '2026-11-01T09:00:00Z',
        commentsCount: 0,
        attachmentsCount: 0,
      },
      {
        id: 't-same-day-late',
        title: 'Same Day Late',
        assignedTo: user,
        createdBy: user,
        priority: 'MEDIUM',
        category: 'General',
        dueDate: '2026-11-18',
        dueTime: '17:00',
        status: 'PENDING',
        createdAt: '2026-11-01T10:00:00Z',
        updatedAt: '2026-11-01T10:00:00Z',
        commentsCount: 0,
        attachmentsCount: 0,
      },
    ];

    expect(sortTasksDesc(tasks).map(t => t.id)).toEqual([
      't-same-day-late',
      't-same-day-early',
      't-old',
    ]);
  });

  it('sorts reminders latest-first by reminderDate and reminderTime', () => {
    const reminders: Reminder[] = [
      {
        id: 'r-1',
        title: 'First',
        recipient: user,
        createdBy: user,
        priority: 'LOW',
        category: 'General',
        reminderDate: '2026-11-12',
        reminderTime: '10:00',
        recurrence: 'ONCE',
        status: 'PENDING',
        createdAt: '2026-11-01T10:00:00Z',
        updatedAt: '2026-11-01T10:00:00Z',
        commentsCount: 0,
        attachmentsCount: 0,
      },
      {
        id: 'r-2',
        title: 'Latest',
        recipient: user,
        createdBy: user,
        priority: 'HIGH',
        category: 'General',
        reminderDate: '2026-11-20',
        reminderTime: '09:00',
        recurrence: 'ONCE',
        status: 'PENDING',
        createdAt: '2026-11-02T10:00:00Z',
        updatedAt: '2026-11-02T10:00:00Z',
        commentsCount: 0,
        attachmentsCount: 0,
      },
    ];

    expect(sortRemindersDesc(reminders).map(r => r.id)).toEqual(['r-2', 'r-1']);
  });

  it('sorts requests latest-first by createdAt', () => {
    const requests: Request[] = [
      {
        id: 'req-older',
        title: 'Older',
        type: 'GENERAL',
        priority: 'MEDIUM',
        requester: user,
        assignedTo: user,
        status: 'PENDING',
        createdAt: '2026-11-01T08:00:00Z',
        updatedAt: '2026-11-01T08:00:00Z',
        commentsCount: 0,
        attachmentsCount: 0,
      },
      {
        id: 'req-newer',
        title: 'Newer',
        type: 'APPROVAL',
        priority: 'HIGH',
        requester: user,
        assignedTo: user,
        status: 'PENDING',
        createdAt: '2026-11-15T12:00:00Z',
        updatedAt: '2026-11-15T12:00:00Z',
        commentsCount: 0,
        attachmentsCount: 0,
      },
    ];

    expect(sortRequestsDesc(requests).map(r => r.id)).toEqual(['req-newer', 'req-older']);
  });

  it('sorts meetings latest-first by meetingDate and startTime', () => {
    const meetings: Meeting[] = [
      {
        id: 'm-1',
        title: 'Morning',
        organizer: user,
        participants: [],
        meetingDate: '2026-11-16',
        startTime: '09:00',
        endTime: '10:00',
        meetingType: 'ONLINE',
        status: 'SCHEDULED',
        createdAt: '2026-11-01T08:00:00Z',
        updatedAt: '2026-11-01T08:00:00Z',
        commentsCount: 0,
        attachmentsCount: 0,
      },
      {
        id: 'm-2',
        title: 'Future',
        organizer: user,
        participants: [],
        meetingDate: '2026-11-22',
        startTime: '14:00',
        endTime: '15:00',
        meetingType: 'IN_PERSON',
        status: 'SCHEDULED',
        createdAt: '2026-11-01T08:00:00Z',
        updatedAt: '2026-11-01T08:00:00Z',
        commentsCount: 0,
        attachmentsCount: 0,
      },
    ];

    expect(sortMeetingsDesc(meetings).map(m => m.id)).toEqual(['m-2', 'm-1']);
  });
});
