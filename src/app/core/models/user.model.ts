export type UserRole =
  | 'CEO'
  | 'EXECUTIVE_ADMIN'
  | 'EMPLOYEE'
  | 'EXECUTIVE_ASSISTANT'
  | 'ADMIN'
  | (string & {});

export interface User {
  id: string;
  title?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  role: UserRole;
  permissions?: string[];
  isActive?: boolean;
  department?: string;
  avatarUrl?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}