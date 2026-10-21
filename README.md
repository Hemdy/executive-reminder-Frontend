# ExecutiveReminder

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.1.3.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Backend API

The frontend calls the backend under `/api`. During local development, the
Angular dev-server proxy in `proxy.conf.json` forwards those requests to
`http://localhost:3000`. Start the NestJS backend before using the
authenticated features.

For deployments where the API is not hosted under the frontend's origin, set
the public `apiBaseUrl` in `public/app-config.js` to the backend API URL,
including `/api` (for example, `https://api.example.com/api`). This browser
configuration is public: never put database connection strings, `JWT_SECRET`,
or other private credentials in it.

## Device push notifications

Push delivery requires the backend VAPID configuration and the database
migration documented in the backend README. The Angular service worker is
enabled for production builds, so test with the deployed HTTPS app or a local
production build served over HTTPS; `ng serve` does not enable push.

Sign in and open **Notifications** to enable the current device. On Android,
use Chrome and allow notifications (installing the PWA is recommended). On
iPhone or iPad, add the site to the Home Screen, open it from its icon, and
allow notifications; Web Push requires iOS/iPadOS 16.4 or later. The user must
enable notifications separately on each browser/device.

To test delivery, subscribe two users on separate devices or browser profiles,
then invite a participant to a meeting, assign a task, add a task/meeting
comment, or schedule a reminder. Reminder delivery runs through the backend
Vercel Cron job and requires `CRON_SECRET` and `REMINDER_TIMEZONE` to be set.
Clicking a push notification should open the linked task, meeting, reminder,
or comment.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
