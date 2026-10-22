import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../config/api.config';
import { LoginCredentials, User } from '../models/user.model';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

  const credentials: LoginCredentials = {
    email: 'user@example.com',
    password: 'test-password',
  };
  const user: User = {
    id: 'user-id',
    email: 'user@example.com',
    firstName: 'Director',
    lastName: 'User',
    role: 'CEO',
  };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('posts the original credentials and stores the returned session', () => {
    let authenticated = false;

    service.login(credentials).subscribe(success => {
      authenticated = success;
    });

    const request = httpTesting.expectOne(`${API_BASE_URL}/auth/login`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      email: 'user@example.com',
      password: 'test-password',
    });

    request.flush({ accessToken: 'session-token', user });

    expect(authenticated).toBe(true);
    expect(sessionStorage.getItem('accessToken')).toBe('session-token');
    expect(JSON.parse(sessionStorage.getItem('currentUser') ?? 'null')).toEqual(user);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('propagates authentication failures to the caller', () => {
    let responseStatus: number | undefined;

    service.login(credentials).subscribe({
      error: error => {
        responseStatus = error.status;
      },
    });

    httpTesting.expectOne(`${API_BASE_URL}/auth/login`).flush(
      { message: 'Invalid credentials' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(responseStatus).toBe(401);
    expect(sessionStorage.getItem('accessToken')).toBeNull();
  });

  it('stores and clears only a normalized remembered email', () => {
    service.rememberEmail(' User@Example.com ');

    expect(service.getRememberedEmail()).toBe('user@example.com');
    expect(localStorage.getItem('rememberedEmail')).toBe('user@example.com');
    expect(localStorage.length).toBe(1);

    service.clearRememberedEmail();

    expect(service.getRememberedEmail()).toBeNull();
    expect(localStorage.length).toBe(0);
  });
});
