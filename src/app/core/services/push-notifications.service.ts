import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { computed, DestroyRef, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwPush } from '@angular/service-worker';
import { Router } from '@angular/router';
import { catchError, EMPTY, finalize, from, of, switchMap, take } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AuthService } from './auth.service';

interface PushConfig {
  enabled: boolean;
  publicKey: string | null;
}

interface PushClickData {
  route?: unknown;
}

export interface PushPreferences {
  tasks: boolean;
  reminders: boolean;
  requests: boolean;
  meetings: boolean;
}

@Injectable({ providedIn: 'root' })
export class PushNotificationsService {
  private readonly http = inject(HttpClient);
  private readonly swPush = inject(SwPush);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly apiUrl = `${API_BASE_URL}/notifications/push`;
  private readonly config = signal<PushConfig | null>(null);
  readonly isConfigLoading = signal(false);

  readonly isSupported = signal(
    this.browser && this.swPush.isEnabled && typeof Notification !== 'undefined',
  );
  readonly isIosDevice = signal(false);
  readonly isStandalone = signal(false);
  readonly requiresIosInstall = computed(() =>
    this.isIosDevice() && !this.isStandalone()
  );
  readonly permission = signal<NotificationPermission>('default');
  readonly isSubscribed = signal(false);
  readonly isRegistered = signal(false);
  readonly isBusy = signal(false);
  readonly statusMessage = signal('');
  readonly statusError = signal('');
  readonly preferences = signal<PushPreferences>({
    tasks: true,
    reminders: true,
    requests: true,
    meetings: true,
  });
  readonly isLoadingPreferences = signal(false);
  readonly isSavingPreferences = signal(false);
  readonly preferencesError = signal('');
  readonly preferencesMessage = signal('');
  private registeredUserId: string | null = null;
  private reconcilingSubscriptionUserId: string | null = null;
  readonly canEnable = computed(() =>
    this.isSupported() &&
    this.permission() !== 'denied' &&
    (!this.isSubscribed() || !this.isRegistered())
  );

  constructor() {
    if (!this.browser) {
      return;
    }

    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIos = /iPad|iPhone|iPod/.test(userAgent) ||
      (/Macintosh/.test(userAgent) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
    const isStandalone = typeof window !== 'undefined' && (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
    this.isIosDevice.set(isIos);
    this.isStandalone.set(isStandalone);

    if (typeof Notification !== 'undefined') {
      this.permission.set(Notification.permission);
    }

    if (!this.isSupported()) {
      return;
    }

    if (this.permission() === 'denied') {
      this.statusError.set(
        'Notifications are blocked in browser settings. Allow them there to enable push notifications.',
      );
    }

    this.loadConfig();

    this.swPush.subscription.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(subscription => {
      this.isSubscribed.set(subscription !== null);
    });

    this.swPush.pushSubscriptionChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ newSubscription }) => {
        const userId = this.auth.currentUser()?.id;
        if (newSubscription && userId) {
          this.saveSubscription(newSubscription, userId);
        }
      });

