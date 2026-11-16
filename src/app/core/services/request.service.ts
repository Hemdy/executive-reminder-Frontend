import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY, Observable, Subscription, catchError, finalize, of, takeUntil, tap, throwError } from 'rxjs';
import { User } from '../models/user.model';
import { CreateRequestRequest, Request, RequestAttachment, RequestComment, RequestStatus, UpdateRequestRequest } from '../models/request.model';
import { API_BASE_URL } from '../config/api.config';
import { sortRequestsDesc } from '../utils/date-sort';
import {
  bindAuthSessionLifecycle,
  currentAuthSessionVersion,
  isSameAuthSession,
  sessionEndedStream,
} from '../utils/session-scope';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class RequestService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = `${API_BASE_URL}/requests`;
  private readonly requestsSignal = signal<Request[]>([]);
  readonly requests = this.requestsSignal.asReadonly();
  readonly listLoading = signal(false);
  readonly listError = signal('');
  readonly pendingRequests = computed(() => this.requestsSignal().filter(request => request.status === 'PENDING'));
  readonly inReviewRequests = computed(() => this.requestsSignal().filter(request => request.status === 'IN_REVIEW'));
  readonly approvedRequests = computed(() => this.requestsSignal().filter(request => request.status === 'APPROVED'));
  readonly completedRequests = computed(() => this.requestsSignal().filter(request => request.status === 'COMPLETED'));
  readonly attentionRequests = computed(() => this.requestsSignal().filter(request => request.priority === 'URGENT' || request.priority === 'HIGH' || request.status === 'NEEDS_INFORMATION'));
  private loadSequence = 0;
  private activeLoadSubscription: Subscription | null = null;

  constructor() {
    bindAuthSessionLifecycle(this.auth, this.destroyRef, {
      onClear: () => this.resetState(),
      onUserChange: userId => {
        this.resetState();
        if (!userId) {
          return;
        }
        this.activeLoadSubscription = this.loadRequests().subscribe({
          error: error => console.error('Unable to load requests', error),
        });
      },
    });

    this.destroyRef.onDestroy(() => {
      this.activeLoadSubscription?.unsubscribe();
    });
  }

  getRequests(): Request[] { return this.requestsSignal(); }
  getRequest(id: string): Request | undefined { return this.requestsSignal().find(request => request.id === id); }
  loadRequest(id: string): Observable<Request> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.get<Request>(`${this.apiUrl}/${id}`).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(request => {
        if (!isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          return;
        }
        const normalized = this.normalize(request);
        this.requestsSignal.update(requests => sortRequestsDesc(
          requests.some(item => item.id === normalized.id)
            ? requests.map(item => item.id === normalized.id ? normalized : item)
            : [normalized, ...requests]
        ));
      })
    );
  }
  loadRequests(): Observable<Request[]> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    if (!expectedUserId) {
      this.resetState();
      return of([]);
    }

    const requestSeq = ++this.loadSequence;
    this.listLoading.set(true);
    this.listError.set('');
    return this.http.get<Request[]>(this.apiUrl).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(requests => {
        if (requestSeq !== this.loadSequence || !isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          return;
        }
        this.requestsSignal.set(sortRequestsDesc(requests.map(request => this.normalize(request))));
      }),
      catchError(error => {
        if (requestSeq !== this.loadSequence || !isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          return EMPTY;
        }
        this.listError.set('Unable to load requests. Please try again.');
        return throwError(() => error);
      }),
      finalize(() => {
        if (requestSeq === this.loadSequence && isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.listLoading.set(false);
        }
      })
    );
  }
  createRequest(request: CreateRequestRequest, _requester?: User, _assignedTo?: User): Observable<Request> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.post<Request>(this.apiUrl, request).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(created => {
        if (isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.requestsSignal.update(requests => sortRequestsDesc([this.normalize(created), ...requests]));
        }
      })
    );
  }
  updateRequest(id: string, request: UpdateRequestRequest, _assignedTo?: User): Observable<Request> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.patch<Request>(`${this.apiUrl}/${id}`, request).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(updated => {
        if (isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.replace(this.normalize(updated));
        }
      })
    );
  }
  updateStatus(id: string, status: RequestStatus): Observable<Request> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.patch<Request>(`${this.apiUrl}/${id}/status`, { status }).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(updated => {
        if (isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.replace(this.normalize(updated));
        }
      })
    );
  }
  getComments(requestId: string): Observable<RequestComment[]> {
    return this.http.get<RequestComment[]>(`${this.apiUrl}/${requestId}/comments`);
  }
  addComment(requestId: string, body: string): Observable<RequestComment> {
    return this.http.post<RequestComment>(`${this.apiUrl}/${requestId}/comments`, { body });
  }
  updateComment(requestId: string, commentId: string, body: string): Observable<RequestComment> {
    return this.http.patch<RequestComment>(
      `${this.apiUrl}/${requestId}/comments/${commentId}`,
      { body }
    );
  }
  getAttachments(requestId: string): Observable<RequestAttachment[]> {
    return this.http.get<RequestAttachment[]>(`${this.apiUrl}/${requestId}/attachments`);
  }
  uploadAttachment(requestId: string, file: File): Observable<RequestAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<RequestAttachment>(`${this.apiUrl}/${requestId}/attachments`, formData);
  }
  downloadAttachment(requestId: string, attachmentId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${requestId}/attachments/${attachmentId}`, {
      responseType: 'blob'
    });
  }
  deleteAttachment(requestId: string, attachmentId: string): Observable<{ id: string; deleted: boolean }> {
    return this.http.delete<{ id: string; deleted: boolean }>(
      `${this.apiUrl}/${requestId}/attachments/${attachmentId}`
    );
  }
  deleteRequest(id: string): Observable<void> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(() => {
        if (isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.requestsSignal.update(requests => requests.filter(request => request.id !== id));
        }
      })
    );
  }

  private resetState(): void {
    this.loadSequence += 1;
    this.activeLoadSubscription?.unsubscribe();
    this.activeLoadSubscription = null;
    this.requestsSignal.set([]);
    this.listError.set('');
    this.listLoading.set(false);
  }
  isOverdue(request: Request): boolean {
    return !!request.dueDate && !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(request.status) && new Date(request.dueDate).getTime() < Date.now();
  }
  formatDate(date?: string): string {
    return date ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date)) : 'No due date';
  }
  private replace(request: Request): void {
    this.requestsSignal.update(requests => sortRequestsDesc(requests.map(existing => existing.id === request.id ? request : existing)));
  }
  private normalize(request: Request): Request {
    return {
      ...request,
      dueDate: request.dueDate?.slice(0, 10),
      commentsCount: request._count?.comments ?? request.commentsCount ?? 0,
      attachmentsCount: request._count?.attachments ?? request.attachmentsCount ?? 0,
    };
  }
}
