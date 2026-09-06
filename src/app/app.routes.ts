


import { Routes } from '@angular/router';
import { MainLayout } from './layout/main-layout/main-layout';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [

  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login/login')
        .then(m => m.Login)
  },

  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [

      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/pages/ceo-dashboard/ceo-dashboard')
            .then(m => m.CeoDashboard)
      },

    //   {
    //     path: 'tasks',
    //     loadComponent: () =>
    //       import('./features/tasks/pages/task-list/task-list.component')
    //         .then(m => m.TaskListComponent)
    //   },

    //   {
    //     path: 'reminders',
    //     loadComponent: () =>
    //       import('./features/reminders/pages/reminder-list/reminder-list.component')
    //         .then(m => m.ReminderListComponent)
    //   },

    //   {
    //     path: 'requests',
    //     loadComponent: () =>
    //       import('./features/requests/pages/request-list/request-list.component')
    //         .then(m => m.RequestListComponent)
    //   },

    //   {
    //     path: 'meetings',
    //     loadComponent: () =>
    //       import('./features/meetings/pages/meeting-list/meeting-list.component')
    //         .then(m => m.MeetingListComponent)
    //   },

    //   {
    //     path: 'calendar',
    //     loadComponent: () =>
    //       import('./features/calendar/pages/calendar/calendar.component')
    //         .then(m => m.CalendarComponent)
    //   },

    //   {
    //     path: 'notifications',
    //     loadComponent: () =>
    //       import('./features/notifications/pages/notification-center/notification-center.component')
    //         .then(m => m.NotificationCenterComponent)
    //   },

    //   {
    //     path: 'users',
    //     canActivate: [roleGuard(['ADMIN'])],
    //     loadComponent: () =>
    //       import('./features/users/pages/user-list/user-list.component')
    //         .then(m => m.UserListComponent)
    //   },

    //   {
    //     path: 'settings',
    //     canActivate: [roleGuard(['ADMIN'])],
    //     loadComponent: () =>
    //       import('./features/settings/pages/settings/settings.component')
    //         .then(m => m.SettingsComponent)
    //   },

      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      }

    ]
  },

  {
    path: '**',
    redirectTo: 'dashboard'
  }

];