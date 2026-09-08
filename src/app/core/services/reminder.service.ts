import { Injectable, computed, signal } from '@angular/core';
import { User } from '../../core/models/user.model';
import {
  CreateReminderRequest,
  Reminder,
  ReminderPriority,
  ReminderStatus,
  UpdateReminderRequest
} from '../models/reminder.model';

@Injectable({
  providedIn: 'root'
})
export class ReminderService {
  private readonly remindersSignal = signal<Reminder[]>([]);

  readonly reminders = this.remindersSignal.asReadonly();

  readonly pendingReminders = computed(() =>
    this.remindersSignal().filter(
      reminder => reminder.status === 'PENDING'
    )
  );

  readonly triggeredReminders = computed(() =>
    this.remindersSignal().filter(
      reminder => reminder.status === 'TRIGGERED'
    )
  );

  readonly completedReminders = computed(() =>
    this.remindersSignal().filter(
      reminder => reminder.status === 'COMPLETED'
    )
  );

  constructor() {
    this.loadMockReminders();
  }

  getReminders(): Reminder[] {
    return this.remindersSignal();
  }

  getReminder(id: string): Reminder | undefined {
    return this.remindersSignal().find(
      reminder => reminder.id === id
    );
  }

  createReminder(
    request: CreateReminderRequest,
    recipient: User,
    createdBy: User
  ): Reminder {
    const now = new Date().toISOString();

    const reminder: Reminder = {
      id: crypto.randomUUID(),

      title: request.title,
      description: request.description,

      recipient,
      createdBy,

      priority: request.priority,
      category: request.category,

      reminderDate: request.reminderDate,
      reminderTime: request.reminderTime,

      recurrence: request.recurrence,

      status: 'PENDING',

      createdAt: now,
      updatedAt: now,

      commentsCount: 0,
      attachmentsCount: 0
    };

    this.remindersSignal.update(reminders => [
      reminder,
      ...reminders
    ]);

    return reminder;
  }

  updateReminder(
    id: string,
    request: UpdateReminderRequest,
    recipient: User
  ): void {
    this.remindersSignal.update(reminders =>
      reminders.map(reminder =>
        reminder.id === id
          ? {
              ...reminder,
              title: request.title,
              description: request.description,
              recipient,
              priority: request.priority,
              category: request.category,
              reminderDate: request.reminderDate,
              reminderTime: request.reminderTime,
              recurrence: request.recurrence,
              status: request.status,
              updatedAt: new Date().toISOString()
            }
          : reminder
      )
    );
  }

  updateStatus(
    id: string,
    status: ReminderStatus
  ): void {
    this.remindersSignal.update(reminders =>
      reminders.map(reminder =>
        reminder.id === id
          ? {
              ...reminder,
              status,
              updatedAt: new Date().toISOString()
            }
          : reminder
      )
    );
  }

  deleteReminder(id: string): void {
    this.remindersSignal.update(reminders =>
      reminders.filter(reminder => reminder.id !== id)
    );
  }

  isOverdue(reminder: Reminder): boolean {
    if (
      reminder.status === 'COMPLETED' ||
      reminder.status === 'DISMISSED' ||
      reminder.status === 'CANCELLED'
    ) {
      return false;
    }

    const reminderDateTime = new Date(
      `${reminder.reminderDate}T${reminder.reminderTime}`
    );

    return reminderDateTime.getTime() < Date.now();
  }

  private loadMockReminders(): void {
    const ceo: User = {
      id: 'user-ceo',
      title: 'Dr.',
      firstName: 'Chigozie',
      lastName: 'F. Oriaku',
      email: 'ceo@exectrack.local',
      role: 'CEO'
    };

    const john: User = {
      id: 'user-employee',
      firstName: 'John',
      lastName: 'Doe',
      email: 'employee@exectrack.local',
      role: 'EMPLOYEE',
      department: 'Operations'
    };

    const sarah: User = {
      id: 'user-assistant',
      firstName: 'Sarah',
      lastName: 'Williams',
      email: 'assistant@exectrack.local',
      role: 'EXECUTIVE_ASSISTANT'
    };

    const now = new Date();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7);

    this.remindersSignal.set([
      {
        id: 'reminder-001',
        title: 'Follow up with Finance',
        description:
          'Follow up with the finance team regarding the outstanding budget figures.',
        recipient: ceo,
        createdBy: sarah,
        priority: 'HIGH',
        category: 'Finance',
        reminderDate: this.formatDate(yesterday),
        reminderTime: '10:00',
        recurrence: 'ONCE',
        status: 'PENDING',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        commentsCount: 2,
        attachmentsCount: 0
      },
      {
        id: 'reminder-002',
        title: 'Daily Executive Briefing',
        description:
          'Review the daily executive briefing before the first meeting.',
        recipient: ceo,
        createdBy: sarah,
        priority: 'URGENT',
        category: 'Executive',
        reminderDate: this.formatDate(now),
        reminderTime: '08:30',
        recurrence: 'DAILY',
        status: 'TRIGGERED',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        commentsCount: 1,
        attachmentsCount: 1
      },
      {
        id: 'reminder-003',
        title: 'Submit Operations Update',
        description:
          'Submit the weekly operations update to the executive office.',
        recipient: john,
        createdBy: sarah,
        priority: 'MEDIUM',
        category: 'Operations',
        reminderDate: this.formatDate(tomorrow),
        reminderTime: '15:00',
        recurrence: 'WEEKLY',
        status: 'PENDING',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        commentsCount: 0,
        attachmentsCount: 0
      },
      {
        id: 'reminder-004',
        title: 'Monthly Strategy Review',
        description:
          'Review outstanding strategic initiatives and prepare discussion points.',
        recipient: ceo,
        createdBy: sarah,
        priority: 'HIGH',
        category: 'Strategy',
        reminderDate: this.formatDate(nextWeek),
        reminderTime: '09:00',
        recurrence: 'MONTHLY',
        status: 'PENDING',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        commentsCount: 3,
        attachmentsCount: 1
      },
      {
        id: 'reminder-005',
        title: 'Review Contract Renewal',
        description:
          'Review the supplier contract renewal before the renewal deadline.',
        recipient: ceo,
        createdBy: sarah,
        priority: 'MEDIUM',
        category: 'Legal',
        reminderDate: this.formatDate(now),
        reminderTime: '16:30',
        recurrence: 'ONCE',
        status: 'COMPLETED',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        commentsCount: 2,
        attachmentsCount: 1
      }
    ]);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}