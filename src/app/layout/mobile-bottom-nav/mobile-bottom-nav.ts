import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  EventEmitter,
  HostListener,
  inject,
  Output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, NavigationStart, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

export interface QuickActionItem {
  id: 'request' | 'task' | 'reminder' | 'meeting';
  label: string;
  route: string;
  icon: string;
  tier: 'top' | 'bottom';
  side: 'left' | 'right';
}

export interface WorkspaceNavItem {
  id: 'requests' | 'meetings' | 'tasks' | 'reminders' | 'roles';
  label: string;
  description: string;
  route: string;
  icon: string;
  tone: 'request' | 'meeting' | 'task' | 'reminder' | 'role';
}

@Component({
  selector: 'app-mobile-bottom-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './mobile-bottom-nav.html',
  styleUrl: './mobile-bottom-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileBottomNav {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  @Output() readonly menuOpened = new EventEmitter<void>();

  readonly activeMenu = signal<'fab' | 'workspace' | null>(null);
  readonly currentUrl = signal(this.router.url || '/dashboard');

  readonly isFabOpen = computed(() => this.activeMenu() === 'fab');
  readonly isWorkspaceOpen = computed(() => this.activeMenu() === 'workspace');
  readonly hasOpenMenu = computed(() => this.activeMenu() !== null);

  readonly isWorkspaceRoute = computed(() => {
    const url = this.currentUrl();
    return ['/requests', '/meetings', '/tasks', '/reminders', '/roles'].some((prefix) =>
      url.startsWith(prefix),
    );
  });

  readonly canViewRoles = computed(() => this.authService.hasPermission('roles:view'));

  readonly topArcActions: readonly QuickActionItem[] = [
    {
      id: 'task',
      label: 'New Task',
      route: '/tasks/new',
      icon: 'fa-solid fa-square-check',
      tier: 'top',
      side: 'left',
    },
    {
      id: 'reminder',
      label: 'New Reminder',
      route: '/reminders/new',
      icon: 'fa-solid fa-bell',
      tier: 'top',
      side: 'right',
    },
  ];

  readonly bottomArcActions: readonly QuickActionItem[] = [
    {
      id: 'request',
      label: 'New Request',
      route: '/requests/new',
      icon: 'fa-solid fa-paper-plane',
      tier: 'bottom',
      side: 'left',
    },
    {
      id: 'meeting',
      label: 'New Meeting',
      route: '/meetings/new',
      icon: 'fa-solid fa-calendar-plus',
      tier: 'bottom',
      side: 'right',
    },
  ];

  readonly workspaceItems: readonly WorkspaceNavItem[] = [
    {
      id: 'requests',
      label: 'Requests',
      description: 'Approvals & filings',
      route: '/requests',
      icon: 'fa-solid fa-file-lines',
      tone: 'request',
    },
    {
      id: 'meetings',
      label: 'Meetings',
      description: 'Agendas & schedules',
      route: '/meetings',
      icon: 'fa-solid fa-users',
      tone: 'meeting',
    },
    {
      id: 'tasks',
      label: 'Tasks',
      description: 'Assigned action items',
      route: '/tasks',
      icon: 'fa-solid fa-list-check',
      tone: 'task',
    },
    {
      id: 'reminders',
      label: 'Reminders',
      description: 'Alerts & follow-ups',
      route: '/reminders',
      icon: 'fa-regular fa-clock',
      tone: 'reminder',
    },
  ];

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationStart | NavigationEnd =>
          event instanceof NavigationStart || event instanceof NavigationEnd,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          this.activeMenu.set(null);
          return;
        }
        this.currentUrl.set(event.urlAfterRedirects || event.url);
      });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.hasOpenMenu()) {
      this.closeMenus();
    }
  }

  toggleFabMenu(): void {
    const next = this.isFabOpen() ? null : 'fab';
    this.activeMenu.set(next);
    if (next !== null) {
      this.menuOpened.emit();
    }
  }

  toggleWorkspaceMenu(): void {
    const next = this.isWorkspaceOpen() ? null : 'workspace';
    this.activeMenu.set(next);
    if (next !== null) {
      this.menuOpened.emit();
    }
  }

  closeMenus(): void {
    this.activeMenu.set(null);
  }

  selectQuickAction(route: string): void {
    this.closeMenus();
    void this.router.navigateByUrl(route);
  }

  selectWorkspaceRoute(route: string): void {
    this.closeMenus();
    void this.router.navigateByUrl(route);
  }
}
