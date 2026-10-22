import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { ReminderService } from '../../../../core/services/reminder.service';
import { RoleService } from '../../../../core/services/role.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Subject } from 'rxjs';

import { ReminderForm } from './reminder-form';

describe('ReminderForm', () => {
  let component: ReminderForm;
  let fixture: ComponentFixture<ReminderForm>;
  const user = {
    id: 'user-1',
    firstName: 'Alex',
    lastName: 'Morgan',
    email: 'alex@example.com',
    role: 'EMPLOYEE'
  };
  const users = signal([user]);
  const usersLoading = signal(false);
  const currentUser = signal(user);
  let createResponse: Subject<{ id: string }>;
  const reminderService = {
    getReminder: () => undefined,
    createReminder: vi.fn()
  };

  beforeEach(async () => {
    createResponse = new Subject<{ id: string }>();
    reminderService.createReminder.mockReturnValue(createResponse);
    await TestBed.configureTestingModule({
      imports: [ReminderForm],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser } },
        { provide: ReminderService, useValue: reminderService },
        { provide: RoleService, useValue: { users, usersLoading } }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReminderForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows recipients with the meeting participant layout and avatar initials', () => {
    fixture.detectChanges();
    const option = fixture.nativeElement.querySelector('.participant-option') as HTMLLabelElement;

    expect(option.querySelector('.participant-avatar')?.textContent.trim()).toBe('AM');
    expect(option.querySelector('.participant-info strong')?.textContent).toContain('Alex Morgan');
    expect(option.querySelector('.participant-info small')?.textContent).toContain('EMPLOYEE');
    expect(option.querySelector('input[type="checkbox"]')).toBeTruthy();
  });

  it('shows participant skeletons while recipient data is loading', () => {
    usersLoading.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.participant-list')?.getAttribute('aria-busy'))
      .toBe('true');
    expect(fixture.nativeElement.querySelectorAll('.participant-skeleton')).toHaveLength(4);
  });

  it('keeps the creation loader active until success, then toasts and opens the reminder', () => {
    const loading = TestBed.inject(LoadingService);
    const toast = TestBed.inject(ToastService);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.reminderForm.patchValue({
      title: 'Follow up',
      recipientId: user.id,
      reminderDate: '2026-11-01',
      reminderTime: '09:00'
    });

    component.save();

    expect(loading.isLoading()).toBe(true);
    expect(loading.message()).toBe('Creating reminder…');
    expect(component.isSaving()).toBe(true);

    createResponse.next({ id: 'reminder-1' });
    createResponse.complete();

    expect(loading.isLoading()).toBe(false);
    expect(component.isSaving()).toBe(false);
    expect(toast.current()?.message).toBe('Reminder created successfully');
    expect(navigate).toHaveBeenCalledWith(['/reminders', 'reminder-1']);
    toast.dismiss();
  });

  it('shows an error toast and ends the loader when reminder creation fails', () => {
    const loading = TestBed.inject(LoadingService);
    const toast = TestBed.inject(ToastService);
    component.reminderForm.patchValue({
      title: 'Follow up',
      recipientId: user.id,
      reminderDate: '2026-11-01',
      reminderTime: '09:00'
    });

    component.save();
    createResponse.error({ error: { message: 'Reminder could not be created' } });

    expect(loading.isLoading()).toBe(false);
    expect(component.isSaving()).toBe(false);
    expect(toast.current()).toMatchObject({
      type: 'error',
      message: 'Reminder could not be created'
    });
    toast.dismiss();
  });
});
