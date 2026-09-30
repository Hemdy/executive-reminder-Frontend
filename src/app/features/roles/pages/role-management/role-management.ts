import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RoleService } from '../../../../core/services/role.service';
import { ManagedRole, ManagedUser } from '../../../../core/models/role.model';

@Component({
  selector: 'app-role-management',
  imports: [ReactiveFormsModule],
  templateUrl: './role-management.html',
  styleUrl: './role-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleManagement {
  private readonly fb = inject(FormBuilder);
  readonly roleService = inject(RoleService);
  readonly selectedTab = signal<'users' | 'roles'>('users');
  readonly editingUserId = signal<string | null>(null);
  readonly editingRoleId = signal<string | null>(null);
  readonly showUserForm = signal(false);
  readonly showRoleForm = signal(false);
  readonly selectedRole = signal<ManagedRole | null>(null);
  readonly statusMessage = signal('');
  readonly formError = signal('');
  readonly permissionOptions = [
    ['dashboard:view', 'Dashboard — View'],
    ['reminders:read', 'Reminders — View'],
    ['reminders:write', 'Reminders — Create/Edit/Delete'],
    ['users:view', 'Users — View'],
    ['users:create', 'Users — Create'],
    ['users:edit', 'Users — Edit'],
    ['users:delete', 'Users — Delete'],
    ['roles:view', 'Roles — View'],
    ['roles:create', 'Roles — Create'],
    ['roles:edit', 'Roles — Edit'],
    ['roles:delete', 'Roles — Delete'],
    ['settings:view', 'Settings — View'],
    ['settings:edit', 'Settings — Edit']
  ] as const;
  readonly selectedPermissions = signal<string[]>([]);
  readonly allPermissionsSelected = computed(() =>
    this.permissionOptions.every(([permission]) => this.selectedPermissions().includes(permission))
  );
  readonly selectedRolePermissionGroups = computed(() => {
    const role = this.selectedRole();
    if (!role) {
      return [];
    }

    const knownPermissions = new Set<string>(
      this.permissionOptions.map(([permission]) => permission)
    );
    const assignedPermissions = new Set(role.permissions);
    const groups = new Map<string, { label: string; permissions: string[] }>();

    for (const [permission] of this.permissionOptions) {
      if (!assignedPermissions.has(permission)) {
        continue;
      }
      const resource = permission.split(':')[0];
      const group = groups.get(resource) ?? {
        label: this.resourceLabel(resource),
        permissions: []
      };
      group.permissions.push(permission);
      groups.set(resource, group);
    }

    for (const permission of assignedPermissions) {
      if (knownPermissions.has(permission)) {
        continue;
      }
      const resource = permission.split(':')[0];
      const group = groups.get(resource) ?? {
        label: this.resourceLabel(resource),
        permissions: []
      };
      group.permissions.push(permission);
      groups.set(resource, group);
    }

    return [...groups.values()];
  });

  readonly userForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.minLength(8)]],
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    role: ['EMPLOYEE', Validators.required]
  });

  readonly roleForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    description: ['', Validators.maxLength(200)],
    firstName: [''],
    lastName: [''],
    email: [''],
    password: ['']
  });

  readonly pageSummary = computed(
    () => `${this.roleService.users().length} users · ${this.roleService.roles().length} roles`
  );

  openNewUser(): void {
    this.editingUserId.set(null);
    this.userForm.reset({ email: '', password: '', firstName: '', lastName: '', role: 'EMPLOYEE' });
    this.showUserForm.set(true);
  }

  editUser(user: ManagedUser): void {
    this.editingUserId.set(user.id);
    this.userForm.reset({
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    });
    this.showUserForm.set(true);
  }

  saveUser(): void {
    if (this.userForm.invalid || (!this.editingUserId() && !this.userForm.controls.password.value)) {
      this.userForm.markAllAsTouched();
      return;
    }
    const value = this.userForm.getRawValue();
    const request = {
      email: value.email,
      firstName: value.firstName,
      lastName: value.lastName,
      role: value.role as ManagedUser['role'],
      ...(value.password ? { password: value.password } : {})
    };
    if (this.editingUserId()) {
      this.roleService.updateUser(this.editingUserId()!, request).subscribe({
        next: () => this.finishSave('User changes saved.'),
        error: error => this.showRequestError(error)
      });
    } else {
      this.roleService.createUser({ ...request, password: value.password }).subscribe({
        next: () => this.finishSave('User changes saved.'),
        error: error => this.showRequestError(error)
      });
    }
  }

  toggleUser(user: ManagedUser): void {
    this.roleService.setUserActive(user.id, !user.isActive).subscribe({
      error: error => this.showRequestError(error)
    });
  }

  removeUser(user: ManagedUser): void {
    if (confirm(`Delete ${user.firstName} ${user.lastName}?`)) {
      this.roleService.deleteUser(user.id).subscribe({
        error: error => this.showRequestError(error)
      });
    }
  }

  openNewRole(): void {
    this.editingRoleId.set(null);
    this.roleForm.reset({ name: '', description: '', firstName: '', lastName: '', email: '', password: '' });
    this.selectedPermissions.set([]);
    this.formError.set('');
    this.showRoleForm.set(true);
  }

  editRole(role: ManagedRole): void {
    this.editingRoleId.set(role.id);
    this.roleForm.reset({
      name: role.name,
      description: role.description ?? '',
      firstName: '',
      lastName: '',
      email: '',
      password: ''
    });
    this.selectedPermissions.set([...new Set(role.permissions)]);
    this.showRoleForm.set(true);
  }

  viewRole(role: ManagedRole): void {
    this.selectedRole.set(role);
  }

  closeRoleDetails(): void {
    this.selectedRole.set(null);
  }

  saveRole(): void {
    this.formError.set('');
    const value = this.roleForm.getRawValue();
    const creatingUser = !this.editingRoleId();
    const userFieldsValid = !creatingUser ||
      Boolean(value.firstName && value.lastName && value.email && value.password.length >= 8);
    if (this.roleForm.controls.name.invalid || !userFieldsValid) {
      this.roleForm.markAllAsTouched();
      this.formError.set('Enter a role name and complete all user details. Passwords must be at least 8 characters.');
      return;
    }
    const request = {
      name: value.name.trim().toUpperCase(),
      description: value.description || undefined,
      permissions: [...new Set(this.selectedPermissions())]
    };
    if (this.editingRoleId()) {
      this.roleService.updateRole(this.editingRoleId()!, request).subscribe({
        next: () => this.finishSave('Role changes saved.'),
        error: error => this.showRequestError(error)
      });
    } else {
      if (this.roleService.roles().some(role => role.name.toLowerCase() === request.name.toLowerCase())) {
        this.formError.set('A role with this name already exists.');
        return;
      }
      this.roleService.createRole(request).subscribe({
        next: role => {
          this.roleService.createUser({
            firstName: value.firstName,
            lastName: value.lastName,
            email: value.email,
            password: value.password,
            role: role.name,
            roleId: role.id
          }).subscribe({
            next: () => this.finishSave('Role and user created.')
            ,
            error: error => this.showRequestError(error)
          });
        },
        error: error => this.showRequestError(error)
      });
    }
  }

  toggleRole(role: ManagedRole): void {
    this.roleService.setRoleActive(role.id, !role.isActive).subscribe({
      error: error => this.showRequestError(error)
    });
  }

  removeRole(role: ManagedRole): void {
    if (confirm(`Delete the ${role.name} role?`)) {
      this.roleService.deleteRole(role.id).subscribe({
        error: error => this.showRequestError(error)
      });
    }
  }

  cancelForms(): void {
    this.showUserForm.set(false);
    this.showRoleForm.set(false);
  }

  togglePermission(permission: string): void {
    this.selectedPermissions.update(current =>
      current.includes(permission)
        ? current.filter(value => value !== permission)
        : [...current, permission]
    );
  }

  toggleAllPermissions(): void {
    this.selectedPermissions.set(
      this.allPermissionsSelected()
        ? []
        : [
            ...new Set([
              ...this.selectedPermissions(),
              ...this.permissionOptions.map(([permission]) => permission)
            ])
          ]
    );
  }

  hasPermission(permission: string): boolean {
    return this.selectedPermissions().includes(permission);
  }

  permissionLabel(permission: string): string {
    const [resource, action = 'view'] = permission.split(':');
    const knownOption = this.permissionOptions.find(([id]) => id === permission);
    const actionLabel = knownOption?.[1].split(' — ')[1] ?? this.titleCase(action);
    const readableAction = actionLabel === 'Create/Edit/Delete'
      ? 'Create, edit, and delete'
      : actionLabel;

    return `${readableAction} ${this.resourceLabel(resource)}`;
  }

  private resourceLabel(resource: string): string {
    return this.titleCase(resource);
  }

  private titleCase(value: string): string {
    return value
      .split(/[-_ ]+/)
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private finishSave(message: string): void {
    this.showUserForm.set(false);
    this.showRoleForm.set(false);
    this.statusMessage.set(message);
  }

  private showRequestError(error: unknown): void {
    const response = error as { error?: { message?: string }; message?: string };
    this.formError.set(response.error?.message ?? response.message ?? 'The request could not be completed.');
  }
}
