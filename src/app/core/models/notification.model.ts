export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_DUE'
  | 'TASK_OVERDUE'
  | 'REMINDER'
  | 'REQUEST'
  | 'MEETING'
  | 'COMMENT'
  | 'SYSTEM';

export type NotificationPriority =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'URGENT';

export interface Notification {
  id: string;

  title: string;

  message: string;

  type: NotificationType;

  priority: NotificationPriority;

  isRead: boolean;

  createdAt: string;

  sourceId?: string;

  route?: string;
}