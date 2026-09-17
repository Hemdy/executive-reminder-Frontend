import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { User } from '../models/user.model';
import { CreateMeetingRequest, Meeting, MeetingStatus, MeetingType, UpdateMeetingRequest } from '../models/meeting.model';
import { API_BASE_URL } from '../config/api.config';

@Injectable({ providedIn: 'root' })
export class MeetingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${API_BASE_URL}/meetings`;
  private readonly meetingsSignal = signal<Meeting[]>([]);
  readonly meetings = this.meetingsSignal.asReadonly();
  readonly scheduledMeetings = computed(() => this.meetingsSignal().filter(meeting => meeting.status === 'SCHEDULED' || meeting.status === 'RESCHEDULED'));
  readonly completedMeetings = computed(() => this.meetingsSignal().filter(meeting => meeting.status === 'COMPLETED'));
  readonly cancelledMeetings = computed(() => this.meetingsSignal().filter(meeting => meeting.status === 'CANCELLED'));
  readonly upcomingMeetings = computed(() => this.scheduledMeetings().filter(meeting => this.getMeetingStart(meeting).getTime() >= Date.now()).sort((a, b) => this.getMeetingStart(a).getTime() - this.getMeetingStart(b).getTime()));

  constructor() {
    this.loadMeetings().subscribe({ error: error => console.error('Unable to load meetings', error) });
  }

  getMeetings(): Meeting[] { return this.meetingsSignal(); }
  getMeeting(id: string): Meeting | undefined { return this.meetingsSignal().find(meeting => meeting.id === id); }
  loadMeeting(id: string): Observable<Meeting> {
    return this.http.get<Meeting>(`${this.apiUrl}/${id}`).pipe(tap(meeting => {
      const normalized = this.normalize(meeting);
      this.meetingsSignal.update(meetings => meetings.some(item => item.id === normalized.id)
        ? meetings.map(item => item.id === normalized.id ? normalized : item)
        : [normalized, ...meetings]);
    }));
  }
  loadMeetings(): Observable<Meeting[]> {
    return this.http.get<Meeting[]>(this.apiUrl).pipe(tap(meetings => this.meetingsSignal.set(meetings.map(meeting => this.normalize(meeting)))));
  }
  createMeeting(request: CreateMeetingRequest, _organizer?: User, _participants?: User[]): Observable<Meeting> {
    return this.http.post<Meeting>(this.apiUrl, request).pipe(tap(meeting => this.meetingsSignal.update(meetings => [this.normalize(meeting), ...meetings])));
  }
  updateMeeting(id: string, request: UpdateMeetingRequest, _participants?: User[]): Observable<Meeting> {
    return this.http.patch<Meeting>(`${this.apiUrl}/${id}`, request).pipe(tap(meeting => this.replace(this.normalize(meeting))));
  }
  updateStatus(id: string, status: MeetingStatus): Observable<Meeting> {
    return this.http.patch<Meeting>(`${this.apiUrl}/${id}/status`, { status }).pipe(tap(meeting => this.replace(this.normalize(meeting))));
  }
  deleteMeeting(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(tap(() => this.meetingsSignal.update(meetings => meetings.filter(meeting => meeting.id !== id))));
  }
  isPast(meeting: Meeting): boolean {
    return !['COMPLETED', 'CANCELLED'].includes(meeting.status) && this.getMeetingEnd(meeting).getTime() < Date.now();
  }
  isToday(meeting: Meeting): boolean { return meeting.meetingDate.slice(0, 10) === this.toDateInputValue(new Date()); }
  formatDate(date: string): string { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date.slice(0, 10)}T00:00:00`)); }
  formatTime(time: string): string { const [hours, minutes] = time.split(':').map(Number); const date = new Date(); date.setHours(hours, minutes, 0, 0); return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date); }
  meetingTypeLabel(type: MeetingType): string { return type.replace('_', ' '); }
  meetingStatusLabel(status: MeetingStatus): string { return status.replace('_', ' '); }
  private getMeetingStart(meeting: Meeting): Date { return new Date(`${meeting.meetingDate.slice(0, 10)}T${meeting.startTime}:00`); }
  private getMeetingEnd(meeting: Meeting): Date { return new Date(`${meeting.meetingDate.slice(0, 10)}T${meeting.endTime}:00`); }
  private toDateInputValue(date: Date): string { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
  private normalize(meeting: Meeting): Meeting { return { ...meeting, meetingDate: meeting.meetingDate.slice(0, 10), participants: meeting.participants?.map((participant: User | { user: User }) => 'user' in participant ? participant.user : participant) ?? [] }; }
  private replace(meeting: Meeting): void { this.meetingsSignal.update(meetings => meetings.map(existing => existing.id === meeting.id ? meeting : existing)); }
}
