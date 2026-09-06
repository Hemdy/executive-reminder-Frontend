import { Injectable, computed, signal } from '@angular/core';

import { User } from '../../core/models/user.model';
import {
  CreateRequestRequest,
  Request,
  RequestPriority,
  RequestStatus,
  RequestType,
  UpdateRequestRequest
} from '../models/request.model';

@Injectable({
  providedIn: 'root'
})
export class RequestService {
  private readonly requestsSignal = signal<Request[]>([]);

  readonly requests = this.requestsSignal.asReadonly();

  readonly pendingRequests = computed(() =>
    this.requestsSignal().filter(request => request.status === 'PENDING')
  );

  readonly inReviewRequests = computed(() =>
    this.requestsSignal().filter(request => request.status === 'IN_REVIEW')
  );

  readonly approvedRequests = computed(() =>
    this.requestsSignal().filter(request => request.status === 'APPROVED')
  );

  readonly completedRequests = computed(() =>
    this.requestsSignal().filter(request => request.status === 'COMPLETED')
  );

  readonly attentionRequests = computed(() =>
    this.requestsSignal().filter(
      request =>
        request.priority === 'URGENT' ||
        request.priority === 'HIGH' ||
        request.status === 'NEEDS_INFORMATION'
    )
  );

  constructor() {
    this.loadMockRequests();
  }

  getRequests(): Request[] {
    return this.requestsSignal();
  }

  getRequest(id: string): Request | undefined {
    return this.requestsSignal().find(request => request.id === id);
  }

  createRequest(
    request: CreateRequestRequest,
    requester: User,
    assignedTo: User
  ): Request {
    const now = new Date().toISOString();

    const newRequest: Request = {
      id: `request-${Date.now()}`,
      title: request.title,
      description: request.description,
      type: request.type,
      priority: request.priority,
      requester,
      assignedTo,
      status: 'PENDING',
      dueDate: request.dueDate || undefined,
      createdAt: now,
      updatedAt: now,
      commentsCount: 0,
      attachmentsCount: 0
    };

    this.requestsSignal.update(requests => [
      newRequest,
      ...requests
    ]);

    return newRequest;
  }

  updateRequest(
    id: string,
    request: UpdateRequestRequest,
    assignedTo: User
  ): void {
    this.requestsSignal.update(requests =>
      requests.map(existingRequest =>
        existingRequest.id === id
          ? {
              ...existingRequest,
              title: request.title,
              description: request.description,
              type: request.type,
              priority: request.priority,
              assignedTo,
              dueDate: request.dueDate || undefined,
              status: request.status,
              updatedAt: new Date().toISOString()
            }
          : existingRequest
      )
    );
  }

  updateStatus(id: string, status: RequestStatus): void {
    this.requestsSignal.update(requests =>
      requests.map(request =>
        request.id === id
          ? {
              ...request,
              status,
              updatedAt: new Date().toISOString()
            }
          : request
      )
    );
  }

  deleteRequest(id: string): void {
    this.requestsSignal.update(requests =>
      requests.filter(request => request.id !== id)
    );
  }

  isOverdue(request: Request): boolean {
    if (!request.dueDate) {
      return false;
    }

    if (
      request.status === 'COMPLETED' ||
      request.status === 'REJECTED' ||
      request.status === 'CANCELLED'
    ) {
      return false;
    }

    return new Date(request.dueDate).getTime() < Date.now();
  }

  formatDate(date?: string): string {
    if (!date) {
      return 'No due date';
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(date));
  }

