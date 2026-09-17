import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { TaskService } from '../../../../core/services/task.service';
import { ReminderService } from '../../../../core/services/reminder.service';
import { RequestService } from '../../../../core/services/request.service';
import { MeetingService } from '../../../../core/services/meeting.service';
import { NotificationService } from '../../../../core/services/notification.service';

@Component({
  selector: 'app-ceo-dashboard',
  standalone: true,
  imports: [RouterModule, DatePipe],
  templateUrl: './ceo-dashboard.html',
  styleUrl: './ceo-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CeoDashboard implements OnInit {
  readonly authService = inject(AuthService);
  readonly tasks = inject(TaskService);
  readonly reminders = inject(ReminderService);
  readonly requests = inject(RequestService);
  readonly meetings = inject(MeetingService);
  readonly notifications = inject(NotificationService);

  ngOnInit(): void {
    this.tasks.loadTasks().subscribe();
    this.reminders.loadReminders().subscribe();
    this.meetings.loadMeetings().subscribe();
    this.notifications.loadNotifications().subscribe();
  }

  readonly summary = computed(() => [
    { label: 'Pending', value: this.tasks.pendingTasks().length + this.reminders.pendingReminders().length + this.requests.pendingRequests().length, description: 'Items awaiting action' },
    { label: 'Overdue', value: this.tasks.tasks().filter(task => this.tasks.isOverdue(task)).length + this.reminders.reminders().filter(reminder => this.reminders.isOverdue(reminder)).length, description: 'Require attention' },
    { label: 'Today', value: this.meetings.meetings().filter(meeting => this.meetings.isToday(meeting)).length, description: 'Scheduled today' },
    { label: 'Completed', value: this.tasks.completedTasks().length + this.reminders.completedReminders().length + this.requests.completedRequests().length, description: 'Completed items' }
  ]);

  readonly schedule = computed(() => this.meetings.upcomingMeetings().slice(0, 5).map(meeting => ({
    time: this.meetings.formatTime(meeting.startTime),
    title: meeting.title,
    type: this.meetings.meetingTypeLabel(meeting.meetingType)
  })));

  readonly attentionItems = computed(() => [
    ...this.tasks.tasks().filter(task => this.tasks.isOverdue(task)).map(task => ({ title: task.title, type: 'Overdue Task', priority: task.priority })),
    ...this.requests.attentionRequests().map(request => ({ title: request.title, type: 'Request', priority: request.priority })),
    ...this.reminders.reminders().filter(reminder => this.reminders.isOverdue(reminder)).map(reminder => ({ title: reminder.title, type: 'Overdue Reminder', priority: reminder.priority }))
  ].slice(0, 8));

  readonly pendingTasks = computed(() => this.tasks.pendingTasks().slice(0, 5));
  readonly upcomingReminders = computed(() =>
    this.reminders.pendingReminders()
      .filter(reminder => !this.reminders.isOverdue(reminder))
      .slice(0, 5)
  );
}
