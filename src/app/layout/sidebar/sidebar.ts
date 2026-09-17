import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../core/models/user.model';

interface NavigationItem {
  label: string;
  icon: string;
  route: string;
  roles?: string[];
  permission?: string;
}

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class Sidebar {

  @Input() collapsed = false;
  @Input() mobileOpen = false;
  @Output() readonly closeMobile = new EventEmitter<void>();
  @Output() readonly toggleSidebar = new EventEmitter<void>();
  mobileProfileOpen = false;

  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly navigation: NavigationItem[] = [
    {
      label: 'Dashboard',
      icon: '⌂',
      route: '/dashboard'
    },
    {
      label: 'Tasks',
      icon: '✓',
      route: '/tasks'
    },
    {
      label: 'Reminders',
      icon: '◷',
      route: '/reminders'
    },
    {
      label: 'Requests',
      icon: '▣',
      route: '/requests'
    },
    {
      label: 'Meetings',
      icon: '▦',
      route: '/meetings'
    },
    {
      label: 'Calendar',
      icon: '□',
      route: '/calendar'
    },
    {
      label: 'Notifications',
      icon: '♢',
      route: '/notifications'
    },
  ];

  readonly adminNavigation: NavigationItem[] = [
    {
      label: 'Roles',
      icon: '♢',
      route: '/roles',
      permission: 'roles:view'
    },
    {
      label: 'Users',
      icon: '♙',
      route: '/users',
      permission: 'users:view'
    },
    {
      label: 'Settings',
      icon: '⚙',
      route: '/settings',
      permission: 'settings:view'
    }
  ];

  isVisible(item: NavigationItem): boolean {
    if (item.permission) {
      return this.authService.hasPermission(item.permission);
    }

    if (!item.roles?.length) {
      return true;
    }

    return this.authService.hasRole(...(item.roles as UserRole[]));
  }

  logout(): void {
    this.mobileProfileOpen = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}