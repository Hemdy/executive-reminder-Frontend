import { Routes } from '@angular/router';
import { MainLayout } from './layout/main-layout/main-layout';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/pages/login/login').then((m) => m.Login),
  },

  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/pages/ceo-dashboard/ceo-dashboard').then(
            (m) => m.CeoDashboard,
          ),
      },

      {
        path: 'tasks',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/tasks/pages/task-list/task-list').then((m) => m.TaskList),
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./features/tasks/pages/task-form/task-form').then((m) => m.TaskForm),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/tasks/pages/task-details/task-details').then((m) => m.TaskDetails),
          },
        ],
      },

      {
        path: 'reminders',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/reminders/pages/reminder-list/reminder-list').then(
                (m) => m.ReminderList,
              ),
          },
          {
            path: 'new',
            loadComponent: () =>
              import('./features/reminders/pages/reminder-form/reminder-form').then(
                (m) => m.ReminderForm,
              ),
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/reminders/pages/reminder-details/reminder-details').then(
                (m) => m.ReminderDetails,
              ),
          },
        ],
      },



      {
  path: 'requests',
  children: [
    {
      path: '',
      loadComponent: () =>
        import(
          './features/requests/pages/request-list/request-list'
        ).then(m => m.RequestList)
    },
    {
      path: 'new',
      loadComponent: () =>
        import(
          './features/requests/pages/request-form/request-form'
        ).then(m => m.RequestForm)
    },
    {
      path: ':id/edit',
      loadComponent: () =>
        import(
          './features/requests/pages/request-form/request-form'
        ).then(m => m.RequestForm)
    },
    {
      path: ':id',
      loadComponent: () =>
        import(
          './features/requests/pages/request-details/request-details'
        ).then(m => m.RequestDetails)
    }
  ]
},
      {
  path: 'meetings',
  children: [
    {
      path: '',
      loadComponent: () =>
        import(
          './features/meetings/pages/meeting-list/meeting-list'
        ).then(m => m.MeetingList)
    },
    {
      path: 'new',
      loadComponent: () =>
        import(
          './features/meetings/pages/meeting-form/meeting-form'
        ).then(m => m.MeetingForm)
    },
    {
      path: ':id/edit',
      loadComponent: () =>
        import(
          './features/meetings/pages/meeting-form/meeting-form'
        ).then(m => m.MeetingForm)
    },
    {
      path: ':id',
      loadComponent: () =>
        import(
          './features/meetings/pages/meeting-details/meeting-details'
        ).then(m => m.MeetingDetails)
    }
  ]
},




        {
          path: 'calendar',
          loadComponent: () =>
            import('./features/calendar/pages/calendar/calendar')
              .then(m => m.Calendar)
        },

        {
          path: 'notifications',
          loadComponent: () =>
            import('./features/notifications/pages/notification-center/notification-center')
              .then(m => m.NotificationCenter)
        },

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
        redirectTo: 'dashboard',
      },
    ],
  },

  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
