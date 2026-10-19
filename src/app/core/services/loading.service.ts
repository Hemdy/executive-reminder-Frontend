import { computed, Injectable, signal } from '@angular/core';

interface LoadingTask {
  id: number;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class LoadingService {
  private nextTaskId = 0;
  private readonly tasks = signal<LoadingTask[]>([]);

  readonly isLoading = computed(() => this.tasks().length > 0);
  readonly message = computed(() => this.tasks().at(-1)?.message ?? 'Loading...');

  begin(message: string): number {
    const id = this.nextTaskId++;
    this.tasks.update(tasks => [...tasks, { id, message }]);
    return id;
  }

  end(id: number): void {
    this.tasks.update(tasks => tasks.filter(task => task.id !== id));
  }
}
