import { Injectable, computed, signal } from '@angular/core';
import { User, UserRole } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly currentUserSignal = signal<User | null>(null);

  readonly currentUser = this.currentUserSignal.asReadonly();

  readonly isAuthenticated = computed(
    () => this.currentUserSignal() !== null
  );

  loginAs(role: UserRole): void {
    const users: Record<UserRole, User> = {
      CEO: {
        id: 'user-ceo',
        firstName: 'Michael',
        lastName: 'Anderson',
        email: 'ceo@exectrack.local',
        role: 'CEO'
      },

      EMPLOYEE: {
        id: 'user-employee',
        firstName: 'John',
        lastName: 'Doe',
        email: 'employee@exectrack.local',
        role: 'EMPLOYEE',
        department: 'Operations'
      },

      EXECUTIVE_ASSISTANT: {
        id: 'user-assistant',
        firstName: 'Sarah',
        lastName: 'Williams',
        email: 'assistant@exectrack.local',
        role: 'EXECUTIVE_ASSISTANT'
      },

      ADMIN: {
        id: 'user-admin',
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@exectrack.local',
        role: 'ADMIN'
      }
    };

    this.currentUserSignal.set(users[role]);
  }

  logout(): void {
    this.currentUserSignal.set(null);
  }

  hasRole(...roles: UserRole[]): boolean {
    const user = this.currentUserSignal();

    return user !== null && roles.includes(user.role);
  }
}