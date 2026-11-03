import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal
} from '@angular/core';
import { DatePipe, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ContentSkeleton } from '../../../../core/components/content-skeleton/content-skeleton';
import { AuthService } from '../../../../core/services/auth.service';
import { TaskService } from '../../../../core/services/task.service';
import { ReminderService } from '../../../../core/services/reminder.service';
import { RequestService } from '../../../../core/services/request.service';
import { MeetingService } from '../../../../core/services/meeting.service';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-ceo-dashboard',
  standalone: true,
  imports: [RouterModule, DatePipe, ContentSkeleton],
  templateUrl: './ceo-dashboard.html',
  styleUrl: './ceo-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CeoDashboard implements OnInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private greetingTimer?: ReturnType<typeof setTimeout>;
  readonly authService = inject(AuthService);
  readonly tasks = inject(TaskService);
  readonly reminders = inject(ReminderService);
  readonly requests = inject(RequestService);
  readonly meetings = inject(MeetingService);
  readonly notifications = inject(NotificationService);
  readonly greeting = signal(this.getGreeting());

  readonly assignedTasks = computed(() => {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return [];

    return this.tasks.tasks().filter(task =>
      task.assignedTo.id === userId ||
      task.participants?.some(participant => participant.user.id === userId) === true
    );
  });

  readonly assignedReminders = computed(() => {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return [];

    return this.reminders.reminders().filter(reminder =>
      reminder.recipient.id === userId ||
      reminder.participants?.some(participant =>
        ('user' in participant ? participant.user.id : participant.id) === userId
      ) === true
    );
  });

  readonly assignedRequests = computed(() => {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return [];

    return this.requests.requests().filter(request => request.assignedTo.id === userId);
  });

  readonly assignedMeetings = computed(() => {
    const userId = this.authService.currentUser()?.id;
    if (!userId) return [];

    return this.meetings.meetings().filter(meeting =>
      meeting.organizer.id === userId ||
      meeting.participants.some(participant => participant.id === userId)
    );
  });

  retryLoad(): void {
    this.tasks.loadTasks().subscribe({
      error: error => console.error('Unable to reload dashboard tasks', error),
    });
    this.reminders.loadReminders().subscribe({
      error: error => console.error('Unable to reload dashboard reminders', error),
    });
    this.requests.loadRequests().subscribe({
      error: error => console.error('Unable to reload dashboard requests', error),
    });
    this.meetings.loadMeetings().subscribe({
      error: error => console.error('Unable to reload dashboard meetings', error),
    });
    this.notifications.loadNotifications().subscribe({
      error: error => console.error('Unable to reload dashboard notifications', error),
    });
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.scheduleGreetingUpdate();
    }
  }

  ngOnDestroy(): void {
    if (this.greetingTimer) {
      clearTimeout(this.greetingTimer);
    }
  }

  private getGreeting(): string {
    const hour = new Date().getHours();

    if (hour < 12) {
      return 'Good morning';
    }
    if (hour < 17) {
      return 'Good afternoon';
    }
    return 'Good evening';
  }

  private scheduleGreetingUpdate(): void {
    const now = new Date();
    const nextNoon = new Date(now);
    nextNoon.setHours(12, 0, 0, 0);
    const nextEvening = new Date(now);
    nextEvening.setHours(17, 0, 0, 0);
    const nextMidnight = new Date(now);
    nextMidnight.setDate(nextMidnight.getDate() + 1);
    nextMidnight.setHours(0, 0, 0, 0);

    const nextChange = [nextNoon, nextEvening, nextMidnight]
      .filter(boundary => boundary.getTime() > now.getTime())
      .sort((a, b) => a.getTime() - b.getTime())[0];

    this.greetingTimer = setTimeout(() => {
      this.greeting.set(this.getGreeting());
      this.scheduleGreetingUpdate();
    }, nextChange.getTime() - now.getTime());
  }

  readonly summary = computed(() => [
    { label: 'Pending', value: this.assignedTasks().filter(task => task.status === 'PENDING').length + this.assignedReminders().filter(reminder => reminder.status === 'PENDING').length + this.assignedRequests().filter(request => request.status === 'PENDING').length, description: 'Items awaiting action' },
    { label: 'Overdue', value: this.assignedTasks().filter(task => this.tasks.isOverdue(task)).length + this.assignedReminders().filter(reminder => this.reminders.isOverdue(reminder)).length, description: 'Require attention' },
    { label: 'Today', value: this.assignedMeetings().filter(meeting => this.meetings.isToday(meeting)).length, description: 'Scheduled today' },
    { label: 'Completed', value: this.assignedTasks().filter(task => task.status === 'COMPLETED').length + this.assignedReminders().filter(reminder => reminder.status === 'COMPLETED').length + this.assignedRequests().filter(request => request.status === 'COMPLETED').length, description: 'Completed items' }
  ]);

  readonly schedule = computed(() => {
    const assignedIds = new Set(this.assignedMeetings().map(meeting => meeting.id));
    return this.meetings.upcomingMeetings()
      .filter(meeting => assignedIds.has(meeting.id))
      .slice(0, 5)
      .map(meeting => ({
        time: this.meetings.formatTime(meeting.startTime),
        title: meeting.title,
        type: this.meetings.meetingTypeLabel(meeting.meetingType)
      }));
  });

  readonly attentionItems = computed(() => [
    ...this.assignedTasks().filter(task => this.tasks.isOverdue(task)).map(task => ({ title: task.title, type: 'Overdue Task', priority: task.priority })),
    ...this.assignedRequests().filter(request =>
      request.priority === 'URGENT' ||
      request.priority === 'HIGH' ||
      request.status === 'NEEDS_INFORMATION'
    ).map(request => ({ title: request.title, type: 'Request', priority: request.priority })),
    ...this.assignedReminders().filter(reminder => this.reminders.isOverdue(reminder)).map(reminder => ({ title: reminder.title, type: 'Overdue Reminder', priority: reminder.priority }))
  ].slice(0, 8));

  readonly pendingTasks = computed(() =>
    this.assignedTasks().filter(task => task.status === 'PENDING').slice(0, 5)
  );
  readonly upcomingReminders = computed(() =>
    this.assignedReminders()
      .filter(reminder => reminder.status === 'PENDING')
      .filter(reminder => !this.reminders.isOverdue(reminder))
      .slice(0, 5)
  );
}
