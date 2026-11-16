import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY, Observable, Subscription, catchError, finalize, of, takeUntil, tap, throwError } from 'rxjs';
import { User } from '../models/user.model';
import { CreateReminderRequest, Reminder, ReminderAttachment, ReminderComment, ReminderStatus, UpdateReminderRequest } from '../models/reminder.model';
import { API_BASE_URL } from '../config/api.config';
import { sortRemindersDesc } from '../utils/date-sort';
import {
  bindAuthSessionLifecycle,
  currentAuthSessionVersion,
  isSameAuthSession,
  sessionEndedStream,
} from '../utils/session-scope';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = `${API_BASE_URL}/reminders`;
  private readonly remindersSignal = signal<Reminder[]>([]);
  readonly reminders = this.remindersSignal.asReadonly();
  readonly listLoading = signal(false);
  readonly listError = signal('');
  readonly pendingReminders = computed(() => this.remindersSignal().filter(reminder => reminder.status === 'PENDING'));
  readonly triggeredReminders = computed(() => this.remindersSignal().filter(reminder => reminder.status === 'TRIGGERED'));
  readonly completedReminders = computed(() => this.remindersSignal().filter(reminder => reminder.status === 'COMPLETED'));
  private loadSequence = 0;
  private activeLoadSubscription: Subscription | null = null;

  constructor() {
    bindAuthSessionLifecycle(this.auth, this.destroyRef, {
      onClear: () => this.resetState(),
      onUserChange: userId => {
        this.resetState();
        if (!userId) {
          return;
        }
        this.activeLoadSubscription = this.loadReminders().subscribe({
          error: error => console.error('Unable to load reminders', error),
        });
      },
    });

    this.destroyRef.onDestroy(() => {
      this.activeLoadSubscription?.unsubscribe();
    });
  }

  getReminders(): Reminder[] { return this.remindersSignal(); }
  getReminder(id: string): Reminder | undefined { return this.remindersSignal().find(reminder => reminder.id === id); }
  loadReminder(id: string): Observable<Reminder> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.get<Reminder>(`${this.apiUrl}/${id}`).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(reminder => {
        if (!isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          return;
        }
        const normalized = this.normalize(reminder);
        this.remindersSignal.update(reminders => sortRemindersDesc(
          reminders.some(item => item.id === normalized.id)
            ? reminders.map(item => item.id === normalized.id ? normalized : item)
            : [normalized, ...reminders]
        ));
      })
    );
  }
  loadReminders(): Observable<Reminder[]> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    if (!expectedUserId) {
      this.resetState();
      return of([]);
    }

    const requestSeq = ++this.loadSequence;
    this.listLoading.set(true);
    this.listError.set('');
    return this.http.get<Reminder[]>(this.apiUrl).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(reminders => {
        if (requestSeq !== this.loadSequence || !isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          return;
        }
        this.remindersSignal.set(sortRemindersDesc(reminders.map(reminder => this.normalize(reminder))));
      }),
      catchError(error => {
        if (requestSeq !== this.loadSequence || !isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          return EMPTY;
        }
        this.listError.set('Unable to load reminders. Please try again.');
        return throwError(() => error);
      }),
      finalize(() => {
        if (requestSeq === this.loadSequence && isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.listLoading.set(false);
        }
      })
    );
  }

  createReminder(request: CreateReminderRequest, _recipient?: User, _createdBy?: User): Observable<Reminder> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.post<Reminder>(this.apiUrl, request).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(reminder => {
        if (isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.remindersSignal.update(reminders => sortRemindersDesc([this.normalize(reminder), ...reminders]));
        }
      })
    );
  }

  updateReminder(id: string, request: UpdateReminderRequest, _recipient?: User): Observable<Reminder> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.patch<Reminder>(`${this.apiUrl}/${id}`, request).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(reminder => {
        if (isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.replace(this.normalize(reminder));
        }
      })
    );
  }

  updateStatus(id: string, status: ReminderStatus): Observable<Reminder> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.patch<Reminder>(`${this.apiUrl}/${id}/status`, { status }).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(reminder => {
        if (isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.replace(this.normalize(reminder));
        }
      })
    );
  }

  getComments(reminderId: string): Observable<ReminderComment[]> {
    return this.http.get<ReminderComment[]>(`${this.apiUrl}/${reminderId}/comments`);
  }

  addComment(reminderId: string, body: string): Observable<ReminderComment> {
    return this.http.post<ReminderComment>(`${this.apiUrl}/${reminderId}/comments`, { body });
  }
  updateComment(reminderId: string, commentId: string, body: string): Observable<ReminderComment> {
    return this.http.patch<ReminderComment>(
      `${this.apiUrl}/${reminderId}/comments/${commentId}`,
      { body }
    );
  }

  getAttachments(reminderId: string): Observable<ReminderAttachment[]> {
    return this.http.get<ReminderAttachment[]>(`${this.apiUrl}/${reminderId}/attachments`);
  }

  uploadAttachment(reminderId: string, file: File): Observable<ReminderAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ReminderAttachment>(`${this.apiUrl}/${reminderId}/attachments`, formData);
  }

  downloadAttachment(reminderId: string, attachmentId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${reminderId}/attachments/${attachmentId}`, {
      responseType: 'blob'
    });
  }
  deleteAttachment(reminderId: string, attachmentId: string): Observable<{ id: string; deleted: boolean }> {
    return this.http.delete<{ id: string; deleted: boolean }>(
      `${this.apiUrl}/${reminderId}/attachments/${attachmentId}`
    );
  }

  deleteReminder(id: string): Observable<void> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(() => {
        if (isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.remindersSignal.update(reminders => reminders.filter(reminder => reminder.id !== id));
        }
      })
    );
  }

  private resetState(): void {
    this.loadSequence += 1;
    this.activeLoadSubscription?.unsubscribe();
    this.activeLoadSubscription = null;
    this.remindersSignal.set([]);
    this.listError.set('');
    this.listLoading.set(false);
  }

  isOverdue(reminder: Reminder): boolean {
    if (['COMPLETED', 'DISMISSED', 'CANCELLED'].includes(reminder.status)) return false;
    return new Date(`${reminder.reminderDate}T${reminder.reminderTime}`).getTime() < Date.now();
  }

  private replace(reminder: Reminder): void {
    this.remindersSignal.update(reminders => sortRemindersDesc(reminders.map(existing => existing.id === reminder.id ? reminder : existing)));
  }
  private normalize(reminder: Reminder): Reminder {
    return {
      ...reminder,
      reminderDate: reminder.reminderDate.slice(0, 10),
      participants: reminder.participants?.map(participant =>
        'user' in participant ? participant.user : participant
      ) ?? [],
      commentsCount: reminder._count?.comments ?? reminder.commentsCount ?? 0,
      attachmentsCount: reminder._count?.attachments ?? reminder.attachmentsCount ?? 0,
    };
  }
}
