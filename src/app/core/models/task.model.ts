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
  participants?: User[];
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