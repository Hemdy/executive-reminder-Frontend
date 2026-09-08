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

import {
  ActivatedRoute,
  Router,
  RouterModule
} from '@angular/router';

import { User } from '../../../../core/models/user.model';

import {
  CreateMeetingRequest,
  MeetingStatus,
  MeetingType,
  UpdateMeetingRequest
} from '../../../../core/models/meeting.model';

import { MeetingService } from '../../../../core/services/meeting.service';

@Component({
  selector: 'app-meeting-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
    templateUrl: './meeting-form.html',
  styleUrl: './meeting-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class MeetingForm {







  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly meetingService = inject(MeetingService);

  readonly meetingId = computed(
    () => this.route.snapshot.paramMap.get('id')
  );

  readonly isEditMode = computed(
    () => this.meetingId() !== null
  );

  readonly users: User[] = [
    {
      id: 'user-ceo',
      firstName: 'Dr. Chigozie',
      lastName: 'F. Oriaku',
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

  readonly meetingTypes: MeetingType[] = [
    'IN_PERSON',
    'ONLINE',
    'PHONE',
    'HYBRID'
  ];

  readonly statuses: MeetingStatus[] = [
    'SCHEDULED',
    'RESCHEDULED',
    'COMPLETED',
    'CANCELLED'
  ];

  readonly form = this.fb.nonNullable.group({
    title: [
      '',
      [Validators.required, Validators.maxLength(200)]
    ],

    description: [
      '',
      Validators.maxLength(2000)
    ],

    agenda: [
      '',
      Validators.maxLength(4000)
    ],

    participantIds: this.fb.nonNullable.control<string[]>([]),

    meetingDate: [
      '',
      Validators.required
    ],

    startTime: [
      '09:00',
      Validators.required
    ],

    endTime: [
      '10:00',
      Validators.required
    ],

    location: [
      '',
      Validators.maxLength(300)
    ],

    meetingType: [
      'IN_PERSON' as MeetingType,
      Validators.required
    ],

    status: [
      'SCHEDULED' as MeetingStatus,
      Validators.required
    ]
  });

  ngOnInit(): void {
    if (!this.isEditMode()) {
      this.form.patchValue({
        meetingDate: this.todayValue()
      });

      return;
    }

    const meeting = this.meetingService.getMeeting(
      this.meetingId()!
    );

    if (!meeting) {
      this.router.navigate(['/meetings']);
      return;
    }

    this.form.patchValue({
      title: meeting.title,
      description: meeting.description ?? '',
      agenda: meeting.agenda ?? '',
      participantIds: meeting.participants.map(
        participant => participant.id
      ),
      meetingDate: meeting.meetingDate,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location ?? '',
      meetingType: meeting.meetingType,
      status: meeting.status
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const values = this.form.getRawValue();

    const participants = this.users.filter(user =>
      values.participantIds.includes(user.id)
    );

    if (this.isEditMode()) {
      const updateRequest: UpdateMeetingRequest = {
        title: values.title,
        description: values.description || undefined,
        agenda: values.agenda || undefined,
        participantIds: values.participantIds,
        meetingDate: values.meetingDate,
        startTime: values.startTime,
        endTime: values.endTime,
        location: values.location || undefined,
        meetingType: values.meetingType,
        status: values.status
      };

      this.meetingService.updateMeeting(
        this.meetingId()!,
        updateRequest,
        participants
      );

      this.router.navigate([
        '/meetings',
        this.meetingId()
      ]);

      return;
    }

    const organizer =
      this.users.find(user => user.id === 'user-ceo') ??
      this.users[0];

    const createRequest: CreateMeetingRequest = {
      title: values.title,
      description: values.description || undefined,
      agenda: values.agenda || undefined,
      participantIds: values.participantIds,
      meetingDate: values.meetingDate,
      startTime: values.startTime,
      endTime: values.endTime,
      location: values.location || undefined,
      meetingType: values.meetingType
    };

    const meeting = this.meetingService.createMeeting(
      createRequest,
      organizer,
      participants
    );

    this.router.navigate(['/meetings', meeting.id]);
  }

  cancel(): void {
    if (this.isEditMode()) {
      this.router.navigate([
        '/meetings',
        this.meetingId()
      ]);

      return;
    }

    this.router.navigate(['/meetings']);
  }

  typeLabel(type: MeetingType): string {
    return this.meetingService.meetingTypeLabel(type);
  }

  statusLabel(status: MeetingStatus): string {
    return this.meetingService.meetingStatusLabel(status);
  }

  get titleControl() {
    return this.form.controls.title;
  }

  private todayValue(): string {
    const date = new Date();

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }


  toggleParticipant(
  userId: string,
  checked: boolean
): void {
  const current =
    this.form.controls.participantIds.value;

  if (checked) {
    if (!current.includes(userId)) {
      this.form.controls.participantIds.setValue([
        ...current,
        userId
      ]);
    }

    return;
  }

  this.form.controls.participantIds.setValue(
    current.filter(id => id !== userId)
  );
}
}