import { Meeting } from '../models/meeting.model';
import { Reminder } from '../models/reminder.model';
import { Request } from '../models/request.model';
import { Task } from '../models/task.model';

export function toSortTimestamp(date?: string | null, time?: string | null): number {
  if (!date) {
    return 0;
  }

  const normalizedDate = date.trim();
  if (!normalizedDate) {
    return 0;
  }

  if (normalizedDate.includes('T')) {
    const parsed = Date.parse(normalizedDate);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  const datePrefix = normalizedDate.slice(0, 10);
  const normalizedTime =
    time && /^\d{2}:\d{2}/.test(time.trim()) ? time.trim().slice(0, 5) : '00:00';
  const parsed = Date.parse(`${datePrefix}T${normalizedTime}:00`);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  const fallback = Date.parse(normalizedDate);
  return Number.isNaN(fallback) ? 0 : fallback;
}

export function compareDescTimestamps(
  aPrimary: number,
  bPrimary: number,
  aTieBreaker = 0,
  bTieBreaker = 0,
): number {
  if (bPrimary !== aPrimary) {
    return bPrimary - aPrimary;
  }
  return bTieBreaker - aTieBreaker;
}

export function sortTasksDesc(tasks: readonly Task[]): Task[] {
  return [...tasks].sort((a, b) =>
    compareDescTimestamps(
      toSortTimestamp(a.dueDate, a.dueTime),
      toSortTimestamp(b.dueDate, b.dueTime),
      toSortTimestamp(a.createdAt),
      toSortTimestamp(b.createdAt),
    ),
  );
}

export function sortRemindersDesc(reminders: readonly Reminder[]): Reminder[] {
  return [...reminders].sort((a, b) =>
    compareDescTimestamps(
      toSortTimestamp(a.reminderDate, a.reminderTime),
      toSortTimestamp(b.reminderDate, b.reminderTime),
      toSortTimestamp(a.createdAt),
      toSortTimestamp(b.createdAt),
    ),
  );
}

export function sortRequestsDesc(requests: readonly Request[]): Request[] {
  return [...requests].sort((a, b) =>
    compareDescTimestamps(
      toSortTimestamp(a.createdAt),
      toSortTimestamp(b.createdAt),
      toSortTimestamp(a.dueDate),
      toSortTimestamp(b.dueDate),
    ),
  );
}

export function sortMeetingsDesc(meetings: readonly Meeting[]): Meeting[] {
  return [...meetings].sort((a, b) =>
    compareDescTimestamps(
      toSortTimestamp(a.meetingDate, a.startTime),
      toSortTimestamp(b.meetingDate, b.startTime),
      toSortTimestamp(a.createdAt),
      toSortTimestamp(b.createdAt),
    ),
  );
}
