import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnInit,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContentSkeleton } from '../../../../core/components/content-skeleton/content-skeleton';
import { AuthService } from '../../../../core/services/auth.service';
import { RoleService } from '../../../../core/services/role.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ManagedRole, ManagedUser } from '../../../../core/models/role.model';
import { finalize, switchMap } from 'rxjs';

@Component({
  selector: 'app-role-management',
  imports: [ReactiveFormsModule, ContentSkeleton],
  templateUrl: './role-management.html',
  styleUrl: './role-management.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleManagement implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly injector = inject(Injector);
  private readonly toast = inject(ToastService);
  readonly authService = inject(AuthService);
  readonly roleService = inject(RoleService);
  readonly usersLoading = this.roleService.usersLoading ?? signal(false);
  readonly usersError = this.roleService.usersError ?? signal('');
  readonly rolesLoading = this.roleService.rolesLoading ?? signal(false);
  readonly rolesError = this.roleService.rolesError ?? signal('');

  retryLoadUsers(): void {
    this.roleService.loadUsers().subscribe({
      error: error => console.error('Unable to reload users', error),
    });
  }

  retryLoadRoles(): void {
    this.roleService.loadRoles().subscribe({
      error: error => console.error('Unable to reload roles', error),
    });
  }
  readonly selectedTab = signal<'users' | 'roles'>('roles');
  readonly editingUserId = signal<string | null>(null);
  readonly editingRoleId = signal<string | null>(null);
  readonly showUserForm = signal(false);
  readonly showRoleForm = signal(false);
  readonly isSavingUser = signal(false);
  readonly isSavingRole = signal(false);
  readonly userActionId = signal<string | null>(null);
  readonly userAction = signal<'status' | 'delete' | null>(null);
  readonly selectedRole = signal<ManagedRole | null>(null);
  readonly formError = signal('');
  private readonly userEditor = viewChild<ElementRef<HTMLFormElement>>('userEditor');
  private readonly roleEditor = viewChild<ElementRef<HTMLFormElement>>('roleEditor');
  readonly canManageRoles = computed(() =>
    this.authService.hasRole('ADMIN', 'DIRECTOR') &&
    this.authService.hasPermission('roles:edit')
  );
readonly permissionOptions = [
  ['dashboard:view', 'Dashboard — View'],

  // Tasks
  ['tasks:read', 'Tasks — View'],
  ['tasks:write', 'Tasks — Create/Edit/Delete'],

  // Reminders
  ['reminders:read', 'Reminders — View'],
  ['reminders:write', 'Reminders — Create/Edit/Delete'],

  // Requests
  ['requests:read', 'Requests — View'],
  ['requests:write', 'Requests — Create/Edit/Delete'],

  // Meetings
  ['meetings:read', 'Meetings — View'],
  ['meetings:write', 'Meetings — Create/Edit/Delete'],

  // Users
  ['users:view', 'Users — View'],
  ['users:assign', 'Users — Assign to operational records'],
  ['users:create', 'Users — Create'],
  ['users:edit', 'Users — Edit'],
  ['users:delete', 'Users — Delete'],

  // Roles
  ['roles:view', 'Roles — View'],
  ['roles:create', 'Roles — Create'],
  ['roles:edit', 'Roles — Edit'],
  ['roles:delete', 'Roles — Delete'],

  // Settings
  ['settings:view', 'Settings — View'],
  ['settings:edit', 'Settings — Edit']
]  as const;
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
    () => `${this.authService.hasPermission('users:view') ? `${this.roleService.users().length} users · ` : ''}${this.roleService.roles().length} roles`
  );

  ngOnInit(): void {
    if (this.authService.hasPermission('users:view')) {
      this.selectedTab.set('users');
      this.roleService.loadUsers().subscribe({
        error: error => this.roleService.errorMessage.set(error.error?.message ?? 'Unable to load users.')
      });
    }

    this.roleService.loadRoles().subscribe({
      error: error => this.roleService.errorMessage.set(error.error?.message ?? 'Unable to load roles.')
    });
  }

  openNewUser(): void {
    this.editingUserId.set(null);
    const defaultRole = this.roleService.activeRoles()[0]?.name ?? 'ADMIN';
    this.userForm.reset({ email: '', password: '', firstName: '', lastName: '', role: defaultRole });
    this.formError.set('');
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
    this.formError.set('');
    this.showUserForm.set(true);
    this.scrollToEditor(() => this.userEditor());
  }

  saveUser(): void {
    if (this.isSavingUser()) {
      return;
    }
    if (this.userForm.invalid || (!this.editingUserId() && !this.userForm.controls.password.value)) {
      this.userForm.markAllAsTouched();
      this.formError.set('Please fill in all required fields. Passwords must be at least 8 characters.');
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
    this.isSavingUser.set(true);
    if (this.editingUserId()) {
      this.roleService.updateUser(this.editingUserId()!, request).pipe(
        finalize(() => this.isSavingUser.set(false))
      ).subscribe({
        next: () => {
          this.finishSave();
          this.toast.success('User details updated successfully.');
        },
        error: error => this.showRequestError(error, 'Unable to save user details.')
      });
    } else {
      this.roleService.createUser({ ...request, password: value.password }).pipe(
        finalize(() => this.isSavingUser.set(false))
      ).subscribe({
        next: () => {
          this.finishSave();
          this.toast.success('User details saved successfully.');
        },
        error: error => this.showRequestError(error, 'Unable to save user details.')
      });
    }
  }

  toggleUser(user: ManagedUser): void {
    if (this.userActionId()) {
      return;
    }
    this.userActionId.set(user.id);
    this.userAction.set('status');
    this.roleService.setUserActive(user.id, !user.isActive).pipe(
      finalize(() => {
        this.userActionId.set(null);
        this.userAction.set(null);
      })
    ).subscribe({
      next: () => this.toast.success(`User ${user.isActive ? 'deactivated' : 'reactivated'} successfully.`),
      error: error => this.showRequestError(error, 'Unable to update user status.')
    });
  }

  removeUser(user: ManagedUser): void {
    if (this.userActionId() || !confirm(`Delete ${user.firstName} ${user.lastName}?`)) {
      return;
    }
    this.userActionId.set(user.id);
    this.userAction.set('delete');
    this.roleService.deleteUser(user.id).pipe(
      finalize(() => {
        this.userActionId.set(null);
        this.userAction.set(null);
      })
    ).subscribe({
      next: () => this.toast.success('User deleted successfully.'),
      error: error => this.showRequestError(error, 'Unable to delete user.')
    });
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
    this.formError.set('');
    this.showRoleForm.set(true);
    this.scrollToEditor(() => this.roleEditor());
  }

  viewRole(role: ManagedRole): void {
    this.selectedRole.set(role);
  }

  closeRoleDetails(): void {
    this.selectedRole.set(null);
  }

  saveRole(): void {
    if (this.isSavingRole()) {
      return;
    }
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
    if (!this.editingRoleId() &&
      this.roleService.roles().some(role => role.name.toLowerCase() === request.name.toLowerCase())) {
      this.formError.set('A role with this name already exists.');
      return;
    }

    this.isSavingRole.set(true);
    if (this.editingRoleId()) {
      this.roleService.updateRole(this.editingRoleId()!, request).pipe(
        finalize(() => this.isSavingRole.set(false))
      ).subscribe({
        next: () => {
          this.finishSave();
          this.toast.success('Role updated successfully.');
        },
        error: error => this.showRequestError(error, 'Unable to update the role.')
      });
    } else {
      this.roleService.createRole(request).pipe(
        switchMap(role => this.roleService.createUser({
            firstName: value.firstName,
            lastName: value.lastName,
            email: value.email,
            password: value.password,
            role: role.name,
            roleId: role.id
          })),
        finalize(() => this.isSavingRole.set(false))
      ).subscribe({
        next: () => {
          this.finishSave();
          this.toast.success('Role added successfully.');
        },
        error: error => this.showRequestError(error, 'Unable to create the role and its initial user.')
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
    if (this.isSavingUser() || this.isSavingRole()) {
      return;
    }
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

  private finishSave(): void {
    this.showUserForm.set(false);
    this.showRoleForm.set(false);
    this.formError.set('');
  }

  private showRequestError(
    error: unknown,
    fallback = 'The request could not be completed.'
  ): void {
    const response = error as { error?: { message?: string }; message?: string };
    this.toast.error(response.error?.message ?? response.message ?? fallback);
  }

  private scrollToEditor(editor: () => ElementRef<HTMLFormElement> | undefined): void {
    afterNextRender(
      () => {
        if (
          typeof window !== 'undefined' &&
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(max-width: 700px)').matches
        ) {
          editor()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      },
      { injector: this.injector }
    );
  }
}
