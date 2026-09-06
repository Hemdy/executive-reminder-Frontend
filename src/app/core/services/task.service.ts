import { Injectable, computed, signal } from '@angular/core';
import { User } from '../../core/models/user.model';
import {
  CreateTaskRequest,
  Task,
  TaskPriority,
  TaskStatus,
  UpdateTaskRequest
} from '../models/task.model';

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private readonly tasksSignal = signal<Task[]>([]);

  readonly tasks = this.tasksSignal.asReadonly();

  readonly pendingTasks = computed(() =>
    this.tasksSignal().filter(task => task.status === 'PENDING')
  );

  readonly inProgressTasks = computed(() =>
    this.tasksSignal().filter(task => task.status === 'IN_PROGRESS')
  );

  readonly completedTasks = computed(() =>
    this.tasksSignal().filter(task => task.status === 'COMPLETED')
  );

  constructor() {
    this.loadMockTasks();
  }

  getTasks(): Task[] {
    return this.tasksSignal();
  }

  getTask(id: string): Task | undefined {
    return this.tasksSignal().find(task => task.id === id);
  }

  createTask(
    request: CreateTaskRequest,
    assignedTo: User,
    createdBy: User
  ): Task {
    const now = new Date().toISOString();

    const task: Task = {
      id: crypto.randomUUID(),

      title: request.title,
      description: request.description,

      assignedTo,
      createdBy,

      priority: request.priority,
      category: request.category,

      dueDate: request.dueDate,
      dueTime: request.dueTime,

      status: 'PENDING',

      createdAt: now,
      updatedAt: now,

      commentsCount: 0,
      attachmentsCount: 0
    };

    this.tasksSignal.update(tasks => [task, ...tasks]);

    return task;
  }

  updateTask(
    id: string,
    request: UpdateTaskRequest,
    assignedTo: User
  ): void {
    this.tasksSignal.update(tasks =>
      tasks.map(task =>
        task.id === id
          ? {
              ...task,
              title: request.title,
              description: request.description,
              assignedTo,
              priority: request.priority,
              category: request.category,
              dueDate: request.dueDate,
              dueTime: request.dueTime,
              status: request.status,
              updatedAt: new Date().toISOString()
            }
          : task
      )
    );
  }

  updateStatus(id: string, status: TaskStatus): void {
    this.tasksSignal.update(tasks =>
      tasks.map(task =>
        task.id === id
          ? {
              ...task,
              status,
              updatedAt: new Date().toISOString()
            }
          : task
      )
    );
  }

  deleteTask(id: string): void {
    this.tasksSignal.update(tasks =>
      tasks.filter(task => task.id !== id)
    );
  }

  isOverdue(task: Task): boolean {
    if (
      task.status === 'COMPLETED' ||
      task.status === 'CANCELLED'
    ) {
      return false;
    }

    const dueDateTime = this.getDueDateTime(task);

    return dueDateTime.getTime() < Date.now();
  }

  private getDueDateTime(task: Task): Date {
    const time = task.dueTime || '23:59';

    return new Date(`${task.dueDate}T${time}`);
  }

  private loadMockTasks(): void {
    const ceo: User = {
      id: 'user-ceo',
      firstName: 'Michael',
      lastName: 'Anderson',
      email: 'ceo@exectrack.local',
      role: 'CEO'
    };

    const john: User = {
      id: 'user-employee',
      firstName: 'John',
      lastName: 'Doe',
      email: 'employee@exectrack.local',
      role: 'EMPLOYEE',
      department: 'Operations'
    };

    const sarah: User = {
      id: 'user-assistant',
      firstName: 'Sarah',
      lastName: 'Williams',
      email: 'assistant@exectrack.local',
      role: 'EXECUTIVE_ASSISTANT'
    };

    const now = new Date();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const inThreeDays = new Date(now);
    inThreeDays.setDate(inThreeDays.getDate() + 3);

    this.tasksSignal.set([
      {
        id: 'task-001',
        title: 'Review Q3 Financial Report',
        description:
          'Review the final Q3 financial report and provide comments before the executive meeting.',
        assignedTo: ceo,
        createdBy: sarah,
        priority: 'HIGH',
        category: 'Finance',
        dueDate: this.formatDate(yesterday),
        dueTime: '16:00',
        status: 'PENDING',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        commentsCount: 4,
        attachmentsCount: 2
      },
      {
        id: 'task-002',
        title: 'Prepare Board Meeting Agenda',
        description:
          'Prepare and circulate the agenda for the upcoming board meeting.',
        assignedTo: sarah,
        createdBy: ceo,
        priority: 'URGENT',
        category: 'Meetings',
        dueDate: this.formatDate(now),
        dueTime: '14:00',
        status: 'IN_PROGRESS',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        commentsCount: 2,
        attachmentsCount: 1
      },
      {
        id: 'task-003',
        title: 'Office Equipment Inventory',
        description:
          'Complete the inventory of office equipment and submit the updated list.',
        assignedTo: john,
        createdBy: sarah,
        priority: 'MEDIUM',
        category: 'Operations',
        dueDate: this.formatDate(tomorrow),
        dueTime: '12:00',
        status: 'PENDING',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        commentsCount: 0,
        attachmentsCount: 0
      },
      {
        id: 'task-004',
        title: 'Review Annual Contract',
        description:
          'Review the annual supplier contract and identify any items requiring renegotiation.',
        assignedTo: ceo,
        createdBy: sarah,
        priority: 'MEDIUM',
        category: 'Legal',
        dueDate: this.formatDate(inThreeDays),
        dueTime: '10:00',
        status: 'PENDING',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        commentsCount: 1,
        attachmentsCount: 1
      },
      {
        id: 'task-005',
        title: 'Approve Laptop Purchase',
        description:
          'Approve the laptop purchase request for the new operations team members.',
        assignedTo: ceo,
        createdBy: john,
        priority: 'URGENT',
        category: 'Approval',
        dueDate: this.formatDate(now),
        dueTime: '17:00',
        status: 'COMPLETED',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        commentsCount: 3,
        attachmentsCount: 2
      }
    ]);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}