import { routes } from './app.routes';

describe('reminder routes', () => {
  it('routes reminder editing to the reminder form', () => {
    const appRoutes = routes.find(route => route.path === '')?.children ?? [];
    const reminderRoutes = appRoutes.find(route => route.path === 'reminders')?.children ?? [];

    expect(reminderRoutes.some(route => route.path === ':id/edit')).toBe(true);
  });
});
