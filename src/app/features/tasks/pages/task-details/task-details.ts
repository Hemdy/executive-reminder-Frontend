
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal
} from '@angular/core';

import { DatePipe, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, from, map, of } from 'rxjs';
import {
  TaskAttachment,
  TaskComment,
  TaskPriority,
  TaskStatus
} from '../../../../core/models/task.model';
import { AuthService } from '../../../../core/services/auth.service';
import { TaskService } from '../../../../core/services/task.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AttachmentTransferService } from '../../../../core/services/attachment-transfer.service';

@Component({
  selector: 'app-task-details',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  templateUrl: './task-details.html',
  styleUrl: './task-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})


export class TaskDetails implements OnInit {




  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly taskService = inject(TaskService);
  private readonly authService = inject(AuthService);
  private readonly document = inject(DOCUMENT);
  private readonly loading = inject(LoadingService);
  private readonly toast = inject(ToastService);
  private readonly attachmentTransfer = inject(AttachmentTransferService);
  readonly comments = signal<TaskComment[]>([]);
  readonly highlightedCommentId = signal<string | null>(null);
  readonly attachments = signal<TaskAttachment[]>([]);
  readonly commentText = signal('');
  readonly activityError = signal('');
  readonly activityMessage = signal('');
  readonly taskActionError = signal('');
  readonly isDeleting = signal(false);
  readonly submittingComment = signal(false);
  readonly uploadingAttachments = signal(false);
  readonly loadingActivity = signal(false);
  readonly downloadingAttachmentId = signal<string | null>(null);

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
    this.activityMessage.set('');
    this.submittingComment.set(true);
    this.taskService.addComment(task.id, body).subscribe({
      next: comment => {
        this.comments.update(comments => [...comments, comment]);
        this.commentText.set('');
        this.activityMessage.set('Comment posted.');
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

    const unsupportedFiles = files.filter(file => !this.isSupportedAttachment(file));
    const oversizedFiles = files.filter(file =>
      this.isSupportedAttachment(file) && file.size > 4 * 1024 * 1024
    );
    const validFiles = files.filter(file =>
      this.isSupportedAttachment(file) && file.size <= 4 * 1024 * 1024
    );
    const validationErrors = [
      ...(unsupportedFiles.length
        ? [`Unsupported file type: ${unsupportedFiles.map(file => file.name).join(', ')}. Only PDF and Word documents are allowed.`]
        : []),
      ...(oversizedFiles.length
        ? [`Files over 4 MB: ${oversizedFiles.map(file => file.name).join(', ')}.`]
        : [])
    ];
    if (!validFiles.length) {
      this.activityError.set(validationErrors.join(' '));
      this.activityMessage.set('');
      return;
    }
    const task = this.task();
    if (!task || this.uploadingAttachments()) {
      return;
    }

    this.activityError.set(validationErrors.join(' '));
    this.activityMessage.set('');
    this.uploadingAttachments.set(true);
    const uploads = validFiles.map(file =>
      this.taskService.uploadAttachment(task.id, file).pipe(
        map(attachment => ({ attachment })),
        catchError(error => from(
          this.attachmentTransfer.failureMessage(error, 'upload'),
        ).pipe(map(message => ({ failedFile: `${file.name}: ${message}` }))))
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
        const uploadErrors = [
          ...validationErrors,
          ...(failedFiles.length ? [`Unable to upload: ${failedFiles.join(', ')}.`] : [])
        ];
        this.activityError.set(uploadErrors.join(' '));
        if (uploaded.length) {
          this.activityMessage.set(`${uploaded.length} file${uploaded.length === 1 ? '' : 's'} uploaded.`);
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
    if (!task || this.downloadingAttachmentId()) {
      return;
    }

    this.activityError.set('');
    this.activityMessage.set('');
    const downloadContext = this.attachmentTransfer.prepareDownload();
    this.downloadingAttachmentId.set(attachment.id);
    this.taskService.downloadAttachment(task.id, attachment.id).subscribe({
      next: blob => {
        void this.attachmentTransfer.save(blob, attachment.fileName, downloadContext).then(result => {
          this.downloadingAttachmentId.set(null);
          this.activityMessage.set(this.downloadSuccessMessage(result));
        }).catch(error => {
          this.attachmentTransfer.cancel(downloadContext);
          this.downloadingAttachmentId.set(null);
          void this.attachmentTransfer.failureMessage(error, 'download')
            .then(message => this.activityError.set(message));
        });
      },
      error: error => {
        this.attachmentTransfer.cancel(downloadContext);
        this.downloadingAttachmentId.set(null);
        void this.attachmentTransfer.failureMessage(error, 'download')
          .then(message => this.activityError.set(message));
      }
    });
  }

  private downloadSuccessMessage(result: 'downloaded' | 'shared' | 'opened' | 'cancelled'): string {
    if (result === 'shared') return 'Attachment shared. Choose Save to Files to keep a copy.';
    if (result === 'opened') return 'Attachment opened. Use your device share or download options to save it.';
    return result === 'cancelled' ? '' : 'Attachment downloaded.';
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

  private isSupportedAttachment(file: File): boolean {
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    return ['.pdf', '.doc', '.docx'].includes(extension);
  }

  deleteTask(): void {
    const task = this.task();

    if (!task || this.isDeleting()) {
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to delete this task?'
    );

    if (!confirmed) {
      return;
    }

    this.isDeleting.set(true);
    const loadingTask = this.loading.begin('Deleting task…');
    this.taskService.deleteTask(task.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.loading.end(loadingTask);
        this.toast.success('Task deleted successfully');
        void this.router.navigate(['/tasks']);
      },
      error: error => {
        this.isDeleting.set(false);
        this.loading.end(loadingTask);
        this.toast.error(error.error?.message ?? 'Unable to delete the task.');
      }
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
    this.loadingActivity.set(true);
    forkJoin({
      comments: this.taskService.getComments(taskId),
      attachments: this.taskService.getAttachments(taskId)
    }).subscribe({
      next: activity => {
        this.comments.set(activity.comments);
        this.attachments.set(activity.attachments);
        this.loadingActivity.set(false);
        const commentId = this.route.snapshot.queryParamMap.get('comment');
        if (commentId && activity.comments.some(comment => comment.id === commentId)) {
          this.highlightedCommentId.set(commentId);
          this.document.defaultView?.requestAnimationFrame(() => {
            this.document.getElementById(`task-comment-${commentId}`)
              ?.scrollIntoView({ block: 'center' });
          });
        }
      },
      error: () => {
        this.loadingActivity.set(false);
        this.activityError.set('Unable to load task comments and attachments.');
      }
    });
  }

  private refreshTaskCounts(taskId: string): void {
    this.taskService.loadTask(taskId).subscribe({
      error: () => this.activityError.set('Activity was saved, but task counts could not be refreshed.')
    });
  }
}