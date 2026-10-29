import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PushNotificationsService } from '../../../../core/services/push-notifications.service';

import { NotificationCenter } from './notification-center';

describe('NotificationCenter', () => {
  let component: NotificationCenter;
  let fixture: ComponentFixture<NotificationCenter>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationCenter],
      providers: [{
        provide: PushNotificationsService,
        useValue: {
          isSupported: signal(false),
          requiresIosInstall: signal(false),
          isSubscribed: signal(false),
          isRegistered: signal(false),
          isBusy: signal(false),
          isTesting: signal(false),
          isConfigLoading: signal(false),
          statusMessage: signal(''),
          statusError: signal(''),
          preferences: signal({ tasks: true, reminders: true, requests: true, meetings: true }),
          isLoadingPreferences: signal(false),
          preferencesError: signal(''),
          preferencesMessage: signal(''),
          isSavingPreferences: signal(false),
          canEnable: signal(false),
          enable: vi.fn(),
          disable: vi.fn(),
          sendTestNotification: vi.fn(),
          updatePreferences: vi.fn(),
        },
      }],
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationCenter);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
