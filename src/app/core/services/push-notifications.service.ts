import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  Injector,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { catchError, EMPTY, finalize, firstValueFrom, from, of, take, timeout } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AuthService } from './auth.service';
import { NotificationService } from './notification.service';

interface PushConfig {
  enabled: boolean;
  publicKey: string | null;
  reason?: string | null;
}

interface PushClickData {
  route?: unknown;
}

export interface TestPushResult {
  sent: boolean;
  notificationId: string;
  deviceCount: number;
  deliveries: Array<{
    deviceType: string;
    status: string;
    httpStatus?: number | null;
    errorDetails?: string | null;
  }>;
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
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly apiUrl = `${API_BASE_URL}/notifications/push`;
  private readonly config = signal<PushConfig | null>(null);
  readonly isConfigLoading = signal(false);

  readonly isIosDevice = signal(false);
  readonly isStandalone = signal(false);
  readonly requiresIosInstall = computed(() => this.isIosDevice() && !this.isStandalone());
  readonly isSupported = signal(
    this.browser && this.swPush.isEnabled && typeof Notification !== 'undefined',
  );
  readonly permission = signal<NotificationPermission>('default');
  readonly isSubscribed = signal(false);
  readonly isRegistered = signal(false);
  readonly isBusy = signal(false);
  readonly isTesting = signal(false);
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
  private isSyncingExistingSubscription = false;

  readonly canEnable = computed(
    () =>
      this.isSupported() &&
      !this.requiresIosInstall() &&
      this.permission() !== 'denied' &&
      (!this.isSubscribed() || !this.isRegistered()),
  );