    this.swPush.notificationClicks
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ notification }) => {
        const data = notification.data as PushClickData | undefined;
        if (typeof data?.route === 'string' && data.route.startsWith('/')) {
          void this.router.navigateByUrl(data.route);
        }
      });

    effect(() => {
      const userId = this.auth.currentUser()?.id ?? null;
      if (userId === this.registeredUserId) {
        return;
      }
      this.registeredUserId = userId;
      this.isRegistered.set(false);
      if (!userId) {
        this.preferences.set({ tasks: true, reminders: true, requests: true, meetings: true });
        this.preferencesError.set('');
        this.preferencesMessage.set('');
        return;
      }
      this.loadPreferences(userId);
      this.registerExistingSubscription(userId);
    });
  }

  enable(): void {
    if (!this.canEnable() || this.isBusy()) {
      return;
    }

    this.isBusy.set(true);
    this.statusMessage.set('');
    this.statusError.set('');
    const config = this.config();
    if (!config) {
      this.isBusy.set(false);
      this.statusError.set('Unable to check push notification availability. Please try again.');
      this.loadConfig();
      return;
    }
    if (!config.enabled || !config.publicKey) {
      this.isBusy.set(false);
      this.statusError.set('Push notifications are not configured on the server yet.');
      return;
    }
    const publicKey = config.publicKey;
    const subscription$ = this.isSubscribed()
      ? this.swPush.subscription.pipe(
        take(1),
        switchMap(subscription => subscription
          ? of(subscription)
          : from(this.swPush.requestSubscription({ serverPublicKey: publicKey }))
        ),
      )
      : from(this.swPush.requestSubscription({ serverPublicKey: publicKey }));

    subscription$.pipe(
      switchMap(subscription => this.http.post<void>(
        `${this.apiUrl}/subscription`,
        subscription.toJSON(),
      )),
      catchError(error => {
        console.error('Unable to enable push notifications', error);
        this.refreshPermission();
        this.statusError.set(
          this.permission() === 'denied'
            ? 'Notifications are blocked in browser settings. Allow them there and try again.'
            : 'Unable to enable push notifications. Please try again.',
        );
        return EMPTY;
      }),
      finalize(() => this.isBusy.set(false)),
    ).subscribe(() => {
      this.refreshPermission();
      this.isSubscribed.set(true);
      this.isRegistered.set(true);
      this.statusMessage.set('Push notifications are enabled on this device.');
    });
  }

  disable(): void {
    if (!this.isSubscribed() || this.isBusy()) {
      return;
    }
    this.isBusy.set(true);
    this.statusMessage.set('');
    this.statusError.set('');
    this.swPush.subscription.pipe(
      take(1),
      switchMap(subscription => {
        if (!subscription) {
          return EMPTY;
        }
        return this.http.delete<void>(`${this.apiUrl}/subscription`, {
          body: { endpoint: subscription.endpoint },
        }).pipe(
          switchMap(() => from(this.swPush.unsubscribe())),
        );
      }),
      catchError(error => {
        console.error('Unable to disable push notifications', error);
        this.statusError.set('Unable to disable push notifications. Please try again.');
        return EMPTY;
      }),
      finalize(() => this.isBusy.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.isSubscribed.set(false);
      this.isRegistered.set(false);
      this.statusMessage.set('Push notifications are disabled on this device.');
    });
  }

  updatePreferences(updates: Partial<PushPreferences>): void {
    if (!this.auth.currentUser() || this.isSavingPreferences()) {
      return;
    }
    this.isSavingPreferences.set(true);
    this.preferencesError.set('');
    this.preferencesMessage.set('');
    this.http.patch<PushPreferences>(`${this.apiUrl}/preferences`, updates).pipe(
      catchError(error => {
        console.error('Unable to update push notification preferences', error);
        this.preferencesError.set('Unable to save notification preferences. Please try again.');
        return EMPTY;
      }),
      finalize(() => this.isSavingPreferences.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(preferences => {
      this.preferences.set(preferences);
      this.preferencesMessage.set('Notification preferences saved.');
    });
  }

  private saveSubscription(subscription: PushSubscription, userId: string): void {
    this.http.post<void>(`${this.apiUrl}/subscription`, subscription.toJSON()).pipe(
      catchError(error => {
        console.error('Unable to refresh push subscription', error);
        this.statusError.set('Unable to register this device for push notifications. Please try again.');
        return EMPTY;
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      if (this.auth.currentUser()?.id === userId) {
        this.isRegistered.set(true);
      }
    });
  }

  private loadConfig(): void {
    if (this.isConfigLoading()) {
      return;
    }
    this.isConfigLoading.set(true);
    this.http.get<PushConfig>(`${this.apiUrl}/config`).pipe(
      catchError(error => {
        console.error('Unable to load push notification configuration', error);
        this.statusError.set('Unable to check push notification availability.');
        return EMPTY;
      }),
      finalize(() => this.isConfigLoading.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(config => {
      this.config.set(config);
      this.statusError.set(
        !config.enabled
          ? 'Push notifications are not configured on the server yet.'
          : this.permission() === 'denied'
            ? 'Notifications are blocked in browser settings. Allow them there to enable push notifications.'
            : '',
      );
      const userId = this.auth.currentUser()?.id;
      if (userId && config.enabled && config.publicKey) {
        this.registerExistingSubscription(userId);
      }
    });
  }

  private registerExistingSubscription(userId: string): void {
    const config = this.config();
    if (!config?.enabled || !config.publicKey || this.permission() !== 'granted') {
      return;
    }
    const publicKey = config.publicKey;

    this.swPush.subscription.pipe(
      take(1),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(subscription => {
      if (!subscription) {
        return;
      }
      if (this.subscriptionUsesKey(subscription, publicKey)) {
        this.saveSubscription(subscription, userId);
        return;
      }
      if (this.reconcilingSubscriptionUserId === userId) {
        return;
      }

      this.reconcilingSubscriptionUserId = userId;
      this.isBusy.set(true);
      this.statusError.set('');
      this.http.delete<void>(`${this.apiUrl}/subscription`, {
        body: { endpoint: subscription.endpoint },
      }).pipe(
        switchMap(() => from(this.swPush.unsubscribe())),
        switchMap(() => from(this.swPush.requestSubscription({
          serverPublicKey: publicKey,
        }))),
        switchMap(newSubscription => this.http.post<void>(
          `${this.apiUrl}/subscription`,
          newSubscription.toJSON(),
        )),
        catchError(error => {
          console.error('Unable to refresh push subscription for the current VAPID key', error);
          this.statusError.set(
            'This device needs to be re-registered for push notifications. Please disable and enable push notifications again.',
          );
          return EMPTY;
        }),
        finalize(() => {
          this.isBusy.set(false);
          if (this.reconcilingSubscriptionUserId === userId) {
            this.reconcilingSubscriptionUserId = null;
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(() => {
        if (this.auth.currentUser()?.id === userId) {
          this.isSubscribed.set(true);
          this.isRegistered.set(true);
          this.statusMessage.set('Push notifications are enabled on this device.');
        }
      });
    });
  }

  private subscriptionUsesKey(
  subscription: PushSubscription,
  publicKey: string,
): boolean {
  const currentKey = subscription.options.applicationServerKey;

  if (!currentKey) {
    return false;
  }

  try {
    const normalizedKey = publicKey
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const paddedKey = normalizedKey.padEnd(
      Math.ceil(normalizedKey.length / 4) * 4,
      '=',
    );

    const expectedKey = Uint8Array.from(
      atob(paddedKey),
      character => character.charCodeAt(0),
    );

    const actualKey = new Uint8Array(currentKey);

    return (
      actualKey.length === expectedKey.length &&
      actualKey.every((value, index) => value === expectedKey[index])
    );
  } catch {
    return false;
  }
}

  private loadPreferences(userId: string): void {
    this.isLoadingPreferences.set(true);
    this.http.get<PushPreferences>(`${this.apiUrl}/preferences`).pipe(
      catchError(error => {
        console.error('Unable to load push notification preferences', error);
        this.preferencesError.set('Unable to load notification preferences.');
        return EMPTY;
      }),
      finalize(() => this.isLoadingPreferences.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(preferences => {
      if (this.auth.currentUser()?.id === userId) {
        this.preferences.set(preferences);
      }
    });
  }

  private refreshPermission(): void {
    if (this.browser && typeof Notification !== 'undefined') {
      this.permission.set(Notification.permission);
    }
  }


  


}


