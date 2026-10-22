import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error';

export interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextToastId = 0;
  private timeout: ReturnType<typeof setTimeout> | null = null;

  readonly current = signal<ToastMessage | null>(null);

  success(message: string): void {
    this.show('success', message);
  }

  error(message: string): void {
    this.show('error', message);
  }

  dismiss(): void {
    if (this.timeout !== null) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.current.set(null);
  }

  private show(type: ToastType, message: string): void {
    if (this.timeout !== null) {
      clearTimeout(this.timeout);
    }

    const toast = { id: this.nextToastId++, type, message };
    this.current.set(toast);
    this.timeout = setTimeout(() => {
      if (this.current()?.id === toast.id) {
        this.current.set(null);
      }
      this.timeout = null;
    }, 5000);
  }
}
