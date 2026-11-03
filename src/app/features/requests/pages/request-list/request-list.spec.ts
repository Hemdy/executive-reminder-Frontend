import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { RequestList } from './request-list';
import { AuthService } from '../../../../core/services/auth.service';
import { RequestService } from '../../../../core/services/request.service';
import { Request } from '../../../../core/models/request.model';
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

function makeRequest(id: string, assignedToId: string): Request {
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
    type: 'GENERAL',
    priority: 'MEDIUM',
    requester: user('requester'),
    assignedTo: user(assignedToId),
    status: 'PENDING',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    commentsCount: 0,
    attachmentsCount: 0
  };
}

describe('RequestList', () => {
  let component: RequestList;
  let fixture: ComponentFixture<RequestList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RequestList],
      providers: [{
        provide: AuthService,
        useValue: { currentUser: currentUserSignal.asReadonly() }
      }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RequestList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('deletes the individually selected requests after confirmation', () => {
    const requestService = TestBed.inject(RequestService);
    const deleteRequest = vi.spyOn(requestService, 'deleteRequest').mockReturnValue(of(undefined));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.toggleSelection('request-1', true);
    component.toggleSelection('request-2', true);
    component.deleteSelected();

    expect(deleteRequest).toHaveBeenCalledTimes(2);
    expect(deleteRequest).toHaveBeenCalledWith('request-1');
    expect(deleteRequest).toHaveBeenCalledWith('request-2');
    expect(component.selectedCount()).toBe(0);
  });

  it('shows only requests assigned to the current user', () => {
    const requestService = TestBed.inject(RequestService);
    vi.spyOn(requestService, 'requests').mockReturnValue([
      makeRequest('assigned', 'current-user'),
      makeRequest('unrelated', 'another-user')
    ]);
    currentUserSignal.set({ ...currentUser, id: 'another-user' });
    currentUserSignal.set(currentUser);
    component.searchTerm.set('refresh');
    component.searchTerm.set('');

    expect(component.requests().map(request => request.id)).toEqual(['assigned']);
    expect(component.totalCount()).toBe(1);
  });
});
