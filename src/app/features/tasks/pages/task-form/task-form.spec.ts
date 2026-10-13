import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { RoleService } from '../../../../core/services/role.service';
import { TaskService } from '../../../../core/services/task.service';

import { TaskForm } from './task-form';

describe('TaskForm', () => {
  let component: TaskForm;
  let fixture: ComponentFixture<TaskForm>;
  const employees = signal([
    { id: 'user-1', firstName: 'Alex', lastName: 'Morgan', department: 'Finance' }
  ]);
  const employeesLoading = signal(true);

  beforeEach(async () => {
    employees.set([
      { id: 'user-1', firstName: 'Alex', lastName: 'Morgan', department: 'Finance' }
    ]);
    employeesLoading.set(true);
    await TestBed.configureTestingModule({
      imports: [TaskForm],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { currentUser: signal(null) } },
        { provide: TaskService, useValue: { getTask: () => undefined } },
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
    expect(option.querySelector('input[type="checkbox"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('.participant-skeletons')).toBeNull();
  });
});
