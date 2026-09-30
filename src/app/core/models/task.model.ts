import { User } from '../../core/models/user.model';

export type TaskPriority =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'URGENT';

export type TaskStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Task {
  id: string;

  title: string;
  description?: string;

  assignedTo: User;
  participants?: Array<{ user: User }>;
  createdBy: User;

  priority: TaskPriority;
  category: string;

  dueDate: string;
  dueTime?: string;

  status: TaskStatus;

  createdAt: string;
  updatedAt: string;

  commentsCount: number;
  attachmentsCount: number;
  _count?: {
    comments: number;
    attachments: number;
  };
}

export interface TaskComment {
  id: string;
  body: string;
  createdAt: string;
  author: Pick<User, 'id' | 'title' | 'firstName' | 'lastName'>;
}

export interface TaskAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploader: Pick<User, 'id' | 'firstName' | 'lastName'>;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  assignedToId: string;
  participantIds?: string[];
  priority: TaskPriority;
  category: string;
  dueDate: string;
  dueTime?: string;
}

export interface UpdateTaskRequest {
  title: string;
  description?: string;
  assignedToId: string;
  participantIds?: string[];
  priority: TaskPriority;
  category: string;
  dueDate: string;
  dueTime?: string;
  status: TaskStatus;
}