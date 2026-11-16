import { DestroyRef, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

export function sessionEndedStream(auth: AuthService): Observable<void> {
  return auth.sessionEnded$ ?? EMPTY;
}

export function currentAuthSessionVersion(auth: AuthService): number {
  return auth.sessionVersion?.() ?? 0;
}

export function isSameAuthSession(
  auth: AuthService,
  expectedUserId: string | null,
  expectedSession: number,
): boolean {
  return (
    (auth.currentUser()?.id ?? null) === expectedUserId &&
    currentAuthSessionVersion(auth) === expectedSession
  );
}

/**
 * Synchronously resets state when an auth session ends and reactively runs
 * lifecycle transitions whenever the authenticated user ID changes.
 */
export function bindAuthSessionLifecycle(
  auth: AuthService,
  destroyRef: DestroyRef,
  handlers: {
    onClear: () => void;
    onUserChange: (userId: string | null) => void;
  },
): void {
  let activeUserId: string | null = null;

  auth.sessionEnded$
    ?.pipe(takeUntilDestroyed(destroyRef))
    .subscribe(() => {
      activeUserId = null;
      handlers.onClear();
    });

  effect(() => {
    const userId = auth.currentUser()?.id ?? null;
    if (userId === activeUserId) {
      return;
    }

    activeUserId = userId;
    handlers.onUserChange(userId);
  });
}
