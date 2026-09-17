import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { User } from '../models/user.model';
import { CreateReminderRequest, Reminder, ReminderStatus, UpdateReminderRequest } from '../models/reminder.model';
import { API_BASE_URL } from '../config/api.config';

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_BASE_URL}/reminders`;
  private readonly remindersSignal = signal<Reminder[]>([]);
  readonly reminders = this.remindersSignal.asReadonly();
  readonly pendingReminders = computed(() => this.remindersSignal().filter(reminder => reminder.status === 'PENDING'));
  readonly triggeredReminders = computed(() => this.remindersSignal().filter(reminder => reminder.status === 'TRIGGERED'));
  readonly completedReminders = computed(() => this.remindersSignal().filter(reminder => reminder.status === 'COMPLETED'));

  constructor() {
    this.loadReminders().subscribe({ error: error => console.error('Unable to load reminders', error) });
  }

  getReminders(): Reminder[] { return this.remindersSignal(); }
  getReminder(id: string): Reminder | undefined { return this.remindersSignal().find(reminder => reminder.id === id); }
  loadReminder(id: string): Observable<Reminder> {
    return this.http.get<Reminder>(`${this.apiUrl}/${id}`).pipe(tap(reminder => {
      const normalized = this.normalize(reminder);
      this.remindersSignal.update(reminders => reminders.some(item => item.id === normalized.id)
        ? reminders.map(item => item.id === normalized.id ? normalized : item)
        : [normalized, ...reminders]);
    }));
  }
  loadReminders(): Observable<Reminder[]> {
    return this.http.get<Reminder[]>(this.apiUrl).pipe(tap(reminders => this.remindersSignal.set(reminders.map(reminder => this.normalize(reminder)))));
  }

  createReminder(request: CreateReminderRequest, _recipient?: User, _createdBy?: User): Observable<Reminder> {
    return this.http.post<Reminder>(this.apiUrl, request).pipe(tap(reminder => this.remindersSignal.update(reminders => [this.normalize(reminder), ...reminders])));
  }

  updateReminder(id: string, request: UpdateReminderRequest, _recipient?: User): Observable<Reminder> {
    return this.http.patch<Reminder>(`${this.apiUrl}/${id}`, request).pipe(tap(reminder => this.replace(this.normalize(reminder))));
  }

  updateStatus(id: string, status: ReminderStatus): Observable<Reminder> {
    return this.http.patch<Reminder>(`${this.apiUrl}/${id}/status`, { status }).pipe(tap(reminder => this.replace(this.normalize(reminder))));
  }

  deleteReminder(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(tap(() => this.remindersSignal.update(reminders => reminders.filter(reminder => reminder.id !== id))));
  }

  isOverdue(reminder: Reminder): boolean {
    if (['COMPLETED', 'DISMISSED', 'CANCELLED'].includes(reminder.status)) return false;
    return new Date(`${reminder.reminderDate}T${reminder.reminderTime}`).getTime() < Date.now();
  }

  private replace(reminder: Reminder): void {
    this.remindersSignal.update(reminders => reminders.map(existing => existing.id === reminder.id ? reminder : existing));
  }
  private normalize(reminder: Reminder): Reminder {
    return { ...reminder, reminderDate: reminder.reminderDate.slice(0, 10) };
  }
}
