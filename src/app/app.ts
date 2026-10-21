import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  Router,
  RouterOutlet,
} from '@angular/router';
import { filter, take } from 'rxjs';
import { LoadingOverlay } from './core/components/loading-overlay/loading-overlay';
import { LoadingService } from './core/services/loading.service';
import { PushNotificationsService } from './core/services/push-notifications.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LoadingOverlay],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly loading = inject(LoadingService);
  protected readonly startupError = signal('');

  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly pushNotifications = inject(PushNotificationsService);
  private startupTask = this.loading.begin('Loading...');
  private startupPending = true;

  constructor() {
    if (this.router.navigated) {
      this.finishStartup();
      return;
    }

    this.router.events.pipe(
      filter(event =>
        event instanceof NavigationEnd ||
        event instanceof NavigationError ||
        event instanceof NavigationSkipped
      ),
      take(1),
    ).subscribe(event => {
      if (event instanceof NavigationError) {
        this.startupError.set('We could not load the app. Check your connection and try again.');
      }
      this.finishStartup();
    });
  }

  protected retryStartup(): void {
    this.document.defaultView?.location.reload();
  }

  private finishStartup(): void {
    if (!this.startupPending) {
      return;
    }
    this.startupPending = false;
    this.loading.end(this.startupTask);
  }
}
