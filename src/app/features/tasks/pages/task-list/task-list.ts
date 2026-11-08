import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ContentSkeleton } from '../../../../core/components/content-skeleton/content-skeleton';
import {
  Task,
  TaskPriority,
  TaskStatus
} from '../../../../core/models/task.model';
import { TaskService } from '../../../../core/services/task.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { ToastService } from '../../../../core/services/toast.service';
import { catchError, from, map, mergeMap, of, toArray } from 'rxjs';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [RouterModule, ContentSkeleton],

  templateUrl: './task-list.html',
  styleUrl: './task-list.scss',
})
export class TaskList {


  private readonly taskService = inject(TaskService);
  readonly listLoading = this.taskService.listLoading;
  readonly listError = this.taskService.listError;

  retryLoad(): void {
    this.taskService.loadTasks().subscribe({
      error: error => console.error('Unable to reload tasks', error),
    });
  }

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly loading = inject(LoadingService);
  private readonly toast = inject(ToastService);

  readonly selectionDeniedMessage =
    'You cannot select or delete this item because you are not its creator.';
  readonly searchTerm = signal('');
  readonly statusFilter = signal<'ALL' | TaskStatus>('ALL');
  readonly priorityFilter = signal<'ALL' | TaskPriority>('ALL');
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly deletingSelected = signal(false);
  readonly deleteError = signal('');

  readonly tasks = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const priority = this.priorityFilter();
    const userId = this.currentUser()?.id;

    return this.taskService.tasks().filter(task => {
      const isAssignedToUser =
        userId !== undefined &&
        (task.createdBy.id === userId ||
          task.assignedTo.id === userId ||
          task.participants?.some(participant => participant.user.id === userId) === true);
      const matchesSearch =
        !search ||
        task.title.toLowerCase().includes(search) ||
        task.description?.toLowerCase().includes(search) ||
        `${task.assignedTo.firstName} ${task.assignedTo.lastName}`
          .toLowerCase()
          .includes(search);

      const matchesStatus =
        status === 'ALL' || task.status === status;

      const matchesPriority =
        priority === 'ALL' || task.priority === priority;

      return isAssignedToUser && matchesSearch && matchesStatus && matchesPriority;
    });

  });

  readonly manageableTasks = computed(() => this.tasks().filter(task => this.canDeleteTask(task)));
  readonly selectedCount = computed(() =>
    this.manageableTasks().filter(task => this.selectedIds().has(task.id)).length
  );
  readonly allVisibleSelected = computed(
    () => this.manageableTasks().length > 0 &&
      this.manageableTasks().every(task => this.selectedIds().has(task.id))
  );
  readonly someVisibleSelected = computed(
    () => this.manageableTasks().some(task => this.selectedIds().has(task.id)) &&
      !this.allVisibleSelected()
  );

  readonly currentUser = this.authService.currentUser;

  createTask(): void {
    this.router.navigate(['/tasks/new']);
  }

  viewTask(task: Task): void {
    this.router.navigate(['/tasks', task.id]);
  }

  canDeleteTask(task: Task): boolean {
    return task.createdBy.id === this.currentUser()?.id;
  }

  onSelectionClick(event: MouseEvent, canSelect: boolean): void {
    event.stopPropagation();
    if (!canSelect) {
      event.preventDefault();
      this.toast.error(this.selectionDeniedMessage);
    }
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelection(id: string, checked: boolean): void {
    const selected = new Set(this.selectedIds());
    const task = this.tasks().find(item => item.id === id);
    if (checked && task && this.canDeleteTask(task)) {
      selected.add(id);
    } else {
      selected.delete(id);
    }
    this.selectedIds.set(selected);
    this.deleteError.set('');
  }

  toggleAllSelection(checked: boolean): void {
    const selected = new Set(this.selectedIds());
    for (const task of this.manageableTasks()) {
      if (checked) {
        selected.add(task.id);
      } else {
        selected.delete(task.id);
      }
    }
    this.selectedIds.set(selected);
    this.deleteError.set('');
  }

  deleteSelected(): void {
    const ids = this.manageableTasks()
      .filter(task => this.selectedIds().has(task.id))
      .map(task => task.id);
    if (!ids.length || this.deletingSelected()) return;
    if (!window.confirm(`Delete ${ids.length} selected task(s)? This action cannot be undone.`)) return;

    this.deletingSelected.set(true);
    this.deleteError.set('');
    const loadingTask = this.loading.begin('Deleting selected tasks…');
    from(ids).pipe(
      mergeMap(id => this.taskService.deleteTask(id).pipe(
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
          console.error('Unable to delete selected tasks', failed);
          this.deleteError.set(
            `Unable to delete ${failed.length} selected task(s). Failed items remain selected.`
          );
        }
      },
      error: error => {
        console.error('Unable to delete selected tasks', error);
        this.deletingSelected.set(false);
        this.loading.end(loadingTask);
        this.deleteError.set('Unable to delete the selected tasks. Please try again.');
      }
    });
  }

  updateStatus(task: Task, status: TaskStatus): void {
    const messages = {
      PENDING: 'Reopening task…',
      IN_PROGRESS: 'Starting task…',
      COMPLETED: 'Completing task…',
      CLOSED: 'Confirming task…',
      CANCELLED: 'Cancelling task…'
    } satisfies Record<TaskStatus, string>;
    const loadingTask = this.loading.begin(messages[status]);
    this.taskService.updateStatus(task.id, status).subscribe({
      next: () => this.loading.end(loadingTask),
      error: error => {
        this.loading.end(loadingTask);
        console.error('Unable to update task status', error);
      }
    });
  }

  isOverdue(task: Task): boolean {
    return this.taskService.isOverdue(task);
  }

  setSearchTerm(value: string): void {
    this.searchTerm.set(value);
  }

  setStatusFilter(value: string): void {
    this.statusFilter.set(value as 'ALL' | TaskStatus);
  }

  setPriorityFilter(value: string): void {
    this.priorityFilter.set(value as 'ALL' | TaskPriority);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('ALL');
    this.priorityFilter.set('ALL');
  }

  getPriorityLabel(priority: TaskPriority): string {
    return priority.replace('_', ' ');
  }

  getStatusLabel(status: TaskStatus): string {
    return status.replace('_', ' ');
  }

  trackByTaskId(_: number, task: Task): string {
    return task.id;
  }
}
