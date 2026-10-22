import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { LoadingService } from '../../../../core/services/loading.service';
import { MeetingService } from '../../../../core/services/meeting.service';
import { RoleService } from '../../../../core/services/role.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Subject } from 'rxjs';

import { MeetingForm } from './meeting-form';

describe('MeetingForm', () => {
  let component: MeetingForm;
  let fixture: ComponentFixture<MeetingForm>;
  let createResponse: Subject<{ id: string }>;
  const meetingService = {
    getMeeting: () => undefined,
    meetingTypeLabel: (type: string) => type,
    meetingStatusLabel: (status: string) => status,
    createMeeting: vi.fn()
  };

  beforeEach(async () => {
    createResponse = new Subject<{ id: string }>();
    meetingService.createMeeting.mockReturnValue(createResponse);
    await TestBed.configureTestingModule({
      imports: [MeetingForm],
      providers: [
        provideRouter([]),
        { provide: MeetingService, useValue: meetingService },
        { provide: RoleService, useValue: { users: signal([]) } }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MeetingForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the scheduling loader active until success, then toasts and opens the meeting', () => {
    const loading = TestBed.inject(LoadingService);
    const toast = TestBed.inject(ToastService);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.form.patchValue({ title: 'Team sync' });

    component.save();

    expect(loading.isLoading()).toBe(true);
    expect(loading.message()).toBe('Scheduling meeting…');
    expect(component.isSaving()).toBe(true);

    createResponse.next({ id: 'meeting-1' });
    createResponse.complete();

    expect(loading.isLoading()).toBe(false);
    expect(component.isSaving()).toBe(false);
    expect(toast.current()?.message).toBe('Meeting scheduled successfully');
    expect(navigate).toHaveBeenCalledWith(['/meetings', 'meeting-1']);
    toast.dismiss();
  });

  it('shows an error toast and ends the loader when meeting creation fails', () => {
    const loading = TestBed.inject(LoadingService);
    const toast = TestBed.inject(ToastService);
    component.form.patchValue({ title: 'Team sync' });

    component.save();
    createResponse.error({ error: { message: 'Meeting could not be scheduled' } });

    expect(loading.isLoading()).toBe(false);
    expect(component.isSaving()).toBe(false);
    expect(toast.current()).toMatchObject({
      type: 'error',
      message: 'Meeting could not be scheduled'
    });
    toast.dismiss();
  });
});
