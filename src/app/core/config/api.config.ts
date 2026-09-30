declare global {
  interface Window {
    __APP_CONFIG__?: {
      apiBaseUrl?: string;
    };
  }
}

const browserApiUrl = typeof window !== 'undefined' ? window.__APP_CONFIG__?.apiBaseUrl : undefined;
const runtimeProcess = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process;
const serverApiUrl = runtimeProcess?.env?.['API_BASE_URL'];
const defaultApiUrl = 'https://executive-reminder-backend.vercel.app/api';

export const API_BASE_URL = (browserApiUrl ?? serverApiUrl ?? defaultApiUrl).replace(/\/+$/, '');
