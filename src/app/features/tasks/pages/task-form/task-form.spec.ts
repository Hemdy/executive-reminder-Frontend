import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { RoleService } from '../../../../core/services/role.service';
import { TaskService } from '../../../../core/services/task.service';
import { ToastService } from '../../../../core/services/toast.service';
import { Subject } from 'rxjs';

import { TaskForm } from './task-form';

describe('TaskForm', () => {
  let component: TaskForm;
  let fixture: ComponentFixture<TaskForm>;
  const employees = signal([
    { id: 'user-1', firstName: 'Alex', lastName: 'Morgan', role: 'EMPLOYEE', department: 'Finance' }
  ]);
  const employeesLoading = signal(true);
  const currentUser = signal({
    id: 'user-1',
    firstName: 'Alex',
    lastName: 'Morgan',
    email: 'alex@example.com',
    role: 'EMPLOYEE'
  });
  let createResponse: Subject<{ id: string }>;
  const taskService = {
    getTask: () => undefined,
    createTask: vi.fn()
  };

  beforeEach(async () => {
    employees.set([
      { id: 'user-1', firstName: 'Alex', lastName: 'Morgan', role: 'EMPLOYEE', department: 'Finance' }
    ]);
    employeesLoading.set(true);
    createResponse = new Subject<{ id: string }>();
    taskService.createTask.mockReturnValue(createResponse);
    await TestBed.configureTestingModule({
      imports: [TaskForm],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser } },
        { provide: TaskService, useValue: taskService },
        {
          provide: RoleService,
          useValue: { users: employees, usersLoading: employeesLoading }
        }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows participant skeletons while the user list is loading', () => {
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.participant-list')?.getAttribute('aria-busy'))
      .toBe('true');
    expect(fixture.nativeElement.querySelectorAll('.participant-skeleton')).toHaveLength(4);
  });

  it('shows aligned participant options when users have loaded', () => {
    employeesLoading.set(false);
    fixture.detectChanges();

    const option = fixture.nativeElement.querySelector('.participant-option') as HTMLLabelElement;
    expect(option.textContent).toContain('Alex Morgan');
    expect(option.textContent).toContain('Finance');
    expect(option.querySelector('.participant-avatar')?.textContent.trim()).toBe('AM');
    expect(option.querySelector('.participant-info small')?.textContent).toContain('EMPLOYEE');
    expect(option.querySelector('input[type="checkbox"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.participant-skeletons')).toBeNull();
  });

  it('keeps the creation loader active until success, then toasts and opens the task', () => {
    const loading = TestBed.inject(LoadingService);
    const toast = TestBed.inject(ToastService);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    component.taskForm.patchValue({
      title: 'Prepare report',
      assignedToId: 'user-1',
      dueDate: '2026-11-01'
    });
    component.save();

    expect(loading.isLoading()).toBe(true);
    expect(loading.message()).toBe('Creating task…');
    expect(component.isSaving()).toBe(true);

    createResponse.next({ id: 'task-1' });
    createResponse.complete();

    expect(loading.isLoading()).toBe(false);
    expect(component.isSaving()).toBe(false);
    expect(toast.current()?.message).toBe('Task created successfully');
    expect(navigate).toHaveBeenCalledWith(['/tasks', 'task-1']);
    toast.dismiss();
  });

  it('shows an error toast and ends the loader when task creation fails', () => {
    const loading = TestBed.inject(LoadingService);
    const toast = TestBed.inject(ToastService);
    component.taskForm.patchValue({
      title: 'Prepare report',
      assignedToId: 'user-1',
      dueDate: '2026-11-01'
    });

    component.save();
    createResponse.error({ error: { message: 'Task could not be created' } });

    expect(loading.isLoading()).toBe(false);
    expect(component.isSaving()).toBe(false);
    expect(toast.current()).toMatchObject({
      type: 'error',
      message: 'Task could not be created'
    });
    toast.dismiss();
  });
});
