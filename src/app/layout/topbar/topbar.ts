import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
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

  @Input() mobileSidebarOpen = false;
  @Output() readonly toggleMobileSidebar = new EventEmitter<void>();
  profileOpen = false;
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  readonly unreadNotificationCount =
  this.notificationService.unreadCount;
  logout(): void {
    this.profileOpen = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
