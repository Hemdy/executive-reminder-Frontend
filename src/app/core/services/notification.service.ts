import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import {
  catchError,
  EMPTY,
  finalize,
  Observable,
  of,
  Subscription,
  takeUntil,
  tap,
  throwError,
} from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
  Notification,
  NotificationPriority,
  NotificationType,
} from '../models/notification.model';
import {
  bindAuthSessionLifecycle,
  currentAuthSessionVersion,
  isSameAuthSession,
  sessionEndedStream,
} from '../utils/session-scope';
import { AuthService } from './auth.service';

export const NOTIFICATION_POLL_INTERVAL_MS = 30_000;
const MIN_FOCUS_SYNC_INTERVAL_MS = 5_000;

export interface LoadNotificationsOptions {
  background?: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly apiUrl = `${API_BASE_URL}/notifications`;

  private readonly notificationsSignal = signal<Notification[]>([]);
  readonly notifications = this.notificationsSignal.asReadonly();
  readonly listLoading = signal(false);
  readonly listError = signal('');
  readonly unreadNotifications = computed(() =>
    this.notificationsSignal().filter(notification => !notification.isRead),
  );
  readonly unreadCount = computed(() => this.unreadNotifications().length);
  readonly readNotifications = computed(() =>
    this.notificationsSignal().filter(notification => notification.isRead),
  );

  private loadSequence = 0;
  private lastSyncAt = 0;
  private activeLoadSubscription: Subscription | null = null;
  private pollTimer: number | null = null;
  private removeSyncListeners: (() => void) | null = null;

  constructor() {
    bindAuthSessionLifecycle(this.auth, this.destroyRef, {
      onClear: () => this.resetState(),
      onUserChange: userId => {
        this.resetState();
        if (!userId) {
          return;
        }
        this.startSync();
        this.activeLoadSubscription = this.loadNotifications().subscribe({
          error: error => console.error('Unable to load notifications', error),
        });
      },
    });

    this.destroyRef.onDestroy(() => {
      this.stopSync();
      this.cancelPendingLoad();
    });
  }

  getNotifications(): Notification[] {
    return this.notificationsSignal();
  }

  getNotification(id: string): Notification | undefined {
    return this.notificationsSignal().find(notification => notification.id === id);
  }

  loadNotifications(options: LoadNotificationsOptions = {}): Observable<Notification[]> {
    const background = options.background ?? false;
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = this.currentSessionVersion();

    if (!expectedUserId) {
      this.notificationsSignal.set([]);
      this.listError.set('');
      this.listLoading.set(false);
      return of([]);
    }

    const requestSeq = ++this.loadSequence;
    if (!background) {
      this.listLoading.set(true);
      this.listError.set('');
    }

    return this.http.get<Notification[]>(this.apiUrl).pipe(
      takeUntil(this.sessionEndedObservable()),
      tap(notifications => {
        if (!this.isCurrentRequest(requestSeq, expectedUserId, expectedSession)) {
          return;
        }
        this.notificationsSignal.set(notifications);
        this.listError.set('');
        this.lastSyncAt = Date.now();
      }),
      catchError(error => {
        if (!this.isCurrentRequest(requestSeq, expectedUserId, expectedSession)) {
          return EMPTY;
        }
        if (!background || this.notificationsSignal().length === 0) {
          this.listError.set('Unable to load notifications. Please try again.');
        }
        return throwError(() => error);
      }),
      finalize(() => {
        if (!background && this.isCurrentRequest(requestSeq, expectedUserId, expectedSession)) {
          this.listLoading.set(false);
        }
      }),
    );
  }

  syncNotifications(force = false): void {
    const userId = this.auth.currentUser()?.id ?? null;
    if (!userId) {
      return;
    }

    if (this.browser && this.document.visibilityState === 'hidden' && !force) {
      return;
    }

    if (!force && Date.now() - this.lastSyncAt < MIN_FOCUS_SYNC_INTERVAL_MS) {
      return;
    }

    this.cancelPendingLoad();
    this.activeLoadSubscription = this.loadNotifications({ background: true }).subscribe({
      error: error => console.warn('Unable to refresh notifications', error),
    });
  }

  resourceRoute(notification: Notification): string | undefined {
    if (notification.route?.startsWith('/')) return notification.route;
    const referenceId = notification.referenceId ?? notification.sourceId;
    if (!referenceId) return notification.route;
    const resource =
      notification.resourceType ??
      (notification.type.startsWith('TASK')
        ? 'task'
        : notification.type === 'REMINDER'
          ? 'reminder'
          : notification.type === 'MEETING'
            ? 'meeting'
            : notification.type === 'REQUEST'
              ? 'request'
              : undefined);
    if (resource === 'task') return `/tasks/${referenceId}`;
    if (resource === 'reminder') return `/reminders/${referenceId}`;
    if (resource === 'meeting') return `/meetings/${referenceId}`;
    if (resource === 'request') return `/requests/${referenceId}`;
    return notification.route;
  }

