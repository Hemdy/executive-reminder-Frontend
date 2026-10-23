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
  _count?: {
    comments: number;
    attachments: number;
  };
}

export interface ReminderComment {
  id: string;
  body: string;
  createdAt: string;
  author: Pick<User, 'id' | 'title' | 'firstName' | 'lastName'>;
}

export interface ReminderAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploader: Pick<User, 'id' | 'firstName' | 'lastName'>;
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