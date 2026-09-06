import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ReminderService } from '../../../../core/services/reminder.service';
import {
  Reminder,
  ReminderPriority,
  ReminderStatus
} from '../../../../core/models/reminder.model';

@Component({
  selector: 'app-reminder-list',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './reminder-list.html',
  styleUrl: './reminder-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class ReminderList {






  private readonly reminderService = inject(ReminderService);
  private readonly router = inject(Router);

  readonly searchTerm = signal('');
  readonly statusFilter =
    signal<'ALL' | ReminderStatus>('ALL');
  readonly priorityFilter =
    signal<'ALL' | ReminderPriority>('ALL');

  readonly reminders = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const priority = this.priorityFilter();

    return this.reminderService.reminders().filter(reminder => {
      const recipientName =
        `${reminder.recipient.firstName} ${reminder.recipient.lastName}`
          .toLowerCase();

      const matchesSearch =
        !search ||
        reminder.title.toLowerCase().includes(search) ||
        reminder.description?.toLowerCase().includes(search) ||
        recipientName.includes(search);

      const matchesStatus =
        status === 'ALL' ||
        reminder.status === status;

      const matchesPriority =
        priority === 'ALL' ||
        reminder.priority === priority;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority
      );
    });
  });

  createReminder(): void {
    this.router.navigate(['/reminders/new']);
  }

  viewReminder(reminder: Reminder): void {
    this.router.navigate([
      '/reminders',
      reminder.id
    ]);
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  setStatusFilter(value: string): void {
    this.statusFilter.set(
      value as 'ALL' | ReminderStatus
    );
  }

  setPriorityFilter(value: string): void {
    this.priorityFilter.set(
      value as 'ALL' | ReminderPriority
    );
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('ALL');
    this.priorityFilter.set('ALL');
  }

  isOverdue(reminder: Reminder): boolean {
    return this.reminderService.isOverdue(reminder);
  }

  getPriorityLabel(
    priority: ReminderPriority
  ): string {
    return priority.replace('_', ' ');
  }

  getStatusLabel(
    status: ReminderStatus
  ): string {
    return status.replace('_', ' ');
  }
}