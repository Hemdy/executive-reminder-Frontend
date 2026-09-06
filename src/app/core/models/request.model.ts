import { User } from '../../core/models/user.model';

export type RequestType =
  | 'GENERAL'
  | 'APPROVAL'
  | 'DECISION'
  | 'DOCUMENT_REVIEW'
  | 'INFORMATION'
  | 'MEETING'
  | 'EXPENSE'
  | 'OTHER';

export type RequestPriority =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'URGENT';

export type RequestStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'NEEDS_INFORMATION'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Request {
  id: string;

  title: string;
  description?: string;

  type: RequestType;
  priority: RequestPriority;

  requester: User;
  assignedTo: User;

  status: RequestStatus;

  dueDate?: string;

  createdAt: string;
  updatedAt: string;

  commentsCount: number;
  attachmentsCount: number;
}

export interface CreateRequestRequest {
  title: string;
  description?: string;
  type: RequestType;
  priority: RequestPriority;
  assignedToId: string;
  dueDate?: string;
}

export interface UpdateRequestRequest {
  title: string;
  description?: string;
  type: RequestType;
  priority: RequestPriority;
  assignedToId: string;
  dueDate?: string;
  status: RequestStatus;
}