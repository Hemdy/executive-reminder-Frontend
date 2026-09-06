
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import {
  TaskPriority,
  TaskStatus
} from '../../../../core/models/task.model';
import { TaskService } from '../../../../core/services/task.service';

interface FormUser {
  id: string;
  firstName: string;
  lastName: string;
  department?: string;
}

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './task-form.html',
  styleUrl: './task-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})








export class TaskForm {


  private readonly fb = inject(FormBuilder);
  private readonly taskService = inject(TaskService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly currentUser = this.authService.currentUser;

  readonly isEditMode = signal(false);
  readonly taskId = signal<string | null>(null);
  readonly errorMessage = signal('');

  readonly isSaving = signal(false);

  readonly employees = signal<FormUser[]>([
    {
      id: 'user-ceo',
      firstName: 'Michael',
      lastName: 'Anderson'
    },
    {
      id: 'user-employee',
      firstName: 'John',
      lastName: 'Doe',
      department: 'Operations'
    },
    {
      id: 'user-assistant',
      firstName: 'Sarah',
      lastName: 'Williams'
    }
  ]);

  readonly categories = [
    'General',
    'Finance',
    'Operations',
    'Meetings',
    'Legal',
    'Approval',
    'HR',
    'IT'
  ];

  readonly priorities: TaskPriority[] = [
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
  ];

  readonly statuses: TaskStatus[] = [
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
  ];

  readonly taskForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.maxLength(2000)]],
    assignedToId: ['', Validators.required],
    priority: ['MEDIUM' as TaskPriority, Validators.required],
    category: ['General', Validators.required],
    dueDate: ['', Validators.required],
    dueTime: [''],
    status: ['PENDING' as TaskStatus, Validators.required]
  });

  readonly pageTitle = computed(() =>
    this.isEditMode() ? 'Edit Task' : 'Create New Task'
  );

  constructor() {
    this.loadExistingTask();
  }

  private loadExistingTask(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.taskForm.patchValue({
        assignedToId: this.currentUser()?.id ?? ''
      });

      return;
    }

    const task = this.taskService.getTask(id);

    if (!task) {
      this.errorMessage.set('The requested task could not be found.');
      return;
    }

    this.isEditMode.set(true);
    this.taskId.set(id);

    this.taskForm.patchValue({
      title: task.title,
      description: task.description ?? '',
      assignedToId: task.assignedTo.id,
      priority: task.priority,
      category: task.category,
      dueDate: task.dueDate,
      dueTime: task.dueTime ?? '',
      status: task.status
    });
  }

  save(): void {
    this.errorMessage.set('');

    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      this.errorMessage.set(
        'Please complete all required fields before saving.'
      );
      return;
    }

    const currentUser = this.currentUser();

    if (!currentUser) {
      this.errorMessage.set('You must be logged in to save a task.');
      return;
    }

    const formValue = this.taskForm.getRawValue();

    const assignedTo = this.employees().find(
      user => user.id === formValue.assignedToId
    );

    if (!assignedTo) {
      this.errorMessage.set('Please select a valid assignee.');
      return;
    }

    this.isSaving.set(true);

    const assignedUser = {
      id: assignedTo.id,
      firstName: assignedTo.firstName,
      lastName: assignedTo.lastName,
      email: `${assignedTo.id}@exectrack.local`,
      role: assignedTo.id === 'user-ceo'
        ? 'CEO' as const
        : assignedTo.id === 'user-assistant'
          ? 'EXECUTIVE_ASSISTANT' as const
          : 'EMPLOYEE' as const,
      department: assignedTo.department
    };

    if (this.isEditMode() && this.taskId()) {
      this.taskService.updateTask(
        this.taskId()!,
        {
          title: formValue.title,
          description: formValue.description || undefined,
          assignedToId: formValue.assignedToId,
          priority: formValue.priority,
          category: formValue.category,
          dueDate: formValue.dueDate,
          dueTime: formValue.dueTime || undefined,
          status: formValue.status
        },
        assignedUser
      );

      this.router.navigate(['/tasks', this.taskId()]);
    } else {
      const task = this.taskService.createTask(
        {
          title: formValue.title,
          description: formValue.description || undefined,
          assignedToId: formValue.assignedToId,
          priority: formValue.priority,
          category: formValue.category,
          dueDate: formValue.dueDate,
          dueTime: formValue.dueTime || undefined
        },
        assignedUser,
        currentUser
      );

      this.router.navigate(['/tasks', task.id]);
    }

    this.isSaving.set(false);
  }

  cancel(): void {
    if (this.isEditMode() && this.taskId()) {
      this.router.navigate(['/tasks', this.taskId()]);
      return;
    }

    this.router.navigate(['/tasks']);
  }

  get titleControl() {
    return this.taskForm.controls.title;
  }

  get descriptionControl() {
    return this.taskForm.controls.description;
  }

  get assignedToControl() {
    return this.taskForm.controls.assignedToId;
  }

  get dueDateControl() {
    return this.taskForm.controls.dueDate;
  }
}