  constructor() {
    if (!this.browser) {
      return;
    }

    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const isIos =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (/Macintosh/.test(userAgent) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
    const isStandalone =
      typeof window !== 'undefined' &&
      (typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)').matches
        : false ||
          (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
    const standaloneFlag =
      isStandalone ||
      (typeof window !== 'undefined' &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
    this.isIosDevice.set(isIos);
    this.isStandalone.set(standaloneFlag);

    if (typeof Notification !== 'undefined') {
      this.permission.set(Notification.permission);
    }

    if (!this.isSupported() || this.requiresIosInstall()) {
      return;
    }

    if (this.permission() === 'denied') {
      this.statusError.set(
        'Notifications are blocked in browser settings. To enable them, click the lock or settings icon in your address bar and change Notifications to "Allow".',
      );
    }

    this.loadConfig();
    this.syncInitialSubscriptionState();

    this.swPush.subscription.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(subscription => {
      this.isSubscribed.set(subscription !== null);
    });

    this.swPush.messages?.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.refreshInAppNotifications();
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
      void this.registerExistingSubscription(userId);
    });
  }

  async enable(): Promise<void> {
    if (!this.canEnable() || this.isBusy()) {
      return;
    }

    this.isBusy.set(true);
    this.statusMessage.set('');
    this.statusError.set('');

    try {
      // 1. Request permission synchronously inside the click gesture (required on iOS WebKit & Safari)
      if (this.browser && typeof Notification !== 'undefined') {
        if (Notification.permission === 'default') {
          try {
            const perm = await Notification.requestPermission();
            this.permission.set(perm);
            if (perm !== 'granted') {
              this.statusError.set(
                perm === 'denied'
                  ? 'Notifications were denied. Allow them in your browser or iOS/Android app settings to enable alerts.'
                  : 'Notification permission prompt was dismissed.',
              );
              return;
            }
          } catch (error) {
            console.warn('Notification.requestPermission error', error);
          }
        } else if (Notification.permission === 'denied') {
          this.refreshPermission();
          this.statusError.set(
            'Notifications are blocked in browser settings. Please allow notifications in site settings and try again.',
          );
          return;
        }
      }

      // 2. Ensure VAPID config is loaded
      let config = this.config();
      if (!config) {
        try {
          config = await firstValueFrom(this.http.get<PushConfig>(`${this.apiUrl}/config`));
          this.config.set(config);
        } catch {
          this.statusError.set(
            'Unable to retrieve push notification server configuration. Please try again.',
          );
          return;
        }
      }

      if (!config?.enabled || !config.publicKey) {
        this.statusError.set(this.notConfiguredMessage(config));
        return;
      }

      const publicKey = config.publicKey;

      // 3. Read current subscription & rotate if VAPID key changed
      let currentSub = await this.getCurrentSubscription();
      if (currentSub && !this.subscriptionUsesKey(currentSub, publicKey)) {
        await this.unsubscribeBrowser(currentSub);
        currentSub = null;
      }

      // 4. Create fresh subscription if needed (with native ServiceWorkerRegistration fallback
      //    when navigator.serviceWorker.controller is null on first PWA launch or hard refresh)
      const subscription = currentSub || (await this.requestBrowserSubscription(publicKey));

      // 5. Persist sanitized subscription payload to backend
      await firstValueFrom(
        this.http.post<void>(`${this.apiUrl}/subscription`, this.serializeSubscription(subscription)),
      );

      this.refreshPermission();
      this.isSubscribed.set(true);
      this.isRegistered.set(true);
      this.statusMessage.set('Push notifications are enabled on this device.');
    } catch (error) {
      console.error('Unable to enable push notifications', error);
      this.refreshPermission();
      this.statusError.set(
        this.permission() === 'denied'
          ? 'Notifications are blocked in browser settings. Allow them there and try again.'
          : 'Unable to enable push notifications. Please check your browser permissions and try again.',
      );
    } finally {
      this.isBusy.set(false);
    }
  }

  async disable(): Promise<void> {
    if (this.isBusy()) {
      return;
    }
    this.isBusy.set(true);
    this.statusMessage.set('');
    this.statusError.set('');

    try {
      const subscription = await this.getCurrentSubscription();
      if (subscription) {
        await firstValueFrom(
          this.http
            .delete<void>(`${this.apiUrl}/subscription`, {
              body: { endpoint: subscription.endpoint },
            })
            .pipe(
              catchError(err => {
                console.warn(
                  'Backend delete subscription error (proceeding with browser unsubscribe)',
                  err,
                );
                return of(null);
              }),
            ),
        );
        await this.unsubscribeBrowser(subscription);
      }

      this.isSubscribed.set(false);
      this.isRegistered.set(false);
      this.statusMessage.set('Push notifications are disabled on this device.');
    } catch (error) {
      console.error('Unable to disable push notifications', error);
      this.statusError.set('Unable to disable push notifications. Please try again.');
    } finally {
      this.isBusy.set(false);
    }
  }

  async sendTestNotification(delaySeconds = 0): Promise<void> {
    if (this.isTesting() || this.isBusy()) {
      return;
    }
    this.isTesting.set(true);
    this.statusError.set('');
    this.statusMessage.set(
      delaySeconds > 0
        ? `Sending test alert in ${delaySeconds}s — lock your screen or switch apps now to verify background tray display...`
        : 'Sending test push notification...',
    );

    try {
      const res = await firstValueFrom(
        this.http.post<TestPushResult>(`${this.apiUrl}/test`, { delaySeconds }),
      );
      if (res.sent) {
        const devices = res.deliveries
          .filter(d => d.status === 'SENT')
          .map(d => d.deviceType)
          .join(', ');
        this.statusMessage.set(
          `Test push delivered (${devices || 'device'}). Check your native notification tray.`,
        );
        this.refreshInAppNotifications();
      } else {
        const errDetail = res.deliveries.find(d => d.errorDetails)?.errorDetails;
        this.statusMessage.set('');
        this.statusError.set(
          errDetail
            ? `Test push failed: ${errDetail}`
            : 'Test push could not be delivered. Try disabling and re-enabling device notifications.',
        );
      }
    } catch (error: unknown) {
      this.statusMessage.set('');
      const apiMsg =
        typeof error === 'object' &&
        error !== null &&
        'error' in error &&
        typeof (error as { error?: { message?: unknown } }).error?.message === 'string'
          ? (error as { error: { message: string } }).error.message
          : null;
      this.statusError.set(apiMsg || 'Unable to send test push notification.');
    } finally {
      this.isTesting.set(false);
    }
  }

  updatePreferences(updates: Partial<PushPreferences>): void {
    if (!this.auth.currentUser() || this.isSavingPreferences()) {
      return;
    }
    this.isSavingPreferences.set(true);
    this.preferencesError.set('');
    this.preferencesMessage.set('');
    this.http
      .patch<PushPreferences>(`${this.apiUrl}/preferences`, updates)
      .pipe(
        catchError(error => {
          console.error('Unable to update push notification preferences', error);
          this.preferencesError.set('Unable to save notification preferences. Please try again.');
          return EMPTY;
        }),
        finalize(() => this.isSavingPreferences.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(preferences => {
        this.preferences.set(preferences);
        this.preferencesMessage.set('Notification preferences saved.');
      });
  }

  private serializeSubscription(subscription: PushSubscription) {
    const json = subscription.toJSON();
    return {
      endpoint: subscription.endpoint,
      expirationTime: subscription.expirationTime ?? null,
      keys: {
        p256dh: json.keys?.['p256dh'] || '',
        auth: json.keys?.['auth'] || '',
      },
    };
  }

  private saveSubscription(subscription: PushSubscription, userId: string): void {
    this.http
      .post<void>(`${this.apiUrl}/subscription`, this.serializeSubscription(subscription))
      .pipe(
        catchError(error => {
          console.error('Unable to refresh push subscription', error);
          this.statusError.set(
            'Unable to register this device for push notifications. Please try again.',
          );
          return EMPTY;
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.auth.currentUser()?.id === userId) {
          this.isSubscribed.set(true);
          this.isRegistered.set(true);
        }
      });
  }

  private loadConfig(): void {
    if (this.isConfigLoading()) {
      return;
    }
    this.isConfigLoading.set(true);
    this.http
      .get<PushConfig>(`${this.apiUrl}/config`)
      .pipe(
        catchError(error => {
          console.error('Unable to load push notification configuration', error);
          this.statusError.set('Unable to check push notification availability.');
          return EMPTY;
        }),
        finalize(() => this.isConfigLoading.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(config => {
        this.config.set(config);
        this.statusError.set(
          !config.enabled
            ? this.notConfiguredMessage(config)
            : this.permission() === 'denied'
              ? 'Notifications are blocked in browser settings. Allow them there to enable push notifications.'
              : '',
        );
        const userId = this.auth.currentUser()?.id;
        if (userId && config.enabled && config.publicKey) {
          void this.registerExistingSubscription(userId);
        }
      });
  }

  private async registerExistingSubscription(userId: string): Promise<void> {
    if (this.isSyncingExistingSubscription) {
      return;
    }
    const config = this.config();
    if (!config?.enabled || !config.publicKey || this.permission() !== 'granted') {
      return;
    }
    this.isSyncingExistingSubscription = true;
    try {
      const publicKey = config.publicKey;
      const subscription = await this.getCurrentSubscription();
      if (!subscription) {
        return;
      }

      if (this.subscriptionUsesKey(subscription, publicKey)) {
        this.saveSubscription(subscription, userId);
        return;
      }

      // Old VAPID key: cleanly remove backend entry & unsubscribe browser so user can re-enable
      try {
        await firstValueFrom(
          this.http
            .delete<void>(`${this.apiUrl}/subscription`, {
              body: { endpoint: subscription.endpoint },
            })
            .pipe(catchError(() => of(null))),
        );
      } catch {
        // ignore
      }

      try {
        await this.unsubscribeBrowser(subscription);
      } catch {
        // ignore
      }

      this.isSubscribed.set(false);
      this.isRegistered.set(false);
      this.statusMessage.set(
        'A new notification key was configured. Tap "Enable device notifications" to activate.',
      );
    } finally {
      this.isSyncingExistingSubscription = false;
    }
  }

  private syncInitialSubscriptionState(): void {
    if (!this.hasUncontrolledServiceWorker()) {
      return;
    }
    void this.getNativePushSubscription().then(sub => {
      if (sub) {
        this.isSubscribed.set(true);
      }
    });
  }

  private hasUncontrolledServiceWorker(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      Boolean(navigator.serviceWorker) &&
      navigator.serviceWorker.controller === null
    );
  }

  private async getCurrentSubscription(): Promise<PushSubscription | null> {
    if (!this.hasUncontrolledServiceWorker()) {
      try {
        return await firstValueFrom(this.swPush.subscription.pipe(take(1), timeout(1500)));
      } catch {
        // Fall through to native ServiceWorkerRegistration lookup
      }
    }
    return this.getNativePushSubscription();
  }

  private async requestBrowserSubscription(publicKey: string): Promise<PushSubscription> {
    if (!this.hasUncontrolledServiceWorker()) {
      try {
        return await this.swPush.requestSubscription({ serverPublicKey: publicKey });
      } catch (err) {
        if (!this.canUseNativeServiceWorker()) {
          throw err;
        }
      }
    }
    const registration = await this.ensureActiveRegistration();
    if (!registration?.pushManager) {
      return this.swPush.requestSubscription({ serverPublicKey: publicKey });
    }
    return registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: this.urlBase64ToUint8Array(publicKey),
    });
  }

  private async unsubscribeBrowser(subscription: PushSubscription): Promise<void> {
    if (!this.hasUncontrolledServiceWorker()) {
      try {
        await firstValueFrom(from(this.swPush.unsubscribe()).pipe(take(1)));
        return;
      } catch {
        // Fall back to direct PushSubscription.unsubscribe()
      }
    }
    await subscription.unsubscribe();
  }

  private canUseNativeServiceWorker(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      typeof navigator.serviceWorker?.getRegistration === 'function'
    );
  }

  private async getNativePushSubscription(): Promise<PushSubscription | null> {
    if (!this.canUseNativeServiceWorker()) {
      return null;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      return (await registration?.pushManager?.getSubscription()) ?? null;
    } catch {
      return null;
    }
  }

  private async ensureActiveRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (!this.canUseNativeServiceWorker()) {
      return null;
    }
    let registration = (await navigator.serviceWorker.getRegistration()) ?? null;
    if (!registration && typeof navigator.serviceWorker.register === 'function') {
      registration = await navigator.serviceWorker.register('/ngsw-worker.js');
    }
    if (!registration) {
      return null;
    }
    if (registration.active) {
      return registration;
    }
    const pendingWorker = registration.installing ?? registration.waiting;
    if (pendingWorker) {
      await new Promise<void>(resolve => {
        const timeoutId = setTimeout(resolve, 4000);
        const onStateChange = () => {
          if (pendingWorker.state === 'activated' || pendingWorker.state === 'redundant') {
            clearTimeout(timeoutId);
            pendingWorker.removeEventListener('statechange', onStateChange);
            resolve();
          }
        };
        pendingWorker.addEventListener('statechange', onStateChange);
      });
    }
    return registration;
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
    const normalized = base64String.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const raw = atob(padded);
    const buffer = new ArrayBuffer(raw.length);
    const output = new Uint8Array(buffer);
    for (let i = 0; i < raw.length; i++) {
      output[i] = raw.charCodeAt(i);
    }
    return output;
  }

