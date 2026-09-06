import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import {
  Task,
  TaskPriority,
  TaskStatus
} from '../../../../core/models/task.model';
import { TaskService } from '../../../../core/services/task.service';

@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [RouterModule],

  templateUrl: './task-list.html',
  styleUrl: './task-list.scss',
})
export class TaskList {


  private readonly taskService = inject(TaskService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly searchTerm = signal('');
  readonly statusFilter = signal<'ALL' | TaskStatus>('ALL');
  readonly priorityFilter = signal<'ALL' | TaskPriority>('ALL');

  readonly tasks = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const priority = this.priorityFilter();

    return this.taskService.tasks().filter(task => {
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

      return matchesSearch && matchesStatus && matchesPriority;
    });
  });

  readonly currentUser = this.authService.currentUser;

  createTask(): void {
    this.router.navigate(['/tasks/new']);
  }

  viewTask(task: Task): void {
    this.router.navigate(['/tasks', task.id]);
  }

  updateStatus(task: Task, status: TaskStatus): void {
    this.taskService.updateStatus(task.id, status);
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


