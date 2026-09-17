import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import {
  CreateManagedRoleRequest,
  CreateManagedUserRequest,
  ManagedRole,
  ManagedUser,
  UpdateManagedRoleRequest,
  UpdateManagedUserRequest
} from '../models/role.model';
import { UserRole } from '../models/user.model';
import { API_BASE_URL } from '../config/api.config';

interface ApiPermission {
  action: string;
  resource: string;
}

interface ApiRole {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  permissions?: Array<{ permission: ApiPermission }>;
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_BASE_URL;

  private readonly usersSignal = signal<ManagedUser[]>([]);
  private readonly rolesSignal = signal<ManagedRole[]>([]);
  readonly errorMessage = signal('');

  readonly users = this.usersSignal.asReadonly();
  readonly roles = this.rolesSignal.asReadonly();
  readonly activeUsers = computed(() => this.usersSignal().filter(user => user.isActive));
  readonly activeRoles = computed(() => this.rolesSignal().filter(role => role.isActive));

  constructor() {
    this.loadRoles().subscribe({
      error: error => this.setError(error)
    });
    this.loadUsers().subscribe({
      error: error => this.setError(error)
    });
  }

  loadRoles(): Observable<ManagedRole[]> {
    return this.http.get<ApiRole[]>(`${this.apiUrl}/roles`).pipe(
      map(roles => roles.map(role => this.toManagedRole(role))),
      tap(roles => this.rolesSignal.set(roles))
    );
  }

  loadUsers(): Observable<ManagedUser[]> {
    return this.http.get<ManagedUser[]>(`${this.apiUrl}/users`).pipe(
      tap(users => this.usersSignal.set(users))
    );
  }

  createUser(request: CreateManagedUserRequest): Observable<ManagedUser> {
    return this.http.post<ManagedUser>(`${this.apiUrl}/users`, request).pipe(
      tap(() => {
        this.loadUsers().subscribe({ error: error => this.setError(error) });
      })
    );
  }

  updateUser(id: string, request: UpdateManagedUserRequest): Observable<ManagedUser> {
    return this.http.patch<ManagedUser>(`${this.apiUrl}/users/${id}`, request).pipe(
      tap(updatedUser => this.replaceUser(updatedUser))
    );
  }

  setUserActive(id: string, isActive: boolean): Observable<ManagedUser> {
    return this.http.patch<ManagedUser>(`${this.apiUrl}/users/${id}/status`, { isActive }).pipe(
      tap(updatedUser => this.replaceUser(updatedUser))
    );
  }

  deleteUser(id: string): Observable<{ id: string; deleted: boolean }> {
    return this.http.delete<{ id: string; deleted: boolean }>(`${this.apiUrl}/users/${id}`).pipe(
      tap(() => this.usersSignal.update(users => users.filter(user => user.id !== id)))
    );
  }

  createRole(request: CreateManagedRoleRequest): Observable<ManagedRole> {
    return this.http.post<ApiRole>(`${this.apiUrl}/roles`, this.toApiRoleRequest(request)).pipe(
      map(role => this.toManagedRole(role)),
      tap(role => this.rolesSignal.update(roles => [role, ...roles]))
    );
  }

  updateRole(id: string, request: UpdateManagedRoleRequest): Observable<ManagedRole> {
    return this.http.put<ApiRole>(`${this.apiUrl}/roles/${id}`, this.toApiRoleRequest(request)).pipe(
      map(role => this.toManagedRole(role)),
      tap(updatedRole => this.replaceRole(updatedRole))
    );
  }

  setRoleActive(id: string, isActive: boolean): Observable<ManagedRole> {
    return this.http.patch<ApiRole>(`${this.apiUrl}/roles/${id}/status`, { isActive }).pipe(
      map(role => this.toManagedRole(role)),
      tap(updatedRole => this.replaceRole(updatedRole))
    );
  }

  deleteRole(id: string): Observable<{ id: string; deleted: boolean }> {
    return this.http.delete<{ id: string; deleted: boolean }>(`${this.apiUrl}/roles/${id}`).pipe(
      tap(() => this.rolesSignal.update(roles => roles.filter(role => role.id !== id)))
    );
  }

  roleOptions(): UserRole[] {
    return this.activeRoles().map(role => role.name as UserRole);
  }

  private toManagedRole(role: ApiRole): ManagedRole {
    return {
      id: role.id,
      name: role.name,
      description: role.description ?? undefined,
      isActive: role.isActive,
      permissions: role.permissions?.map(({ permission }) =>
        `${permission.resource}:${permission.action}`
      ) ?? []
    };
  }

  private toApiRoleRequest(request: CreateManagedRoleRequest | UpdateManagedRoleRequest) {
    return {
      name: request.name,
      description: request.description,
      permissions: request.permissions.map(permission => {
        const separator = permission.indexOf(':');
        return {
          resource: separator >= 0 ? permission.slice(0, separator) : permission,
          action: separator >= 0 ? permission.slice(separator + 1) : 'view'
        };
      })
    };
  }

  private replaceUser(user: ManagedUser): void {
    this.usersSignal.update(users => users.map(existing => existing.id === user.id ? user : existing));
  }

  private replaceRole(role: ManagedRole): void {
    this.rolesSignal.update(roles => roles.map(existing => existing.id === role.id ? role : existing));
  }

  private setError(error: unknown): void {
    this.errorMessage.set(error instanceof Error ? error.message : 'Unable to load role management data.');
  }
}
