import {
  Injectable,
  computed,
  signal
} from '@angular/core';

import {
  Notification,
  NotificationPriority,
  NotificationType
} from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly notificationsSignal =
    signal<Notification[]>([]);

  readonly notifications =
    this.notificationsSignal.asReadonly();

  readonly unreadNotifications = computed(() =>
    this.notificationsSignal().filter(
      notification => !notification.isRead
    )
  );

  readonly unreadCount = computed(() =>
    this.unreadNotifications().length
  );

  readonly readNotifications = computed(() =>
    this.notificationsSignal().filter(
      notification => notification.isRead
    )
  );

  constructor() {
    this.loadMockNotifications();
  }

  getNotifications(): Notification[] {
    return this.notificationsSignal();
  }

  getNotification(id: string): Notification | undefined {
    return this.notificationsSignal().find(
      notification => notification.id === id
    );
  }

  markAsRead(id: string): void {
    this.notificationsSignal.update(notifications =>
      notifications.map(notification =>
        notification.id === id
          ? {
              ...notification,
              isRead: true
            }
          : notification
      )
    );
  }

  markAsUnread(id: string): void {
    this.notificationsSignal.update(notifications =>
      notifications.map(notification =>
        notification.id === id
          ? {
              ...notification,
              isRead: false
            }
          : notification
      )
    );
  }

  markAllAsRead(): void {
    this.notificationsSignal.update(notifications =>
      notifications.map(notification => ({
        ...notification,
        isRead: true
      }))
    );
  }

  deleteNotification(id: string): void {
    this.notificationsSignal.update(notifications =>
      notifications.filter(
        notification => notification.id !== id
      )
    );
  }

  clearReadNotifications(): void {
    this.notificationsSignal.update(notifications =>
      notifications.filter(
        notification => !notification.isRead
      )
    );
  }

  addNotification(
    notification: Omit<Notification, 'id' | 'createdAt'>
  ): void {
    const newNotification: Notification = {
      ...notification,
      id: this.generateId(),
      createdAt: new Date().toISOString()
    };

    this.notificationsSignal.update(notifications => [
      newNotification,
      ...notifications
    ]);
  }

  notify(
    title: string,
    message: string,
    type: NotificationType,
    priority: NotificationPriority = 'MEDIUM',
    route?: string,
    sourceId?: string
  ): void {
    this.addNotification({
      title,
      message,
      type,
      priority,
      isRead: false,
      route,
      sourceId
    });
  }

  getTypeLabel(type: NotificationType): string {
    switch (type) {
      case 'TASK_ASSIGNED':
        return 'Task Assigned';

      case 'TASK_DUE':
        return 'Task Due';

      case 'TASK_OVERDUE':
        return 'Task Overdue';

      case 'REMINDER':
        return 'Reminder';

      case 'REQUEST':
        return 'Request';

      case 'MEETING':
        return 'Meeting';

      case 'COMMENT':
        return 'Comment';

      case 'SYSTEM':
        return 'System';

      default:
        return 'Notification';
    }
  }

  getPriorityLabel(
    priority: NotificationPriority
  ): string {
    return priority.charAt(0) +
      priority.slice(1).toLowerCase();
  }

  private generateId(): string {
    return `notification-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
  }

  private loadMockNotifications(): void {
    const now = new Date();

    const notifications: Notification[] = [
      {
        id: 'notification-1',
        title: 'Urgent approval required',
        message:
          'Laptop Purchase Approval is waiting for your decision.',
        type: 'REQUEST',
        priority: 'URGENT',
        isRead: false,
        createdAt: this.subtractMinutes(now, 8),
        sourceId: 'request-1',
        route: '/requests/request-1'
      },
      {
        id: 'notification-2',
        title: 'Meeting starting soon',
        message:
          'Executive Board Meeting starts in 30 minutes.',
        type: 'MEETING',
        priority: 'HIGH',
        isRead: false,
        createdAt: this.subtractMinutes(now, 25),
        sourceId: 'meeting-1',
        route: '/meetings/meeting-1'
      },
      {
        id: 'notification-3',
        title: 'Reminder triggered',
        message:
          'Daily Executive Briefing reminder has been triggered.',
        type: 'REMINDER',
        priority: 'URGENT',
        isRead: false,
        createdAt: this.subtractMinutes(now, 50),
        sourceId: 'reminder-2',
        route: '/reminders/reminder-2'
      },
      {
        id: 'notification-4',
        title: 'Task overdue',
        message:
          'Q3 Financial Report is overdue.',
        type: 'TASK_OVERDUE',
        priority: 'HIGH',
        isRead: false,
        createdAt: this.subtractHours(now, 2),
        sourceId: 'task-2',
        route: '/tasks/task-2'
      },
      {
        id: 'notification-5',
        title: 'New task assigned',
        message:
          'You have been assigned a new Operations task.',
        type: 'TASK_ASSIGNED',
        priority: 'MEDIUM',
        isRead: true,
        createdAt: this.subtractHours(now, 4),
        sourceId: 'task-3',
        route: '/tasks/task-3'
      },
      {
        id: 'notification-6',
        title: 'New comment',
        message:
          'Sarah Williams commented on Budget Proposal Review.',
        type: 'COMMENT',
        priority: 'LOW',
        isRead: true,
        createdAt: this.subtractHours(now, 7),
        sourceId: 'meeting-2',
        route: '/meetings/meeting-2'
      },
      {
        id: 'notification-7',
        title: 'System update',
        message:
          'Your ExecutiveTrack workspace has been updated.',
        type: 'SYSTEM',
        priority: 'LOW',
        isRead: true,
        createdAt: this.subtractDays(now, 1)
      }
    ];

    this.notificationsSignal.set(notifications);
  }

  private subtractMinutes(
    date: Date,
    minutes: number
  ): string {
    return new Date(
      date.getTime() - minutes * 60_000
    ).toISOString();
  }

  private subtractHours(
    date: Date,
    hours: number
  ): string {
    return new Date(
      date.getTime() - hours * 3_600_000
    ).toISOString();
  }

  private subtractDays(
    date: Date,
    days: number
  ): string {
    return new Date(
      date.getTime() - days * 86_400_000
    ).toISOString();
  }
}