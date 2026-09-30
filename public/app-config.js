const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname);

window.__APP_CONFIG__ = {
  apiBaseUrl: isLocalDevelopment
    ? 'http://localhost:3000/api'
    : 'https://executive-reminder-backend.vercel.app/api'
};
