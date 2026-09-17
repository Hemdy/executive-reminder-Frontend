import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { Notification, NotificationPriority, NotificationType } from '../models/notification.model';
import { API_BASE_URL } from '../config/api.config';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_BASE_URL}/notifications`;
  private readonly notificationsSignal = signal<Notification[]>([]);
  readonly notifications = this.notificationsSignal.asReadonly();
  readonly unreadNotifications = computed(() => this.notificationsSignal().filter(notification => !notification.isRead));
  readonly unreadCount = computed(() => this.unreadNotifications().length);
  readonly readNotifications = computed(() => this.notificationsSignal().filter(notification => notification.isRead));

  constructor() {
    this.loadNotifications().subscribe({ error: error => console.error('Unable to load notifications', error) });
  }

  getNotifications(): Notification[] { return this.notificationsSignal(); }
  getNotification(id: string): Notification | undefined { return this.notificationsSignal().find(notification => notification.id === id); }
  loadNotifications(): Observable<Notification[]> { return this.http.get<Notification[]>(this.apiUrl).pipe(tap(notifications => this.notificationsSignal.set(notifications))); }
  resourceRoute(notification: Notification): string | undefined {
    const referenceId = notification.referenceId ?? notification.sourceId;
    if (!referenceId) return notification.route;
    const resource = notification.resourceType
      ?? (notification.type.startsWith('TASK') ? 'task' : notification.type === 'REMINDER' ? 'reminder' : notification.type === 'MEETING' ? 'meeting' : undefined);
    if (resource === 'task') return `/tasks/${referenceId}`;
    if (resource === 'reminder') return `/reminders/${referenceId}`;
    if (resource === 'meeting') return `/meetings/${referenceId}`;
    return notification.route;
  }
  markAsRead(id: string): Observable<unknown> { return this.http.patch(`${this.apiUrl}/${id}/read`, {}).pipe(tap(() => this.setRead(id, true))); }
  markAsUnread(_id: string): Observable<unknown> { return this.http.patch(`${this.apiUrl}/${_id}/unread`, {}).pipe(tap(() => this.setRead(_id, false))); }
  markAllAsRead(): Observable<unknown> { return this.http.patch(`${this.apiUrl}/read-all`, {}).pipe(tap(() => this.notificationsSignal.update(notifications => notifications.map(notification => ({ ...notification, isRead: true }))))); }
  deleteNotification(_id: string): Observable<void> { return this.http.delete<void>(`${this.apiUrl}/${_id}`).pipe(tap(() => this.notificationsSignal.update(notifications => notifications.filter(notification => notification.id !== _id)))); }
  clearReadNotifications(): Observable<void> { return this.http.delete<void>(`${this.apiUrl}/read`).pipe(tap(() => this.notificationsSignal.update(notifications => notifications.filter(notification => !notification.isRead)))); }
  addNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Observable<Notification> { return this.http.post<Notification>(this.apiUrl, notification).pipe(tap(created => this.notificationsSignal.update(notifications => [created, ...notifications]))); }
  notify(title: string, message: string, type: NotificationType, priority: NotificationPriority = 'MEDIUM', route?: string, sourceId?: string): void {
    this.addNotification({ title, message, type, priority, isRead: false, route, sourceId }).subscribe({ error: error => console.error('Unable to create notification', error) });
  }
  getTypeLabel(type: NotificationType): string { return type.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase()); }
  getPriorityLabel(priority: NotificationPriority): string { return priority.charAt(0) + priority.slice(1).toLowerCase(); }
  private setRead(id: string, isRead: boolean): void { this.notificationsSignal.update(notifications => notifications.map(notification => notification.id === id ? { ...notification, isRead } : notification)); }
}
