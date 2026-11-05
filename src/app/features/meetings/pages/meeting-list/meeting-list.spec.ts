import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { MeetingList } from './meeting-list';
import { AuthService } from '../../../../core/services/auth.service';
import { MeetingService } from '../../../../core/services/meeting.service';
import { Meeting } from '../../../../core/models/meeting.model';
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

function makeMeeting(id: string, organizerId: string, participantIds: string[] = []): Meeting {
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
    organizer: user(organizerId),
    participants: participantIds.map(user),
    meetingDate: '2030-01-01',
    startTime: '09:00',
    endTime: '10:00',
    meetingType: 'IN_PERSON',
    status: 'SCHEDULED',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    commentsCount: 0,
    attachmentsCount: 0
  };
}

describe('MeetingList', () => {
  let component: MeetingList;
  let fixture: ComponentFixture<MeetingList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MeetingList],
      providers: [{
        provide: AuthService,
        useValue: {
          currentUser: currentUserSignal.asReadonly(),
          hasPermission: () => true
        }
      }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MeetingList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('deletes the individually selected meetings after confirmation', () => {
    const meetingService = TestBed.inject(MeetingService);
    const deleteMeeting = vi.spyOn(meetingService, 'deleteMeeting').mockReturnValue(of(undefined));
    vi.spyOn(meetingService, 'meetings').mockReturnValue([
      makeMeeting('meeting-1', 'current-user'),
      makeMeeting('meeting-2', 'current-user')
    ]);
    currentUserSignal.set({ ...currentUser });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.toggleSelection('meeting-1', true);
    component.toggleSelection('meeting-2', true);
    component.deleteSelected();

    expect(deleteMeeting).toHaveBeenCalledTimes(2);
    expect(deleteMeeting).toHaveBeenCalledWith('meeting-1');
    expect(deleteMeeting).toHaveBeenCalledWith('meeting-2');
    expect(component.selectedCount()).toBe(0);
  });

  it('shows only meetings involving the current user', () => {
    const meetingService = TestBed.inject(MeetingService);
    vi.spyOn(meetingService, 'meetings').mockReturnValue([
      makeMeeting('participant', 'another-user', ['current-user']),
      makeMeeting('organizer', 'current-user', ['another-user']),
      makeMeeting('unrelated', 'another-user', ['someone-else'])
    ]);
    currentUserSignal.set({ ...currentUser, id: 'another-user' });
    currentUserSignal.set(currentUser);
    component.searchTerm.set('refresh');
    component.searchTerm.set('');

    expect(component.meetings().map(meeting => meeting.id)).toEqual(['participant', 'organizer']);
    expect(component.totalCount()).toBe(2);
  });

  it('does not allow participants to select another user\'s meeting for deletion', () => {
    const meetingService = TestBed.inject(MeetingService);
    const deleteMeeting = vi.spyOn(meetingService, 'deleteMeeting');
    vi.spyOn(meetingService, 'meetings').mockReturnValue([
      makeMeeting('participant-meeting', 'another-user', ['current-user'])
    ]);
    currentUserSignal.set({ ...currentUser });

    component.toggleSelection('participant-meeting', true);
    component.deleteSelected();

    expect(deleteMeeting).not.toHaveBeenCalled();
    expect(component.selectedCount()).toBe(0);
  });
});
