import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  let component: Sidebar;
  let fixture: ComponentFixture<Sidebar>;
  let roles: string[];
  let permissions: string[];

  beforeEach(async () => {
    roles = [];
    permissions = [];
    await TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            hasRole: (...requiredRoles: string[]) => requiredRoles.some(role => roles.includes(role)),
            hasPermission: (permission: string) => permissions.includes(permission),
            currentUser: () => null,
            getInitials: () => '',
            logout: () => undefined
          }
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Sidebar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('hides Administration when the user is not an Admin', () => {
    fixture.detectChanges(false);

    expect(fixture.nativeElement.textContent).not.toContain('Administration');
    expect(fixture.nativeElement.textContent).not.toContain('Roles');
  });

  it('shows privileged navigation for Admin users with the configured permissions', () => {
    roles.push('ADMIN');
    permissions.push('roles:view', 'settings:view');
    fixture.destroy();
    fixture = TestBed.createComponent(Sidebar);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Administration');
    expect(text).toContain('Roles');
    expect(text).toContain('Settings');
  });

  it('shows Roles to a role that was explicitly granted roles:view', () => {
    permissions.push('roles:view');
    fixture.destroy();
    fixture = TestBed.createComponent(Sidebar);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Roles');
  });

  it('shows Roles and Settings to a Director with those grants', () => {
    roles.push('DIRECTOR');
    permissions.push('roles:view', 'settings:view');
    fixture.destroy();
    fixture = TestBed.createComponent(Sidebar);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Roles');
    expect(fixture.nativeElement.textContent).toContain('Settings');
  });

  it('does not show Roles or Settings without their explicit permissions', () => {
    roles.push('COMPLIANCE OFFICER');
    fixture.destroy();
    fixture = TestBed.createComponent(Sidebar);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Roles');
    expect(fixture.nativeElement.textContent).not.toContain('Settings');
  });
});
