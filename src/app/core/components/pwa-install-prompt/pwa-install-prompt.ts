import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal, PLATFORM_ID } from '@angular/core';

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
  private readonly dismissalKey = 'exec-track-install-prompt-dismissed';
  private installPrompt: InstallPromptEvent | null = null;
  private readonly isIosDevice = signal(false);
  private readonly isAndroidDevice = signal(false);
  private readonly isIosSafari = signal(false);
  readonly installed = signal(false);
  readonly dismissed = signal(false);
  readonly showBrowserInstructions = signal(false);
  readonly showPrompt = computed(() =>
    this.browser && !this.installed() && !this.dismissed(),
  );
  readonly installButtonLabel = computed(() =>
    this.isIosDevice() ? 'Add to Home Screen' : 'Install App',
  );

  private readonly onBeforeInstallPrompt = (event: Event): void => {
    event.preventDefault();
    this.installPrompt = event as InstallPromptEvent;
  };
  private readonly onAppInstalled = (): void => {
    this.installed.set(true);
    this.dismissed.set(true);
    this.persistDismissal();
  };

  constructor() {
    if (!this.browser) {
      return;
    }

    const view = this.document.defaultView;
    if (!view) {
      return;
    }

    const userAgent = view.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(userAgent) ||
      (/Macintosh/.test(userAgent) && view.navigator.maxTouchPoints > 1);
    const standalone = view.matchMedia('(display-mode: standalone)').matches ||
      (view.navigator as Navigator & { standalone?: boolean }).standalone === true;

    this.isIosDevice.set(isIos);
    this.isAndroidDevice.set(/Android/i.test(userAgent));
    this.isIosSafari.set(isIos && /Safari/i.test(userAgent) &&
      !/(CriOS|FxiOS|EdgiOS|OPiOS)/i.test(userAgent));
    this.installed.set(standalone);
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
    if (this.isIosDevice() || !this.installPrompt) {
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
    return this.isIosDevice();
  }

  get isAndroid(): boolean {
    return this.isAndroidDevice();
  }

  get isSafariOnIos(): boolean {
    return this.isIosSafari();
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
