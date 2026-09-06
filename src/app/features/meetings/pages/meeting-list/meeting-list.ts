import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { Router } from '@angular/router';

import {
  MeetingStatus,
  MeetingType
} from '../../../../core/models/meeting.model';
import { MeetingService } from '../../../../core/services/meeting.service';

@Component({
  selector: 'app-meeting-list',
  standalone: true,
 templateUrl: './meeting-list.html',
  styleUrl: './meeting-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class MeetingList {

  readonly meetingService = inject(MeetingService);
  private readonly router = inject(Router);

  readonly searchTerm = signal('');

  readonly statusFilter =
    signal<'ALL' | MeetingStatus>('ALL');

  readonly typeFilter =
    signal<'ALL' | MeetingType>('ALL');

  readonly statuses: MeetingStatus[] = [
    'SCHEDULED',
    'RESCHEDULED',
    'COMPLETED',
    'CANCELLED'
  ];

  readonly types: MeetingType[] = [
    'IN_PERSON',
    'ONLINE',
    'PHONE',
    'HYBRID'
  ];

  readonly meetings = computed(() => {
    const search = this.searchTerm()
      .trim()
      .toLowerCase();

    const status = this.statusFilter();
    const type = this.typeFilter();

    return this.meetingService.meetings().filter(meeting => {
      const participantNames = meeting.participants
        .map(
          participant =>
            `${participant.firstName} ${participant.lastName}`
        )
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        !search ||
        meeting.title.toLowerCase().includes(search) ||
        meeting.description?.toLowerCase().includes(search) ||
        meeting.organizer.firstName
          .toLowerCase()
          .includes(search) ||
        meeting.organizer.lastName
          .toLowerCase()
          .includes(search) ||
        participantNames.includes(search) ||
        meeting.location?.toLowerCase().includes(search);

      const matchesStatus =
        status === 'ALL' || meeting.status === status;

      const matchesType =
        type === 'ALL' || meeting.meetingType === type;

      return matchesSearch && matchesStatus && matchesType;
    });
  });

  readonly totalCount = computed(
    () => this.meetingService.meetings().length
  );

  readonly scheduledCount = computed(
    () => this.meetingService.scheduledMeetings().length
  );

  readonly todayCount = computed(
    () =>
      this.meetingService
        .meetings()
        .filter(meeting => this.meetingService.isToday(meeting))
        .length
  );

  readonly completedCount = computed(
    () => this.meetingService.completedMeetings().length
  );

  readonly upcomingCount = computed(
    () => this.meetingService.upcomingMeetings().length
  );

  readonly cancelledCount = computed(
    () => this.meetingService.cancelledMeetings().length
  );

  createMeeting(): void {
    this.router.navigate(['/meetings/new']);
  }

  viewMeeting(id: string): void {
    this.router.navigate(['/meetings', id]);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('ALL');
    this.typeFilter.set('ALL');
  }

  isPast(meeting: Parameters<MeetingService['isPast']>[0]): boolean {
    return this.meetingService.isPast(meeting);
  }

  formatDate(date: string): string {
    return this.meetingService.formatDate(date);
  }

  formatTime(time: string): string {
    return this.meetingService.formatTime(time);
  }

  typeLabel(type: MeetingType): string {
    return this.meetingService.meetingTypeLabel(type);
  }

  statusLabel(status: MeetingStatus): string {
    return this.meetingService.meetingStatusLabel(status);
  }

  participantSummary(meeting: Parameters<MeetingService['getMeeting']>[0] extends string ? never : never): string {
    return '';
  }
}