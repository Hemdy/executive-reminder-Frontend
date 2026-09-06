
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { CalendarService } from '../../../../core/services/calendar.service';
import {
  CalendarEvent,
  CalendarEventType
} from '../../../../core/models/calendar-event.model';

type CalendarView = 'MONTH' | 'WEEK' | 'DAY' | 'AGENDA';

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})

export class Calendar {


  readonly calendarService = inject(CalendarService);
  private readonly router = inject(Router);

  readonly currentDate = signal(new Date());

  readonly currentView = signal<CalendarView>('MONTH');

  readonly selectedDate = signal(new Date());

  readonly events = this.calendarService.events;

  readonly currentMonthLabel = computed(() => {
    return this.currentDate().toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric'
    });
  });

  readonly currentDayLabel = computed(() => {
    return this.selectedDate().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  });

  readonly monthDays = computed(() => {
    return this.buildMonthDays(this.currentDate());
  });

  readonly weekDays = computed(() => {
    const date = new Date(this.selectedDate());

    const day = date.getDay();

    date.setDate(date.getDate() - day);

    return Array.from({ length: 7 }, (_, index) => {
      const current = new Date(date);

      current.setDate(date.getDate() + index);

      return current;
    });
  });

  readonly dayEvents = computed(() =>
    this.calendarService.getEventsForDate(
      this.selectedDate()
    )
  );

  readonly weekEvents = computed(() =>
    this.calendarService.getEventsForWeek(
      this.getWeekStart(this.selectedDate())
    )
  );

  readonly agendaEvents = computed(() => {
    return [...this.events()].filter(event => {
      const eventDate = this.calendarService.parseDate(event.date);

      return eventDate >= this.startOfToday();
    });
  });

  setView(view: CalendarView): void {
    this.currentView.set(view);
  }

  previous(): void {
    const date = new Date(this.currentDate());

    switch (this.currentView()) {
      case 'MONTH':
        date.setMonth(date.getMonth() - 1);
        break;

      case 'WEEK':
        date.setDate(date.getDate() - 7);
        break;

      case 'DAY':
        date.setDate(date.getDate() - 1);
        break;

      case 'AGENDA':
        date.setMonth(date.getMonth() - 1);
        break;
    }

    this.currentDate.set(date);
    this.selectedDate.set(new Date(date));
  }

  next(): void {
    const date = new Date(this.currentDate());

    switch (this.currentView()) {
      case 'MONTH':
        date.setMonth(date.getMonth() + 1);
        break;

      case 'WEEK':
        date.setDate(date.getDate() + 7);
        break;

      case 'DAY':
        date.setDate(date.getDate() + 1);
        break;

      case 'AGENDA':
        date.setMonth(date.getMonth() + 1);
        break;
    }

    this.currentDate.set(date);
    this.selectedDate.set(new Date(date));
  }

  goToToday(): void {
    const today = new Date();

    this.currentDate.set(today);
    this.selectedDate.set(today);
  }

  selectDate(date: Date): void {
    this.selectedDate.set(new Date(date));

    if (this.currentView() === 'MONTH') {
      this.currentDate.set(new Date(date));
    }
  }

  openEvent(event: CalendarEvent): void {
    this.router.navigateByUrl(event.route);
  }

  getEventsForDate(date: Date): CalendarEvent[] {
    return this.calendarService.getEventsForDate(date);
  }

  getEventClass(event: CalendarEvent): string {
    return `event-${event.type.toLowerCase()}`;
  }

  getEventTime(event: CalendarEvent): string {
    if (!event.startTime) {
      return '';
    }

    if (!event.endTime) {
      return this.formatTime(event.startTime);
    }

    return `${this.formatTime(event.startTime)} – ${this.formatTime(event.endTime)}`;
  }

  formatTime(value: string): string {
    const [hours, minutes] = value.split(':').map(Number);

    const date = new Date();

    date.setHours(hours, minutes, 0, 0);

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  getTypeLabel(type: CalendarEventType): string {
    switch (type) {
      case 'MEETING':
        return 'Meeting';

      case 'TASK':
        return 'Task';

      case 'REMINDER':
        return 'Reminder';
    }
  }

  trackByDate(_: number, day: CalendarDay): string {
    return day.date.toISOString();
  }

  trackByEvent(_: number, event: CalendarEvent): string {
    return event.id;
  }

  private buildMonthDays(date: Date): CalendarDay[] {
    const year = date.getFullYear();
    const month = date.getMonth();

    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();

    const daysInMonth = new Date(
      year,
      month + 1,
      0
    ).getDate();

    const previousMonthDays = new Date(
      year,
      month,
      0
    ).getDate();

    const days: CalendarDay[] = [];

    for (let index = startDay - 1; index >= 0; index--) {
      const day = new Date(
        year,
        month - 1,
        previousMonthDays - index
      );

      days.push({
        date: day,
        isCurrentMonth: false,
        isToday: this.calendarService.isToday(day)
      });
    }

    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber++) {
      const day = new Date(
        year,
        month,
        dayNumber
      );

      days.push({
        date: day,
        isCurrentMonth: true,
        isToday: this.calendarService.isToday(day)
      });
    }

    let nextDay = 1;

    while (days.length < 42) {
      const day = new Date(
        year,
        month + 1,
        nextDay++
      );

      days.push({
        date: day,
        isCurrentMonth: false,
        isToday: this.calendarService.isToday(day)
      });
    }

    return days;
  }

  private getWeekStart(date: Date): Date {
    const result = new Date(date);

    result.setDate(
      result.getDate() - result.getDay()
    );

    result.setHours(0, 0, 0, 0);

    return result;
  }

  private startOfToday(): Date {
    const today = new Date();

    today.setHours(0, 0, 0, 0);

    return today;
  }
}
