import { Injectable, computed, signal } from '@angular/core';

import { User } from '../../core/models/user.model';
import {
  CreateMeetingRequest,
  Meeting,
  MeetingStatus,
  MeetingType,
  UpdateMeetingRequest
} from '../models/meeting.model';

@Injectable({
  providedIn: 'root'
})
export class MeetingService {
  private readonly meetingsSignal = signal<Meeting[]>([]);

  readonly meetings = this.meetingsSignal.asReadonly();

  readonly scheduledMeetings = computed(() =>
    this.meetingsSignal().filter(
      meeting =>
        meeting.status === 'SCHEDULED' ||
        meeting.status === 'RESCHEDULED'
    )
  );

  readonly completedMeetings = computed(() =>
    this.meetingsSignal().filter(
      meeting => meeting.status === 'COMPLETED'
    )
  );

  readonly cancelledMeetings = computed(() =>
    this.meetingsSignal().filter(
      meeting => meeting.status === 'CANCELLED'
    )
  );

  readonly upcomingMeetings = computed(() =>
    this.meetingsSignal()
      .filter(meeting => {
        if (
          meeting.status === 'COMPLETED' ||
          meeting.status === 'CANCELLED'
        ) {
          return false;
        }

        return this.getMeetingStart(meeting).getTime() >= Date.now();
      })
      .sort(
        (a, b) =>
          this.getMeetingStart(a).getTime() -
          this.getMeetingStart(b).getTime()
      )
  );

  constructor() {
    this.loadMockMeetings();
  }

  getMeetings(): Meeting[] {
    return this.meetingsSignal();
  }

  getMeeting(id: string): Meeting | undefined {
    return this.meetingsSignal().find(meeting => meeting.id === id);
  }

  createMeeting(
    request: CreateMeetingRequest,
    organizer: User,
    participants: User[]
  ): Meeting {
    const now = new Date().toISOString();

    const meeting: Meeting = {
      id: `meeting-${Date.now()}`,
      title: request.title,
      description: request.description,
      agenda: request.agenda,
      organizer,
      participants,
      meetingDate: request.meetingDate,
      startTime: request.startTime,
      endTime: request.endTime,
      location: request.location || undefined,
      meetingType: request.meetingType,
      status: 'SCHEDULED',
      createdAt: now,
      updatedAt: now,
      commentsCount: 0,
      attachmentsCount: 0
    };

    this.meetingsSignal.update(meetings => [
      meeting,
      ...meetings
    ]);

    return meeting;
  }

  updateMeeting(
    id: string,
    request: UpdateMeetingRequest,
    participants: User[]
  ): void {
    this.meetingsSignal.update(meetings =>
      meetings.map(meeting =>
        meeting.id === id
          ? {
              ...meeting,
              title: request.title,
              description: request.description,
              agenda: request.agenda,
              participants,
              meetingDate: request.meetingDate,
              startTime: request.startTime,
              endTime: request.endTime,
              location: request.location || undefined,
              meetingType: request.meetingType,
              status: request.status,
              updatedAt: new Date().toISOString()
            }
          : meeting
      )
    );
  }

  updateStatus(id: string, status: MeetingStatus): void {
    this.meetingsSignal.update(meetings =>
      meetings.map(meeting =>
        meeting.id === id
          ? {
              ...meeting,
              status,
              updatedAt: new Date().toISOString()
            }
          : meeting
      )
    );
  }

  deleteMeeting(id: string): void {
    this.meetingsSignal.update(meetings =>
      meetings.filter(meeting => meeting.id !== id)
    );
  }

  isPast(meeting: Meeting): boolean {
    if (
      meeting.status === 'COMPLETED' ||
      meeting.status === 'CANCELLED'
    ) {
      return false;
    }

    return this.getMeetingEnd(meeting).getTime() < Date.now();
  }

  isToday(meeting: Meeting): boolean {
    const today = new Date();

    return meeting.meetingDate === this.toDateInputValue(today);
  }

