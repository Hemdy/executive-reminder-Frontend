





import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';

import { DatePipe } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

import {
  Notification,
  NotificationType
} from '../../../../core/models/notification.model';

import { NotificationService } from '../../../../core/services/notification.service';

type NotificationFilter =
  | 'ALL'
  | 'UNREAD'
  | 'READ';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [RouterModule, DatePipe],
  templateUrl: './notification-center.html',
  styleUrl: './notification-center.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class NotificationCenter {





  private readonly notificationService =
    inject(NotificationService);

  private readonly router = inject(Router);

  readonly filter =
    signal<NotificationFilter>('ALL');

  readonly notifications =
    this.notificationService.notifications;

  readonly unreadCount =
    this.notificationService.unreadCount;

  readonly filteredNotifications = computed(() => {
    const currentFilter = this.filter();

    const notifications =
      this.notifications();

    if (currentFilter === 'UNREAD') {
      return notifications.filter(
        notification => !notification.isRead
      );
    }

    if (currentFilter === 'READ') {
      return notifications.filter(
        notification => notification.isRead
      );
    }

    return notifications;
  });

  readonly hasNotifications = computed(
    () => this.filteredNotifications().length > 0
  );

  setFilter(filter: NotificationFilter): void {
    this.filter.set(filter);
  }

  markAsRead(notification: Notification): void {
    this.notificationService.markAsRead(
      notification.id
    );
  }

  markAsUnread(notification: Notification): void {
    this.notificationService.markAsUnread(
      notification.id
    );
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead();
  }

  deleteNotification(
    notification: Notification
  ): void {
    this.notificationService.deleteNotification(
      notification.id
    );
  }

  clearReadNotifications(): void {
    this.notificationService.clearReadNotifications();
  }

  openNotification(
    notification: Notification
  ): void {
    if (!notification.isRead) {
      this.notificationService.markAsRead(
        notification.id
      );
    }

    if (notification.route) {
      this.router.navigateByUrl(
        notification.route
      );
    }
  }

  getIcon(type: NotificationType): string {
    switch (type) {
      case 'TASK_ASSIGNED':
        return '✓';

      case 'TASK_DUE':
        return '◷';

      case 'TASK_OVERDUE':
        return '!';

      case 'REMINDER':
        return '◴';

      case 'REQUEST':
        return '▣';

      case 'MEETING':
        return '▦';

      case 'COMMENT':
        return '◌';

      case 'SYSTEM':
        return '⚙';

      default:
        return '•';
    }
  }

  getTypeLabel(type: NotificationType): string {
    return this.notificationService.getTypeLabel(type);
  }

  getPriorityClass(
    priority: Notification['priority']
  ): string {
    return `priority-${priority.toLowerCase()}`;
  }

  getTypeClass(
    type: NotificationType
  ): string {
    return `notification-${type.toLowerCase()}`;
  }

  trackByNotification(
    _: number,
    notification: Notification
  ): string {
    return notification.id;
  }
}