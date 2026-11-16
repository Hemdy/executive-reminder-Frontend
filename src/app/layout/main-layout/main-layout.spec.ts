import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { PwaDetectionService } from '../../core/services/pwa-detection.service';
import { MainLayout } from './main-layout';

describe('MainLayout', () => {
  let component: MainLayout;
  let fixture: ComponentFixture<MainLayout>;
  let isStandaloneSignal: ReturnType<typeof signal<boolean>>;
  let isCompactViewportSignal: ReturnType<typeof signal<boolean>>;
  let currentUserSignal: ReturnType<typeof signal<User | null>>;

  beforeEach(async () => {
    isStandaloneSignal = signal(false);
    isCompactViewportSignal = signal(false);
    currentUserSignal = signal<User | null>({
      id: 'user-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      role: 'CEO',
    });

    await TestBed.configureTestingModule({
      imports: [MainLayout],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            hasRole: () => false,
            hasPermission: () => false,
            currentUser: currentUserSignal.asReadonly(),
            getInitials: (u: User) => `${u.firstName[0]}${u.lastName[0]}`.toUpperCase(),
            logout: () => undefined,
          },
        },
        {
          provide: NotificationService,
          useValue: {
            unreadCount: signal(0),
          },
        },
        {
          provide: PwaDetectionService,
          useValue: {
            isBrowser: true,
            isStandalone: isStandaloneSignal.asReadonly(),
            isCompactViewport: isCompactViewportSignal.asReadonly(),
            isInstalledCompactPwa: () =>
              isStandaloneSignal() && isCompactViewportSignal(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MainLayout);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('hides mobile bottom navigation in normal browser even on narrow screens', () => {
    isStandaloneSignal.set(false);
    isCompactViewportSignal.set(true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-mobile-bottom-nav')).toBeNull();
    expect(el.querySelector('.app-shell')?.classList.contains('has-bottom-nav')).toBe(false);
    expect(el.querySelector('app-topbar .mobile-menu-button')).toBeTruthy();
  });

  it('hides mobile bottom navigation on wide desktop even when installed as a PWA', () => {
    isStandaloneSignal.set(true);
    isCompactViewportSignal.set(false);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-mobile-bottom-nav')).toBeNull();
    expect(el.querySelector('app-topbar .mobile-menu-button')).toBeTruthy();
  });

  it('shows mobile bottom navigation and swaps the topbar menu button for the initials avatar in installed mobile/tablet PWAs', () => {
    isStandaloneSignal.set(true);
    isCompactViewportSignal.set(true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-mobile-bottom-nav')).toBeTruthy();
    expect(el.querySelector('.app-shell')?.classList.contains('has-bottom-nav')).toBe(true);
    expect(el.querySelector('app-topbar .notification-button')).toBeTruthy();
    expect(el.querySelector('app-topbar .mobile-menu-button')).toBeNull();
    expect(el.querySelector('app-topbar .topbar.has-bottom-nav .avatar')?.textContent?.trim()).toBe('AL');
  });
});
