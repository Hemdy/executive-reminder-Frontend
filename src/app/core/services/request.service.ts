import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { User } from '../models/user.model';
import { CreateRequestRequest, Request, RequestStatus, UpdateRequestRequest } from '../models/request.model';
import { API_BASE_URL } from '../config/api.config';

@Injectable({ providedIn: 'root' })
export class RequestService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_BASE_URL}/requests`;
  private readonly requestsSignal = signal<Request[]>([]);
  readonly requests = this.requestsSignal.asReadonly();
  readonly pendingRequests = computed(() => this.requestsSignal().filter(request => request.status === 'PENDING'));
  readonly inReviewRequests = computed(() => this.requestsSignal().filter(request => request.status === 'IN_REVIEW'));
  readonly approvedRequests = computed(() => this.requestsSignal().filter(request => request.status === 'APPROVED'));
  readonly completedRequests = computed(() => this.requestsSignal().filter(request => request.status === 'COMPLETED'));
  readonly attentionRequests = computed(() => this.requestsSignal().filter(request => request.priority === 'URGENT' || request.priority === 'HIGH' || request.status === 'NEEDS_INFORMATION'));

  constructor() {
    this.loadRequests().subscribe({ error: error => console.error('Unable to load requests', error) });
  }

  getRequests(): Request[] { return this.requestsSignal(); }
  getRequest(id: string): Request | undefined { return this.requestsSignal().find(request => request.id === id); }
  loadRequests(): Observable<Request[]> {
    return this.http.get<Request[]>(this.apiUrl).pipe(tap(requests => this.requestsSignal.set(requests.map(request => this.normalize(request)))));
  }
  createRequest(request: CreateRequestRequest, _requester?: User, _assignedTo?: User): Observable<Request> {
    return this.http.post<Request>(this.apiUrl, request).pipe(tap(created => this.requestsSignal.update(requests => [this.normalize(created), ...requests])));
  }
  updateRequest(id: string, request: UpdateRequestRequest, _assignedTo?: User): Observable<Request> {
    return this.http.patch<Request>(`${this.apiUrl}/${id}`, request).pipe(tap(updated => this.replace(this.normalize(updated))));
  }
  updateStatus(id: string, status: RequestStatus): Observable<Request> {
    return this.http.patch<Request>(`${this.apiUrl}/${id}/status`, { status }).pipe(tap(updated => this.replace(this.normalize(updated))));
  }
  deleteRequest(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(tap(() => this.requestsSignal.update(requests => requests.filter(request => request.id !== id))));
  }
  isOverdue(request: Request): boolean {
    return !!request.dueDate && !['COMPLETED', 'REJECTED', 'CANCELLED'].includes(request.status) && new Date(request.dueDate).getTime() < Date.now();
  }
  formatDate(date?: string): string {
    return date ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date)) : 'No due date';
  }
  private replace(request: Request): void {
    this.requestsSignal.update(requests => requests.map(existing => existing.id === request.id ? request : existing));
  }
  private normalize(request: Request): Request {
    return { ...request, dueDate: request.dueDate?.slice(0, 10) };
  }
}
