import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { User } from '../models/user.model';
import { CreateTaskRequest, Task, TaskStatus, UpdateTaskRequest } from '../models/task.model';
import { API_BASE_URL } from '../config/api.config';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_BASE_URL}/tasks`;
  private readonly tasksSignal = signal<Task[]>([]);
  readonly tasks = this.tasksSignal.asReadonly();
  readonly pendingTasks = computed(() => this.tasksSignal().filter(task => task.status === 'PENDING'));
  readonly inProgressTasks = computed(() => this.tasksSignal().filter(task => task.status === 'IN_PROGRESS'));
  readonly completedTasks = computed(() => this.tasksSignal().filter(task => task.status === 'COMPLETED'));

  constructor() {
    this.loadTasks().subscribe({ error: error => console.error('Unable to load tasks', error) });
  }

  getTasks(): Task[] { return this.tasksSignal(); }
  getTask(id: string): Task | undefined { return this.tasksSignal().find(task => task.id === id); }
  loadTask(id: string): Observable<Task> {
    return this.http.get<Task>(`${this.apiUrl}/${id}`).pipe(tap(task => {
      const normalized = this.normalize(task);
      this.tasksSignal.update(tasks => tasks.some(item => item.id === normalized.id)
        ? tasks.map(item => item.id === normalized.id ? normalized : item)
        : [normalized, ...tasks]);
    }));
  }

  loadTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(this.apiUrl).pipe(tap(tasks => this.tasksSignal.set(tasks.map(task => this.normalize(task)))));
  }

  createTask(request: CreateTaskRequest, _assignedTo?: User, _createdBy?: User): Observable<Task> {
    return this.http.post<Task>(this.apiUrl, request).pipe(tap(task => this.tasksSignal.update(tasks => [this.normalize(task), ...tasks])));
  }

  updateTask(id: string, request: UpdateTaskRequest, _assignedTo?: User): Observable<Task> {
    return this.http.patch<Task>(`${this.apiUrl}/${id}`, request).pipe(tap(task => this.replace(this.normalize(task))));
  }

  updateStatus(id: string, status: TaskStatus): Observable<Task> {
    return this.http.patch<Task>(`${this.apiUrl}/${id}/status`, { status }).pipe(tap(task => this.replace(this.normalize(task))));
  }

  deleteTask(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(tap(() => this.tasksSignal.update(tasks => tasks.filter(task => task.id !== id))));
  }

  isOverdue(task: Task): boolean {
    if (task.status === 'COMPLETED' || task.status === 'CANCELLED') return false;
    return new Date(`${task.dueDate}T${task.dueTime || '23:59'}`).getTime() < Date.now();
  }

  private replace(task: Task): void {
    this.tasksSignal.update(tasks => tasks.map(existing => existing.id === task.id ? task : existing));
  }
  private normalize(task: Task): Task {
    return { ...task, dueDate: task.dueDate.slice(0, 10) };
  }
}
