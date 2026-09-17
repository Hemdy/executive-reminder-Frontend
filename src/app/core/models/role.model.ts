import { User, UserRole } from './user.model';

export interface ManagedRole {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  permissions: string[];
}

export interface CreateManagedUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  roleId?: string;
}

export interface UpdateManagedUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  password?: string;
  roleId?: string;
}

export interface CreateManagedRoleRequest {
  name: string;
  description?: string;
  permissions: string[];
}

export interface UpdateManagedRoleRequest {
  name: string;
  description?: string;
  permissions: string[];
}

export interface ManagedUser extends User {
  isActive: boolean;
}
