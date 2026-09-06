

import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { UserRole } from '../../../../core/models/user.model';
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {


  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  login(role: UserRole): void {
    this.authService.loginAs(role);
    this.router.navigate(['/dashboard']);
  }
}