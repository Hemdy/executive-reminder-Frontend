export type CalendarEventType =
  | 'MEETING'
  | 'TASK'
  | 'REMINDER';

export type CalendarEventStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'SCHEDULED'
  | 'RESCHEDULED'
  | 'TRIGGERED'
  | 'DISMISSED';

export interface CalendarEvent {
  id: string;

  title: string;

  type: CalendarEventType;

  date: string;

  startTime?: string;

  endTime?: string;

  description?: string;

  status: CalendarEventStatus;

  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

  location?: string;

  sourceId: string;

  route: string;
}