import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject
} from '@angular/core';

import { DatePipe } from '@angular/common';

import {
  ActivatedRoute,
  Router,
  RouterLink,
  RouterModule
} from '@angular/router';

import {
  MeetingStatus,
  MeetingType
} from '../../../../core/models/meeting.model';

import { MeetingService } from '../../../../core/services/meeting.service';

@Component({
  selector: 'app-meeting-details',
  standalone: true,
  imports: [RouterModule, DatePipe],
   templateUrl: './meeting-details.html',
  styleUrl: './meeting-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class MeetingDetails {





  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly meetingService = inject(MeetingService);

  readonly meeting = computed(() => {
    const id = this.route.snapshot.paramMap.get('id');

    return id
      ? this.meetingService.getMeeting(id) ?? null
      : null;
  });

  readonly isPast = computed(() => {
    const meeting = this.meeting();

    return meeting
      ? this.meetingService.isPast(meeting)
      : false;
  });

  editMeeting(): void {
    const meeting = this.meeting();

    if (meeting) {
      this.router.navigate([
        '/meetings',
        meeting.id,
        'edit'
      ]);
    }
  }

  markCompleted(): void {
    this.updateStatus('COMPLETED');
  }

  reschedule(): void {
    this.updateStatus('RESCHEDULED');
  }

  cancelMeeting(): void {
    this.updateStatus('CANCELLED');
  }

  restoreMeeting(): void {
    this.updateStatus('SCHEDULED');
  }

  deleteMeeting(): void {
    const meeting = this.meeting();

    if (!meeting) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${meeting.title}"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    this.meetingService.deleteMeeting(meeting.id);

    this.router.navigate(['/meetings']);
  }

  backToMeetings(): void {
    this.router.navigate(['/meetings']);
  }

  typeLabel(type: MeetingType): string {
    return this.meetingService.meetingTypeLabel(type);
  }

  statusLabel(status: MeetingStatus): string {
    return this.meetingService.meetingStatusLabel(status);
  }

  formatTime(time: string): string {
    return this.meetingService.formatTime(time);
  }

  initials(
    firstName: string,
    lastName: string
  ): string {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`;
  }

  private updateStatus(status: MeetingStatus): void {
    const meeting = this.meeting();

    if (!meeting) {
      return;
    }

    this.meetingService.updateStatus(
      meeting.id,
      status
    );
  }
}