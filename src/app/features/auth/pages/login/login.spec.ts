import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, of, Subject } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { LoginCredentials } from '../../../../core/models/user.model';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;
  let loginRequest: Subject<boolean>;
  let authService: {
    login: ReturnType<typeof vi.fn>;
    getRememberedEmail: ReturnType<typeof vi.fn>;
    rememberEmail: ReturnType<typeof vi.fn>;
    clearRememberedEmail: ReturnType<typeof vi.fn>;
  };
  let loadingService: { begin: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    loginRequest = new Subject<boolean>();
    authService = {
      login: vi.fn((_credentials: LoginCredentials): Observable<boolean> => loginRequest.asObservable()),
      getRememberedEmail: vi.fn(() => null),
      rememberEmail: vi.fn(),
      clearRememberedEmail: vi.fn(),
    };
    loadingService = {
      begin: vi.fn(() => 1),
      end: vi.fn(),
    };
    router = {
      navigate: vi.fn(() => Promise.resolve(true)),
    };

    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: LoadingService, useValue: loadingService },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('prefills a previously remembered email without a password', () => {
    authService.getRememberedEmail.mockReturnValue('saved@example.com');

    fixture.destroy();
    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.loginForm.controls.email.value).toBe('saved@example.com');
    expect(component.loginForm.controls.password.value).toBe('');
    expect(component.loginForm.controls.rememberMe.value).toBe(true);
  });

  it('remembers only the email after successful login when selected', () => {
    component.loginForm.setValue({
      email: 'user@example.com',
      password: 'secret',
      rememberMe: true,
    });
    component.submit();
    loginRequest.next(true);

    expect(authService.rememberEmail).toHaveBeenCalledWith('user@example.com');
    expect(authService.login).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'secret',
    });
  });

  it('clears the remembered email when the checkbox is unchecked', () => {
    component.loginForm.controls.rememberMe.setValue(true);
    component.loginForm.controls.rememberMe.setValue(false);
    component.onRememberMeChange();

    expect(authService.clearRememberedEmail).toHaveBeenCalledOnce();
  });

  it('shows the loader and prevents duplicate login requests while submitting', () => {
    component.loginForm.setValue({
      email: 'user@example.com',
      password: 'secret',
      rememberMe: false,
    });

    component.submit();
    component.submit();

    expect(component.isSubmitting()).toBe(true);
    expect(authService.login).toHaveBeenCalledTimes(1);
    expect(loadingService.begin).toHaveBeenCalledWith('Signing you in...');

    loginRequest.next(false);
    loginRequest.complete();

    expect(component.isSubmitting()).toBe(false);
    expect(component.loginError()).toBe('Invalid email or password.');
    expect(loadingService.end).toHaveBeenCalledWith(1);
  });

  it('shows invalid-credential errors and allows a retry', async () => {
    component.loginForm.setValue({
      email: 'user@example.com',
      password: 'wrong',
      rememberMe: false,
    });
    component.submit();
    loginRequest.error(new HttpErrorResponse({ status: 401 }));

    expect(component.loginError()).toBe('Invalid email or password.');
    expect(component.isSubmitting()).toBe(false);
    expect(loadingService.end).toHaveBeenCalledWith(1);

    authService.login.mockReturnValue(of(true));
    component.loginForm.setValue({
      email: 'user@example.com',
      password: 'secret',
      rememberMe: false,
    });
    component.submit();

    expect(authService.login).toHaveBeenCalledTimes(2);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    await fixture.whenStable();
    expect(component.isSubmitting()).toBe(false);
  });

  it('reports a login-service connection failure and releases the loader', () => {
    component.loginForm.setValue({
      email: 'user@example.com',
      password: 'secret',
      rememberMe: false,
    });
    component.submit();
    loginRequest.error(new HttpErrorResponse({ status: 0 }));

    expect(component.loginError()).toBe(
      'Unable to connect to the sign-in service. Please try again.',
    );
    expect(component.isSubmitting()).toBe(false);
    expect(loadingService.end).toHaveBeenCalledWith(1);
  });

  it('keeps the loader until successful navigation completes', async () => {
    component.loginForm.setValue({
      email: 'user@example.com',
      password: 'secret',
      rememberMe: false,
    });

    component.submit();
    loginRequest.next(true);

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(loadingService.end).not.toHaveBeenCalled();

    await fixture.whenStable();

    expect(loadingService.end).toHaveBeenCalledWith(1);
    expect(component.isSubmitting()).toBe(false);
  });

  it('clears the loader if the login component is destroyed during a request', () => {
    component.loginForm.setValue({
      email: 'user@example.com',
      password: 'secret',
      rememberMe: false,
    });
    component.submit();

    fixture.destroy();

    expect(loadingService.end).toHaveBeenCalledWith(1);
  });
});
