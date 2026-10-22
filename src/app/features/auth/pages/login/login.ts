

import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { LoadingService } from '../../../../core/services/loading.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly loading = inject(LoadingService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loginError = signal('');
  readonly rememberMeError = signal('');
  readonly passwordVisible = signal(false);
  readonly isSubmitting = signal(false);
  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    rememberMe: [false]
  });

  private loadingTask: number | null = null;
  private loginSubscription: Subscription | null = null;
  private navigationStarted = false;

  constructor() {
    try {
      const rememberedEmail = this.authService.getRememberedEmail();
      if (rememberedEmail) {
        this.loginForm.patchValue({ email: rememberedEmail, rememberMe: true });
      }
    } catch (error) {
      console.error('Unable to load remembered sign-in email', error);
      this.rememberMeError.set('Remember Me is unavailable in this browser.');
    }

    this.destroyRef.onDestroy(() => {
      if (!this.navigationStarted && this.loadingTask !== null) {
        this.loginSubscription?.unsubscribe();
        this.finishLogin();
      }
    });
  }

  submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    this.loginError.set('');
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.loginError.set('Invalid email or password.');
      return;
    }

    this.isSubmitting.set(true);
    this.loadingTask = this.loading.begin('Signing you in...');
    const { email, password } = this.loginForm.getRawValue();
    this.loginSubscription = this.authService.login({ email, password }).pipe(
      finalize(() => {
        if (!this.navigationStarted) {
          this.finishLogin();
        }
      }),
    ).subscribe({
      next: success => {
        if (!success) {
          this.loginError.set('Invalid email or password.');
          return;
        }

        this.updateRememberedEmail(email);
        this.navigationStarted = true;
        void this.router.navigate(['/dashboard']).then(
          navigated => {
            if (!navigated) {
              this.loginError.set('Unable to open your workspace. Please try again.');
            }
            this.navigationStarted = false;
            this.finishLogin();
          },
          () => {
            this.loginError.set('Unable to open your workspace. Please try again.');
            this.navigationStarted = false;
            this.finishLogin();
          },
        );
      },
      error: error => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          this.loginError.set('Invalid email or password.');
        } else if (error instanceof HttpErrorResponse && error.status === 0) {
          this.loginError.set('Unable to connect to the sign-in service. Please try again.');
        } else {
          this.loginError.set('Unable to sign in right now. Please try again.');
        }
      },
    });
  }

  togglePassword(): void {
    this.passwordVisible.update(visible => !visible);
  }

  onRememberMeChange(): void {
    this.rememberMeError.set('');
    if (this.loginForm.controls.rememberMe.value) {
      return;
    }

    try {
      this.authService.clearRememberedEmail();
    } catch (error) {
      console.error('Unable to clear remembered sign-in email', error);
      this.rememberMeError.set('Unable to remove the saved email from this browser.');
    }
  }

  private updateRememberedEmail(email: string): void {
    this.rememberMeError.set('');
    try {
      if (this.loginForm.controls.rememberMe.value) {
        this.authService.rememberEmail(email);
      } else {
        this.authService.clearRememberedEmail();
      }
    } catch (error) {
      console.error('Unable to save remembered sign-in email', error);
      this.rememberMeError.set('You are signed in, but your email could not be saved on this browser.');
    }
  }

  private finishLogin(): void {
    if (this.loadingTask !== null) {
      this.loading.end(this.loadingTask);
      this.loadingTask = null;
    }
    this.isSubmitting.set(false);
  }
}