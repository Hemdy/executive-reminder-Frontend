import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { DestroyRef, inject, Injectable, PLATFORM_ID } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { NavigationEnd, Router } from '@angular/router';
import { filter, fromEvent, interval, merge } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppActivityService } from './app-activity.service';

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly updates = inject(SwUpdate);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly activity = inject(AppActivityService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private updateReady = false;
  private activating = false;

  constructor() {
    if (!this.browser || !this.updates.isEnabled) {
      return;
    }

    this.updates.versionUpdates.pipe(
      filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => {
      this.updateReady = true;
      this.activateWhenSafe();
    });

    this.updates.versionUpdates.pipe(
      filter(event => event.type === 'VERSION_INSTALLATION_FAILED'),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(event => {
      console.error('Unable to install the new PWA version', event);
    });

    const view = this.document.defaultView;
    if (view) {
      merge(
        fromEvent(view, 'focus'),
        fromEvent(this.document, 'visibilitychange'),
        this.router.events.pipe(filter(event => event instanceof NavigationEnd)),
        interval(15_000),
      ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.activateWhenSafe());
    }

    void this.checkForUpdate();
    interval(6 * 60 * 60 * 1000).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => void this.checkForUpdate());
  }

  private async checkForUpdate(): Promise<void> {
    try {
      await this.updates.checkForUpdate();
    } catch (error) {
      console.warn('PWA update check failed; the current version will remain available.', error);
    }
  }

  private activateWhenSafe(): void {
    if (!this.updateReady || this.activating ||
        this.document.visibilityState !== 'visible' ||
        this.activity.hasPendingRequests() ||
        this.document.querySelector(
          'form .ng-dirty, input.ng-dirty, textarea.ng-dirty, select.ng-dirty, [contenteditable="true"].ng-dirty, [data-update-guard="pending"], [aria-busy="true"]',
        )) {
      return;
    }

    const activeElement = this.document.activeElement;
    if (activeElement instanceof HTMLElement &&
        activeElement.matches('input, textarea, select, [contenteditable="true"]')) {
      return;
    }

    this.activating = true;
    void this.updates.activateUpdate().then(() => {
      this.document.defaultView?.location.reload();
    }).catch(error => {
      this.activating = false;
      console.error('Unable to activate the new PWA version.', error);
    });
  }
}
