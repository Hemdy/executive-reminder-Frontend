export type UserRole =
  | 'CEO'
  | 'EMPLOYEE'
  | 'EXECUTIVE_ASSISTANT'
  | 'ADMIN';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  department?: string;
  avatarUrl?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}