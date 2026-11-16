import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MobileBottomNav } from './mobile-bottom-nav';

describe('MobileBottomNav', () => {
  let component: MobileBottomNav;
  let fixture: ComponentFixture<MobileBottomNav>;
  let router: Router;
  let permissions: string[];

  beforeEach(async () => {
    permissions = [];

    await TestBed.configureTestingModule({
      imports: [MobileBottomNav],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            hasPermission: (permission: string) => permissions.includes(permission),
            hasRole: () => false,
            currentUser: () => null,
            getInitials: () => '',
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(MobileBottomNav);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('renders Home, Workspace, FAB (+), Calendar, and Settings', () => {
    const el = fixture.nativeElement as HTMLElement;
    const labels = Array.from(el.querySelectorAll('.bottom-nav-label')).map((node) =>
      node.textContent?.trim(),
    );

    expect(labels).toEqual(['Home', 'Workspace', 'Calendar', 'Settings']);
    expect(el.querySelector('.fab-trigger')).toBeTruthy();
  });

  it('toggles the parabolic quick-action menu from the FAB and closes on outside tap or Escape', () => {
    const el = fixture.nativeElement as HTMLElement;
    const fab = el.querySelector('.fab-trigger') as HTMLButtonElement;
    const fabMenu = el.querySelector('#fab-quick-actions') as HTMLElement;

    expect(fab.getAttribute('aria-expanded')).toBe('false');
    expect(fabMenu.classList.contains('is-open')).toBe(false);

    fab.click();
    fixture.detectChanges();

    expect(fab.getAttribute('aria-expanded')).toBe('true');
    expect(fab.classList.contains('is-expanded')).toBe(true);
    expect(fabMenu.classList.contains('is-open')).toBe(true);

    const actionLabels = Array.from(el.querySelectorAll('.fab-action-label')).map((n) =>
      n.textContent?.trim(),
    );
    expect(actionLabels).toEqual(['New Task', 'New Reminder', 'New Request', 'New Meeting']);

    // Tap outside backdrop closes menu
    const backdrop = el.querySelector('.mobile-nav-backdrop') as HTMLButtonElement;
    expect(backdrop).toBeTruthy();
    backdrop.click();
    fixture.detectChanges();

    expect(component.isFabOpen()).toBe(false);
    expect(fabMenu.classList.contains('is-open')).toBe(false);

    // Reopen and close with Escape
    fab.click();
    fixture.detectChanges();
    expect(component.isFabOpen()).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(component.isFabOpen()).toBe(false);
  });

  it('navigates to each existing creation flow and closes the FAB menu', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const el = fixture.nativeElement as HTMLElement;
    const fab = el.querySelector('.fab-trigger') as HTMLButtonElement;

    const expectedRoutes = ['/tasks/new', '/reminders/new', '/requests/new', '/meetings/new'];
    const pills = Array.from(el.querySelectorAll('.fab-action-pill')) as HTMLButtonElement[];
    expect(pills.length).toBe(4);

    pills.forEach((pill, index) => {
      fab.click();
      fixture.detectChanges();
      expect(component.isFabOpen()).toBe(true);

      pill.click();
      fixture.detectChanges();

      expect(component.isFabOpen()).toBe(false);
      expect(navigateSpy).toHaveBeenCalledWith(expectedRoutes[index]);
    });
  });

  it('opens Workspace sheet with Requests, Meetings, Tasks, and Reminders and respects roles:view permission', () => {
    const el = fixture.nativeElement as HTMLElement;
    const workspaceBtn = el.querySelector(
      'button.bottom-nav-item[aria-controls="workspace-sheet"]',
    ) as HTMLButtonElement;

    workspaceBtn.click();
    fixture.detectChanges();

    const sheet = el.querySelector('#workspace-sheet') as HTMLElement;
    expect(sheet.classList.contains('is-open')).toBe(true);

    const cardTitles = Array.from(sheet.querySelectorAll('.workspace-card-copy strong')).map((n) =>
      n.textContent?.trim(),
    );
    expect(cardTitles).toEqual(['Requests', 'Meetings', 'Tasks', 'Reminders']);
    expect(sheet.querySelector('.workspace-admin-row')).toBeNull();

    // Grant roles:view permission and verify Roles row appears
    permissions.push('roles:view');
    fixture.destroy();
    fixture = TestBed.createComponent(MobileBottomNav);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const updatedSheet = (fixture.nativeElement as HTMLElement).querySelector(
      '#workspace-sheet',
    ) as HTMLElement;
    expect(updatedSheet.querySelector('.workspace-admin-row')?.textContent).toContain(
      'Roles & Permissions',
    );
  });

  it('switches cleanly between FAB menu and Workspace sheet without overlap', () => {
    const el = fixture.nativeElement as HTMLElement;
    const fab = el.querySelector('.fab-trigger') as HTMLButtonElement;
    const workspaceBtn = el.querySelector(
      'button.bottom-nav-item[aria-controls="workspace-sheet"]',
    ) as HTMLButtonElement;

    fab.click();
    fixture.detectChanges();
    expect(component.isFabOpen()).toBe(true);
    expect(component.isWorkspaceOpen()).toBe(false);

    workspaceBtn.click();
    fixture.detectChanges();
    expect(component.isFabOpen()).toBe(false);
    expect(component.isWorkspaceOpen()).toBe(true);
  });
});
