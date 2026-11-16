import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  computed,
  DestroyRef,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type LegacyMediaQueryList = MediaQueryList & {
  addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
};

export const PWA_COMPACT_BREAKPOINT_QUERY = '(max-width: 1024px)';
export const PWA_STANDALONE_DISPLAY_QUERY = '(display-mode: standalone)';

@Injectable({ providedIn: 'root' })
export class PwaDetectionService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly standaloneSignal = signal(false);
  private readonly compactViewportSignal = signal(false);
  private readonly iosDeviceSignal = signal(false);
  private readonly androidDeviceSignal = signal(false);
  private readonly iosSafariSignal = signal(false);

  /** True when the app is launched in standalone PWA display mode (including iOS navigator.standalone). */
  readonly isStandalone = this.standaloneSignal.asReadonly();

  /** True when the viewport is mobile or tablet sized (<= 1024px). */
  readonly isCompactViewport = this.compactViewportSignal.asReadonly();

  /** True when the app is running as an installed PWA on a mobile, tablet, or compact (<= 1024px) viewport. */
  readonly isInstalledCompactPwa = computed(
    () => this.isBrowser && this.standaloneSignal() && this.compactViewportSignal(),
  );

  readonly isIosDevice = this.iosDeviceSignal.asReadonly();
  readonly isAndroidDevice = this.androidDeviceSignal.asReadonly();
  readonly isIosSafari = this.iosSafariSignal.asReadonly();

  constructor() {
    if (!this.isBrowser) {
      return;
    }

    const view = this.document.defaultView;
    if (!view) {
      return;
    }

    this.detectPlatform(view);
    this.syncDisplayState(view);
    this.registerListeners(view);
  }

  refresh(): void {
    if (!this.isBrowser) {
      return;
    }

    const view = this.document.defaultView;
    if (!view) {
      return;
    }

    this.detectPlatform(view);
    this.syncDisplayState(view);
  }

  private detectPlatform(view: Window): void {
    const userAgent = view.navigator?.userAgent ?? '';
    const maxTouchPoints = view.navigator?.maxTouchPoints ?? 0;
    const isIos =
      /iPad|iPhone|iPod/.test(userAgent) ||
      (/Macintosh/.test(userAgent) && maxTouchPoints > 1);

    this.iosDeviceSignal.set(isIos);
    this.androidDeviceSignal.set(/Android/i.test(userAgent));
    this.iosSafariSignal.set(
      isIos &&
        /Safari/i.test(userAgent) &&
        !/(CriOS|FxiOS|EdgiOS|OPiOS)/i.test(userAgent),
    );
  }

  private syncDisplayState(view: Window): void {
    this.standaloneSignal.set(this.readStandaloneState(view));
    this.compactViewportSignal.set(this.readCompactViewportState(view));
  }

  private readStandaloneState(view: Window): boolean {
    const mediaMatches =
      typeof view.matchMedia === 'function'
        ? view.matchMedia(PWA_STANDALONE_DISPLAY_QUERY).matches
        : false;
    const navigatorStandalone =
      (view.navigator as NavigatorWithStandalone | undefined)?.standalone === true;

    return mediaMatches || navigatorStandalone;
  }

  private readCompactViewportState(view: Window): boolean {
    if (typeof view.matchMedia === 'function') {
      return view.matchMedia(PWA_COMPACT_BREAKPOINT_QUERY).matches;
    }

    return view.innerWidth > 0 && view.innerWidth <= 1024;
  }

  private registerListeners(view: Window): void {
    const cleanups: Array<() => void> = [];

    if (typeof view.matchMedia === 'function') {
      const standaloneMql = view.matchMedia(PWA_STANDALONE_DISPLAY_QUERY);
      const compactMql = view.matchMedia(PWA_COMPACT_BREAKPOINT_QUERY);

      const onDisplayModeChange = (): void => {
        this.standaloneSignal.set(this.readStandaloneState(view));
      };
      const onViewportChange = (event: MediaQueryListEvent): void => {
        this.compactViewportSignal.set(event.matches);
      };

      cleanups.push(this.subscribeMediaQuery(standaloneMql, onDisplayModeChange));
      cleanups.push(this.subscribeMediaQuery(compactMql, onViewportChange));
    } else {
      const onResize = (): void => {
        this.compactViewportSignal.set(this.readCompactViewportState(view));
      };
      view.addEventListener('resize', onResize);
      cleanups.push(() => view.removeEventListener('resize', onResize));
    }

    const onAppInstalled = (): void => {
      this.standaloneSignal.set(true);
    };
    view.addEventListener('appinstalled', onAppInstalled);
    cleanups.push(() => view.removeEventListener('appinstalled', onAppInstalled));

    this.destroyRef.onDestroy(() => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    });
  }

  private subscribeMediaQuery(
    mql: MediaQueryList,
    handler: (event: MediaQueryListEvent) => void,
  ): () => void {
    const legacyMql = mql as LegacyMediaQueryList;
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }

    if (typeof legacyMql.addListener === 'function') {
      legacyMql.addListener(handler);
      return () => legacyMql.removeListener?.(handler);
    }

    return () => undefined;
  }
}
