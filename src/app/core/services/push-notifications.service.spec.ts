import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { Observable, of, Subject } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { AuthService } from './auth.service';
import { PushNotificationsService } from './push-notifications.service';

describe('PushNotificationsService', () => {
  const endpoint = 'https://fcm.googleapis.com/fcm/send/test-endpoint';
  const subscriptionData = {
    endpoint,
    keys: { p256dh: 'public-key', auth: 'auth-key' },
  };
  const subscription = {
    endpoint,
    expirationTime: null,
    options: { userVisibleOnly: true, applicationServerKey: null },
    getKey: () => null,
    unsubscribe: () => Promise.resolve(true),
    toJSON: () => subscriptionData,
  } as PushSubscription;
  const swPush = {
    isEnabled: true,
    subscription: of(null) as Observable<PushSubscription | null>,
    pushSubscriptionChanges: new Subject(),
    notificationClicks: new Subject(),
    requestSubscription: vi.fn(() => Promise.resolve(subscription)),
    unsubscribe: vi.fn(() => Promise.resolve(true)),
  };
  const currentUser = vi.fn<() => { id: string } | null>(() => null);
  let service: PushNotificationsService;
  let http: HttpTestingController;

  beforeEach(() => {
    currentUser.mockReturnValue(null);
    swPush.subscription = of(null) as Observable<PushSubscription | null>;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: SwPush, useValue: swPush },
        {
          provide: AuthService,
          useValue: { currentUser, isAuthenticated: () => currentUser() !== null },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    swPush.requestSubscription.mockClear();
    swPush.unsubscribe.mockClear();
  });

  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  function initializeService(
    config: { enabled: boolean; publicKey: string | null } = {
      enabled: true,
      publicKey: 'vapid-public-key',
    },
    permission: NotificationPermission = 'granted',
  ): void {
    vi.stubGlobal('Notification', { permission });
    service = TestBed.inject(PushNotificationsService);
    http.expectOne(`${API_BASE_URL}/notifications/push/config`).flush(config);
  }

  it('requests permission synchronously from the user action and registers the subscription', async () => {
    initializeService();
    service.enable();

    expect(swPush.requestSubscription).toHaveBeenCalledWith({
      serverPublicKey: 'vapid-public-key',
    });

    await new Promise(resolve => setTimeout(resolve, 0));
    const request = http.expectOne(`${API_BASE_URL}/notifications/push/subscription`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(subscriptionData);
    request.flush(null);

    expect(service.isSubscribed()).toBe(true);
    expect(service.isRegistered()).toBe(true);
  });

  it('does not request permission when browser notifications are denied', () => {
    initializeService(undefined, 'denied');

    expect(service.permission()).toBe('denied');
    expect(service.canEnable()).toBe(false);

    service.enable();

    expect(swPush.requestSubscription).not.toHaveBeenCalled();
    expect(service.statusError()).toContain('blocked in browser settings');
  });

  it('reports missing VAPID configuration without requesting a subscription', () => {
    initializeService({ enabled: false, publicKey: null });

    service.enable();

    expect(swPush.requestSubscription).not.toHaveBeenCalled();
    expect(service.statusError()).toBe('Push notifications are not configured on the server yet.');
  });

  it('replaces an existing subscription created with a different VAPID key', async () => {
    const previousSubscription = {
      ...subscription,
      options: { userVisibleOnly: true, applicationServerKey: Uint8Array.from([3, 2, 1]).buffer },
    } as PushSubscription;
    swPush.subscription = of(previousSubscription);
    currentUser.mockReturnValue({ id: 'user-1' });
    initializeService({ enabled: true, publicKey: 'AQID' });

    await new Promise(resolve => setTimeout(resolve, 0));
    http.expectOne(`${API_BASE_URL}/notifications/push/preferences`).flush({
      tasks: true,
      reminders: true,
      requests: true,
      meetings: true,
    });
    const removeRequest = http.expectOne(`${API_BASE_URL}/notifications/push/subscription`);
    expect(removeRequest.request.method).toBe('DELETE');
    removeRequest.flush(null);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(swPush.unsubscribe).toHaveBeenCalledOnce();
    expect(swPush.requestSubscription).toHaveBeenCalledWith({ serverPublicKey: 'AQID' });
    const saveRequest = http.expectOne(`${API_BASE_URL}/notifications/push/subscription`);
    expect(saveRequest.request.method).toBe('POST');
    saveRequest.flush(null);
    expect(service.isRegistered()).toBe(true);
  });

  it('saves the authenticated user device notification preferences', () => {
    initializeService();
    currentUser.mockReturnValue({ id: 'user-1' });

    service.updatePreferences({ tasks: false, meetings: false });

    const request = http.expectOne(`${API_BASE_URL}/notifications/push/preferences`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ tasks: false, meetings: false });
    request.flush({ tasks: false, reminders: true, requests: true, meetings: false });

    expect(service.preferences()).toEqual({
      tasks: false,
      reminders: true,
      requests: true,
      meetings: false,
    });
    expect(service.preferencesMessage()).toBe('Notification preferences saved.');
  });

  it('removes the backend subscription before unsubscribing this device', async () => {
    swPush.subscription = of(subscription);
    initializeService();

    expect(service.isSubscribed()).toBe(true);
    service.disable();

    const request = http.expectOne(`${API_BASE_URL}/notifications/push/subscription`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toEqual({ endpoint });
    request.flush(null);

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(swPush.unsubscribe).toHaveBeenCalledOnce();
    expect(service.isSubscribed()).toBe(false);
    expect(service.statusMessage()).toBe('Push notifications are disabled on this device.');
  });

  it('navigates to the root-relative route in a push notification click payload', () => {
    initializeService();
    const router = TestBed.inject(Router);
    const navigateByUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    swPush.notificationClicks.next({
      notification: { data: { route: '/reminders/reminder-1' } },
    });
    swPush.notificationClicks.next({
      notification: { data: { route: 'https://example.com' } },
    });

    expect(navigateByUrl).toHaveBeenCalledOnce();
    expect(navigateByUrl).toHaveBeenCalledWith('/reminders/reminder-1');
  });
});
