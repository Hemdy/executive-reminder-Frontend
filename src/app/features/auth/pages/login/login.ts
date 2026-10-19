

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
  readonly passwordVisible = signal(false);
  readonly isSubmitting = signal(false);
  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  private loadingTask: number | null = null;
  private loginSubscription: Subscription | null = null;
  private navigationStarted = false;

  constructor() {
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
    this.loginSubscription = this.authService.login(this.loginForm.getRawValue()).pipe(
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

  private finishLogin(): void {
    if (this.loadingTask !== null) {
      this.loading.end(this.loadingTask);
      this.loadingTask = null;
    }
    this.isSubmitting.set(false);
  }
}