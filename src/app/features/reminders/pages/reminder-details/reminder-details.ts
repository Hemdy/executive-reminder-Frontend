import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { ReminderAttachment, ReminderComment, ReminderPriority, ReminderStatus } from '../../../../core/models/reminder.model';
import { ReminderService } from '../../../../core/services/reminder.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-reminder-details',
  standalone: true,
  imports: [RouterLink, DatePipe, FormsModule],
  templateUrl: './reminder-details.html',
  styleUrl: './reminder-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReminderDetails implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly reminderService = inject(ReminderService);
  private readonly loading = inject(LoadingService);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  readonly isDeleting = signal(false);
  readonly comments = signal<ReminderComment[]>([]);
  readonly attachments = signal<ReminderAttachment[]>([]);
  readonly commentText = signal('');
  readonly activityError = signal('');
  readonly activityMessage = signal('');
  readonly submittingComment = signal(false);
  readonly uploadingAttachments = signal(false);
  readonly loadingActivity = signal(false);
  readonly downloadingAttachmentId = signal<string | null>(null);
  readonly highlightedCommentId = signal<string | null>(null);

  readonly reminder = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return id ? this.reminderService.getReminder(id) : undefined;
  });

  readonly isOverdue = computed(() => {
    const reminder = this.reminder();
    return reminder ? this.reminderService.isOverdue(reminder) : false;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.reminderService.loadReminder(id).subscribe({
        next: () => this.loadReminderActivity(id),
        error: () => this.activityError.set('Unable to load this reminder.'),
      });
    }
  }

  editReminder(): void {
    const reminder = this.reminder();
    if (!reminder || this.isDeleting()) return;
    this.router.navigate(['/reminders', reminder.id, 'edit']);
  }

  markTriggered(): void {
    const reminder = this.reminder();
    if (reminder) this.reminderService.updateStatus(reminder.id, 'TRIGGERED').subscribe();
  }

  completeReminder(): void {
    const reminder = this.reminder();
    if (reminder) this.reminderService.updateStatus(reminder.id, 'COMPLETED').subscribe();
  }

  dismissReminder(): void {
    const reminder = this.reminder();
    if (reminder) this.reminderService.updateStatus(reminder.id, 'DISMISSED').subscribe();
  }

  cancelReminder(): void {
    const reminder = this.reminder();
    if (reminder) this.reminderService.updateStatus(reminder.id, 'CANCELLED').subscribe();
  }

  reopenReminder(): void {
    const reminder = this.reminder();
    if (reminder) this.reminderService.updateStatus(reminder.id, 'PENDING').subscribe();
  }

  updateCommentText(event: Event): void {
    this.commentText.set((event.target as HTMLTextAreaElement).value);
  }

  submitComment(): void {
    const reminder = this.reminder();
    const body = this.commentText().trim();
    if (!reminder || !body || this.submittingComment()) return;
    this.activityError.set('');
    this.activityMessage.set('');
    this.submittingComment.set(true);
    this.reminderService.addComment(reminder.id, body).subscribe({
      next: comment => {
        this.comments.update(comments => [...comments, comment]);
        this.commentText.set('');
        this.activityMessage.set('Comment posted.');
        this.submittingComment.set(false);
        this.refreshReminderCounts(reminder.id);
      },
      error: () => {
        this.activityError.set('Unable to post the comment. Please try again.');
        this.submittingComment.set(false);
      },
    });
  }

  uploadAttachments(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    const unsupportedFiles = files.filter(file => !this.isSupportedAttachment(file));
    const oversizedFiles = files.filter(file => this.isSupportedAttachment(file) && file.size > 4 * 1024 * 1024);
    const validFiles = files.filter(file => this.isSupportedAttachment(file) && file.size <= 4 * 1024 * 1024);
    const validationErrors = [
      ...(unsupportedFiles.length ? [`Unsupported file type: ${unsupportedFiles.map(file => file.name).join(', ')}. Only PDF and Word documents are allowed.`] : []),
      ...(oversizedFiles.length ? [`Files over 4 MB: ${oversizedFiles.map(file => file.name).join(', ')}.`] : []),
    ];
    if (!validFiles.length) {
      this.activityError.set(validationErrors.join(' '));
      this.activityMessage.set('');
      return;
    }
    const reminder = this.reminder();
    if (!reminder || this.uploadingAttachments()) return;
    this.activityError.set(validationErrors.join(' '));
    this.activityMessage.set('');
    this.uploadingAttachments.set(true);
    const uploads = validFiles.map(file => this.reminderService.uploadAttachment(reminder.id, file).pipe(
      map(attachment => ({ attachment })),
      catchError(() => of({ failedFile: file.name }))
    ));
    forkJoin(uploads).subscribe({
      next: results => {
        const uploaded = results.flatMap(result => 'attachment' in result ? [result.attachment] : []);
        const failedFiles = results.flatMap(result => 'failedFile' in result ? [result.failedFile] : []);
        this.attachments.update(attachments => [...attachments, ...uploaded]);
        this.uploadingAttachments.set(false);
        const uploadErrors = [...validationErrors, ...(failedFiles.length ? [`Unable to upload: ${failedFiles.join(', ')}.`] : [])];
        this.activityError.set(uploadErrors.join(' '));
        if (uploaded.length) {
          this.activityMessage.set(`${uploaded.length} file${uploaded.length === 1 ? '' : 's'} uploaded.`);
          this.refreshReminderCounts(reminder.id);
        }
      },
      error: () => {
        this.activityError.set('Unable to upload the selected file(s). Please try again.');
        this.uploadingAttachments.set(false);
      },
    });
  }

  downloadAttachment(attachment: ReminderAttachment): void {
    const reminder = this.reminder();
    if (!reminder || this.downloadingAttachmentId()) return;
    this.activityError.set('');
    this.activityMessage.set('');
    this.downloadingAttachmentId.set(attachment.id);
    this.reminderService.downloadAttachment(reminder.id, attachment.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = attachment.fileName;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
        this.downloadingAttachmentId.set(null);
        this.activityMessage.set('Attachment downloaded.');
      },
      error: () => {
        this.downloadingAttachmentId.set(null);
        this.activityError.set('Unable to download this attachment.');
      },
    });
  }

  deleteReminder(): void {
    const reminder = this.reminder();
    if (!reminder) return;
    const confirmed = window.confirm('Are you sure you want to delete this reminder?');
    if (!confirmed) return;
    this.isDeleting.set(true);
    const loadingTask = this.loading.begin('Deleting reminder…');
    this.reminderService.deleteReminder(reminder.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.loading.end(loadingTask);
        this.toast.success('Reminder deleted successfully');
        void this.router.navigate(['/reminders']);
      },
      error: error => {
        this.isDeleting.set(false);
        this.loading.end(loadingTask);
        this.toast.error(error.error?.message ?? 'Unable to delete the reminder.');
      },
    });
  }

  backToReminders(): void { this.router.navigate(['/reminders']); }
  getInitials(firstName: string, lastName: string): string {
    const first = firstName?.trim()?.charAt(0) ?? 'U';
    const last = lastName?.trim()?.charAt(0) ?? '';
    return `${first}${last}`;
  }
  getPriorityLabel(priority: ReminderPriority): string { return priority.replace('_', ' '); }
  getStatusLabel(status: ReminderStatus): string { return status.replace('_', ' '); }
  getFullName(user?: { firstName?: string; lastName?: string; title?: string } | null): string {
    if (!user) return 'Unknown user';
    const firstName = user.firstName?.trim() ?? '';
    const lastName = user.lastName?.trim() ?? '';
    const title = user.title?.trim() ?? '';
    const fullName = `${firstName} ${lastName}`.trim();
    return fullName ? `${title ? `${title} ` : ''}${fullName}` : (title || 'Unknown user');
  }
  getRecipientEmail(user?: { email?: string } | null): string {
    return user?.email?.trim() || 'No email available';
  }
  formatRecurrence(value?: string): string {
    return value ? value.replace('_', ' ') : 'Once';
  }
  formatFileSize(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  private loadReminderActivity(reminderId: string): void {
    this.loadingActivity.set(true);
    forkJoin({
      comments: this.reminderService.getComments(reminderId),
      attachments: this.reminderService.getAttachments(reminderId),
    }).subscribe({
      next: activity => {
        this.comments.set(activity.comments);
        this.attachments.set(activity.attachments);
        this.loadingActivity.set(false);
        const commentId = this.route.snapshot.queryParamMap.get('comment');
        if (commentId && activity.comments.some(comment => comment.id === commentId)) {
          this.highlightedCommentId.set(commentId);
          this.document.defaultView?.requestAnimationFrame(() => {
            this.document.getElementById(`reminder-comment-${commentId}`)?.scrollIntoView({ block: 'center' });
          });
        }
      },
      error: () => {
        this.loadingActivity.set(false);
        this.activityError.set('Unable to load reminder comments and attachments.');
      },
    });
  }

  private refreshReminderCounts(reminderId: string): void {
    this.reminderService.loadReminder(reminderId).subscribe({
      error: () => this.activityError.set('Activity was saved, but reminder counts could not be refreshed.'),
    });
  }

  private isSupportedAttachment(file: File): boolean {
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    return ['.pdf', '.doc', '.docx'].includes(extension);
  }
}
