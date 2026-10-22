import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { RequestService } from '../../../../core/services/request.service';
import { RoleService } from '../../../../core/services/role.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Subject } from 'rxjs';

import { RequestForm } from './request-form';

describe('RequestForm', () => {
  let component: RequestForm;
  let fixture: ComponentFixture<RequestForm>;
  const user = {
    id: 'user-1',
    firstName: 'Alex',
    lastName: 'Morgan',
    email: 'alex@example.com',
    role: 'EMPLOYEE'
  };
  const users = signal([user]);
  const currentUser = signal(user);
  let createResponse: Subject<{ id: string }>;
  const requestService = {
    getRequest: () => undefined,
    createRequest: vi.fn()
  };

  beforeEach(async () => {
    createResponse = new Subject<{ id: string }>();
    requestService.createRequest.mockReturnValue(createResponse);
    await TestBed.configureTestingModule({
      imports: [RequestForm],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser } },
        { provide: RequestService, useValue: requestService },
        { provide: RoleService, useValue: { users } }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RequestForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the creation loader active until success, then toasts and opens the request', () => {
    const loading = TestBed.inject(LoadingService);
    const toast = TestBed.inject(ToastService);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    component.form.patchValue({ title: 'Purchase approval', assignedToId: user.id });

    component.save();

    expect(loading.isLoading()).toBe(true);
    expect(loading.message()).toBe('Creating request…');
    expect(component.isSaving()).toBe(true);

    createResponse.next({ id: 'request-1' });
    createResponse.complete();

    expect(loading.isLoading()).toBe(false);
    expect(component.isSaving()).toBe(false);
    expect(toast.current()?.message).toBe('Request created successfully');
    expect(navigate).toHaveBeenCalledWith(['/requests', 'request-1']);
    toast.dismiss();
  });

  it('shows an error toast and ends the loader when request creation fails', () => {
    const loading = TestBed.inject(LoadingService);
    const toast = TestBed.inject(ToastService);
    component.form.patchValue({ title: 'Purchase approval', assignedToId: user.id });

    component.save();
    createResponse.error({ error: { message: 'Request could not be created' } });

    expect(loading.isLoading()).toBe(false);
    expect(component.isSaving()).toBe(false);
    expect(toast.current()).toMatchObject({
      type: 'error',
      message: 'Request could not be created'
    });
    toast.dismiss();
  });
});
