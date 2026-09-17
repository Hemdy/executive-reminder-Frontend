import { HttpClient } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { LoginCredentials, User } from '../models/user.model';
import { API_BASE_URL } from '../config/api.config';

interface LoginResponse {
  accessToken: string;
  user: User;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly browser = isPlatformBrowser(this.platformId);
  private readonly currentUserSignal = signal<User | null>(this.readStoredUser());

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() =>
    this.browser &&
    this.currentUserSignal() !== null &&
    this.getStorage()?.getItem('accessToken') !== null
  );

  login(credentials: LoginCredentials): Observable<boolean> {
    return this.http.post<LoginResponse>(`${API_BASE_URL}/auth/login`, {
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password
    }).pipe(
      tap(response => this.storeSession(response)),
      map(() => true),
      catchError(() => of(false))
    );
  }

  logout(): void {
    const storage = this.getStorage();
    storage?.removeItem('accessToken');
    storage?.removeItem('currentUser');
    this.currentUserSignal.set(null);
  }

  getAccessToken(): string | null {
    return this.getStorage()?.getItem('accessToken') ?? null;
  }

  getInitials(user: User): string {
    return `${user.firstName.trim().charAt(0)}${user.lastName.trim().charAt(0)}`.toUpperCase();
  }

  hasRole(...roles: string[]): boolean {
    const user = this.currentUserSignal();
    return user !== null && roles.includes(user.role);
  }

  hasPermission(permission: string): boolean {
    const permissions = this.currentUserSignal()?.permissions ?? [];
    return permissions.includes('*') || permissions.includes(permission);
  }

  private storeSession(response: LoginResponse): void {
    const storage = this.getStorage();
    if (!storage) {
      this.currentUserSignal.set(null);
      return;
    }

    storage.setItem('accessToken', response.accessToken);
    storage.setItem('currentUser', JSON.stringify(response.user));
    this.currentUserSignal.set(response.user);
  }

  private readStoredUser(): User | null {
    const storage = this.getStorage();
    const serialized = storage?.getItem('currentUser');
    const token = storage?.getItem('accessToken');

    if (!serialized || !token) {
      return null;
    }

    try {
      return JSON.parse(serialized) as User;
    } catch {
      storage?.removeItem('accessToken');
      storage?.removeItem('currentUser');
      return null;
    }
  }

  private getStorage(): Storage | null {
    return this.browser ? sessionStorage : null;
  }
}
