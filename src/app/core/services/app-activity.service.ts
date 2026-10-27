import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AppActivityService {
  private readonly pendingRequests = signal(0);
  readonly hasPendingRequests = this.pendingRequests.asReadonly();

  beginRequest(): void {
    this.pendingRequests.update(count => count + 1);
  }

  endRequest(): void {
    this.pendingRequests.update(count => Math.max(0, count - 1));
  }
}
