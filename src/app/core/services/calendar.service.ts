import { Injectable, computed, inject } from '@angular/core';
import { MeetingService } from '../../core/services/meeting.service';
import { ReminderService } from '../../core/services/reminder.service';
import { CalendarEvent } from '../models/calendar-event.model';

@Injectable({
  providedIn: 'root'
})
export class CalendarService {
  private readonly meetingService = inject(MeetingService);
  private readonly reminderService = inject(ReminderService);

  readonly events = computed<CalendarEvent[]>(() => {
    const meetings = this.meetingService.meetings().map(meeting => ({
      id: `meeting-${meeting.id}`,
      title: meeting.title,
      type: 'MEETING' as const,
      date: meeting.meetingDate,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      description: meeting.description,
      status: meeting.status,
      location: meeting.location,
      sourceId: meeting.id,
      route: `/meetings/${meeting.id}`
    }));

    const reminders = this.reminderService.reminders().map(reminder => ({
      id: `reminder-${reminder.id}`,
      title: reminder.title,
      type: 'REMINDER' as const,
      date: reminder.reminderDate,
      startTime: reminder.reminderTime,
      description: reminder.description,
      status: reminder.status,
      priority: reminder.priority,
      sourceId: reminder.id,
      route: `/reminders/${reminder.id}`
    }));

    return [...meetings, ...reminders].sort(
      (a, b) =>
        this.toDateTime(a).getTime() -
        this.toDateTime(b).getTime()
    );
  });

  readonly meetings = computed(() =>
    this.events().filter(event => event.type === 'MEETING')
  );

  readonly reminders = computed(() =>
    this.events().filter(event => event.type === 'REMINDER')
  );

  getEventsForDate(date: Date): CalendarEvent[] {
    const dateKey = this.formatDateKey(date);

    return this.events().filter(
      event => event.date === dateKey
    );
  }

  getEventsForMonth(date: Date): CalendarEvent[] {
    const year = date.getFullYear();
    const month = date.getMonth();

    return this.events().filter(event => {
      const eventDate = this.parseDate(event.date);

      return (
        eventDate.getFullYear() === year &&
        eventDate.getMonth() === month
      );
    });
  }

  getEventsForWeek(startDate: Date): CalendarEvent[] {
    const start = this.startOfDay(startDate);
    const end = new Date(start);

    end.setDate(end.getDate() + 7);

    return this.events().filter(event => {
      const eventDate = this.parseDate(event.date);

      return eventDate >= start && eventDate < end;
    });
  }

  isToday(date: Date): boolean {
    const today = new Date();

    return (
      today.getFullYear() === date.getFullYear() &&
      today.getMonth() === date.getMonth() &&
      today.getDate() === date.getDate()
    );
  }

  formatDateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  parseDate(value: string): Date {
    const [year, month, day] = value
      .split('-')
      .map(Number);

    return new Date(year, month - 1, day);
  }

  private toDateTime(event: CalendarEvent): Date {
    const date = this.parseDate(event.date);

    if (event.startTime) {
      const [hours, minutes] = event.startTime
        .split(':')
        .map(Number);

      date.setHours(hours, minutes, 0, 0);
    }

    return date;
  }

  private startOfDay(date: Date): Date {
    const result = new Date(date);

    result.setHours(0, 0, 0, 0);

    return result;
  }
}