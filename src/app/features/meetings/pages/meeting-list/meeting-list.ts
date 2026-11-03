import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { Router } from '@angular/router';
import { ContentSkeleton } from '../../../../core/components/content-skeleton/content-skeleton';

import {
  MeetingStatus,
  MeetingType
} from '../../../../core/models/meeting.model';
import { AuthService } from '../../../../core/services/auth.service';
import { MeetingService } from '../../../../core/services/meeting.service';
import { catchError, from, map, mergeMap, of, toArray } from 'rxjs';

@Component({
  selector: 'app-meeting-list',
  standalone: true,
  imports: [ContentSkeleton],
  templateUrl: './meeting-list.html',
  styleUrl: './meeting-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class MeetingList {

  readonly meetingService = inject(MeetingService);
  readonly listLoading = this.meetingService.listLoading;
  readonly listError = this.meetingService.listError;

  retryLoad(): void {
    this.meetingService.loadMeetings().subscribe({
      error: error => console.error('Unable to reload meetings', error),
    });
  }

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentUser = this.authService.currentUser;
  readonly searchTerm = signal('');

  readonly statusFilter =
    signal<'ALL' | MeetingStatus>('ALL');

  readonly typeFilter =
    signal<'ALL' | MeetingType>('ALL');
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly deletingSelected = signal(false);
  readonly deleteError = signal('');

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

  readonly assignedMeetings = computed(() => {
    const userId = this.currentUser()?.id;
    if (!userId) return [];

    return this.meetingService.meetings().filter(meeting =>
      meeting.organizer.id === userId ||
      meeting.participants.some(participant => participant.id === userId)
    );
  });

  readonly meetings = computed(() => {
    const search = this.searchTerm()
      .trim()
      .toLowerCase();

    const status = this.statusFilter();
    const type = this.typeFilter();

    return this.assignedMeetings().filter(meeting => {
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

  readonly selectedCount = computed(() => this.selectedIds().size);
  readonly allVisibleSelected = computed(
    () => this.meetings().length > 0 && this.meetings().every(meeting => this.selectedIds().has(meeting.id))
  );
  readonly someVisibleSelected = computed(
    () => this.meetings().some(meeting => this.selectedIds().has(meeting.id)) && !this.allVisibleSelected()
  );

  readonly totalCount = computed(
    () => this.assignedMeetings().length
  );

  readonly scheduledCount = computed(
    () => this.assignedMeetings().filter(meeting =>
      meeting.status === 'SCHEDULED' || meeting.status === 'RESCHEDULED'
    ).length
  );

  readonly todayCount = computed(
    () =>
      this.assignedMeetings()
        .filter(meeting => this.meetingService.isToday(meeting))
        .length
  );

  readonly completedCount = computed(
    () => this.assignedMeetings().filter(meeting => meeting.status === 'COMPLETED').length
  );

  readonly upcomingCount = computed(
    () => {
      const upcomingIds = new Set(
        this.meetingService.upcomingMeetings().map(meeting => meeting.id)
      );
      return this.assignedMeetings().filter(meeting => upcomingIds.has(meeting.id)).length;
    }
  );

  readonly cancelledCount = computed(
    () => this.assignedMeetings().filter(meeting => meeting.status === 'CANCELLED').length
  );

  createMeeting(): void {
    this.router.navigate(['/meetings/new']);
  }

  viewMeeting(id: string): void {
    this.router.navigate(['/meetings', id]);
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  toggleSelection(id: string, checked: boolean): void {
    const selected = new Set(this.selectedIds());
    if (checked) {
      selected.add(id);
    } else {
      selected.delete(id);
    }
    this.selectedIds.set(selected);
    this.deleteError.set('');
  }

  toggleAllSelection(checked: boolean): void {
    const selected = new Set(this.selectedIds());
    for (const meeting of this.meetings()) {
      if (checked) {
        selected.add(meeting.id);
      } else {
        selected.delete(meeting.id);
      }
    }
    this.selectedIds.set(selected);
    this.deleteError.set('');
  }

  deleteSelected(): void {
    const ids = [...this.selectedIds()];
    if (!ids.length || this.deletingSelected()) return;
    if (!window.confirm(`Delete ${ids.length} selected meeting(s)? This action cannot be undone.`)) return;

    this.deletingSelected.set(true);
    this.deleteError.set('');
    from(ids).pipe(
      mergeMap(id => this.meetingService.deleteMeeting(id).pipe(
        map(() => ({ id, deleted: true as const })),
        catchError(error => of({ id, deleted: false as const, error }))
      ), 5),
      toArray()
    ).subscribe({
      next: results => {
        const failed = results.filter(result => !result.deleted);
        this.selectedIds.set(new Set(failed.map(result => result.id)));
        this.deletingSelected.set(false);
        if (failed.length) {
          console.error('Unable to delete selected meetings', failed);
          this.deleteError.set(
            `Unable to delete ${failed.length} selected meeting(s). Failed items remain selected.`
          );
        }
      },
      error: error => {
        console.error('Unable to delete selected meetings', error);
        this.deletingSelected.set(false);
        this.deleteError.set('Unable to delete the selected meetings. Please try again.');
      }
    });
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