import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManagedRole, ManagedUser } from '../../../../core/models/role.model';
import { RoleService } from '../../../../core/services/role.service';
import { RoleManagement } from './role-management';

describe('RoleManagement', () => {
  let component: RoleManagement;
  let fixture: ComponentFixture<RoleManagement>;
  const roles = signal<ManagedRole[]>([]);
  const roleServiceMock = {
    users: signal<ManagedUser[]>([]),
    roles,
    activeRoles: computed(() => roles().filter(role => role.isActive)),
    errorMessage: signal('')
  };

  beforeEach(async () => {
    roles.set([]);
    await TestBed.configureTestingModule({
      imports: [RoleManagement],
      providers: [{ provide: RoleService, useValue: roleServiceMock }]
    }).compileComponents();

    fixture = TestBed.createComponent(RoleManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('selects and deselects every available permission', () => {
    component.toggleAllPermissions();

    expect(component.allPermissionsSelected()).toBe(true);
    expect(component.selectedPermissions()).toHaveLength(component.permissionOptions.length);

    component.toggleAllPermissions();

    expect(component.allPermissionsSelected()).toBe(false);
    expect(component.selectedPermissions()).toEqual([]);
  });

  it('keeps Select All synchronized with individual permission changes', () => {
    for (const [permission] of component.permissionOptions) {
      component.togglePermission(permission);
    }

    expect(component.allPermissionsSelected()).toBe(true);

    component.togglePermission(component.permissionOptions[0][0]);

    expect(component.allPermissionsSelected()).toBe(false);
  });

  it('does not discard existing permission identifiers when selecting all available permissions', () => {
    component.selectedPermissions.set(['reports:export']);

    component.toggleAllPermissions();

    expect(component.selectedPermissions()).toContain('reports:export');
    expect(new Set(component.selectedPermissions()).size)
      .toBe(component.selectedPermissions().length);
  });

  it('groups only assigned, unique permissions in role details', () => {
    const role: ManagedRole = {
      id: 'role-1',
      name: 'Manager',
      description: 'Manages users and settings',
      isActive: true,
      permissions: ['users:view', 'users:create', 'users:view', 'settings:edit']
    };

    component.viewRole(role);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Manager');
    expect(fixture.nativeElement.textContent).toContain('Manages users and settings');
    expect(fixture.nativeElement.textContent).toContain('Users');
    expect(fixture.nativeElement.textContent).toContain('View Users');
    expect(fixture.nativeElement.textContent).toContain('Create Users');
    expect(fixture.nativeElement.textContent).toContain('Settings');
    expect(fixture.nativeElement.textContent).toContain('Edit Settings');
    expect(fixture.nativeElement.textContent.match(/View Users/g)).toHaveLength(1);
    expect(fixture.nativeElement.textContent).not.toContain('Delete Users');
  });

  it('shows a no-permissions message for roles without permissions', () => {
    component.viewRole({
      id: 'role-2',
      name: 'Observer',
      isActive: true,
      permissions: []
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No permissions assigned.');
  });
});
