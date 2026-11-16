import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  PWA_COMPACT_BREAKPOINT_QUERY,
  PWA_STANDALONE_DISPLAY_QUERY,
  PwaDetectionService,
} from './pwa-detection.service';

interface MockMediaQueryList {
  matches: boolean;
  media: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  dispatchChange: (matches: boolean) => void;
}

function createMockMediaQueryList(media: string, initialMatches: boolean): MockMediaQueryList {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  return {
    matches: initialMatches,
    media,
    addEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
      if (event === 'change') {
        listeners.add(listener);
      }
    }),
    removeEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
      if (event === 'change') {
        listeners.delete(listener);
      }
    }),
    dispatchChange(matches: boolean) {
      this.matches = matches;
      const event = { matches, media } as MediaQueryListEvent;
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

describe('PwaDetectionService', () => {
  function setupBrowserEnvironment(options: {
    standaloneMatch?: boolean;
    compactMatch?: boolean;
    navigatorStandalone?: boolean;
    userAgent?: string;
    maxTouchPoints?: number;
  } = {}) {
    const standaloneMql = createMockMediaQueryList(
      PWA_STANDALONE_DISPLAY_QUERY,
      options.standaloneMatch ?? false,
    );
    const compactMql = createMockMediaQueryList(
      PWA_COMPACT_BREAKPOINT_QUERY,
      options.compactMatch ?? false,
    );

    const windowListeners = new Map<string, Set<EventListener>>();

    const mockView = {
      innerWidth: options.compactMatch ? 390 : 1280,
      navigator: {
        userAgent: options.userAgent ?? 'Mozilla/5.0',
        maxTouchPoints: options.maxTouchPoints ?? 0,
        standalone: options.navigatorStandalone,
      },
      matchMedia: vi.fn((query: string) => {
        if (query === PWA_STANDALONE_DISPLAY_QUERY) {
          return standaloneMql as unknown as MediaQueryList;
        }
        if (query === PWA_COMPACT_BREAKPOINT_QUERY) {
          return compactMql as unknown as MediaQueryList;
        }
        return createMockMediaQueryList(query, false) as unknown as MediaQueryList;
      }),
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        const set = windowListeners.get(type) ?? new Set<EventListener>();
        set.add(listener);
        windowListeners.set(type, set);
      }),
      removeEventListener: vi.fn((type: string, listener: EventListener) => {
        windowListeners.get(type)?.delete(listener);
      }),
      dispatchEvent(event: Event) {
        for (const listener of windowListeners.get(event.type) ?? []) {
          listener(event);
        }
        return true;
      },
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: DOCUMENT, useValue: { defaultView: mockView } },
      ],
    });

    const service = TestBed.inject(PwaDetectionService);
    return { service, standaloneMql, compactMql, mockView };
  }

  it('safely returns false values during Angular SSR without touching window APIs', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: DOCUMENT, useValue: { defaultView: null } },
      ],
    });

    const service = TestBed.inject(PwaDetectionService);

    expect(service.isBrowser).toBe(false);
    expect(service.isStandalone()).toBe(false);
    expect(service.isCompactViewport()).toBe(false);
    expect(service.isInstalledCompactPwa()).toBe(false);
  });

  it('detects installed mobile/tablet PWA via display-mode standalone', () => {
    const { service } = setupBrowserEnvironment({
      standaloneMatch: true,
      compactMatch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14)',
    });

    expect(service.isStandalone()).toBe(true);
    expect(service.isCompactViewport()).toBe(true);
    expect(service.isInstalledCompactPwa()).toBe(true);
    expect(service.isAndroidDevice()).toBe(true);
  });

  it('detects installed iOS Safari PWA via navigator.standalone fallback', () => {
    const { service } = setupBrowserEnvironment({
      standaloneMatch: false,
      compactMatch: true,
      navigatorStandalone: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    });

    expect(service.isStandalone()).toBe(true);
    expect(service.isIosDevice()).toBe(true);
    expect(service.isIosSafari()).toBe(true);
    expect(service.isInstalledCompactPwa()).toBe(true);
  });

  it('hides bottom navigation on narrow viewports in a normal mobile or tablet browser', () => {
    const { service } = setupBrowserEnvironment({
      standaloneMatch: false,
      compactMatch: true,
      navigatorStandalone: false,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/604.1',
    });

    expect(service.isStandalone()).toBe(false);
    expect(service.isCompactViewport()).toBe(true);
    expect(service.isInstalledCompactPwa()).toBe(false);
  });

  it('hides bottom navigation on wide desktop screens even when installed as a PWA', () => {
    const { service } = setupBrowserEnvironment({
      standaloneMatch: true,
      compactMatch: false,
    });

    expect(service.isStandalone()).toBe(true);
    expect(service.isCompactViewport()).toBe(false);
    expect(service.isInstalledCompactPwa()).toBe(false);
  });

  it('reactively updates when display-mode or viewport width changes', () => {
    const { service, standaloneMql, compactMql } = setupBrowserEnvironment({
      standaloneMatch: false,
      compactMatch: false,
    });

    expect(service.isInstalledCompactPwa()).toBe(false);

    standaloneMql.dispatchChange(true);
    expect(service.isStandalone()).toBe(true);
    expect(service.isInstalledCompactPwa()).toBe(false);

    compactMql.dispatchChange(true);
    expect(service.isCompactViewport()).toBe(true);
    expect(service.isInstalledCompactPwa()).toBe(true);

    compactMql.dispatchChange(false);
    expect(service.isInstalledCompactPwa()).toBe(false);
  });

  it('marks standalone true when appinstalled event fires', () => {
    const { service, mockView } = setupBrowserEnvironment({
      standaloneMatch: false,
      compactMatch: true,
    });

    expect(service.isStandalone()).toBe(false);
    mockView.dispatchEvent(new Event('appinstalled'));
    expect(service.isStandalone()).toBe(true);
    expect(service.isInstalledCompactPwa()).toBe(true);
  });
});
