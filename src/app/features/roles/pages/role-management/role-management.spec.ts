import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ManagedRole, ManagedUser } from '../../../../core/models/role.model';
import { AuthService } from '../../../../core/services/auth.service';
import { RoleService } from '../../../../core/services/role.service';
import { ToastService } from '../../../../core/services/toast.service';
import { RoleManagement } from './role-management';
import { Subject, of, tap, throwError } from 'rxjs';

describe('RoleManagement', () => {
  let component: RoleManagement;
  let fixture: ComponentFixture<RoleManagement>;
  const roles = signal<ManagedRole[]>([]);
  const users = signal<ManagedUser[]>([]);
  let currentRole = 'ADMIN';
  const permissions = [
    'roles:view', 'roles:edit', 'roles:create', 'roles:delete',
    'users:view', 'users:edit', 'users:delete'
  ];
  const savedUser: ManagedUser = {
    id: 'user-1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.com',
    role: 'EMPLOYEE',
    isActive: true
  };
  const savedRole: ManagedRole = {
    id: 'role-1',
    name: 'MANAGER',
    isActive: true,
    permissions: ['tasks:read']
  };
  const roleServiceMock = {
    users,
    roles,
    activeRoles: computed(() => roles().filter(role => role.isActive)),
    errorMessage: signal(''),
    loadRoles: vi.fn(() => of([])),
    loadUsers: vi.fn(() => of([])),
    createUser: vi.fn(() => of(savedUser)),
    updateUser: vi.fn(() => of(savedUser)),
    setUserActive: vi.fn((id: string, isActive: boolean) => {
      const updated = { ...savedUser, id, isActive };
      return of(updated).pipe(
        tap(user => users.update(current => current.map(existing => existing.id === user.id ? user : existing)))
      );
    }),
    deleteUser: vi.fn((id: string) => of({ id, deleted: true }).pipe(
      tap(() => users.update(current => current.filter(user => user.id !== id)))
    )),
    createRole: vi.fn(() => of(savedRole)),
    updateRole: vi.fn(() => of(savedRole)),
    setRoleActive: vi.fn(() => of(savedRole)),
    deleteRole: vi.fn(() => of({ id: savedRole.id, deleted: true }))
  };
  const authServiceMock = {
    hasRole: (...names: string[]) => names.includes(currentRole),
    hasPermission: (permission: string) => permissions.includes(permission)
  };
  const setViewport = (mobile: boolean): void => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: mobile })
    });
  };

  beforeEach(async () => {
    setViewport(false);
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn()
    });
    roles.set([]);
    users.set([]);
    currentRole = 'ADMIN';
    permissions.splice(
      0,
      permissions.length,
      'roles:view', 'roles:edit', 'roles:create', 'roles:delete',
      'users:view', 'users:edit', 'users:delete'
    );
    roleServiceMock.loadRoles.mockClear();
    roleServiceMock.loadUsers.mockClear();
    roleServiceMock.createUser.mockReset().mockReturnValue(of(savedUser));
    roleServiceMock.updateUser.mockReset().mockReturnValue(of(savedUser));
    roleServiceMock.setUserActive.mockReset().mockImplementation((id, isActive) => {
      const updated = { ...savedUser, id, isActive };
      return of(updated).pipe(
        tap(user => users.update(current => current.map(existing => existing.id === user.id ? user : existing)))
      );
    });
    roleServiceMock.deleteUser.mockReset().mockImplementation(id => of({ id, deleted: true }).pipe(
      tap(() => users.update(current => current.filter(user => user.id !== id)))
    ));
    roleServiceMock.createRole.mockReset().mockReturnValue(of(savedRole));
    roleServiceMock.updateRole.mockReset().mockReturnValue(of(savedRole));
    roleServiceMock.setRoleActive.mockClear();
    roleServiceMock.deleteRole.mockClear();
    await TestBed.configureTestingModule({
      imports: [RoleManagement],
      providers: [
        { provide: RoleService, useValue: roleServiceMock },
        { provide: AuthService, useValue: authServiceMock }
      ]
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

  it('loads role data through the role APIs when the module opens', () => {
    expect(roleServiceMock.loadRoles).toHaveBeenCalledOnce();
    expect(roleServiceMock.loadUsers).toHaveBeenCalledOnce();
  });

  it('does not request the full user list when the viewer lacks users:view', async () => {
    permissions.splice(0, permissions.length, 'roles:view');
    currentRole = 'COMPLIANCE OFFICER';
    roleServiceMock.loadRoles.mockClear();
    roleServiceMock.loadUsers.mockClear();
    fixture.destroy();
    fixture = TestBed.createComponent(RoleManagement);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(roleServiceMock.loadRoles).toHaveBeenCalled();
    expect(roleServiceMock.loadUsers).not.toHaveBeenCalled();
    expect(component.selectedTab()).toBe('roles');
  });

  it.each([
    { viewport: 'desktop', mobile: false },
    { viewport: 'mobile', mobile: true }
  ])('creates a user on $viewport and only toasts after the request succeeds', ({ mobile }) => {
    setViewport(mobile);
    const pendingSave = new Subject<ManagedUser>();
    roleServiceMock.createUser.mockReturnValue(pendingSave);
    const toast = TestBed.inject(ToastService);
    component.openNewUser();
    component.userForm.setValue({
      email: savedUser.email,
      password: 'valid-pass',
      firstName: savedUser.firstName,
      lastName: savedUser.lastName,
      role: savedUser.role
    });

    component.saveUser();
    fixture.detectChanges();

    expect(component.isSavingUser()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Saving User...');
    expect(toast.current()).toBeNull();
    component.saveUser();
    expect(roleServiceMock.createUser).toHaveBeenCalledOnce();

    pendingSave.next(savedUser);
    pendingSave.complete();
    fixture.detectChanges();
    expect(component.isSavingUser()).toBe(false);
    expect(toast.current()?.message).toBe('User details saved successfully.');
    expect(component.showUserForm()).toBe(false);
  });

  it.each([
    { viewport: 'desktop', mobile: false },
    { viewport: 'mobile', mobile: true }
  ])('updates a user on $viewport with the contextual success toast', ({ mobile }) => {
    setViewport(mobile);
    const toast = TestBed.inject(ToastService);
    component.editUser(savedUser);
    component.saveUser();

    expect(roleServiceMock.updateUser).toHaveBeenCalledOnce();
    expect(toast.current()?.message).toBe('User details updated successfully.');
  });

  it('shows a user save error toast and restores the save state', () => {
    roleServiceMock.updateUser.mockReturnValue(
      throwError(() => ({ error: { message: 'User update failed.' } }))
    );
    const toast = TestBed.inject(ToastService);
    component.editUser(savedUser);
    component.saveUser();

    expect(component.isSavingUser()).toBe(false);
    expect(toast.current()).toMatchObject({
      type: 'error',
      message: 'User update failed.'
    });
  });

  it('deactivates and reactivates users with progress feedback and duplicate-submit protection', () => {
    const pendingStatus = new Subject<ManagedUser>();
    roleServiceMock.setUserActive.mockReturnValue(pendingStatus.pipe(
      tap(updated => users.update(current =>
        current.map(existing => existing.id === updated.id ? updated : existing)
      ))
    ));
    users.set([savedUser]);
    const toast = TestBed.inject(ToastService);

    component.toggleUser(savedUser);
    fixture.detectChanges();

    expect(component.userActionId()).toBe(savedUser.id);
    expect(fixture.nativeElement.textContent).toContain('Deactivating...');
    component.toggleUser(savedUser);
    expect(roleServiceMock.setUserActive).toHaveBeenCalledOnce();

    pendingStatus.next({ ...savedUser, isActive: false });
    pendingStatus.complete();
    fixture.detectChanges();
    expect(component.userActionId()).toBeNull();
    expect(users()[0].isActive).toBe(false);
    expect(toast.current()?.message).toBe('User deactivated successfully.');

    roleServiceMock.setUserActive.mockReturnValue(of({ ...savedUser, isActive: true }));
    component.toggleUser({ ...savedUser, isActive: false });
    expect(roleServiceMock.setUserActive).toHaveBeenLastCalledWith(savedUser.id, true);
    expect(toast.current()?.message).toBe('User reactivated successfully.');
  });

  it('soft-deletes a user with progress feedback and refreshes the local list on success', () => {
    const pendingDelete = new Subject<{ id: string; deleted: boolean }>();
    roleServiceMock.deleteUser.mockReturnValue(pendingDelete.pipe(
      tap(() => users.update(current => current.filter(user => user.id !== savedUser.id)))
    ));
    users.set([savedUser]);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const toast = TestBed.inject(ToastService);

    component.removeUser(savedUser);
    fixture.detectChanges();

    expect(component.userActionId()).toBe(savedUser.id);
    expect(fixture.nativeElement.textContent).toContain('Deleting...');
    component.removeUser(savedUser);
    expect(roleServiceMock.deleteUser).toHaveBeenCalledOnce();

    pendingDelete.next({ id: savedUser.id, deleted: true });
    pendingDelete.complete();
    fixture.detectChanges();
    expect(component.userActionId()).toBeNull();
    expect(users()).toEqual([]);
    expect(toast.current()?.message).toBe('User deleted successfully.');
    confirmSpy.mockRestore();
  });

  it('shows an error and restores user action controls when deactivation fails', () => {
    roleServiceMock.setUserActive.mockReturnValue(
      throwError(() => ({ error: { message: 'The last active administrator cannot be deactivated.' } }))
    );
    const toast = TestBed.inject(ToastService);

    component.toggleUser(savedUser);

    expect(component.userActionId()).toBeNull();
    expect(toast.current()).toMatchObject({
      type: 'error',
      message: 'The last active administrator cannot be deactivated.'
    });
  });

  it('shows a deletion error and restores the delete control', () => {
    roleServiceMock.deleteUser.mockReturnValue(
      throwError(() => ({ error: { message: 'User deletion failed.' } }))
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const toast = TestBed.inject(ToastService);

    component.removeUser(savedUser);

    expect(component.userActionId()).toBeNull();
    expect(toast.current()).toMatchObject({
      type: 'error',
      message: 'User deletion failed.'
    });
    confirmSpy.mockRestore();
  });

  it.each([
    { viewport: 'desktop', mobile: false },
    { viewport: 'mobile', mobile: true }
  ])('creates a role on $viewport and its initial user before showing success', ({ mobile }) => {
    setViewport(mobile);
    const pendingRoleSave = new Subject<ManagedRole>();
    const pendingUserSave = new Subject<ManagedUser>();
    roleServiceMock.createRole.mockReturnValue(pendingRoleSave);
    roleServiceMock.createUser.mockReturnValue(pendingUserSave);
    const toast = TestBed.inject(ToastService);
    component.selectedTab.set('roles');
    component.openNewRole();
    component.roleForm.patchValue({
      name: 'Manager',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'valid-pass'
    });

    component.saveRole();
    fixture.detectChanges();
    expect(component.isSavingRole()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Saving Role...');
    expect(toast.current()).toBeNull();
    component.saveRole();
    expect(roleServiceMock.createRole).toHaveBeenCalledOnce();

    pendingRoleSave.next(savedRole);
    pendingRoleSave.complete();
    fixture.detectChanges();
    expect(roleServiceMock.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ role: savedRole.name, roleId: savedRole.id })
    );
    expect(component.isSavingRole()).toBe(true);
    expect(toast.current()).toBeNull();
    component.saveRole();
    expect(roleServiceMock.createRole).toHaveBeenCalledOnce();

    pendingUserSave.next(savedUser);
    pendingUserSave.complete();
    fixture.detectChanges();
    expect(component.isSavingRole()).toBe(false);
    expect(toast.current()?.message).toBe('Role added successfully.');
  });

  it.each([
    { viewport: 'desktop', mobile: false },
    { viewport: 'mobile', mobile: true }
  ])('updates a role on $viewport with the contextual success toast', ({ mobile }) => {
    setViewport(mobile);
    const toast = TestBed.inject(ToastService);
    component.editRole(savedRole);
    component.saveRole();

    expect(roleServiceMock.updateRole).toHaveBeenCalledOnce();
    expect(toast.current()?.message).toBe('Role updated successfully.');
  });

  it('shows a role save error toast and restores the save state', () => {
    roleServiceMock.updateRole.mockReturnValue(
      throwError(() => ({ error: { message: 'Role update failed.' } }))
    );
    const toast = TestBed.inject(ToastService);
    component.editRole(savedRole);
    component.saveRole();

    expect(component.isSavingRole()).toBe(false);
    expect(toast.current()).toMatchObject({
      type: 'error',
      message: 'Role update failed.'
    });
  });

  it('does not report role creation success when its initial user could not be created', () => {
    roleServiceMock.createUser.mockReturnValue(
      throwError(() => ({ error: { message: 'User creation failed.' } }))
    );
    const toast = TestBed.inject(ToastService);
    component.selectedTab.set('roles');
    component.openNewRole();
    component.roleForm.patchValue({
      name: 'Manager',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      password: 'valid-pass'
    });

    component.saveRole();

    expect(component.isSavingRole()).toBe(false);
    expect(component.showRoleForm()).toBe(true);
    expect(toast.current()).toMatchObject({
      type: 'error',
      message: 'User creation failed.'
    });
  });

  it('scrolls edited forms into view on mobile but not desktop', async () => {
    const originalMatchMedia = window.matchMedia;
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true })
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollIntoView
    });

    component.editUser(savedUser);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scrollIntoView).toHaveBeenCalledOnce();

    scrollIntoView.mockClear();
    component.selectedTab.set('roles');
    component.editRole(savedRole);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scrollIntoView).toHaveBeenCalledOnce();

    scrollIntoView.mockClear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false })
    });
    component.selectedTab.set('users');
    component.editUser(savedUser);
    fixture.detectChanges();
    await fixture.whenStable();
    component.selectedTab.set('roles');
    component.editRole(savedRole);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(scrollIntoView).not.toHaveBeenCalled();

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia
    });
    if (originalScrollIntoView) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: originalScrollIntoView
      });
    } else {
      delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
    }
  });
});
