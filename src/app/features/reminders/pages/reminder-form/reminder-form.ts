



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
import {
  ActivatedRoute,
  Router,
  RouterModule
} from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import {
  ReminderPriority,
  ReminderRecurrence,
  ReminderStatus
} from '../../../../core/models/reminder.model';
import { ReminderService } from '../../../../core/services/reminder.service';

interface ReminderUser {
  id: string;
  firstName: string;
  lastName: string;
  department?: string;
}

@Component({
  selector: 'app-reminder-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './reminder-form.html',
  styleUrl: './reminder-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class ReminderForm {





  private readonly fb = inject(FormBuilder);
  private readonly reminderService = inject(ReminderService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;

  readonly isEditMode = signal(false);
  readonly reminderId = signal<string | null>(null);
  readonly errorMessage = signal('');
  readonly isSaving = signal(false);

  readonly recipients = signal<ReminderUser[]>([
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
    'Executive',
    'Finance',
    'Operations',
    'Meetings',
    'Legal',
    'Strategy',
    'HR',
    'IT'
  ];

  readonly priorities: ReminderPriority[] = [
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
  ];

  readonly recurrences: ReminderRecurrence[] = [
    'ONCE',
    'DAILY',
    'WEEKLY',
    'MONTHLY',
    'YEARLY',
    'CUSTOM'
  ];

  readonly statuses: ReminderStatus[] = [
    'PENDING',
    'TRIGGERED',
    'COMPLETED',
    'DISMISSED',
    'CANCELLED'
  ];

  readonly reminderForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', Validators.maxLength(2000)],
    recipientId: ['', Validators.required],
    priority: ['MEDIUM' as ReminderPriority, Validators.required],
    category: ['General', Validators.required],
    reminderDate: ['', Validators.required],
    reminderTime: ['', Validators.required],
    recurrence: ['ONCE' as ReminderRecurrence, Validators.required],
    status: ['PENDING' as ReminderStatus, Validators.required]
  });

  readonly pageTitle = computed(() =>
    this.isEditMode()
      ? 'Edit Reminder'
      : 'Create New Reminder'
  );

  constructor() {
    this.loadExistingReminder();
  }

  private loadExistingReminder(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id) {
      this.reminderForm.patchValue({
        recipientId: this.currentUser()?.id ?? '',
        reminderTime: '09:00'
      });

      return;
    }

    const reminder = this.reminderService.getReminder(id);

    if (!reminder) {
      this.errorMessage.set(
        'The requested reminder could not be found.'
      );
      return;
    }

    this.isEditMode.set(true);
    this.reminderId.set(id);

    this.reminderForm.patchValue({
      title: reminder.title,
      description: reminder.description ?? '',
      recipientId: reminder.recipient.id,
      priority: reminder.priority,
      category: reminder.category,
      reminderDate: reminder.reminderDate,
      reminderTime: reminder.reminderTime,
      recurrence: reminder.recurrence,
      status: reminder.status
    });
  }

  save(): void {
    this.errorMessage.set('');

    if (this.reminderForm.invalid) {
      this.reminderForm.markAllAsTouched();

      this.errorMessage.set(
        'Please complete all required fields before saving.'
      );

      return;
    }

    const currentUser = this.currentUser();

    if (!currentUser) {
      this.errorMessage.set(
        'You must be logged in to save a reminder.'
      );

      return;
    }

    const formValue = this.reminderForm.getRawValue();

    const selectedRecipient = this.recipients().find(
      recipient =>
        recipient.id === formValue.recipientId
    );

    if (!selectedRecipient) {
      this.errorMessage.set(
        'Please select a valid recipient.'
      );

      return;
    }

    const recipient = {
      id: selectedRecipient.id,
      firstName: selectedRecipient.firstName,
      lastName: selectedRecipient.lastName,
      email: `${selectedRecipient.id}@exectrack.local`,
      role:
        selectedRecipient.id === 'user-ceo'
          ? 'CEO' as const
          : selectedRecipient.id === 'user-assistant'
            ? 'EXECUTIVE_ASSISTANT' as const
            : 'EMPLOYEE' as const,
      department: selectedRecipient.department
    };

    this.isSaving.set(true);

    if (this.isEditMode() && this.reminderId()) {
      this.reminderService.updateReminder(
        this.reminderId()!,
        {
          title: formValue.title,
          description:
            formValue.description || undefined,
          recipientId: formValue.recipientId,
          priority: formValue.priority,
          category: formValue.category,
          reminderDate: formValue.reminderDate,
          reminderTime: formValue.reminderTime,
          recurrence: formValue.recurrence,
          status: formValue.status
        },
        recipient
      );

      this.router.navigate([
        '/reminders',
        this.reminderId()
      ]);
    } else {
      const reminder =
        this.reminderService.createReminder(
          {
            title: formValue.title,
            description:
              formValue.description || undefined,
            recipientId: formValue.recipientId,
            priority: formValue.priority,
            category: formValue.category,
            reminderDate: formValue.reminderDate,
            reminderTime: formValue.reminderTime,
            recurrence: formValue.recurrence
          },
          recipient,
          currentUser
        );

      this.router.navigate([
        '/reminders',
        reminder.id
      ]);
    }

    this.isSaving.set(false);
  }

  cancel(): void {
    if (this.isEditMode() && this.reminderId()) {
      this.router.navigate([
        '/reminders',
        this.reminderId()
      ]);

      return;
    }

    this.router.navigate(['/reminders']);
  }

  get titleControl() {
    return this.reminderForm.controls.title;
  }

  get recipientControl() {
    return this.reminderForm.controls.recipientId;
  }

  get dateControl() {
    return this.reminderForm.controls.reminderDate;
  }

  get timeControl() {
    return this.reminderForm.controls.reminderTime;
  }
}