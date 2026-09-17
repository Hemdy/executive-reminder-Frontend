import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink, RouterModule } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';
import {
  RequestPriority,
  RequestStatus,
  RequestType
} from '../../../../core/models/request.model';
import { RequestService } from '../../../../core/services/request.service';

@Component({
  selector: 'app-request-details',
  standalone: true,
  imports: [RouterModule, DatePipe],

  templateUrl: './request-details.html',
  styleUrl: './request-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class RequestDetails {






  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly requestService = inject(RequestService);
  private readonly authService = inject(AuthService);

  readonly request = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');

    return id
      ? this.requestService.getRequest(id) ?? null
      : null;
  });

  readonly isOverdue = computed(() => {
    const request = this.request();

    return request
      ? this.requestService.isOverdue(request)
      : false;
  });

  readonly canApprove = computed(() => {
    const request = this.request();
    const user = this.authService.currentUser();

    if (!request || !user) {
      return false;
    }

    return (
      user.role === 'CEO' &&
      (request.status === 'PENDING' ||
        request.status === 'IN_REVIEW' ||
        request.status === 'NEEDS_INFORMATION')
    );
  });

  readonly canReject = computed(() => {
    const request = this.request();
    const user = this.authService.currentUser();

    if (!request || !user) {
      return false;
    }

    return (
      user.role === 'CEO' &&
      (request.status === 'PENDING' ||
        request.status === 'IN_REVIEW' ||
        request.status === 'NEEDS_INFORMATION')
    );
  });

  readonly canRequestInformation = computed(() => {
    const request = this.request();
    const user = this.authService.currentUser();

    if (!request || !user) {
      return false;
    }

    return (
      user.role === 'CEO' &&
      (request.status === 'PENDING' ||
        request.status === 'IN_REVIEW')
    );
  });

  readonly canComplete = computed(() => {
    const request = this.request();

    return (
      request?.status === 'APPROVED' ||
      request?.status === 'IN_REVIEW'
    );
  });

  readonly canReopen = computed(() => {
    const request = this.request();

    return (
      request?.status === 'REJECTED' ||
      request?.status === 'CANCELLED' ||
      request?.status === 'COMPLETED'
    );
  });

  editRequest(): void {
    const request = this.request();

    if (request) {
      this.router.navigate(['/requests', request.id, 'edit']);
    }
  }

  approveRequest(): void {
    this.updateStatus('APPROVED');
  }

  rejectRequest(): void {
    this.updateStatus('REJECTED');
  }

  requestMoreInformation(): void {
    this.updateStatus('NEEDS_INFORMATION');
  }

  completeRequest(): void {
    this.updateStatus('COMPLETED');
  }

  reopenRequest(): void {
    this.updateStatus('PENDING');
  }

  cancelRequest(): void {
    this.updateStatus('CANCELLED');
  }

  deleteRequest(): void {
    const request = this.request();

    if (!request) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${request.title}"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    this.requestService.deleteRequest(request.id);
    this.router.navigate(['/requests']);
  }

  backToRequests(): void {
    this.router.navigate(['/requests']);
  }

  statusLabel(status: RequestStatus): string {
    return status.replace('_', ' ');
  }

  typeLabel(type: RequestType): string {
    return type.replace('_', ' ');
  }

  initials(firstName: string, lastName: string): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`;
  }

  private updateStatus(status: RequestStatus): void {
    const request = this.request();

    if (!request) {
      return;
    }

    this.requestService.updateStatus(request.id, status).subscribe();
  }
}
