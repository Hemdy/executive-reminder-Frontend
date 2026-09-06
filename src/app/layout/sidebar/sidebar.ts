import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface NavigationItem {
  label: string;
  icon: string;
  route: string;
  roles?: string[];
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



   readonly authService = inject(AuthService);

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
    }
  ];

  readonly adminNavigation: NavigationItem[] = [
    {
      label: 'Users',
      icon: '♙',
      route: '/users',
      roles: ['ADMIN']
    },
    {
      label: 'Settings',
      icon: '⚙',
      route: '/settings',
      roles: ['ADMIN']
    }
  ];

  isVisible(item: NavigationItem): boolean {
    if (!item.roles?.length) {
      return true;
    }

    return this.authService.hasRole(
      ...(item.roles as any)
    );
  }
}