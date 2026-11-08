import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { Router } from '@angular/router';
import { ContentSkeleton } from '../../../../core/components/content-skeleton/content-skeleton';

import {
  Request,
  RequestPriority,
  RequestStatus,
  RequestType
} from '../../../../core/models/request.model';
import { AuthService } from '../../../../core/services/auth.service';
import { RequestService } from '../../../../core/services/request.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { ToastService } from '../../../../core/services/toast.service';
import { catchError, from, map, mergeMap, of, toArray } from 'rxjs';

@Component({
  selector: 'app-request-list',
  standalone: true,
  imports: [ContentSkeleton],
  templateUrl: './request-list.html',
  styleUrl: './request-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})


export class RequestList {


  readonly requestService = inject(RequestService);
  readonly listLoading = this.requestService.listLoading;
  readonly listError = this.requestService.listError;

  retryLoad(): void {
    this.requestService.loadRequests().subscribe({
      error: error => console.error('Unable to reload requests', error),
    });
  }

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly loading = inject(LoadingService);
  private readonly toast = inject(ToastService);

  readonly currentUser = this.authService.currentUser;
  readonly selectionDeniedMessage =
    'You cannot select or delete this item because you are not its creator.';
  readonly searchTerm = signal('');
  readonly statusFilter = signal<'ALL' | RequestStatus>('ALL');
  readonly typeFilter = signal<'ALL' | RequestType>('ALL');
  readonly priorityFilter = signal<'ALL' | RequestPriority>('ALL');
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly deletingSelected = signal(false);
  readonly deleteError = signal('');

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

  readonly assignedRequests = computed(() => {
    const userId = this.currentUser()?.id;
    if (!userId) return [];

    return this.requestService.requests().filter(request =>
      request.requester.id === userId || request.assignedTo.id === userId
    );
  });

  readonly requests = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const status = this.statusFilter();
    const type = this.typeFilter();
    const priority = this.priorityFilter();

    return this.assignedRequests().filter(request => {
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

  readonly manageableRequests = computed(() =>
    this.requests().filter(request => this.canDeleteRequest(request))
  );
  readonly selectedCount = computed(() =>
    this.manageableRequests().filter(request => this.selectedIds().has(request.id)).length
  );
  readonly allVisibleSelected = computed(
    () => this.manageableRequests().length > 0 &&
      this.manageableRequests().every(request => this.selectedIds().has(request.id))
  );
  readonly someVisibleSelected = computed(
    () => this.manageableRequests().some(request => this.selectedIds().has(request.id)) &&
      !this.allVisibleSelected()
  );

  readonly totalCount = computed(
    () => this.assignedRequests().length
  );

  readonly pendingCount = computed(
    () => this.assignedRequests().filter(request => request.status === 'PENDING').length
  );

  readonly inReviewCount = computed(
    () => this.assignedRequests().filter(request => request.status === 'IN_REVIEW').length
  );

  readonly approvedCount = computed(
    () => this.assignedRequests().filter(request => request.status === 'APPROVED').length
  );

  readonly completedCount = computed(
    () => this.assignedRequests().filter(request => request.status === 'COMPLETED').length
  );

  readonly attentionCount = computed(
    () => this.assignedRequests().filter(request =>
      request.priority === 'URGENT' ||
      request.priority === 'HIGH' ||
      request.status === 'NEEDS_INFORMATION'
    ).length
  );

  createRequest(): void {
    this.router.navigate(['/requests/new']);
  }

  viewRequest(id: string): void {
    this.router.navigate(['/requests', id]);
  }

  canDeleteRequest(request: Request): boolean {
    return request.requester.id === this.currentUser()?.id;
  }

  onSelectionClick(event: MouseEvent, canSelect: boolean): void {
    event.stopPropagation();
    if (!canSelect) {
      event.preventDefault();
      this.toast.error(this.selectionDeniedMessage);
    }
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelection(id: string, checked: boolean): void {
    const selected = new Set(this.selectedIds());
    const request = this.requests().find(item => item.id === id);
    if (checked && request && this.canDeleteRequest(request)) {
      selected.add(id);
    } else {
      selected.delete(id);
    }
    this.selectedIds.set(selected);
    this.deleteError.set('');
  }

  toggleAllSelection(checked: boolean): void {
    const selected = new Set(this.selectedIds());
    for (const request of this.manageableRequests()) {
      if (checked) {
        selected.add(request.id);
      } else {
        selected.delete(request.id);
      }
    }
    this.selectedIds.set(selected);
    this.deleteError.set('');
  }

  deleteSelected(): void {
    const ids = this.manageableRequests()
      .filter(request => this.selectedIds().has(request.id))
      .map(request => request.id);
    if (!ids.length || this.deletingSelected()) return;
    if (!window.confirm(`Delete ${ids.length} selected request(s)? This action cannot be undone.`)) return;

    this.deletingSelected.set(true);
    this.deleteError.set('');
    const loadingTask = this.loading.begin('Deleting selected requests…');
    from(ids).pipe(
      mergeMap(id => this.requestService.deleteRequest(id).pipe(
        map(() => ({ id, deleted: true as const })),
        catchError(error => of({ id, deleted: false as const, error }))
      ), 5),
      toArray()
    ).subscribe({
      next: results => {
        const failed = results.filter(result => !result.deleted);
        this.selectedIds.set(new Set(failed.map(result => result.id)));
        this.deletingSelected.set(false);
        this.loading.end(loadingTask);
        if (failed.length) {
          console.error('Unable to delete selected requests', failed);
          this.deleteError.set(
            `Unable to delete ${failed.length} selected request(s). Failed items remain selected.`
          );
        }
      },
      error: error => {
        console.error('Unable to delete selected requests', error);
        this.deletingSelected.set(false);
        this.loading.end(loadingTask);
        this.deleteError.set('Unable to delete the selected requests. Please try again.');
      }
    });
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