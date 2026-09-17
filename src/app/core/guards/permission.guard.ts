import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const permissionGuard = (permission: string): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    return authService.hasPermission(permission)
      ? true
      : router.createUrlTree(['/dashboard']);
  };
};
