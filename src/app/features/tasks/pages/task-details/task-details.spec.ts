import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Task } from '../../../../core/models/task.model';
import { User } from '../../../../core/models/user.model';
import { AuthService } from '../../../../core/services/auth.service';
import { TaskService } from '../../../../core/services/task.service';
import { TaskDetails } from './task-details';

describe('TaskDetails', () => {
  let component: TaskDetails;
  let fixture: ComponentFixture<TaskDetails>;
  let currentTask: Task;
  let currentUser: User;
  let hasTaskWritePermission: boolean;
  const taskServiceMock = {
    getTask: () => currentTask,
    loadTask: () => of(currentTask),
    loadTaskActivity: () => of(undefined),
    getComments: () => of([]),
    getAttachments: () => of([]),
    isOverdue: () => false,
    updateStatus: vi.fn(() => of(currentTask)),
    deleteTask: () => of(undefined),
    addComment: (_taskId: string, body: string) => of({
      id: 'comment-1',
      body,
      createdAt: '2026-09-30T12:00:00.000Z',
      author: {
        id: currentUser.id,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName
      }
    }),
    uploadAttachment: () => of({
      id: 'attachment-1',
      fileName: 'brief.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      createdAt: '2026-09-30T12:00:00.000Z',
      uploader: {
        id: currentUser.id,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName
      }
    }),
    downloadAttachment: () => of(new Blob())
  };

  beforeEach(async () => {
    currentUser = {
      id: 'assignee-1',
      firstName: 'Avery',
      lastName: 'Assignee',
      email: 'avery@example.test',
      role: 'EMPLOYEE'
    };
    hasTaskWritePermission = false;
    currentTask = {
      id: 'task-1',
      title: 'Prepare report',
      assignedTo: currentUser,
      participants: [{ user: currentUser }],
      createdBy: {
        id: 'creator-1',
        firstName: 'Casey',
        lastName: 'Creator',
        email: 'casey@example.test',
        role: 'ADMIN'
      },
      priority: 'MEDIUM',
      category: 'General',
      dueDate: '2026-10-01',
      status: 'PENDING',
      createdAt: '2026-09-30T12:00:00.000Z',
      updatedAt: '2026-09-30T12:00:00.000Z',
      commentsCount: 0,
      attachmentsCount: 0
    };
    taskServiceMock.updateStatus.mockClear();

    await TestBed.configureTestingModule({
      imports: [TaskDetails],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: new Map([['id', 'task-1']]) } }
        },
        { provide: TaskService, useValue: taskServiceMock },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => currentUser,
            hasPermission: () => hasTaskWritePermission
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(TaskDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('allows an assigned user to start a pending task', () => {
    expect(component.canUpdateTaskStatus()).toBe(true);
    const root = fixture.nativeElement as HTMLElement;
    const startButton = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Start Task'));

    expect(startButton).toBeTruthy();
    if (!startButton) {
      throw new Error('Start Task control was not rendered');
    }
    startButton.click();
    expect(taskServiceMock.updateStatus).toHaveBeenCalledWith('task-1', 'IN_PROGRESS');
  });

  it('allows an assigned user to complete an in-progress task', () => {
    currentTask = { ...currentTask, status: 'IN_PROGRESS' };
    fixture.destroy();
    fixture = TestBed.createComponent(TaskDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.canUpdateTaskStatus()).toBe(true);
    const root = fixture.nativeElement as HTMLElement;
    const completeButton = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Complete Task'));

    expect(completeButton).toBeTruthy();
    if (!completeButton) {
      throw new Error('Complete Task control was not rendered');
    }
    completeButton.click();
    expect(taskServiceMock.updateStatus).toHaveBeenCalledWith('task-1', 'COMPLETED');
  });

  it('does not show task status controls to an unrelated user without task write permission', () => {
    currentUser = {
      ...currentUser,
      id: 'unrelated-user'
    };
    fixture.destroy();
    fixture = TestBed.createComponent(TaskDetails);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(component.canUpdateTaskStatus()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Start Task');
  });

  it('allows the assigned user to post a comment', () => {
    component.commentText.set('Started reviewing the report.');

    component.submitComment();

    expect(component.comments()).toHaveLength(1);
    expect(component.comments()[0].body).toBe('Started reviewing the report.');
  });

  it('allows the assigned user to upload a file attachment', () => {
    const file = new File(['report'], 'brief.pdf', { type: 'application/pdf' });
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });

    component.uploadAttachments({ target: input } as unknown as Event);

    expect(component.attachments()).toHaveLength(1);
    expect(component.attachments()[0].fileName).toBe('brief.pdf');
  });
});
