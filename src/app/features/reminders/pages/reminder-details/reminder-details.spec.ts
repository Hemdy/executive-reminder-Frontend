import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Reminder, ReminderAttachment, ReminderComment } from '../../../../core/models/reminder.model';
import { AuthService } from '../../../../core/services/auth.service';
import { ReminderService } from '../../../../core/services/reminder.service';
import { ReminderDetails } from './reminder-details';

describe('ReminderDetails', () => {
  let component: ReminderDetails;
  let fixture: ComponentFixture<ReminderDetails>;
  const author = {
    id: 'user-1',
    firstName: 'Alex',
    lastName: 'User',
    email: 'alex@example.test',
    role: 'EMPLOYEE',
  };
  const reminder = {
    id: 'reminder-1',
    title: 'Review report',
    recipient: author,
    createdBy: author,
    priority: 'MEDIUM',
    category: 'General',
    reminderDate: '2026-10-12',
    reminderTime: '09:00',
    recurrence: 'ONCE',
    status: 'PENDING',
    createdAt: '2026-09-30T12:00:00.000Z',
    updatedAt: '2026-09-30T12:00:00.000Z',
    commentsCount: 0,
    attachmentsCount: 0,
  } satisfies Reminder;
  const reminderServiceMock = {
    getReminder: () => reminder,
    loadReminder: () => of(reminder),
    getComments: () => of([]),
    getAttachments: () => of([]),
    isOverdue: () => false,
    updateComment: vi.fn((_id: string, commentId: string, body: string) => of({
      id: commentId,
      body,
      createdAt: '2026-09-30T12:00:00.000Z',
      updatedAt: '2026-09-30T12:30:00.000Z',
      author: { id: author.id, firstName: author.firstName, lastName: author.lastName },
    })),
    deleteAttachment: vi.fn(() => of({ id: 'attachment-1', deleted: true })),
  };

  beforeEach(async () => {
    reminderServiceMock.updateComment.mockClear();
    reminderServiceMock.deleteAttachment.mockClear();
    await TestBed.configureTestingModule({
      imports: [ReminderDetails],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: new Map([['id', reminder.id]]),
              queryParamMap: new Map<string, string>(),
            },
          },
        },
        { provide: ReminderService, useValue: reminderServiceMock },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => author,
            hasPermission: () => false,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ReminderDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('updates an authored comment in place', () => {
    const comment: ReminderComment = {
      id: 'comment-1',
      body: 'Original',
      createdAt: '2026-09-30T12:00:00.000Z',
      author: { id: author.id, firstName: author.firstName, lastName: author.lastName },
    };
    component.comments.set([comment]);
    component.editComment(comment);
    component.editCommentText.set('Updated');

    component.saveCommentEdit(comment);

    expect(reminderServiceMock.updateComment).toHaveBeenCalledWith(
      reminder.id,
      comment.id,
      'Updated',
    );
    expect(component.comments()[0].body).toBe('Updated');
  });

  it('lets the creator manage a reminder without reminder write permission', () => {
    expect(component.canManageReminder()).toBe(true);
    expect(component.canChangeReminderStatus('CANCELLED')).toBe(true);
  });

  it('removes an owned attachment after confirmation and blocks another uploader', () => {
    const attachment: ReminderAttachment = {
      id: 'attachment-1',
      fileName: 'report.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      createdAt: '2026-09-30T12:00:00.000Z',
      uploader: { id: author.id, firstName: author.firstName, lastName: author.lastName },
    };
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.attachments.set([attachment]);
    component.deleteAttachment(attachment);

    expect(reminderServiceMock.deleteAttachment).toHaveBeenCalledWith(
      reminder.id,
      attachment.id,
    );
    expect(component.attachments()).toEqual([]);

    const otherAttachment = {
      ...attachment,
      id: 'attachment-2',
      uploader: { id: 'other-user', firstName: 'Other', lastName: 'User' },
    };
    component.attachments.set([otherAttachment]);
    component.deleteAttachment(otherAttachment);
    expect(reminderServiceMock.deleteAttachment).toHaveBeenCalledTimes(1);
    expect(component.attachments()).toEqual([otherAttachment]);
    confirm.mockRestore();
  });
});
