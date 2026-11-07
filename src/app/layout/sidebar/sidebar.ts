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
    icon: 'fa-solid fa-house',
    route: '/dashboard'
  },
  {
    label: 'Tasks',
    icon: 'fa-solid fa-list-check',
    route: '/tasks'
  },
  {
    label: 'Reminders',
    icon: 'fa-regular fa-clock',
    route: '/reminders'
  },
  {
    label: 'Requests',
    icon: 'fa-solid fa-file-lines',
    route: '/requests'
  },
  {
    label: 'Meetings',
    icon: 'fa-solid fa-users',
    route: '/meetings'
  },
  {
    label: 'Calendar',
    icon: 'fa-solid fa-calendar-days',
    route: '/calendar'
  },
  // {
  //   label: 'Notifications',
  //   icon: 'fa-solid fa-bell',
  //   route: '/notifications'
  // },
  {
    label: 'Settings',
    icon: 'fa-solid fa-gear',
    route: '/settings'
  },
];

readonly adminNavigation: NavigationItem[] = [
  {
    label: 'Roles',
    icon: 'fa-solid fa-user-shield',
    route: '/roles',
    permission: 'roles:view'
  },

    // {
    //   label: 'Users',
    //   icon: 'fa-solid fa-user',
    //   route: '/users',
    //   permission: 'users:view'
    // },
  ];

  isVisible(item: NavigationItem): boolean {
    const hasRequiredRole =
      !item.roles?.length || this.authService.hasRole(...(item.roles as UserRole[]));
    const hasRequiredPermission =
      !item.permission || this.authService.hasPermission(item.permission);
    return hasRequiredRole && hasRequiredPermission;
  }

  isAdministrationVisible(): boolean {
    return this.adminNavigation.some(item => this.isVisible(item));
  }

  logout(): void {
    this.mobileProfileOpen = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}