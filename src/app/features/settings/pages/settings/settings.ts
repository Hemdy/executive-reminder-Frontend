import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ContentSkeleton } from '../../../../core/components/content-skeleton/content-skeleton';
import {
  PushNotificationsService,
  PushPreferences,
} from '../../../../core/services/push-notifications.service';

type SettingsPanel = 'enable' | 'preferences';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [ContentSkeleton],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  readonly pushNotifications = inject(PushNotificationsService);
  readonly activePanel = signal<SettingsPanel | null>(null);
  readonly pendingPushEnabled = signal<boolean | null>(null);

  pushEnabled(): boolean {
    return this.pendingPushEnabled() ??
      (this.pushNotifications.isSubscribed() && this.pushNotifications.isRegistered());
  }

  setPreference(key: keyof PushPreferences, event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.pushNotifications.updatePreferences({ [key]: input.checked });
    }
  }

  setPushEnabled(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    if (this.pushNotifications.isBusy()) return;

    this.pendingPushEnabled.set(input.checked);
    const operation = input.checked
      ? this.pushNotifications.enable()
      : this.pushNotifications.disable();
    void operation.then(() => this.pendingPushEnabled.set(null));
  }
}
