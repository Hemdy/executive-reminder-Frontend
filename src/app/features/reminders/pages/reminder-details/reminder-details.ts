import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReminderPriority, ReminderStatus } from '../../../../core/models/reminder.model';
import { ReminderService } from '../../../../core/services/reminder.service';

@Component({
  selector: 'app-reminder-details',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './reminder-details.html',
  styleUrl: './reminder-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReminderDetails {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reminderService = inject(ReminderService);

  readonly reminder = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');

    return id ? this.reminderService.getReminder(id) : undefined;
  });

  readonly isOverdue = computed(() => {
    const reminder = this.reminder();

    return reminder ? this.reminderService.isOverdue(reminder) : false;
  });

  editReminder(): void {
    const reminder = this.reminder();

    if (!reminder) {
      return;
    }

    this.router.navigate(['/reminders', reminder.id, 'edit']);
  }

  markTriggered(): void {
    const reminder = this.reminder();

    if (reminder) {
      this.reminderService.updateStatus(reminder.id, 'TRIGGERED');
    }
  }

  completeReminder(): void {
    const reminder = this.reminder();

    if (reminder) {
      this.reminderService.updateStatus(reminder.id, 'COMPLETED');
    }
  }

  dismissReminder(): void {
    const reminder = this.reminder();

    if (reminder) {
      this.reminderService.updateStatus(reminder.id, 'DISMISSED');
    }
  }

  cancelReminder(): void {
    const reminder = this.reminder();

    if (reminder) {
      this.reminderService.updateStatus(reminder.id, 'CANCELLED');
    }
  }

  reopenReminder(): void {
    const reminder = this.reminder();

    if (reminder) {
      this.reminderService.updateStatus(reminder.id, 'PENDING');
    }
  }

  deleteReminder(): void {
    const reminder = this.reminder();

    if (!reminder) {
      return;
    }

    const confirmed = window.confirm('Are you sure you want to delete this reminder?');

    if (!confirmed) {
      return;
    }

    this.reminderService.deleteReminder(reminder.id);
    this.router.navigate(['/reminders']);
  }

  backToReminders(): void {
    this.router.navigate(['/reminders']);
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`;
  }

  getPriorityLabel(priority: ReminderPriority): string {
    return priority.replace('_', ' ');
  }

  getStatusLabel(status: ReminderStatus): string {
    return status.replace('_', ' ');
  }
}
