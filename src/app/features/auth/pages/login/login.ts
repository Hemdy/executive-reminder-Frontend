

import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
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
  readonly loginError = signal('');
  readonly passwordVisible = signal(false);
  readonly loginForm = this.fb.nonNullable.group({
    email: ['ceo@example.com', [Validators.required, Validators.email]],
    password: ['password123', Validators.required]
  });

  submit(): void {
    this.loginError.set('');
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.loginError.set('Invalid email or password.');
      return;
    }

    this.authService.login(this.loginForm.getRawValue()).subscribe(success => {
      if (success) {
        this.router.navigate(['/dashboard']);
      } else {
        this.loginError.set('Invalid email or password.');
      }
    });
  }

  togglePassword(): void {
    this.passwordVisible.update(visible => !visible);
  }
}