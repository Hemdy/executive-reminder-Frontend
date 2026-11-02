import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Request, RequestAttachment, RequestComment } from '../../../../core/models/request.model';
import { AuthService } from '../../../../core/services/auth.service';
import { RequestService } from '../../../../core/services/request.service';
import { RequestDetails } from './request-details';

describe('RequestDetails', () => {
  let component: RequestDetails;
  let fixture: ComponentFixture<RequestDetails>;
  const author = {
    id: 'user-1',
    firstName: 'Alex',
    lastName: 'User',
    email: 'alex@example.test',
    role: 'EMPLOYEE',
  };
  const request = {
    id: 'request-1',
    title: 'Review policy',
    type: 'GENERAL',
    priority: 'MEDIUM',
    requester: author,
    assignedTo: author,
    status: 'PENDING',
    createdAt: '2026-09-30T12:00:00.000Z',
    updatedAt: '2026-09-30T12:00:00.000Z',
    commentsCount: 0,
    attachmentsCount: 0,
  } satisfies Request;
  const requestServiceMock = {
    getRequest: () => request,
    loadRequest: () => of(request),
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
    requestServiceMock.updateComment.mockClear();
    requestServiceMock.deleteAttachment.mockClear();
    await TestBed.configureTestingModule({
      imports: [RequestDetails],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: new Map([['id', request.id]]),
              queryParamMap: new Map<string, string>(),
            },
          },
        },
        { provide: RequestService, useValue: requestServiceMock },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => author,
            hasPermission: () => false,
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RequestDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('updates an authored comment in place', () => {
    const comment: RequestComment = {
      id: 'comment-1',
      body: 'Original',
      createdAt: '2026-09-30T12:00:00.000Z',
      author: { id: author.id, firstName: author.firstName, lastName: author.lastName },
    };
    component.comments.set([comment]);
    component.editComment(comment);
    component.editCommentText.set('Updated');

    component.saveCommentEdit(comment);

    expect(requestServiceMock.updateComment).toHaveBeenCalledWith(
      request.id,
      comment.id,
      'Updated',
    );
    expect(component.comments()[0].body).toBe('Updated');
  });

  it('removes an owned attachment after confirmation and blocks another uploader', () => {
    const attachment: RequestAttachment = {
      id: 'attachment-1',
      fileName: 'policy.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      createdAt: '2026-09-30T12:00:00.000Z',
      uploader: { id: author.id, firstName: author.firstName, lastName: author.lastName },
    };
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    component.attachments.set([attachment]);
    component.deleteAttachment(attachment);

    expect(requestServiceMock.deleteAttachment).toHaveBeenCalledWith(
      request.id,
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
    expect(requestServiceMock.deleteAttachment).toHaveBeenCalledTimes(1);
    expect(component.attachments()).toEqual([otherAttachment]);
    confirm.mockRestore();
  });
});
