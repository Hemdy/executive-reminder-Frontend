import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  PushNotificationsService,
  PushPreferences,
} from '../../../../core/services/push-notifications.service';

type SettingsPanel = 'enable' | 'preferences';

@Component({
  selector: 'app-settings',
  standalone: true,
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  readonly pushNotifications = inject(PushNotificationsService);
  readonly activePanel = signal<SettingsPanel | null>(null);

  setPreference(key: keyof PushPreferences, event: Event): void {
    const input = event.target;
    if (input instanceof HTMLInputElement) {
      this.pushNotifications.updatePreferences({ [key]: input.checked });
    }
  }
}
