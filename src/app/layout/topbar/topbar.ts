import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './topbar.html',
  styleUrl: './topbar.scss',
})
export class Topbar {



  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  readonly unreadNotificationCount =
  this.notificationService.unreadCount;
  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
