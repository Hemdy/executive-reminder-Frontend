import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { ReminderList } from './reminder-list';
import { AuthService } from '../../../../core/services/auth.service';
import { ReminderService } from '../../../../core/services/reminder.service';
import { Reminder } from '../../../../core/models/reminder.model';
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

function makeReminder(id: string, recipientId: string, participantIds: string[] = []): Reminder {
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
    recipient: user(recipientId),
    participants: participantIds.map(user),
    createdBy: user('creator'),
    priority: 'MEDIUM',
    category: 'General',
    reminderDate: '2030-01-01',
    reminderTime: '09:00',
    recurrence: 'ONCE',
    status: 'PENDING',
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    commentsCount: 0,
    attachmentsCount: 0
  };
}

describe('ReminderList', () => {
  let component: ReminderList;
  let fixture: ComponentFixture<ReminderList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReminderList],
      providers: [{
        provide: AuthService,
        useValue: { currentUser: currentUserSignal.asReadonly() }
      }]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReminderList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('deletes the individually selected reminders after confirmation', () => {
    const reminderService = TestBed.inject(ReminderService);
    const deleteReminder = vi.spyOn(reminderService, 'deleteReminder').mockReturnValue(of(undefined));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.toggleSelection('reminder-1', true);
    component.toggleSelection('reminder-2', true);
    component.deleteSelected();

    expect(deleteReminder).toHaveBeenCalledTimes(2);
    expect(deleteReminder).toHaveBeenCalledWith('reminder-1');
    expect(deleteReminder).toHaveBeenCalledWith('reminder-2');
    expect(component.selectedCount()).toBe(0);
  });

  it('shows only reminders addressed to or involving the current user', () => {
    const reminderService = TestBed.inject(ReminderService);
    vi.spyOn(reminderService, 'reminders').mockReturnValue([
      makeReminder('recipient', 'current-user'),
      makeReminder('participant', 'another-user', ['current-user']),
      makeReminder('unrelated', 'another-user')
    ]);
    currentUserSignal.set({ ...currentUser, id: 'another-user' });
    currentUserSignal.set(currentUser);
    component.searchTerm.set('refresh');
    component.searchTerm.set('');

    expect(component.reminders().map(reminder => reminder.id)).toEqual(['recipient', 'participant']);
  });
});
