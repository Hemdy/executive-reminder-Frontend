import { User } from '../../core/models/user.model';

export type ReminderPriority =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'URGENT';

export type ReminderRecurrence =
  | 'ONCE'
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'YEARLY'
  | 'CUSTOM';

export type ReminderStatus =
  | 'PENDING'
  | 'TRIGGERED'
  | 'COMPLETED'
  | 'DISMISSED'
  | 'CANCELLED';

export interface Reminder {
  id: string;

  title: string;
  description?: string;

  recipient: User;
  participants?: User[];
  createdBy: User;

  priority: ReminderPriority;
  category: string;

  reminderDate: string;
  reminderTime: string;

  recurrence: ReminderRecurrence;

  status: ReminderStatus;

  createdAt: string;
  updatedAt: string;

  commentsCount: number;
  attachmentsCount: number;
}

export interface CreateReminderRequest {
  title: string;
  description?: string;
  recipientId: string;
  participantIds?: string[];
  priority: ReminderPriority;
  category: string;
  reminderDate: string;
  reminderTime: string;
  recurrence: ReminderRecurrence;
}

export interface UpdateReminderRequest {
  title: string;
  description?: string;
  recipientId: string;
  participantIds?: string[];
  priority: ReminderPriority;
  category: string;
  reminderDate: string;
  reminderTime: string;
  recurrence: ReminderRecurrence;
  status: ReminderStatus;
}