import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY, Observable, catchError, finalize, map, of, takeUntil, tap, throwError } from 'rxjs';
import {
  CreateManagedRoleRequest,
  CreateManagedUserRequest,
  AssignableUser,
  ManagedRole,
  ManagedUser,
  UpdateManagedRoleRequest,
  UpdateManagedUserRequest
} from '../models/role.model';
import { UserRole } from '../models/user.model';
import { API_BASE_URL } from '../config/api.config';
import {
  bindAuthSessionLifecycle,
  currentAuthSessionVersion,
  isSameAuthSession,
  sessionEndedStream,
} from '../utils/session-scope';
import { AuthService } from './auth.service';

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
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = API_BASE_URL;

  private readonly usersSignal = signal<ManagedUser[]>([]);
  private readonly assignableUsersSignal = signal<AssignableUser[]>([]);
  private readonly rolesSignal = signal<ManagedRole[]>([]);
  readonly errorMessage = signal('');
  readonly usersLoading = signal(false);
  readonly usersError = signal('');
  readonly rolesLoading = signal(false);
  readonly rolesError = signal('');
  readonly assignableUsersLoading = signal(false);
  private rolesLoadSeq = 0;
  private usersLoadSeq = 0;
  private directoryLoadSeq = 0;

  readonly users = this.usersSignal.asReadonly();
  readonly assignableUsers = this.assignableUsersSignal.asReadonly();
  readonly roles = this.rolesSignal.asReadonly();
  readonly activeUsers = computed(() => this.usersSignal().filter(user => user.isActive));
  readonly activeRoles = computed(() => this.rolesSignal().filter(role => role.isActive));

  constructor() {
    bindAuthSessionLifecycle(this.auth, this.destroyRef, {
      onClear: () => this.resetState(),
      onUserChange: () => this.resetState(),
    });
  }

  loadRoles(): Observable<ManagedRole[]> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    if (!expectedUserId) {
      this.resetState();
      return of([]);
    }

    const requestSeq = ++this.rolesLoadSeq;
    this.rolesLoading.set(true);
    this.rolesError.set('');
    return this.http.get<ApiRole[]>(`${this.apiUrl}/roles`).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      map(roles => roles.map(role => this.toManagedRole(role))),
      tap(roles => {
        if (requestSeq === this.rolesLoadSeq && isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.rolesSignal.set(roles);
        }
      }),
      catchError(error => {
        if (requestSeq !== this.rolesLoadSeq || !isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          return EMPTY;
        }
        this.rolesError.set('Unable to load roles. Please try again.');
        return throwError(() => error);
      }),
      finalize(() => {
        if (requestSeq === this.rolesLoadSeq && isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.rolesLoading.set(false);
        }
      })
    );
  }

  loadUsers(): Observable<ManagedUser[]> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    if (!expectedUserId) {
      this.resetState();
      return of([]);
    }

    const requestSeq = ++this.usersLoadSeq;
    this.usersLoading.set(true);
    this.usersError.set('');
    return this.http.get<ManagedUser[]>(`${this.apiUrl}/users`).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(users => {
        if (requestSeq === this.usersLoadSeq && isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.usersSignal.set(users);
        }
      }),
      catchError(error => {
        if (requestSeq !== this.usersLoadSeq || !isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          return EMPTY;
        }
        this.usersError.set('Unable to load users. Please try again.');
        return throwError(() => error);
      }),
      finalize(() => {
        if (requestSeq === this.usersLoadSeq && isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.usersLoading.set(false);
        }
      })
    );
  }

  loadAssignableUsers(): Observable<AssignableUser[]> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    if (!expectedUserId) {
      this.resetState();
      return of([]);
    }

    const requestSeq = ++this.directoryLoadSeq;
    this.assignableUsersLoading.set(true);
    return this.http.get<AssignableUser[]>(`${this.apiUrl}/users/directory`).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(users => {
        if (requestSeq === this.directoryLoadSeq && isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.assignableUsersSignal.set(users);
        }
      }),
      finalize(() => {
        if (requestSeq === this.directoryLoadSeq && isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.assignableUsersLoading.set(false);
        }
      })
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

  deleteUser(id: string): Observable<{ id: string; deleted: boolean; softDeleted?: boolean }> {
    return this.http.delete<{ id: string; deleted: boolean; softDeleted?: boolean }>(`${this.apiUrl}/users/${id}`).pipe(
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

  private resetState(): void {
    this.rolesLoadSeq += 1;
    this.usersLoadSeq += 1;
    this.directoryLoadSeq += 1;
    this.usersSignal.set([]);
    this.assignableUsersSignal.set([]);
    this.rolesSignal.set([]);
    this.errorMessage.set('');
    this.usersError.set('');
    this.rolesError.set('');
    this.usersLoading.set(false);
    this.rolesLoading.set(false);
    this.assignableUsersLoading.set(false);
  }
}
