import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { TaskList } from './task-list';
import { AuthService } from '../../../../core/services/auth.service';
import { TaskService } from '../../../../core/services/task.service';
import { Task } from '../../../../core/models/task.model';
import { User } from '../../../../core/models/user.model';
import { of } from 'rxjs';

const currentUser: User = {
  id: 'current-user',
  firstName: 'Current',
  lastName: 'User',
  email: 'current@example.com',
  role: 'EMPLOYEE'
};
const currentUserSignal = signal<User | null>(currentUser);

function makeTask(
  id: string,
  assignedToId: string,
  participantIds: string[] = [],
  createdById = 'creator'
): Task {
  const user = (userId: string): User => ({
    id: userId,
    firstName: userId,
    lastName: 'User',
    email: `${userId}@example.com`,
    role: 'EMPLOYEE'
  });
  return {
    id,
    title: id,
    assignedTo: user(assignedToId),
    participants: participantIds.map(userId => ({ user: user(userId) })),
    createdBy: user(createdById),
    priority: 'MEDIUM',
    category: 'General',
    dueDate: '2030-01-01',
    status: 'PENDING',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    commentsCount: 0,
    attachmentsCount: 0
  };
}

describe('TaskList', () => {
  let component: TaskList;
  let fixture: ComponentFixture<TaskList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskList],
      providers: [{
        provide: AuthService,
        useValue: {
          currentUser: currentUserSignal.asReadonly(),
          hasPermission: () => true
        }
      }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TaskList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('deletes the individually selected tasks after confirmation', () => {
    const taskService = TestBed.inject(TaskService);
    const deleteTask = vi.spyOn(taskService, 'deleteTask').mockReturnValue(of(undefined));
    vi.spyOn(taskService, 'tasks').mockReturnValue([
      makeTask('task-1', 'another-user', [], 'current-user'),
      makeTask('task-2', 'another-user', [], 'current-user')
    ]);
    currentUserSignal.set({ ...currentUser });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.toggleSelection('task-1', true);
    component.toggleSelection('task-2', true);
    expect(component.selectedCount()).toBe(2);
    component.deleteSelected();

    expect(deleteTask).toHaveBeenCalledTimes(2);
    expect(deleteTask).toHaveBeenCalledWith('task-1');
    expect(deleteTask).toHaveBeenCalledWith('task-2');
    expect(component.selectedCount()).toBe(0);
  });

  it('shows only tasks assigned to or involving the current user', () => {
    const taskService = TestBed.inject(TaskService);
    vi.spyOn(taskService, 'tasks').mockReturnValue([
      makeTask('assigned', 'current-user'),
      makeTask('participant', 'another-user', ['current-user']),
      makeTask('created', 'another-user', [], 'current-user'),
      makeTask('unrelated', 'another-user')
    ]);
    currentUserSignal.set({ ...currentUser, id: 'another-user' });
    currentUserSignal.set(currentUser);
    component.searchTerm.set('refresh');
    component.searchTerm.set('');

    expect(component.tasks().map(task => task.id)).toEqual(['assigned', 'participant', 'created']);
  });

  it('does not allow assignees to select another user’s task for deletion', () => {
    const taskService = TestBed.inject(TaskService);
    const deleteTask = vi.spyOn(taskService, 'deleteTask');
    vi.spyOn(taskService, 'tasks').mockReturnValue([
      makeTask('owned-by-another', 'current-user')
    ]);
    currentUserSignal.set({ ...currentUser });

    component.toggleSelection('owned-by-another', true);
    component.deleteSelected();

    expect(deleteTask).not.toHaveBeenCalled();
    expect(component.selectedCount()).toBe(0);
  });
});
