import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const browser = isPlatformBrowser(inject(PLATFORM_ID));
  const token = authService.getAccessToken();
  const isLoginRequest = req.url.endsWith('/auth/login');
  const request = token && !isLoginRequest
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError(error => {
      if (browser && error instanceof HttpErrorResponse && error.status === 401 && !isLoginRequest) {
        authService.logout();
        void router.navigate(['/login']);
      }

      return throwError(() => error);
    })
  );
};
