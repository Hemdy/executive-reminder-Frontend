import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ContentSkeleton } from '../../../../core/components/content-skeleton/content-skeleton';
import { AuthService } from '../../../../core/services/auth.service';
import { ReminderService } from '../../../../core/services/reminder.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { ToastService } from '../../../../core/services/toast.service';
import { catchError, from, map, mergeMap, of, toArray } from 'rxjs';
import {
  Reminder,
  ReminderPriority,
  ReminderStatus
} from '../../../../core/models/reminder.model';

@Component({
  selector: 'app-reminder-list',
  standalone: true,
  imports: [RouterModule, ContentSkeleton],
  templateUrl: './reminder-list.html',
  styleUrl: './reminder-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class ReminderList {






  private readonly reminderService = inject(ReminderService);
  readonly listLoading = this.reminderService.listLoading;
  readonly listError = this.reminderService.listError;

  retryLoad(): void {
    this.reminderService.loadReminders().subscribe({
      error: error => console.error('Unable to reload reminders', error),
    });
  }

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly loading = inject(LoadingService);
  private readonly toast = inject(ToastService);

  readonly selectionDeniedMessage =
    'You cannot select or delete this item because you are not its creator.';
  readonly searchTerm = signal('');
  readonly statusFilter =
    signal<'ALL' | ReminderStatus>('ALL');
  readonly priorityFilter =
    signal<'ALL' | ReminderPriority>('ALL');
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly deletingSelected = signal(false);
  readonly deleteError = signal('');

  readonly currentUser = this.authService.currentUser;

  readonly reminders = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const priority = this.priorityFilter();
    const userId = this.currentUser()?.id;

    return this.reminderService.reminders().filter(reminder => {
      const isAssignedToUser =
        userId !== undefined &&
        (reminder.createdBy.id === userId ||
          reminder.recipient.id === userId ||
          reminder.participants?.some(participant =>
            ('user' in participant ? participant.user.id : participant.id) === userId
          ) === true);
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
        isAssignedToUser &&
        matchesSearch &&
        matchesStatus &&
        matchesPriority
      );
    });

  });

  readonly manageableReminders = computed(() =>
    this.reminders().filter(reminder => this.canDeleteReminder(reminder))
  );
  readonly selectedCount = computed(() =>
    this.manageableReminders().filter(reminder => this.selectedIds().has(reminder.id)).length
  );
  readonly allVisibleSelected = computed(
    () => this.manageableReminders().length > 0 &&
      this.manageableReminders().every(reminder => this.selectedIds().has(reminder.id))
  );
  readonly someVisibleSelected = computed(
    () => this.manageableReminders().some(reminder => this.selectedIds().has(reminder.id)) &&
      !this.allVisibleSelected()
  );

  canDeleteReminder(reminder: Reminder): boolean {
    return reminder.createdBy.id === this.currentUser()?.id;
  }

  onSelectionClick(event: MouseEvent, canSelect: boolean): void {
    event.stopPropagation();
    if (!canSelect) {
      event.preventDefault();
      this.toast.error(this.selectionDeniedMessage);
    }
  }

  createReminder(): void {
    this.router.navigate(['/reminders/new']);
  }

  viewReminder(reminder: Reminder): void {
    this.router.navigate([
      '/reminders',
      reminder.id
    ]);
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelection(id: string, checked: boolean): void {
    const selected = new Set(this.selectedIds());
    const reminder = this.reminders().find(item => item.id === id);
    if (checked && reminder && this.canDeleteReminder(reminder)) {
      selected.add(id);
    } else {
      selected.delete(id);
    }
    this.selectedIds.set(selected);
    this.deleteError.set('');
  }

  toggleAllSelection(checked: boolean): void {
    const selected = new Set(this.selectedIds());
    for (const reminder of this.manageableReminders()) {
      if (checked) {
        selected.add(reminder.id);
      } else {
        selected.delete(reminder.id);
      }
    }
    this.selectedIds.set(selected);
    this.deleteError.set('');
  }

  deleteSelected(): void {
    const ids = this.manageableReminders()
      .filter(reminder => this.selectedIds().has(reminder.id))
      .map(reminder => reminder.id);
    if (!ids.length || this.deletingSelected()) return;
    if (!window.confirm(`Delete ${ids.length} selected reminder(s)? This action cannot be undone.`)) return;

    this.deletingSelected.set(true);
    this.deleteError.set('');
    const loadingTask = this.loading.begin('Deleting selected reminders…');
    from(ids).pipe(
      mergeMap(id => this.reminderService.deleteReminder(id).pipe(
        map(() => ({ id, deleted: true as const })),
        catchError(error => of({ id, deleted: false as const, error }))
      ), 5),
      toArray()
    ).subscribe({
      next: results => {
        const failed = results.filter(result => !result.deleted);
        this.selectedIds.set(new Set(failed.map(result => result.id)));
        this.deletingSelected.set(false);
        this.loading.end(loadingTask);
        if (failed.length) {
          console.error('Unable to delete selected reminders', failed);
          this.deleteError.set(
            `Unable to delete ${failed.length} selected reminder(s). Failed items remain selected.`
          );
        }
      },
      error: error => {
        console.error('Unable to delete selected reminders', error);
        this.deletingSelected.set(false);
        this.loading.end(loadingTask);
        this.deleteError.set('Unable to delete the selected reminders. Please try again.');
      }
    });
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