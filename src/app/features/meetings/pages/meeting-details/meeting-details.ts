import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal
} from '@angular/core';

import { DatePipe, DOCUMENT } from '@angular/common';

import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterModule
} from '@angular/router';

import {
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
  imports: [RouterModule, DatePipe],
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
  readonly commentText = signal('');
  readonly commentsLoading = signal(false);
  readonly commentSubmitting = signal(false);
  readonly commentsError = signal('');
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
      this.meetingService.loadMeeting(id).subscribe();
      this.loadComments(id);
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
    const meetingId = this.route.snapshot.paramMap.get('id');
    const body = this.commentText().trim();
    if (!meetingId || !body || this.commentSubmitting()) {
      return;
    }
    this.commentsError.set('');
    this.commentSubmitting.set(true);
    this.meetingService.addComment(meetingId, body).subscribe({
      next: comment => {
        this.comments.update(comments => [...comments, comment]);
        this.commentText.set('');
        this.commentSubmitting.set(false);
      },
      error: () => {
        this.commentsError.set('Unable to post the comment. Please try again.');
        this.commentSubmitting.set(false);
      },
    });
  }

  private loadComments(meetingId: string): void {
    this.commentsLoading.set(true);
    this.meetingService.getComments(meetingId).subscribe({
      next: comments => {
        this.comments.set(comments);
        this.commentsLoading.set(false);
        const commentId = this.route.snapshot.queryParamMap.get('comment');
        if (commentId && comments.some(comment => comment.id === commentId)) {
          this.highlightedCommentId.set(commentId);
          this.document.defaultView?.requestAnimationFrame(() => {
            this.document.getElementById(`meeting-comment-${commentId}`)
              ?.scrollIntoView({ block: 'center' });
          });
        }
      },
      error: () => {
        this.commentsLoading.set(false);
        this.commentsError.set('Unable to load meeting comments.');
      },
    });
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