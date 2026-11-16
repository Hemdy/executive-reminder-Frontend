import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { PwaDetectionService } from '../../services/pwa-detection.service';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Component({
  selector: 'app-pwa-install-prompt',
  standalone: true,
  templateUrl: './pwa-install-prompt.html',
  styleUrl: './pwa-install-prompt.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PwaInstallPrompt implements OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly pwaDetection = inject(PwaDetectionService);
  private readonly dismissalKey = 'exec-track-install-prompt-dismissed';
  private installPrompt: InstallPromptEvent | null = null;
  private readonly clientReady = signal(false);
  readonly installed = this.pwaDetection.isStandalone;
  readonly dismissed = signal(false);
  readonly showBrowserInstructions = signal(false);
  readonly showPrompt = computed(() =>
    this.browser && this.clientReady() && !this.installed() && !this.dismissed(),
  );
  readonly installButtonLabel = computed(() =>
    this.pwaDetection.isIosDevice() ? 'Add to Home Screen' : 'Install App',
  );

  private readonly onBeforeInstallPrompt = (event: Event): void => {
    event.preventDefault();
    this.installPrompt = event as InstallPromptEvent;
  };
  private readonly onAppInstalled = (): void => {
    this.dismissed.set(true);
    this.persistDismissal();
  };

  constructor() {
    afterNextRender(() => {
      this.clientReady.set(true);
    });

    if (!this.browser) {
      return;
    }

    const view = this.document.defaultView;
    if (!view) {
      return;
    }

    this.dismissed.set(this.isDismissed());

    view.addEventListener('beforeinstallprompt', this.onBeforeInstallPrompt);
    view.addEventListener('appinstalled', this.onAppInstalled);
  }

  ngOnDestroy(): void {
    const view = this.document.defaultView;
    view?.removeEventListener('beforeinstallprompt', this.onBeforeInstallPrompt);
    view?.removeEventListener('appinstalled', this.onAppInstalled);
  }

  async install(): Promise<void> {
    if (this.pwaDetection.isIosDevice() || !this.installPrompt) {
      this.showBrowserInstructions.set(true);
      return;
    }

    const prompt = this.installPrompt;
    this.installPrompt = null;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === 'accepted') {
        this.dismissed.set(true);
        this.persistDismissal();
      } else {
        this.dismiss();
      }
    } catch (error) {
      console.error('Unable to start the browser PWA installation prompt.', error);
      this.showBrowserInstructions.set(true);
    }
  }

  dismiss(): void {
    this.dismissed.set(true);
    this.persistDismissal();
  }

  get isIos(): boolean {
    return this.pwaDetection.isIosDevice();
  }

  get isAndroid(): boolean {
    return this.pwaDetection.isAndroidDevice();
  }

  get isSafariOnIos(): boolean {
    return this.pwaDetection.isIosSafari();
  }

  private isDismissed(): boolean {
    try {
      return this.document.defaultView?.localStorage.getItem(this.dismissalKey) === 'true';
    } catch {
      return false;
    }
  }

  private persistDismissal(): void {
    try {
      this.document.defaultView?.localStorage.setItem(this.dismissalKey, 'true');
    } catch {
      return;
    }
  }
}
