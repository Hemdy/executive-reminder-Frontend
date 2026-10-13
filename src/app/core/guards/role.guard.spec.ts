import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';

import { AuthService } from '../services/auth.service';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  let isAdmin: boolean;

  beforeEach(() => {
    isAdmin = false;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { hasRole: (...roles: string[]) => isAdmin && roles.includes('ADMIN') }
        }
      ]
    });
  });

  function activateRolesRoute() {
    return TestBed.runInInjectionContext(() =>
      roleGuard(['ADMIN'])({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
  }

  it('allows Admin users to access the Roles route', () => {
    isAdmin = true;

    expect(activateRolesRoute()).toBe(true);
  });

  it('redirects non-Admin users away from the Roles route', () => {
    const result = activateRolesRoute();

    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/dashboard');
  });
});