  markAsRead(id: string): Observable<unknown> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = this.currentSessionVersion();
    return this.http.patch(`${this.apiUrl}/${id}/read`, {}).pipe(
      takeUntil(this.sessionEndedObservable()),
      tap(() => {
        if (this.isSameSession(expectedUserId, expectedSession)) {
          this.setRead(id, true);
        }
      }),
    );
  }

  markAsUnread(id: string): Observable<unknown> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = this.currentSessionVersion();
    return this.http.patch(`${this.apiUrl}/${id}/unread`, {}).pipe(
      takeUntil(this.sessionEndedObservable()),
      tap(() => {
        if (this.isSameSession(expectedUserId, expectedSession)) {
          this.setRead(id, false);
        }
      }),
    );
  }

  markAllAsRead(): Observable<unknown> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = this.currentSessionVersion();
    return this.http.patch(`${this.apiUrl}/read-all`, {}).pipe(
      takeUntil(this.sessionEndedObservable()),
      tap(() => {
        if (this.isSameSession(expectedUserId, expectedSession)) {
          this.notificationsSignal.update(notifications =>
            notifications.map(notification => ({ ...notification, isRead: true })),
          );
        }
      }),
    );
  }

  deleteNotification(id: string): Observable<void> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = this.currentSessionVersion();
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      takeUntil(this.sessionEndedObservable()),
      tap(() => {
        if (this.isSameSession(expectedUserId, expectedSession)) {
          this.notificationsSignal.update(notifications =>
            notifications.filter(notification => notification.id !== id),
          );
        }
      }),
    );
  }

  clearReadNotifications(): Observable<void> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = this.currentSessionVersion();
    return this.http.delete<void>(`${this.apiUrl}/read`).pipe(
      takeUntil(this.sessionEndedObservable()),
      tap(() => {
        if (this.isSameSession(expectedUserId, expectedSession)) {
          this.notificationsSignal.update(notifications =>
            notifications.filter(notification => !notification.isRead),
          );
        }
      }),
    );
  }

  addNotification(notification: Omit<Notification, 'id' | 'createdAt'>): Observable<Notification> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = this.currentSessionVersion();
    return this.http.post<Notification>(this.apiUrl, notification).pipe(
      takeUntil(this.sessionEndedObservable()),
      tap(created => {
        if (this.isSameSession(expectedUserId, expectedSession)) {
          this.notificationsSignal.update(notifications => [created, ...notifications]);
        }
      }),
    );
  }

  notify(
    title: string,
    message: string,
    type: NotificationType,
    priority: NotificationPriority = 'MEDIUM',
    route?: string,
    sourceId?: string,
  ): void {
    this.addNotification({
      title,
      message,
      type,
      priority,
      isRead: false,
      route,
      sourceId,
    }).subscribe({ error: error => console.error('Unable to create notification', error) });
  }

  getTypeLabel(type: NotificationType): string {
    return type.replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());
  }

  getPriorityLabel(priority: NotificationPriority): string {
    return priority.charAt(0) + priority.slice(1).toLowerCase();
  }

  private setRead(id: string, isRead: boolean): void {
    this.notificationsSignal.update(notifications =>
      notifications.map(notification =>
        notification.id === id ? { ...notification, isRead } : notification,
      ),
    );
  }

  private resetState(): void {
    this.loadSequence += 1;
    this.lastSyncAt = 0;
    this.stopSync();
    this.cancelPendingLoad();
    this.notificationsSignal.set([]);
    this.listError.set('');
    this.listLoading.set(false);
  }

  private cancelPendingLoad(): void {
    this.activeLoadSubscription?.unsubscribe();
    this.activeLoadSubscription = null;
  }

  private startSync(): void {
    this.stopSync();
    if (!this.browser) {
      return;
    }

    const view = this.document.defaultView;
    if (!view) {
      return;
    }

    this.pollTimer = view.setInterval(() => {
      this.syncNotifications();
    }, NOTIFICATION_POLL_INTERVAL_MS);

    const onVisibilityChange = (): void => {
      if (this.document.visibilityState === 'visible') {
        this.syncNotifications();
      }
    };
    const onWindowFocus = (): void => {
      this.syncNotifications();
    };
    const onOnline = (): void => {
      this.syncNotifications(true);
    };

    this.document.addEventListener('visibilitychange', onVisibilityChange);
    view.addEventListener('focus', onWindowFocus);
    view.addEventListener('online', onOnline);

    this.removeSyncListeners = () => {
      this.document.removeEventListener('visibilitychange', onVisibilityChange);
      view.removeEventListener('focus', onWindowFocus);
      view.removeEventListener('online', onOnline);
      this.removeSyncListeners = null;
    };
  }

  private stopSync(): void {
    if (this.pollTimer !== null) {
      this.document.defaultView?.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.removeSyncListeners?.();
  }

  private isCurrentRequest(
    requestSeq: number,
    expectedUserId: string | null,
    expectedSession: number,
  ): boolean {
    return requestSeq === this.loadSequence && this.isSameSession(expectedUserId, expectedSession);
  }

  private isSameSession(expectedUserId: string | null, expectedSession: number): boolean {
    return isSameAuthSession(this.auth, expectedUserId, expectedSession);
  }

  private currentSessionVersion(): number {
    return currentAuthSessionVersion(this.auth);
  }

  private sessionEndedObservable(): Observable<void> {
    return sessionEndedStream(this.auth);
  }
}
