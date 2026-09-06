import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

import { AuthService } from '../../../../core/services/auth.service';
import { User } from '../../../../core/models/user.model';
import {
  CreateRequestRequest,
  RequestPriority,
  RequestStatus,
  RequestType,
  UpdateRequestRequest
} from '../../../../core/models/request.model';
import { RequestService } from '../../../../core/services/request.service';

@Component({
  selector: 'app-request-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './request-form.html',
  styleUrl: './request-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class RequestForm {















  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly requestService = inject(RequestService);

  readonly requestId = computed(
    () => this.route.snapshot.paramMap.get('id')
  );

  readonly isEditMode = computed(() => this.requestId() !== null);

  readonly users: User[] = [
    {
      id: 'user-ceo',
      firstName: 'Michael',
      lastName: 'Anderson',
      email: 'ceo@exectrack.local',
      role: 'CEO'
    },
    {
      id: 'user-employee',
      firstName: 'John',
      lastName: 'Doe',
      email: 'employee@exectrack.local',
      role: 'EMPLOYEE',
      department: 'Operations'
    },
    {
      id: 'user-assistant',
      firstName: 'Sarah',
      lastName: 'Williams',
      email: 'assistant@exectrack.local',
      role: 'EXECUTIVE_ASSISTANT'
    },
    {
      id: 'user-admin',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@exectrack.local',
      role: 'ADMIN'
    }
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

  readonly statuses: RequestStatus[] = [
    'PENDING',
    'IN_REVIEW',
    'APPROVED',
    'REJECTED',
    'NEEDS_INFORMATION',
    'COMPLETED',
    'CANCELLED'
  ];

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(2000)],
    type: ['GENERAL' as RequestType, Validators.required],
    priority: ['MEDIUM' as RequestPriority, Validators.required],
    assignedToId: ['', Validators.required],
    dueDate: [''],
    status: ['PENDING' as RequestStatus, Validators.required]
  });

  ngOnInit(): void {
    const currentUser = this.authService.currentUser();

    if (!this.isEditMode()) {
      this.form.patchValue({
        assignedToId: currentUser?.id ?? 'user-ceo'
      });

      return;
    }

    const request = this.requestService.getRequest(this.requestId()!);

    if (!request) {
      this.router.navigate(['/requests']);
      return;
    }

    this.form.patchValue({
      title: request.title,
      description: request.description ?? '',
      type: request.type,
      priority: request.priority,
      assignedToId: request.assignedTo.id,
      dueDate: request.dueDate
        ? this.toDateInputValue(request.dueDate)
        : '',
      status: request.status
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const requester = this.authService.currentUser();

    if (!requester) {
      this.router.navigate(['/login']);
      return;
    }

    const values = this.form.getRawValue();

    const assignedTo = this.users.find(
      user => user.id === values.assignedToId
    );

    if (!assignedTo) {
      this.form.controls.assignedToId.setErrors({
        invalidRecipient: true
      });
      return;
    }

    if (this.isEditMode()) {
      const updateRequest: UpdateRequestRequest = {
        title: values.title,
        description: values.description || undefined,
        type: values.type,
        priority: values.priority,
        assignedToId: values.assignedToId,
        dueDate: values.dueDate
          ? new Date(`${values.dueDate}T23:59:59`).toISOString()
          : undefined,
        status: values.status
      };

      this.requestService.updateRequest(
        this.requestId()!,
        updateRequest,
        assignedTo
      );

      this.router.navigate(['/requests', this.requestId()]);
      return;
    }

    const createRequest: CreateRequestRequest = {
      title: values.title,
      description: values.description || undefined,
      type: values.type,
      priority: values.priority,
      assignedToId: values.assignedToId,
      dueDate: values.dueDate
        ? new Date(`${values.dueDate}T23:59:59`).toISOString()
        : undefined
    };

    const createdRequest = this.requestService.createRequest(
      createRequest,
      requester,
      assignedTo
    );

    this.router.navigate(['/requests', createdRequest.id]);
  }

  cancel(): void {
    if (this.isEditMode()) {
      this.router.navigate(['/requests', this.requestId()]);
      return;
    }

    this.router.navigate(['/requests']);
  }

  typeLabel(type: RequestType): string {
    return type.replace('_', ' ');
  }

  statusLabel(status: RequestStatus): string {
    return status.replace('_', ' ');
  }

  get titleControl() {
    return this.form.controls.title;
  }

  get assignedToControl() {
    return this.form.controls.assignedToId;
  }

  private toDateInputValue(date: string): string {
    return new Date(date).toISOString().slice(0, 10);
  }
}
