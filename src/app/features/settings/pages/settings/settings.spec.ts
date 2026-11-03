import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PushNotificationsService } from '../../../../core/services/push-notifications.service';
import { Settings } from './settings';

describe('Settings', () => {
  let fixture: ComponentFixture<Settings>;
  let enableNotifications: ReturnType<typeof vi.fn>;
  let updatePreferences: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    enableNotifications = vi.fn();
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
          disable: vi.fn(),
          updatePreferences,
        },
      }],
    }).compileComponents();

    fixture = TestBed.createComponent(Settings);
    fixture.detectChanges();
  });

  it('shows notification settings options and the enable action', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Enable Notifications');
    expect(element.textContent).toContain('Manage Notification Preferences');

    const enableOption = [...element.querySelectorAll<HTMLButtonElement>('.settings-option')]
      .find(button => button.textContent?.includes('Enable Notifications'));
    enableOption?.click();
    fixture.detectChanges();

    const enableButton =
      element.querySelector<HTMLButtonElement>('#enable-notifications-panel .primary-button');
    expect(enableButton?.textContent).toContain('Enable Notifications');
    enableButton?.click();
    expect(enableNotifications).toHaveBeenCalledOnce();
  });

  it('opens and updates the notification preferences list from its option', () => {
    const element = fixture.nativeElement as HTMLElement;
    const preferencesOption = [...element.querySelectorAll<HTMLButtonElement>('.settings-option')]
      .find(button => button.textContent?.includes('Manage Notification Preferences'));
    preferencesOption?.click();
    fixture.detectChanges();

    expect(element.querySelector('#notification-preferences-panel')?.textContent)
      .toContain('Tasks');

    const tasksPreference =
      element.querySelector<HTMLInputElement>('#notification-preferences-panel input');
    expect(tasksPreference).not.toBeNull();
    if (tasksPreference) {
      tasksPreference.checked = false;
      tasksPreference.dispatchEvent(new Event('change', { bubbles: true }));
    }
    expect(updatePreferences).toHaveBeenCalledWith({ tasks: false });
  });
});
