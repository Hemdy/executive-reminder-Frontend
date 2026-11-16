import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { MeetingService } from '../../../../core/services/meeting.service';
import { ReminderService } from '../../../../core/services/reminder.service';
import { Calendar } from './calendar';

describe('Calendar', () => {
  let component: Calendar;
  let fixture: ComponentFixture<Calendar>;
  let router: Router;

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Calendar],
      providers: [
        provideRouter([]),
        {
          provide: MeetingService,
          useValue: {
            listLoading: signal(false),
            listError: signal(''),
            meetings: signal([
              {
                id: 'm-1',
                title: 'Board Strategy Review',
                meetingDate: todayKey,
                startTime: '10:00',
                endTime: '11:00',
                status: 'SCHEDULED',
                meetingType: 'IN_PERSON',
                location: 'Boardroom A',
                organizer: { id: 'u-1', firstName: 'Ada', lastName: 'Lovelace' },
                participants: [],
              },
            ]),
            loadMeetings: () => of([]),
          },
        },
        {
          provide: ReminderService,
          useValue: {
            listLoading: signal(false),
            listError: signal(''),
            reminders: signal([
              {
                id: 'r-1',
                title: 'Approve Q4 Budget',
                reminderDate: todayKey,
                reminderTime: '14:30',
                status: 'PENDING',
                priority: 'HIGH',
                category: 'Finance',
                recurrence: 'ONCE',
                createdBy: { id: 'u-1', firstName: 'Ada', lastName: 'Lovelace' },
                recipient: { id: 'u-1', firstName: 'Ada', lastName: 'Lovelace' },
              },
            ]),
            loadReminders: () => of([]),
          },
        },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(Calendar);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create and display the redesigned calendar header, legend, and month grid', () => {
    expect(component).toBeTruthy();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.page-title')?.textContent?.trim()).toBe('Calendar');
    expect(el.querySelectorAll('.calendar-day').length).toBe(42);
    expect(el.querySelector('.calendar-day.today')).toBeTruthy();
    expect(el.querySelectorAll('.legend-item').length).toBe(3);
  });

  it('switches views cleanly between Month, Week, Day, and Agenda', () => {
    const el = fixture.nativeElement as HTMLElement;
    const tabs = Array.from(el.querySelectorAll('.view-switcher button')) as HTMLButtonElement[];
    expect(tabs.length).toBe(4);

    tabs[1].click();
    fixture.detectChanges();
    expect(el.querySelector('.week-view')).toBeTruthy();

    tabs[2].click();
    fixture.detectChanges();
    expect(el.querySelector('.day-view')).toBeTruthy();
    expect(el.querySelectorAll('.agenda-item').length).toBe(2);

    tabs[3].click();
    fixture.detectChanges();
    expect(el.querySelector('.agenda-view')).toBeTruthy();
    expect(el.querySelectorAll('.agenda-row').length).toBe(2);
  });

  it('updates selected date and navigates when an event is clicked', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const el = fixture.nativeElement as HTMLElement;

    const firstEvent = el.querySelector('.calendar-event') as HTMLButtonElement;
    expect(firstEvent).toBeTruthy();
    firstEvent.click();

    expect(navigateSpy).toHaveBeenCalledWith('/meetings/m-1');
  });

  it('changes month via the month picker dropdown', () => {
    const options = component.monthOptions();
    const targetOption = options[0];

    component.selectMonthKey(targetOption.value);
    fixture.detectChanges();

    expect(component.currentMonthKey()).toBe(targetOption.value);
  });
});
