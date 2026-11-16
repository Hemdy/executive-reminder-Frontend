import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY, Observable, Subscription, catchError, finalize, of, takeUntil, tap, throwError } from 'rxjs';
import { User } from '../models/user.model';
import {
  CreateTaskRequest,
  Task,
  TaskAttachment,
  TaskComment,
  TaskStatus,
  UpdateTaskRequest
} from '../models/task.model';
import { API_BASE_URL } from '../config/api.config';
import { sortTasksDesc } from '../utils/date-sort';
import {
  bindAuthSessionLifecycle,
  currentAuthSessionVersion,
  isSameAuthSession,
  sessionEndedStream,
} from '../utils/session-scope';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = `${API_BASE_URL}/tasks`;
  private readonly tasksSignal = signal<Task[]>([]);
  readonly tasks = this.tasksSignal.asReadonly();
  readonly listLoading = signal(false);
  readonly listError = signal('');
  readonly pendingTasks = computed(() => this.tasksSignal().filter(task => task.status === 'PENDING'));
  readonly inProgressTasks = computed(() => this.tasksSignal().filter(task => task.status === 'IN_PROGRESS'));
  readonly completedTasks = computed(() =>
    this.tasksSignal().filter(task => task.status === 'COMPLETED' || task.status === 'CLOSED')
  );
  private loadSequence = 0;
  private activeLoadSubscription: Subscription | null = null;

  constructor() {
    bindAuthSessionLifecycle(this.auth, this.destroyRef, {
      onClear: () => this.resetState(),
      onUserChange: userId => {
        this.resetState();
        if (!userId) {
          return;
        }
        this.activeLoadSubscription = this.loadTasks().subscribe({
          error: error => console.error('Unable to load tasks', error),
        });
      },
    });

    this.destroyRef.onDestroy(() => {
      this.activeLoadSubscription?.unsubscribe();
    });
  }

  getTasks(): Task[] { return this.tasksSignal(); }
  getTask(id: string): Task | undefined { return this.tasksSignal().find(task => task.id === id); }
  loadTask(id: string): Observable<Task> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.get<Task>(`${this.apiUrl}/${id}`).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(task => {
        if (!isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          return;
        }
        const normalized = this.normalize(task);
        this.tasksSignal.update(tasks => sortTasksDesc(
          tasks.some(item => item.id === normalized.id)
            ? tasks.map(item => item.id === normalized.id ? normalized : item)
            : [normalized, ...tasks]
        ));
      })
    );
  }

  loadTasks(): Observable<Task[]> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    if (!expectedUserId) {
      this.resetState();
      return of([]);
    }

    const requestSeq = ++this.loadSequence;
    this.listLoading.set(true);
    this.listError.set('');
    return this.http.get<Task[]>(this.apiUrl).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(tasks => {
        if (requestSeq !== this.loadSequence || !isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          return;
        }
        this.tasksSignal.set(sortTasksDesc(tasks.map(task => this.normalize(task))));
      }),
      catchError(error => {
        if (requestSeq !== this.loadSequence || !isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          return EMPTY;
        }
        this.listError.set('Unable to load tasks. Please try again.');
        return throwError(() => error);
      }),
      finalize(() => {
        if (requestSeq === this.loadSequence && isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.listLoading.set(false);
        }
      })
    );
  }

  createTask(request: CreateTaskRequest, _assignedTo?: User, _createdBy?: User): Observable<Task> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.post<Task>(this.apiUrl, request).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(task => {
        if (isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.tasksSignal.update(tasks => sortTasksDesc([this.normalize(task), ...tasks]));
        }
      })
    );
  }

  updateTask(id: string, request: UpdateTaskRequest, _assignedTo?: User): Observable<Task> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.patch<Task>(`${this.apiUrl}/${id}`, request).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(task => {
        if (isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.replace(this.normalize(task));
        }
      })
    );
  }

  updateStatus(id: string, status: TaskStatus): Observable<Task> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.patch<Task>(`${this.apiUrl}/${id}/status`, { status }).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(task => {
        if (isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.replace(this.normalize(task));
        }
      })
    );
  }

  getComments(taskId: string): Observable<TaskComment[]> {
    return this.http.get<TaskComment[]>(`${this.apiUrl}/${taskId}/comments`);
  }

  addComment(taskId: string, body: string): Observable<TaskComment> {
    return this.http.post<TaskComment>(`${this.apiUrl}/${taskId}/comments`, { body });
  }

  updateComment(taskId: string, commentId: string, body: string): Observable<TaskComment> {
    return this.http.patch<TaskComment>(`${this.apiUrl}/${taskId}/comments/${commentId}`, { body });
  }

  getAttachments(taskId: string): Observable<TaskAttachment[]> {
    return this.http.get<TaskAttachment[]>(`${this.apiUrl}/${taskId}/attachments`);
  }

  uploadAttachment(taskId: string, file: File): Observable<TaskAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<TaskAttachment>(`${this.apiUrl}/${taskId}/attachments`, formData);
  }

  downloadAttachment(taskId: string, attachmentId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${taskId}/attachments/${attachmentId}`, {
      responseType: 'blob'
    });
  }

  deleteAttachment(taskId: string, attachmentId: string): Observable<{ id: string; deleted: boolean }> {
    return this.http.delete<{ id: string; deleted: boolean }>(
      `${this.apiUrl}/${taskId}/attachments/${attachmentId}`
    );
  }

  deleteTask(id: string): Observable<void> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(() => {
        if (isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.tasksSignal.update(tasks => tasks.filter(task => task.id !== id));
        }
      })
    );
  }

  private resetState(): void {
    this.loadSequence += 1;
    this.activeLoadSubscription?.unsubscribe();
    this.activeLoadSubscription = null;
    this.tasksSignal.set([]);
    this.listError.set('');
    this.listLoading.set(false);
  }

  isOverdue(task: Task): boolean {
    if (task.status === 'COMPLETED' || task.status === 'CLOSED' || task.status === 'CANCELLED') return false;
    return new Date(`${task.dueDate}T${task.dueTime || '23:59'}`).getTime() < Date.now();
  }

  private replace(task: Task): void {
    this.tasksSignal.update(tasks => sortTasksDesc(tasks.map(existing => existing.id === task.id ? task : existing)));
  }
  private normalize(task: Task): Task {
    return {
      ...task,
      dueDate: task.dueDate.slice(0, 10),
      commentsCount: task._count?.comments ?? task.commentsCount ?? 0,
      attachmentsCount: task._count?.attachments ?? task.attachmentsCount ?? 0
    };
  }
}
