import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  Input,
  Output,
  viewChild,
} from '@angular/core';
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
  @Input() hasBottomNav = false;
  @Output() readonly toggleMobileSidebar = new EventEmitter<void>();

  private readonly profileMenuRef = viewChild<ElementRef<HTMLElement>>('profileMenu');

  profileOpen = false;
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);
  readonly unreadNotificationCount = this.notificationService.unreadCount;

  @HostListener('document:pointerdown', ['$event'])
  onDocumentPointerDown(event: Event): void {
    if (!this.profileOpen) {
      return;
    }

    const target = event.target as Node | null;
    const menuEl = this.profileMenuRef()?.nativeElement;
    if (!menuEl || (target && !menuEl.contains(target))) {
      this.profileOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.profileOpen) {
      this.profileOpen = false;
    }
  }

  toggleProfileMenu(): void {
    this.profileOpen = !this.profileOpen;
  }

  closeProfileMenu(): void {
    this.profileOpen = false;
  }

  logout(): void {
    this.profileOpen = false;
    this.authService.logout();
    void this.router.navigate(['/login']);
  }
}