  formatDate(date: string): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(`${date}T00:00:00`));
  }

  formatTime(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);

    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    }).format(date);
  }

  meetingTypeLabel(type: MeetingType): string {
    return type.replace('_', ' ');
  }

  meetingStatusLabel(status: MeetingStatus): string {
    return status.replace('_', ' ');
  }

  private getMeetingStart(meeting: Meeting): Date {
    return new Date(
      `${meeting.meetingDate}T${meeting.startTime}:00`
    );
  }

  private getMeetingEnd(meeting: Meeting): Date {
    return new Date(
      `${meeting.meetingDate}T${meeting.endTime}:00`
    );
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private loadMockMeetings(): void {
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

    const dateOffset = (days: number): string => {
      const date = new Date();

      date.setDate(date.getDate() + days);

      return this.toDateInputValue(date);
    };

    const dateMinus = (days: number): string => {
      const date = new Date();

      date.setDate(date.getDate() - days);

      return this.toDateInputValue(date);
    };

    const now = new Date();

    const mockMeetings: Meeting[] = [
      {
        id: 'meeting-001',
        title: 'Executive Board Meeting',
        description:
          'Monthly executive meeting covering company performance and strategic priorities.',
        agenda:
          '1. Financial performance\n2. Strategic priorities\n3. Operations update\n4. Next quarter planning',
        organizer: ceo,
        participants: [ceo, assistant, employee],
        meetingDate: dateOffset(0),
        startTime: '09:00',
        endTime: '10:30',
        location: 'Executive Conference Room',
        meetingType: 'IN_PERSON',
        status: 'SCHEDULED',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        commentsCount: 4,
        attachmentsCount: 2
      },
      {
        id: 'meeting-002',
        title: 'Budget Proposal Review',
        description:
          'Review of the proposed departmental budgets for the next quarter.',
        agenda:
          'Budget overview\nDepartment allocations\nCost reduction opportunities\nApproval requirements',
        organizer: assistant,
        participants: [ceo, assistant],
        meetingDate: dateOffset(0),
        startTime: '11:30',
        endTime: '12:30',
        location: 'Microsoft Teams',
        meetingType: 'ONLINE',
        status: 'SCHEDULED',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        commentsCount: 2,
        attachmentsCount: 3
      },
      {
        id: 'meeting-003',
        title: 'Operations Strategy Meeting',
        description:
          'Discussion of operational priorities and process improvements.',
        agenda:
          'Operations metrics\nProcess improvements\nStaffing\nAction items',
        organizer: employee,
        participants: [employee, ceo, assistant],
        meetingDate: dateOffset(1),
        startTime: '14:00',
        endTime: '15:00',
        location: 'Google Meet',
        meetingType: 'ONLINE',
        status: 'SCHEDULED',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        commentsCount: 1,
        attachmentsCount: 1
      },
      {
        id: 'meeting-004',
        title: 'Annual Strategy Review',
        description:
          'Annual review of company strategy and objectives.',
        agenda:
          'Annual performance\nStrategic objectives\nMarket outlook\nGoals for next year',
        organizer: ceo,
        participants: [ceo, assistant, employee, admin],
        meetingDate: dateOffset(5),
        startTime: '09:30',
        endTime: '11:30',
        location: 'Executive Conference Room',
        meetingType: 'HYBRID',
        status: 'SCHEDULED',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        commentsCount: 7,
        attachmentsCount: 4
      },
      {
        id: 'meeting-005',
        title: 'Supplier Contract Discussion',
        description:
          'Discussion with the supplier regarding contract renewal.',
        agenda:
          'Current contract\nRenewal terms\nPricing\nNext steps',
        organizer: assistant,
        participants: [assistant, employee],
        meetingDate: dateMinus(2),
        startTime: '15:00',
        endTime: '16:00',
        location: 'Phone',
        meetingType: 'PHONE',
        status: 'COMPLETED',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        commentsCount: 3,
        attachmentsCount: 2
      },
      {
        id: 'meeting-006',
        title: 'Quarterly Planning Session',
        description:
          'Planning session for the upcoming quarter.',
        agenda:
          'Quarterly objectives\nDepartment plans\nKPIs\nOwnership',
        organizer: ceo,
        participants: [ceo, assistant],
        meetingDate: dateOffset(3),
        startTime: '10:00',
        endTime: '11:30',
        location: 'Executive Conference Room',
        meetingType: 'IN_PERSON',
        status: 'RESCHEDULED',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        commentsCount: 2,
        attachmentsCount: 1
      },
      {
        id: 'meeting-007',
        title: 'Team Check-in',
        description:
          'Weekly team check-in meeting.',
        agenda: 'Team updates\nBlockers\nPriorities',
        organizer: employee,
        participants: [employee, assistant],
        meetingDate: dateMinus(5),
        startTime: '10:00',
        endTime: '10:30',
        location: 'Google Meet',
        meetingType: 'ONLINE',
        status: 'CANCELLED',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        commentsCount: 1,
        attachmentsCount: 0
      }
    ];

    this.meetingsSignal.set(mockMeetings);
  }
}