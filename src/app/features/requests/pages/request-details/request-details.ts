import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { DatePipe, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { catchError, forkJoin, from, map, of } from 'rxjs';

import { AuthService } from '../../../../core/services/auth.service';
import {
  RequestAttachment,
  RequestComment,
  RequestPriority,
  RequestStatus,
  RequestType,
} from '../../../../core/models/request.model';
import { RequestService } from '../../../../core/services/request.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { ToastService } from '../../../../core/services/toast.service';
import { AttachmentTransferService } from '../../../../core/services/attachment-transfer.service';

@Component({
  selector: 'app-request-details',
  standalone: true,
  imports: [RouterModule, DatePipe, FormsModule],
  templateUrl: './request-details.html',
  styleUrl: './request-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestDetails implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly requestService = inject(RequestService);
  private readonly authService = inject(AuthService);
  private readonly loading = inject(LoadingService);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly attachmentTransfer = inject(AttachmentTransferService);
  readonly isDeleting = signal(false);
  readonly comments = signal<RequestComment[]>([]);
  readonly attachments = signal<RequestAttachment[]>([]);
  readonly commentText = signal('');
  readonly activityError = signal('');
  readonly activityMessage = signal('');
  readonly submittingComment = signal(false);
  readonly uploadingAttachments = signal(false);
  readonly loadingActivity = signal(false);
  readonly downloadingAttachmentId = signal<string | null>(null);
  readonly highlightedCommentId = signal<string | null>(null);

  readonly request = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');
    return id ? this.requestService.getRequest(id) ?? null : null;
  });

  readonly isOverdue = computed(() => {
    const request = this.request();
    return request ? this.requestService.isOverdue(request) : false;
  });

  readonly canApprove = computed(() => {
    const request = this.request();
    const user = this.authService.currentUser();
    if (!request || !user) return false;
    return user.role === 'CEO' && (request.status === 'PENDING' || request.status === 'IN_REVIEW' || request.status === 'NEEDS_INFORMATION');
  });

  readonly canReject = computed(() => {
    const request = this.request();
    const user = this.authService.currentUser();
    if (!request || !user) return false;
    return user.role === 'CEO' && (request.status === 'PENDING' || request.status === 'IN_REVIEW' || request.status === 'NEEDS_INFORMATION');
  });

  readonly canRequestInformation = computed(() => {
    const request = this.request();
    const user = this.authService.currentUser();
    if (!request || !user) return false;
    return user.role === 'CEO' && (request.status === 'PENDING' || request.status === 'IN_REVIEW');
  });

  readonly canComplete = computed(() => {
    const request = this.request();
    return request?.status === 'APPROVED' || request?.status === 'IN_REVIEW';
  });

  readonly canReopen = computed(() => {
    const request = this.request();
    return request?.status === 'REJECTED' || request?.status === 'CANCELLED' || request?.status === 'COMPLETED';
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.requestService.loadRequest(id).subscribe({
        next: () => this.loadRequestActivity(id),
        error: () => this.activityError.set('Unable to load this request.'),
      });
    }
  }

  editRequest(): void {
    const request = this.request();
    if (request) this.router.navigate(['/requests', request.id, 'edit']);
  }

  approveRequest(): void { this.updateStatus('APPROVED'); }
  rejectRequest(): void { this.updateStatus('REJECTED'); }
  requestMoreInformation(): void { this.updateStatus('NEEDS_INFORMATION'); }
  completeRequest(): void { this.updateStatus('COMPLETED'); }
  reopenRequest(): void { this.updateStatus('PENDING'); }
  cancelRequest(): void { this.updateStatus('CANCELLED'); }

  updateCommentText(event: Event): void {
    this.commentText.set((event.target as HTMLTextAreaElement).value);
  }

  submitComment(): void {
    const request = this.request();
    const body = this.commentText().trim();
    if (!request || !body || this.submittingComment()) return;
    this.activityError.set('');
    this.activityMessage.set('');
    this.submittingComment.set(true);
    this.requestService.addComment(request.id, body).subscribe({
      next: comment => {
        this.comments.update(comments => [...comments, comment]);
        this.commentText.set('');
        this.activityMessage.set('Comment posted.');
        this.submittingComment.set(false);
        this.refreshRequestCounts(request.id);
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
    const request = this.request();
    if (!request || this.uploadingAttachments()) return;
    this.activityError.set(validationErrors.join(' '));
    this.activityMessage.set('');
    this.uploadingAttachments.set(true);
    const uploads = validFiles.map(file => this.requestService.uploadAttachment(request.id, file).pipe(
      map(attachment => ({ attachment })),
      catchError(error => from(
        this.attachmentTransfer.failureMessage(error, 'upload'),
      ).pipe(map(message => ({ failedFile: `${file.name}: ${message}` }))))
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
          this.refreshRequestCounts(request.id);
        }
      },
      error: () => {
        this.activityError.set('Unable to upload the selected file(s). Please try again.');
        this.uploadingAttachments.set(false);
      },
    });
  }

  downloadAttachment(attachment: RequestAttachment): void {
    const request = this.request();
    if (!request || this.downloadingAttachmentId()) return;
    this.activityError.set('');
    this.activityMessage.set('');
    const downloadContext = this.attachmentTransfer.prepareDownload();
    this.downloadingAttachmentId.set(attachment.id);
    this.requestService.downloadAttachment(request.id, attachment.id).subscribe({
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
      },
    });
  }

  private downloadSuccessMessage(result: 'downloaded' | 'shared' | 'opened' | 'cancelled'): string {
    if (result === 'shared') return 'Attachment shared. Choose Save to Files to keep a copy.';
    if (result === 'opened') return 'Attachment opened. Use the Share menu to save it to Files.';
    return result === 'cancelled' ? '' : 'Attachment downloaded.';
  }

  deleteRequest(): void {
    const request = this.request();
    if (!request || this.isDeleting()) return;
    const confirmed = window.confirm(`Delete "${request.title}"? This action cannot be undone.`);
    if (!confirmed) return;
    this.isDeleting.set(true);
    const loadingTask = this.loading.begin('Deleting request…');
    this.requestService.deleteRequest(request.id).subscribe({
      next: () => {
        this.isDeleting.set(false);
        this.loading.end(loadingTask);
        this.toast.success('Request deleted successfully');
        void this.router.navigate(['/requests']);
      },
      error: error => {
        this.isDeleting.set(false);
        this.loading.end(loadingTask);
        this.toast.error(error.error?.message ?? 'Unable to delete the request.');
      },
    });
  }

  backToRequests(): void { this.router.navigate(['/requests']); }
  statusLabel(status: RequestStatus): string { return status.replace('_', ' '); }
  typeLabel(type: RequestType): string { return type.replace('_', ' '); }
  initials(firstName: string, lastName: string): string { return `${firstName.charAt(0)}${lastName.charAt(0)}`; }
  formatFileSize(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  private updateStatus(status: RequestStatus): void {
    const request = this.request();
    if (!request) return;
    this.requestService.updateStatus(request.id, status).subscribe();
  }

  private loadRequestActivity(requestId: string): void {
    this.loadingActivity.set(true);
    forkJoin({
      comments: this.requestService.getComments(requestId),
      attachments: this.requestService.getAttachments(requestId),
    }).subscribe({
      next: activity => {
        this.comments.set(activity.comments);
        this.attachments.set(activity.attachments);
        this.loadingActivity.set(false);
        const commentId = this.route.snapshot.queryParamMap.get('comment');
        if (commentId && activity.comments.some(comment => comment.id === commentId)) {
          this.highlightedCommentId.set(commentId);
          this.document.defaultView?.requestAnimationFrame(() => {
            this.document.getElementById(`request-comment-${commentId}`)?.scrollIntoView({ block: 'center' });
          });
        }
      },
      error: () => {
        this.loadingActivity.set(false);
        this.activityError.set('Unable to load request comments and attachments.');
      },
    });
  }

  private refreshRequestCounts(requestId: string): void {
    this.requestService.loadRequest(requestId).subscribe({
      error: () => this.activityError.set('Activity was saved, but request counts could not be refreshed.'),
    });
  }

  private isSupportedAttachment(file: File): boolean {
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    return ['.pdf', '.doc', '.docx'].includes(extension);
  }
}
