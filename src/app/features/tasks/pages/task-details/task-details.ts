
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal
} from '@angular/core';

import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import {
  TaskAttachment,
  TaskComment,
  TaskPriority,
  TaskStatus
} from '../../../../core/models/task.model';
import { AuthService } from '../../../../core/services/auth.service';
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
  private readonly authService = inject(AuthService);
  readonly comments = signal<TaskComment[]>([]);
  readonly attachments = signal<TaskAttachment[]>([]);
  readonly commentText = signal('');
  readonly activityError = signal('');
  readonly taskActionError = signal('');
  readonly submittingComment = signal(false);
  readonly uploadingAttachments = signal(false);

  readonly task = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');

    return id ? this.taskService.getTask(id) : undefined;
  });

  readonly isOverdue = computed(() => {
    const task = this.task();

    return task ? this.taskService.isOverdue(task) : false;
  });

  readonly canUpdateTaskStatus = computed(() => {
    const task = this.task();
    const user = this.authService.currentUser();
    return Boolean(
      task &&
      user &&
      (task.assignedTo.id === user.id || this.authService.hasPermission('tasks:write'))
    );
  });

  readonly canManageTask = computed(() => this.authService.hasPermission('tasks:write'));

  readonly canUseTaskActivity = computed(() => {
    const task = this.task();
    const user = this.authService.currentUser();
    if (!task || !user) {
      return false;
    }
    return task.assignedTo.id === user.id ||
      task.createdBy.id === user.id ||
      task.participants?.some(participant => participant.user.id === user.id) === true ||
      this.authService.hasPermission('tasks:write');
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.taskService.loadTask(id).subscribe({
        next: () => this.loadTaskActivity(id),
        error: () => this.taskActionError.set('Unable to load this task.')
      });
    }
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

    this.updateStatus(task.id, 'IN_PROGRESS');
  }

  completeTask(): void {
    const task = this.task();

    if (!task) {
      return;
    }

    this.updateStatus(task.id, 'COMPLETED');
  }

  cancelTask(): void {
    const task = this.task();

    if (!task) {
      return;
    }

    this.updateStatus(task.id, 'CANCELLED');
  }

  reopenTask(): void {
    const task = this.task();

    if (!task) {
      return;
    }

    this.updateStatus(task.id, 'PENDING');
  }

  updateCommentText(event: Event): void {
    this.commentText.set((event.target as HTMLTextAreaElement).value);
  }

  submitComment(): void {
    const task = this.task();
    const body = this.commentText().trim();
    if (!task || !body || this.submittingComment()) {
      return;
    }

    this.activityError.set('');
    this.submittingComment.set(true);
    this.taskService.addComment(task.id, body).subscribe({
      next: comment => {
        this.comments.update(comments => [...comments, comment]);
        this.commentText.set('');
        this.submittingComment.set(false);
        this.refreshTaskCounts(task.id);
      },
      error: () => {
        this.activityError.set('Unable to post the comment. Please try again.');
        this.submittingComment.set(false);
      }
    });
  }

  uploadAttachments(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';

    const oversizedFile = files.find(file => file.size > 4 * 1024 * 1024);
    if (oversizedFile) {
      this.activityError.set(`${oversizedFile.name} is larger than the 4 MB limit.`);
      return;
    }
    const task = this.task();
    if (!task || !files.length || this.uploadingAttachments()) {
      return;
    }

    this.activityError.set('');
    this.uploadingAttachments.set(true);
    const uploads = files.map(file =>
      this.taskService.uploadAttachment(task.id, file).pipe(
        map(attachment => ({ attachment })),
        catchError(() => of({ failedFile: file.name }))
      )
    );
    forkJoin(uploads).subscribe({
      next: results => {
        const uploaded = results.flatMap(result =>
          'attachment' in result ? [result.attachment] : []
        );
        const failedFiles = results.flatMap(result =>
          'failedFile' in result ? [result.failedFile] : []
        );
        this.attachments.update(attachments => [...attachments, ...uploaded]);
        this.uploadingAttachments.set(false);
        if (failedFiles.length) {
          this.activityError.set(`Unable to upload: ${failedFiles.join(', ')}.`);
        }
        if (uploaded.length) {
          this.refreshTaskCounts(task.id);
        }
      },
      error: () => {
        this.activityError.set('Unable to upload the selected file(s). Please try again.');
        this.uploadingAttachments.set(false);
      }
    });
  }

  downloadAttachment(attachment: TaskAttachment): void {
    const task = this.task();
    if (!task) {
      return;
    }

    this.taskService.downloadAttachment(task.id, attachment.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.fileName;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
      },
      error: () => this.activityError.set('Unable to download this attachment.')
    });
  }

  formatFileSize(size: number): string {
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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

  private updateStatus(taskId: string, status: TaskStatus): void {
    this.taskActionError.set('');
    this.taskService.updateStatus(taskId, status).subscribe({
      error: () => this.taskActionError.set('Unable to update this task. Please try again.')
    });
  }

  private loadTaskActivity(taskId: string): void {
    forkJoin({
      comments: this.taskService.getComments(taskId),
      attachments: this.taskService.getAttachments(taskId)
    }).subscribe({
      next: activity => {
        this.comments.set(activity.comments);
        this.attachments.set(activity.attachments);
      },
      error: () => this.activityError.set('Unable to load task comments and attachments.')
    });
  }

  private refreshTaskCounts(taskId: string): void {
    this.taskService.loadTask(taskId).subscribe({
      error: () => this.activityError.set('Activity was saved, but task counts could not be refreshed.')
    });
  }
}