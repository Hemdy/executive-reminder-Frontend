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

import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterModule
} from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';

import {
  MeetingAttachment,
  MeetingComment,
  MeetingStatus,
  MeetingType
} from '../../../../core/models/meeting.model';

import { MeetingService } from '../../../../core/services/meeting.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { ToastService } from '../../../../core/services/toast.service';

@Component({
  selector: 'app-meeting-details',
  standalone: true,
  imports: [RouterModule, DatePipe, FormsModule],
  templateUrl: './meeting-details.html',
  styleUrl: './meeting-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class MeetingDetails implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly meetingService = inject(MeetingService);
  private readonly document = inject(DOCUMENT);
  private readonly loading = inject(LoadingService);
  private readonly toast = inject(ToastService);
  readonly isDeleting = signal(false);
  readonly comments = signal<MeetingComment[]>([]);
  readonly attachments = signal<MeetingAttachment[]>([]);
  readonly commentText = signal('');
  readonly commentsLoading = signal(false);
  readonly commentSubmitting = signal(false);
  readonly commentsError = signal('');
  readonly activityError = signal('');
  readonly activityMessage = signal('');
  readonly uploadingAttachments = signal(false);
  readonly downloadingAttachmentId = signal<string | null>(null);
  readonly highlightedCommentId = signal<string | null>(null);

  readonly meeting = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');

    return id
      ? this.meetingService.getMeeting(id) ?? null
      : null;
  });

  readonly isPast = computed(() => {
    const meeting = this.meeting();

    return meeting
      ? this.meetingService.isPast(meeting)
      : false;
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.meetingService.loadMeeting(id).subscribe({
        next: () => this.loadMeetingActivity(id),
        error: () => this.activityError.set('Unable to load this meeting.')
      });
    }
  }

  editMeeting(): void {
    const meeting = this.meeting();

    if (meeting) {
      this.router.navigate([
        '/meetings',
        meeting.id,
        'edit'
      ]);
    }
  }

  markCompleted(): void {
    this.updateStatus('COMPLETED');
  }

  reschedule(): void {
    this.updateStatus('RESCHEDULED');
  }

  cancelMeeting(): void {
    this.updateStatus('CANCELLED');
  }

  restoreMeeting(): void {
    this.updateStatus('SCHEDULED');
  }

  deleteMeeting(): void {
    const meeting = this.meeting();

    if (!meeting || this.isDeleting()) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${meeting.title}"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    this.isDeleting.set(true);
    const loadingTask = this.loading.begin('Deleting meeting…');
    this.meetingService.deleteMeeting(meeting.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.loading.end(loadingTask);
        this.toast.success('Meeting deleted successfully');
        void this.router.navigate(['/meetings']);
      },
      error: error => {
        this.isDeleting.set(false);
        this.loading.end(loadingTask);
        this.toast.error(error.error?.message ?? 'Unable to delete the meeting.');
      }
    });
  }

  backToMeetings(): void {
    this.router.navigate(['/meetings']);
  }

  typeLabel(type: MeetingType): string {
    return this.meetingService.meetingTypeLabel(type);
  }

  statusLabel(status: MeetingStatus): string {
    return this.meetingService.meetingStatusLabel(status);
  }

  formatTime(time: string): string {
    return this.meetingService.formatTime(time);
  }

  initials(
    firstName: string,
    lastName: string
  ): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`;
  }

  updateCommentText(event: Event): void {
    this.commentText.set((event.target as HTMLTextAreaElement).value);
  }

  submitComment(): void {
    const meeting = this.meeting();
    const body = this.commentText().trim();

    if (!meeting || !body || this.commentSubmitting()) {
      return;
    }

    this.activityError.set('');
    this.activityMessage.set('');
    this.commentSubmitting.set(true);
    this.meetingService.addComment(meeting.id, body).subscribe({
      next: comment => {
        this.comments.update(comments => [...comments, comment]);
        this.commentText.set('');
        this.commentSubmitting.set(false);
        this.activityMessage.set('Comment posted.');
        this.refreshMeetingCounts(meeting.id);
      },
      error: () => {
        this.commentsError.set('Unable to post the comment. Please try again.');
        this.commentSubmitting.set(false);
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

    const meeting = this.meeting();
    if (!meeting || this.uploadingAttachments()) {
      return;
    }

    this.activityError.set(validationErrors.join(' '));
    this.activityMessage.set('');
    this.uploadingAttachments.set(true);

    const uploads = validFiles.map(file => this.meetingService.uploadAttachment(meeting.id, file).pipe(
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
          this.refreshMeetingCounts(meeting.id);
        }
      },
      error: () => {
        this.activityError.set('Unable to upload the selected file(s). Please try again.');
        this.uploadingAttachments.set(false);
      },
    });
  }

  downloadAttachment(attachment: MeetingAttachment): void {
    const meeting = this.meeting();
    if (!meeting || this.downloadingAttachmentId()) {
      return;
    }

    this.activityError.set('');
    this.activityMessage.set('');
    this.downloadingAttachmentId.set(attachment.id);
    this.meetingService.downloadAttachment(meeting.id, attachment.id).subscribe({
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

  formatFileSize(size: number): string {
    if (size < 1024) {
      return `${size} B`;
    }
    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`;
    }
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  private loadMeetingActivity(meetingId: string): void {
    this.commentsLoading.set(true);
    forkJoin({
      comments: this.meetingService.getComments(meetingId),
      attachments: this.meetingService.getAttachments(meetingId),
    }).subscribe({
      next: activity => {
        this.comments.set(activity.comments);
        this.attachments.set(activity.attachments);
        this.commentsLoading.set(false);
        const commentId = this.route.snapshot.queryParamMap.get('comment');
        if (commentId && activity.comments.some(comment => comment.id === commentId)) {
          this.highlightedCommentId.set(commentId);
          this.document.defaultView?.requestAnimationFrame(() => {
            this.document.getElementById(`meeting-comment-${commentId}`)?.scrollIntoView({ block: 'center' });
          });
        }
      },
      error: () => {
        this.commentsLoading.set(false);
        this.activityError.set('Unable to load meeting comments and attachments.');
      },
    });
  }

  private refreshMeetingCounts(meetingId: string): void {
    this.meetingService.loadMeeting(meetingId).subscribe({
      error: () => this.activityError.set('Activity was saved, but meeting counts could not be refreshed.')
    });
  }

  private isSupportedAttachment(file: File): boolean {
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    return ['.pdf', '.doc', '.docx'].includes(extension);
  }

  private updateStatus(status: MeetingStatus): void {
    const meeting = this.meeting();

    if (!meeting) {
      return;
    }

    this.meetingService.updateStatus(
      meeting.id,
      status
    ).subscribe();
  }
}