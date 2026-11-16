import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { User } from '../../core/models/user.model';
import { Topbar } from './topbar';

describe('Topbar', () => {
  let component: Topbar;
  let fixture: ComponentFixture<Topbar>;
  let router: Router;
  let currentUserSignal: ReturnType<typeof signal<User | null>>;
  let logoutSpy: ReturnType<typeof vi.fn>;

  const user: User = {
    id: 'user-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    role: 'CEO',
  };

  beforeEach(async () => {
    currentUserSignal = signal<User | null>(user);
    logoutSpy = vi.fn();

    await TestBed.configureTestingModule({
      imports: [Topbar],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: currentUserSignal.asReadonly(),
            getInitials: (u: User) => `${u.firstName[0]}${u.lastName[0]}`.toUpperCase(),
            logout: logoutSpy,
          },
        },
        {
          provide: NotificationService,
          useValue: {
            unreadCount: signal(2),
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(Topbar);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create and show the mobile menu button when bottom navigation is inactive', () => {
    expect(component).toBeTruthy();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.mobile-menu-button')).toBeTruthy();
    expect(el.querySelector('.topbar')?.classList.contains('has-bottom-nav')).toBe(false);
  });

  it('hides the mobile menu button and displays the user initials avatar when bottom navigation is active', () => {
    fixture.componentRef.setInput('hasBottomNav', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.mobile-menu-button')).toBeNull();
    expect(el.querySelector('.topbar')?.classList.contains('has-bottom-nav')).toBe(true);
    expect(el.querySelector('.avatar')?.textContent?.trim()).toBe('AL');
  });

  it('toggles the profile dropdown with Logout, closes on outside click or Escape, and logs out cleanly', () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentRef.setInput('hasBottomNav', true);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const avatarBtn = el.querySelector('.avatar-button') as HTMLButtonElement;
    expect(el.querySelector('.profile-dropdown')).toBeNull();

    avatarBtn.click();
    fixture.detectChanges();

    const dropdown = el.querySelector('.profile-dropdown') as HTMLElement;
    expect(dropdown).toBeTruthy();
    expect(dropdown.textContent).toContain('Logout');

    // Click outside closes the dropdown
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fixture.detectChanges();
    expect(el.querySelector('.profile-dropdown')).toBeNull();

    // Reopen and press Escape to close
    avatarBtn.click();
    fixture.detectChanges();
    expect(el.querySelector('.profile-dropdown')).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(el.querySelector('.profile-dropdown')).toBeNull();

    // Reopen and click Logout
    avatarBtn.click();
    fixture.detectChanges();
    const logoutBtn = el.querySelector('.logout-button') as HTMLButtonElement;
    logoutBtn.click();
    fixture.detectChanges();

    expect(logoutSpy).toHaveBeenCalledOnce();
    expect(navigateSpy).toHaveBeenCalledWith(['/login']);
    expect(el.querySelector('.profile-dropdown')).toBeNull();
  });
});
