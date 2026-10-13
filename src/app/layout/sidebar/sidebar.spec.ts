import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  let component: Sidebar;
  let fixture: ComponentFixture<Sidebar>;
  let roles: string[];

  beforeEach(async () => {
    roles = [];
    await TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            hasRole: (...requiredRoles: string[]) => requiredRoles.some(role => roles.includes(role)),
            hasPermission: () => false,
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

  it('shows the Roles navigation item to Admin users', () => {
    roles.push('ADMIN');
    fixture.destroy();
    fixture = TestBed.createComponent(Sidebar);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Administration');
    expect(text).toContain('Roles');
  });

  it('does not show Roles to users with roles:view but without the Admin role', () => {
    fixture.destroy();
    fixture = TestBed.createComponent(Sidebar);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const authService = TestBed.inject(AuthService);
    vi.spyOn(authService, 'hasPermission').mockReturnValue(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Roles');
  });
});
