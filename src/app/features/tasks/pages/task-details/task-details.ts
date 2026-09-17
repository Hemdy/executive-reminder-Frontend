
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit
} from '@angular/core';

import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TaskPriority, TaskStatus } from '../../../../core/models/task.model';
import { TaskService } from '../../../../core/services/task.service';

@Component({
  selector: 'app-task-details',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './task-details.html',
  styleUrl: './task-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})


export class TaskDetails implements OnInit {




  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly taskService = inject(TaskService);

  readonly task = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');

    return id ? this.taskService.getTask(id) : undefined;
  });

  readonly isOverdue = computed(() => {
    const task = this.task();

    return task ? this.taskService.isOverdue(task) : false;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.taskService.loadTask(id).subscribe();
  }

  editTask(): void {
    const task = this.task();

    if (!task) {
      return;
    }

    this.router.navigate(['/tasks', task.id, 'edit']);
  }

  backToTasks(): void {
    this.router.navigate(['/tasks']);
  }

  startTask(): void {
    const task = this.task();

    if (!task) {
      return;
    }

    this.taskService.updateStatus(task.id, 'IN_PROGRESS').subscribe();
  }

  completeTask(): void {
    const task = this.task();

    if (!task) {
      return;
    }

    this.taskService.updateStatus(task.id, 'COMPLETED').subscribe();
  }

  cancelTask(): void {
    const task = this.task();

    if (!task) {
      return;
    }

    this.taskService.updateStatus(task.id, 'CANCELLED').subscribe();
  }

  reopenTask(): void {
    const task = this.task();

    if (!task) {
      return;
    }

    this.taskService.updateStatus(task.id, 'PENDING').subscribe();
  }

  deleteTask(): void {
    const task = this.task();

    if (!task) {
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to delete this task?'
    );

    if (!confirmed) {
      return;
    }

    this.taskService.deleteTask(task.id).subscribe({
      next: () => this.router.navigate(['/tasks'])
    });
  }

  getInitials(firstName: string, lastName: string): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`;
  }

  getPriorityLabel(priority: TaskPriority): string {
    return priority.replace('_', ' ');
  }

  getStatusLabel(status: TaskStatus): string {
    return status.replace('_', ' ');
  }
}