import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PushNotificationsService } from '../../../../core/services/push-notifications.service';
import { Settings } from './settings';

describe('Settings', () => {
  let fixture: ComponentFixture<Settings>;
  let enableNotifications: ReturnType<typeof vi.fn>;
  let disableNotifications: ReturnType<typeof vi.fn>;
  let updatePreferences: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    enableNotifications = vi.fn().mockResolvedValue(undefined);
    disableNotifications = vi.fn().mockResolvedValue(undefined);
    updatePreferences = vi.fn();

    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [{
        provide: PushNotificationsService,
        useValue: {
          requiresIosInstall: signal(false),
          isSupported: signal(true),
          statusMessage: signal(''),
          statusError: signal(''),
          isSubscribed: signal(false),
          isRegistered: signal(false),
          canEnable: signal(true),
          isBusy: signal(false),
          isConfigLoading: signal(false),
          preferences: signal({ tasks: true, reminders: true, requests: true, meetings: true }),
          isLoadingPreferences: signal(false),
          isSavingPreferences: signal(false),
          preferencesError: signal(''),
          preferencesMessage: signal(''),
          enable: enableNotifications,
          disable: disableNotifications,
          updatePreferences,
        },
      }],
    }).compileComponents();

    fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();
  });

  it('shows notification settings options and a push notification switch', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Enable Notifications');
    expect(element.textContent).toContain('Manage Notification Preferences');

    const enableOption = [...element.querySelectorAll<HTMLButtonElement>('.settings-option')]
      .find(button => button.textContent?.includes('Enable Notifications'));
    enableOption?.click();
    fixture.detectChanges();

    const pushSwitch =
      element.querySelector<HTMLInputElement>('#enable-notifications-panel input[role="switch"]');
    expect(pushSwitch?.checked).toBe(false);
    if (pushSwitch) {
      pushSwitch.checked = true;
      pushSwitch.dispatchEvent(new Event('change', { bubbles: true }));
    }
    expect(enableNotifications).toHaveBeenCalledOnce();
  });

  it('immediately reflects a push toggle and restores its saved state after the operation', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const enableOption = [...element.querySelectorAll<HTMLButtonElement>('.settings-option')]
      .find(button => button.textContent?.includes('Enable Notifications'));
    enableOption?.click();
    fixture.detectChanges();

    const pushSwitch =
      element.querySelector<HTMLInputElement>('#enable-notifications-panel input[role="switch"]');
    expect(pushSwitch).not.toBeNull();
    if (!pushSwitch) return;

    pushSwitch.checked = true;
    pushSwitch.dispatchEvent(new Event('change', { bubbles: true }));
    TestBed.inject(PushNotificationsService).isBusy.set(true);
    fixture.detectChanges();
    expect(fixture.componentInstance.pushEnabled()).toBe(true);
    expect(element.textContent).toContain('Enabling push notifications');

    TestBed.inject(PushNotificationsService).isBusy.set(false);
    await Promise.resolve();
    fixture.detectChanges();
    expect(fixture.componentInstance.pushEnabled()).toBe(false);
    expect(pushSwitch.checked).toBe(false);
  });

  it('renders module preferences as switches and updates the selected preference', () => {
    const element = fixture.nativeElement as HTMLElement;
    const preferencesOption = [...element.querySelectorAll<HTMLButtonElement>('.settings-option')]
      .find(button => button.textContent?.includes('Manage Notification Preferences'));
    preferencesOption?.click();
    fixture.detectChanges();

    expect(element.querySelector('#notification-preferences-panel')?.textContent)
      .toContain('Tasks');

    const switches = element.querySelectorAll<HTMLInputElement>(
      '#notification-preferences-panel input[role="switch"]'
    );
    expect(switches).toHaveLength(4);
    expect([...switches].map(input => input.getAttribute('aria-label'))).toEqual([
      'Task notifications',
      'Reminder notifications',
      'Request notifications',
      'Meeting notifications'
    ]);
    const tasksPreference = switches[0];
    if (tasksPreference) {
      tasksPreference.checked = false;
      tasksPreference.dispatchEvent(new Event('change', { bubbles: true }));
    }
    expect(updatePreferences).toHaveBeenCalledWith({ tasks: false });
  });

  it('shows saving feedback while module preferences are being persisted', () => {
    const pushNotifications = TestBed.inject(PushNotificationsService);
    const element = fixture.nativeElement as HTMLElement;
    const preferencesOption = [...element.querySelectorAll<HTMLButtonElement>('.settings-option')]
      .find(button => button.textContent?.includes('Manage Notification Preferences'));
    preferencesOption?.click();
    pushNotifications.isSavingPreferences.set(true);
    fixture.detectChanges();

    expect(element.querySelector('[role="status"]')?.textContent)
      .toContain('Saving notification preferences');
  });
});
