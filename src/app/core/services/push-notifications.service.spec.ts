import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { of, Subject } from 'rxjs';
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
    subscription: of(null),
    pushSubscriptionChanges: new Subject(),
    notificationClicks: new Subject(),
    requestSubscription: vi.fn(() => Promise.resolve(subscription)),
    unsubscribe: vi.fn(() => Promise.resolve(true)),
  };
  const currentUser = vi.fn(() => null);
  let service: PushNotificationsService;
  let http: HttpTestingController;

  beforeEach(() => {
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
    service = TestBed.inject(PushNotificationsService);
    http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API_BASE_URL}/notifications/push/config`).flush({
      enabled: true,
      publicKey: 'vapid-public-key',
    });
    swPush.requestSubscription.mockClear();
  });

  afterEach(() => http.verify());

  it('requests permission synchronously from the user action and registers the subscription', async () => {
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
});