  private loadMockRequests(): void {
    const ceo: User = {
      id: 'user-ceo',
      firstName: 'Michael',
      lastName: 'Anderson',
      email: 'ceo@exectrack.local',
      role: 'CEO'
    };

    const employee: User = {
      id: 'user-employee',
      firstName: 'John',
      lastName: 'Doe',
      email: 'employee@exectrack.local',
      role: 'EMPLOYEE',
      department: 'Operations'
    };

    const assistant: User = {
      id: 'user-assistant',
      firstName: 'Sarah',
      lastName: 'Williams',
      email: 'assistant@exectrack.local',
      role: 'EXECUTIVE_ASSISTANT'
    };

    const admin: User = {
      id: 'user-admin',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@exectrack.local',
      role: 'ADMIN'
    };

    const today = new Date();

    const datePlusDays = (days: number): string => {
      const date = new Date(today);
      date.setDate(date.getDate() + days);
      return date.toISOString();
    };

    const dateMinusDays = (days: number): string => {
      const date = new Date(today);
      date.setDate(date.getDate() - days);
      return date.toISOString();
    };

    const mockRequests: Request[] = [
      {
        id: 'request-001',
        title: 'Laptop Purchase Approval',
        description:
          'Approval is required for the purchase of a new executive laptop.',
        type: 'APPROVAL',
        priority: 'URGENT',
        requester: employee,
        assignedTo: ceo,
        status: 'PENDING',
        dueDate: datePlusDays(1),
        createdAt: dateMinusDays(1),
        updatedAt: dateMinusDays(1),
        commentsCount: 3,
        attachmentsCount: 2
      },
      {
        id: 'request-002',
        title: 'Q3 Marketing Budget Decision',
        description:
          'Management decision requested on the proposed Q3 marketing budget.',
        type: 'DECISION',
        priority: 'HIGH',
        requester: assistant,
        assignedTo: ceo,
        status: 'IN_REVIEW',
        dueDate: datePlusDays(2),
        createdAt: dateMinusDays(2),
        updatedAt: dateMinusDays(1),
        commentsCount: 5,
        attachmentsCount: 1
      },
      {
        id: 'request-003',
        title: 'Annual Contract Review',
        description:
          'Please review the annual supplier contract before renewal.',
        type: 'DOCUMENT_REVIEW',
        priority: 'MEDIUM',
        requester: employee,
        assignedTo: ceo,
        status: 'NEEDS_INFORMATION',
        dueDate: dateMinusDays(1),
        createdAt: dateMinusDays(4),
        updatedAt: dateMinusDays(1),
        commentsCount: 4,
        attachmentsCount: 3
      },
      {
        id: 'request-004',
        title: 'Operations Equipment Request',
        description:
          'Request for additional equipment required by the Operations team.',
        type: 'EXPENSE',
        priority: 'MEDIUM',
        requester: employee,
        assignedTo: assistant,
        status: 'APPROVED',
        dueDate: datePlusDays(5),
        createdAt: dateMinusDays(5),
        updatedAt: dateMinusDays(2),
        commentsCount: 2,
        attachmentsCount: 1
      },
      {
        id: 'request-005',
        title: 'Employee Policy Information',
        description:
          'Request for clarification regarding the updated employee policy.',
        type: 'INFORMATION',
        priority: 'LOW',
        requester: employee,
        assignedTo: assistant,
        status: 'COMPLETED',
        dueDate: dateMinusDays(2),
        createdAt: dateMinusDays(7),
        updatedAt: dateMinusDays(3),
        commentsCount: 1,
        attachmentsCount: 0
      },
      {
        id: 'request-006',
        title: 'Board Meeting Proposal',
        description:
          'Proposal to schedule a special board meeting for strategic planning.',
        type: 'MEETING',
        priority: 'HIGH',
        requester: assistant,
        assignedTo: ceo,
        status: 'PENDING',
        dueDate: datePlusDays(3),
        createdAt: dateMinusDays(1),
        updatedAt: dateMinusDays(1),
        commentsCount: 2,
        attachmentsCount: 0
      },
      {
        id: 'request-007',
        title: 'Office Renovation Request',
        description:
          'Request to approve the proposed office renovation project.',
        type: 'GENERAL',
        priority: 'LOW',
        requester: admin,
        assignedTo: assistant,
        status: 'REJECTED',
        dueDate: dateMinusDays(5),
        createdAt: dateMinusDays(10),
        updatedAt: dateMinusDays(6),
        commentsCount: 3,
        attachmentsCount: 2
      }
    ];

    this.requestsSignal.set(mockRequests);
  }
}