  private subscriptionUsesKey(subscription: PushSubscription, publicKey: string): boolean {
    const currentKey = subscription.options.applicationServerKey;
    if (!currentKey) {
      return false;
    }
    try {
      const expectedKey = this.urlBase64ToUint8Array(publicKey);
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
    this.http
      .get<PushPreferences>(`${this.apiUrl}/preferences`)
      .pipe(
        catchError(error => {
          console.error('Unable to load push notification preferences', error);
          this.preferencesError.set('Unable to load notification preferences.');
          return EMPTY;
        }),
        finalize(() => this.isLoadingPreferences.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(preferences => {
        if (this.auth.currentUser()?.id === userId) {
          this.preferences.set(preferences);
        }
      });
  }

  private refreshInAppNotifications(): void {
    const notificationService = this.injector.get(NotificationService, null, { optional: true });
    notificationService?.loadNotifications().subscribe({
      error: err => console.warn('Unable to refresh in-app notifications on push event', err),
    });
  }

  private notConfiguredMessage(config: PushConfig | null): string {
    const reason = config?.reason ? ` (${config.reason})` : '';
    return `Push notifications are not configured on the server yet${reason}.`;
  }

  private refreshPermission(): void {
    if (this.browser && typeof Notification !== 'undefined') {
      this.permission.set(Notification.permission);
    }
  }
}
