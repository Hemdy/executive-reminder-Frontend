import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { Router } from '@angular/router';

import {
  RequestPriority,
  RequestStatus,
  RequestType
} from '../../../../core/models/request.model';
import { RequestService } from '../../../../core/services/request.service';

@Component({
  selector: 'app-request-list',
  standalone: true,
   templateUrl: './request-list.html',
  styleUrl: './request-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})


export class RequestList {


  readonly requestService = inject(RequestService);
  private readonly router = inject(Router);

  readonly searchTerm = signal('');
  readonly statusFilter = signal<'ALL' | RequestStatus>('ALL');
  readonly typeFilter = signal<'ALL' | RequestType>('ALL');
  readonly priorityFilter = signal<'ALL' | RequestPriority>('ALL');

  readonly statuses: RequestStatus[] = [
    'PENDING',
    'IN_REVIEW',
    'APPROVED',
    'REJECTED',
    'NEEDS_INFORMATION',
    'COMPLETED',
    'CANCELLED'
  ];

  readonly types: RequestType[] = [
    'GENERAL',
    'APPROVAL',
    'DECISION',
    'DOCUMENT_REVIEW',
    'INFORMATION',
    'MEETING',
    'EXPENSE',
    'OTHER'
  ];

  readonly priorities: RequestPriority[] = [
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
  ];

  readonly requests = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const type = this.typeFilter();
    const priority = this.priorityFilter();

    return this.requestService.requests().filter(request => {
      const matchesSearch =
        !search ||
        request.title.toLowerCase().includes(search) ||
        request.description?.toLowerCase().includes(search) ||
        `${request.requester.firstName} ${request.requester.lastName}`
          .toLowerCase()
          .includes(search) ||
        `${request.assignedTo.firstName} ${request.assignedTo.lastName}`
          .toLowerCase()
          .includes(search);

      const matchesStatus =
        status === 'ALL' || request.status === status;

      const matchesType =
        type === 'ALL' || request.type === type;

      const matchesPriority =
        priority === 'ALL' || request.priority === priority;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesPriority
      );
    });
  });

  readonly totalCount = computed(
    () => this.requestService.requests().length
  );

  readonly pendingCount = computed(
    () => this.requestService.pendingRequests().length
  );

  readonly inReviewCount = computed(
    () => this.requestService.inReviewRequests().length
  );

  readonly approvedCount = computed(
    () => this.requestService.approvedRequests().length
  );

  readonly completedCount = computed(
    () => this.requestService.completedRequests().length
  );

  readonly attentionCount = computed(
    () => this.requestService.attentionRequests().length
  );

  createRequest(): void {
    this.router.navigate(['/requests/new']);
  }

  viewRequest(id: string): void {
    this.router.navigate(['/requests', id]);
  }

  isOverdue(request: Parameters<RequestService['isOverdue']>[0]): boolean {
    return this.requestService.isOverdue(request);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('ALL');
    this.typeFilter.set('ALL');
    this.priorityFilter.set('ALL');
  }

  statusLabel(status: RequestStatus): string {
    return status.replace('_', ' ');
  }

  typeLabel(type: RequestType): string {
    return type.replace('_', ' ');
  }

  priorityLabel(priority: RequestPriority): string {
    return priority;
  }

  // requesterName(request: Parameters<RequestService['getRequest']>[0] extends string ? never : never): string {
  //   return '';
  // }
}