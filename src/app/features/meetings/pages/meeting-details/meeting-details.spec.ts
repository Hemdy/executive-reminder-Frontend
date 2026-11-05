import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Meeting, MeetingAttachment, MeetingComment } from '../../../../core/models/meeting.model';
import { AuthService } from '../../../../core/services/auth.service';
import { MeetingService } from '../../../../core/services/meeting.service';
import { MeetingDetails } from './meeting-details';

describe('MeetingDetails', () => {
  let component: MeetingDetails;
  let fixture: ComponentFixture<MeetingDetails>;
  const author = {
    id: 'user-1',
    firstName: 'Alex',
    lastName: 'User',
    email: 'alex@example.test',
    role: 'EMPLOYEE',
  };
  const meeting = {
    id: 'meeting-1',
    title: 'Planning meeting',
    organizer: author,
    participants: [author],
    meetingDate: '2026-10-12',
    startTime: '09:00',
    endTime: '10:00',
    meetingType: 'ONLINE',
    status: 'SCHEDULED',
    createdAt: '2026-09-30T12:00:00.000Z',
    updatedAt: '2026-09-30T12:00:00.000Z',
    commentsCount: 0,
    attachmentsCount: 0,
  } satisfies Meeting;
  const meetingServiceMock = {
    getMeeting: () => meeting,
    loadMeeting: () => of(meeting),
    getComments: () => of([]),
    getAttachments: () => of([]),
    meetingTypeLabel: () => 'Online',
    meetingStatusLabel: () => 'Scheduled',
    formatTime: (time: string) => time,
    isPast: () => false,
    updateComment: vi.fn((_id: string, commentId: string, body: string) => of({
      id: commentId,
      body,
      createdAt: '2026-09-30T12:00:00.000Z',
      author: { id: author.id, firstName: author.firstName, lastName: author.lastName },
    })),
    deleteAttachment: vi.fn(() => of({ id: 'attachment-1', deleted: true })),
  };

  beforeEach(async () => {
    meetingServiceMock.updateComment.mockClear();
    meetingServiceMock.deleteAttachment.mockClear();
    await TestBed.configureTestingModule({
      imports: [MeetingDetails],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: new Map([['id', meeting.id]]),
              queryParamMap: new Map<string, string>(),
            },
          },
        },
        { provide: MeetingService, useValue: meetingServiceMock },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => author,
            hasPermission: () => false,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MeetingDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('updates an authored comment in place', () => {
    const comment: MeetingComment = {
      id: 'comment-1',
      body: 'Original',
      createdAt: '2026-09-30T12:00:00.000Z',
      author: { id: author.id, firstName: author.firstName, lastName: author.lastName },
    };
    component.comments.set([comment]);
    component.editComment(comment);
    component.editCommentText.set('Updated');

    component.saveCommentEdit(comment);

    expect(meetingServiceMock.updateComment).toHaveBeenCalledWith(
      meeting.id,
      comment.id,
      'Updated',
    );
    expect(component.comments()[0].body).toBe('Updated');
  });

  it('lets the organizer manage a meeting without meeting write permission', () => {
    expect(component.canManageMeeting()).toBe(true);
  });

  it('removes an owned attachment after confirmation and blocks another uploader', () => {
    const attachment: MeetingAttachment = {
      id: 'attachment-1',
      fileName: 'agenda.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      createdAt: '2026-09-30T12:00:00.000Z',
      uploader: { id: author.id, firstName: author.firstName, lastName: author.lastName },
    };
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.attachments.set([attachment]);
    component.deleteAttachment(attachment);

    expect(meetingServiceMock.deleteAttachment).toHaveBeenCalledWith(
      meeting.id,
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
    expect(meetingServiceMock.deleteAttachment).toHaveBeenCalledTimes(1);
    expect(component.attachments()).toEqual([otherAttachment]);
    confirm.mockRestore();
  });
});
