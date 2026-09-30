import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { Sidebar } from './sidebar';

describe('Sidebar', () => {
  let component: Sidebar;
  let fixture: ComponentFixture<Sidebar>;
  let permissions: string[];

  beforeEach(async () => {
    permissions = [];
    await TestBed.configureTestingModule({
      imports: [Sidebar],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
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

  it('hides Administration when the user has none of its page permissions', () => {
    fixture.detectChanges(false);

    expect(fixture.nativeElement.textContent).not.toContain('Administration');
    expect(fixture.nativeElement.textContent).not.toContain('Roles');
    expect(fixture.nativeElement.textContent).not.toContain('Users');
    expect(fixture.nativeElement.textContent).not.toContain('Settings');
  });

  it.each(['roles:view', 'users:view', 'settings:view'])(
    'shows only the permitted Administration page when the user has %s',
    permission => {
      permissions.push(permission);
      fixture.destroy();
      fixture = TestBed.createComponent(Sidebar);
      component = fixture.componentInstance;
      fixture.detectChanges();

      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('Administration');
      const permittedPage = permission.replace(':view', '');
      for (const page of ['Roles', 'Users', 'Settings']) {
        expect(text.includes(page)).toBe(page.toLowerCase() === permittedPage);
      }
    }
  );
});
