
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
import { RoleService } from '../../../../core/services/role.service';

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
  private readonly roleService = inject(RoleService);

  readonly currentUser = this.authService.currentUser;

  readonly isEditMode = signal(false);
  readonly taskId = signal<string | null>(null);
  readonly errorMessage = signal('');

  readonly isSaving = signal(false);

  readonly employees = this.roleService.users;

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
    participantIds: this.fb.nonNullable.control<string[]>([]),
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
        , participantIds: this.currentUser()?.id ? [this.currentUser()!.id] : []
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
      participantIds: task.participants?.map(user => user.id) ?? [task.assignedTo.id],
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
    const participantIds = formValue.participantIds.length ? formValue.participantIds : [formValue.assignedToId];

    const assignedTo = this.employees().find(
      user => user.id === formValue.assignedToId
    );

    if (!assignedTo) {
      this.errorMessage.set('Please select a valid assignee.');
      return;
    }

    this.isSaving.set(true);

    const assignedUser = this.roleService.users().find(user => user.id === assignedTo.id);
    if (!assignedUser) {
      this.errorMessage.set('The selected assignee is no longer available.');
      return;
    }

    if (this.isEditMode() && this.taskId()) {
      this.taskService.updateTask(
        this.taskId()!,
        {
          title: formValue.title,
          description: formValue.description || undefined,
          assignedToId: formValue.assignedToId,
          participantIds,
          priority: formValue.priority,
          category: formValue.category,
          dueDate: formValue.dueDate,
          dueTime: formValue.dueTime || undefined,
          status: formValue.status
        },
        assignedUser
      ).subscribe({
        next: () => this.router.navigate(['/tasks', this.taskId()!]),
        error: error => this.errorMessage.set(error.error?.message ?? 'Unable to update the task.')
      });
    } else {
      this.taskService.createTask(
        {
          title: formValue.title,
          description: formValue.description || undefined,
          assignedToId: formValue.assignedToId,
          participantIds,
          priority: formValue.priority,
          category: formValue.category,
          dueDate: formValue.dueDate,
          dueTime: formValue.dueTime || undefined
        },
        assignedUser,
        currentUser
      ).subscribe({
        next: task => this.router.navigate(['/tasks', task.id]),
        error: error => this.errorMessage.set(error.error?.message ?? 'Unable to create the task.')
      });
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

  toggleParticipant(userId: string, checked: boolean): void {
    const current = this.taskForm.controls.participantIds.value;
    const next = checked ? [...new Set([...current, userId])] : current.filter(id => id !== userId);
    this.taskForm.controls.participantIds.setValue(next);
    if (next.length) this.taskForm.controls.assignedToId.setValue(next[0]);
  }

  get dueDateControl() {
    return this.taskForm.controls.dueDate;
  }
}