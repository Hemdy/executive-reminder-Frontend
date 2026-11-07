
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
import { catchError, forkJoin, map, of } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import {
  TaskPriority,
  TaskStatus
} from '../../../../core/models/task.model';
import { TaskService } from '../../../../core/services/task.service';
import { RoleService } from '../../../../core/services/role.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { ToastService } from '../../../../core/services/toast.service';
import { ContentSkeleton } from '../../../../core/components/content-skeleton/content-skeleton';
import {
  isSupportedTaskAttachment,
  MAX_TASK_ATTACHMENT_SIZE,
  TASK_ATTACHMENT_ACCEPT,
  taskAttachmentIcon
} from '../../utils/task-attachments';

interface FormUser {
  id: string;
  firstName: string;
  lastName: string;
  role?: string;
  department?: string;
}

@Component({
  selector: 'app-task-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ContentSkeleton],
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
  private readonly loading = inject(LoadingService);
  private readonly toast = inject(ToastService);

  readonly currentUser = this.authService.currentUser;

  readonly isEditMode = signal(false);
  readonly taskId = signal<string | null>(null);
  readonly errorMessage = signal('');
  readonly attachmentError = signal('');
  readonly selectedAttachments = signal<File[]>([]);
  readonly attachmentAccept = TASK_ATTACHMENT_ACCEPT;
  readonly isDraggingAttachments = signal(false);

  readonly isSaving = signal(false);

  readonly employees = this.roleService.assignableUsers;
  readonly employeesLoading = this.roleService.assignableUsersLoading;

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
    'CLOSED',
    'CANCELLED'
  ];

  readonly taskForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.maxLength(2000)]],
    assignedToId: ['', Validators.required],
    participantIds: this.fb.nonNullable.control<string[]>([], Validators.required),
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
    this.roleService.loadAssignableUsers().subscribe({
      error: error => this.errorMessage.set(error.error?.message ?? 'Unable to load task assignees.')
    });
  }

  private loadExistingTask(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.taskForm.patchValue({
        assignedToId: '',
        participantIds: []
      });

      return;
    }

    const task = this.taskService.getTask(id);

    if (!task) {
      this.errorMessage.set('The requested task could not be found.');
      return;
    }
    if (task.createdBy.id !== this.currentUser()?.id) {
      this.errorMessage.set('Only the task creator can edit this task.');
      void this.router.navigate(['/tasks']);
      return;
    }

    this.isEditMode.set(true);
    this.taskId.set(id);

    this.taskForm.patchValue({
      title: task.title,
      description: task.description ?? '',
      assignedToId: '',
      participantIds: [],
      priority: task.priority,
      category: task.category,
      dueDate: task.dueDate,
      dueTime: task.dueTime ?? '',
      status: task.status
    });
  }

  save(): void {
    if (this.isSaving()) {
      return;
    }

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
    const participantIds = formValue.participantIds;

    const assignedTo = this.employees().find(
      user => user.id === formValue.assignedToId
    );

    if (!assignedTo) {
      this.errorMessage.set('Please select a valid assignee.');
      return;
    }

    this.isSaving.set(true);
    const loadingTask = this.loading.begin(
      this.isEditMode() ? 'Updating task…' : 'Creating task…'
    );

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
        }
      ).subscribe({
        next: () => {
          this.uploadSelectedAttachments(this.taskId()!, true, loadingTask);
        },
        error: error => {
          this.isSaving.set(false);
          this.loading.end(loadingTask);
          this.errorMessage.set(error.error?.message ?? 'Unable to update the task.');
        }
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
        }
      ).subscribe({
        next: task => {
          this.uploadSelectedAttachments(task.id, false, loadingTask);
        },
        error: error => {
          this.isSaving.set(false);
          this.loading.end(loadingTask);
          const message = error.error?.message ?? 'Unable to create the task.';
          this.errorMessage.set(message);
          this.toast.error(message);
        }
      });
    }
  }

  selectAttachments(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addAttachments(Array.from(input.files ?? []));
    input.value = '';
  }

  onAttachmentDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.isSaving()) {
      this.isDraggingAttachments.set(true);
    }
  }

  onAttachmentDragLeave(event: DragEvent): void {
    if (!event.currentTarget || !(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
      this.isDraggingAttachments.set(false);
    }
  }

  onAttachmentDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDraggingAttachments.set(false);
    if (!this.isSaving()) {
      this.addAttachments(Array.from(event.dataTransfer?.files ?? []));
    }
  }

  removeSelectedAttachment(index: number): void {
    this.selectedAttachments.update(files => files.filter((_, fileIndex) => fileIndex !== index));
  }

  fileIcon(fileName: string): string {
    return taskAttachmentIcon(fileName);
  }

  formatFileSize(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  categoryColor(category: string): string {
    const colors: Record<string, string> = {
      General: '#2878e8',
      Finance: '#00a85a',
      Operations: '#7639e8',
      Meetings: '#f08c00',
      Legal: '#db2777',
      Approval: '#0891b2',
      HR: '#6b7280',
      IT: '#4f46e5'
    };
    return colors[category] ?? '#2878e8';
  }

  priorityColor(): string {
    const colors: Record<TaskPriority, string> = {
      LOW: '#00a85a',
      MEDIUM: '#e52655',
      HIGH: '#f08c00',
      URGENT: '#c53030'
    };
    return colors[this.taskForm.controls.priority.value];
  }

  private addAttachments(files: File[]): void {
    const unsupported = files.filter(file => !isSupportedTaskAttachment(file));
    const oversized = files.filter(file =>
      isSupportedTaskAttachment(file) && file.size > MAX_TASK_ATTACHMENT_SIZE
    );
    const validFiles = files.filter(file =>
      isSupportedTaskAttachment(file) && file.size <= MAX_TASK_ATTACHMENT_SIZE
    );
    this.selectedAttachments.update(selected => {
      const existing = new Set(selected.map(file => `${file.name}:${file.size}:${file.lastModified}`));
      return [...selected, ...validFiles.filter(file =>
        !existing.has(`${file.name}:${file.size}:${file.lastModified}`)
      )];
    });
    this.attachmentError.set([
      ...(unsupported.length
        ? [`Unsupported file type: ${unsupported.map(file => file.name).join(', ')}.`]
        : []),
      ...(oversized.length
        ? [`Files over 4 MB: ${oversized.map(file => file.name).join(', ')}.`]
        : [])
    ].join(' '));
  }

  private uploadSelectedAttachments(
    taskId: string,
    isEdit: boolean,
    loadingTask: number
  ): void {
    const files = this.selectedAttachments();
    if (!files.length) {
      this.finishSave(taskId, isEdit, loadingTask);
      return;
    }

    forkJoin(files.map(file =>
      this.taskService.uploadAttachment(taskId, file).pipe(
        map(() => ({ fileName: file.name })),
        catchError(error => of({
          fileName: file.name,
          error: error.error?.message ?? 'Upload failed'
        }))
      )
    )).subscribe({
      next: results => {
        const failures = results.filter(result => 'error' in result);
        this.finishSave(
          taskId,
          isEdit,
          loadingTask,
          failures.length
            ? `Task saved, but these attachments could not be uploaded: ${failures
                .map(result => `${result.fileName} (${result.error})`)
                .join(', ')}`
            : undefined
        );
      },
      error: () => this.finishSave(
        taskId,
        isEdit,
        loadingTask,
        'Task saved, but attachments could not be uploaded. You can try again from task details.'
      )
    });
  }

  private finishSave(
    taskId: string,
    isEdit: boolean,
    loadingTask: number,
    attachmentError?: string
  ): void {
    this.isSaving.set(false);
    this.loading.end(loadingTask);
    if (attachmentError) {
      this.toast.error(attachmentError);
    } else if (!isEdit) {
      this.toast.success('Task created successfully');
    } else {
      this.toast.success('Task updated successfully');
    }
    void this.router.navigate(['/tasks', taskId]);
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
    this.taskForm.controls.assignedToId.setValue(next[0] ?? '');
  }

  get dueDateControl() {
    return this.taskForm.controls.dueDate;
  }
}