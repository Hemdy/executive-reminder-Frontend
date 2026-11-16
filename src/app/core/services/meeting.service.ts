import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { EMPTY, Observable, Subscription, catchError, finalize, of, takeUntil, tap, throwError } from 'rxjs';
import { User } from '../models/user.model';
import { CreateMeetingRequest, Meeting, MeetingAttachment, MeetingComment, MeetingStatus, MeetingType, UpdateMeetingRequest } from '../models/meeting.model';
import { API_BASE_URL } from '../config/api.config';
import { sortMeetingsDesc } from '../utils/date-sort';
import {
  bindAuthSessionLifecycle,
  currentAuthSessionVersion,
  isSameAuthSession,
  sessionEndedStream,
} from '../utils/session-scope';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class MeetingService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = `${API_BASE_URL}/meetings`;
  private readonly meetingsSignal = signal<Meeting[]>([]);
  readonly meetings = this.meetingsSignal.asReadonly();
  readonly listLoading = signal(false);
  readonly listError = signal('');
  readonly scheduledMeetings = computed(() => this.meetingsSignal().filter(meeting => meeting.status === 'SCHEDULED' || meeting.status === 'RESCHEDULED'));
  readonly completedMeetings = computed(() => this.meetingsSignal().filter(meeting => meeting.status === 'COMPLETED'));
  readonly cancelledMeetings = computed(() => this.meetingsSignal().filter(meeting => meeting.status === 'CANCELLED'));
  readonly upcomingMeetings = computed(() => this.scheduledMeetings().filter(meeting => this.getMeetingStart(meeting).getTime() >= Date.now()).sort((a, b) => this.getMeetingStart(a).getTime() - this.getMeetingStart(b).getTime()));
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
        this.activeLoadSubscription = this.loadMeetings().subscribe({
          error: error => console.error('Unable to load meetings', error),
        });
      },
    });

    this.destroyRef.onDestroy(() => {
      this.activeLoadSubscription?.unsubscribe();
    });
  }

  getMeetings(): Meeting[] { return this.meetingsSignal(); }
  getMeeting(id: string): Meeting | undefined { return this.meetingsSignal().find(meeting => meeting.id === id); }
  loadMeeting(id: string): Observable<Meeting> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.get<Meeting>(`${this.apiUrl}/${id}`).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(meeting => {
        if (!isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          return;
        }
        const normalized = this.normalize(meeting);
        this.meetingsSignal.update(meetings => sortMeetingsDesc(
          meetings.some(item => item.id === normalized.id)
            ? meetings.map(item => item.id === normalized.id ? normalized : item)
            : [normalized, ...meetings]
        ));
      })
    );
  }
  loadMeetings(): Observable<Meeting[]> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    if (!expectedUserId) {
      this.resetState();
      return of([]);
    }

    const requestSeq = ++this.loadSequence;
    this.listLoading.set(true);
    this.listError.set('');
    return this.http.get<Meeting[]>(this.apiUrl).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(meetings => {
        if (requestSeq !== this.loadSequence || !isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          return;
        }
        this.meetingsSignal.set(sortMeetingsDesc(meetings.map(meeting => this.normalize(meeting))));
      }),
      catchError(error => {
        if (requestSeq !== this.loadSequence || !isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          return EMPTY;
        }
        this.listError.set('Unable to load meetings. Please try again.');
        return throwError(() => error);
      }),
      finalize(() => {
        if (requestSeq === this.loadSequence && isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.listLoading.set(false);
        }
      })
    );
  }
  createMeeting(request: CreateMeetingRequest, _organizer?: User, _participants?: User[]): Observable<Meeting> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.post<Meeting>(this.apiUrl, request).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(meeting => {
        if (isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.meetingsSignal.update(meetings => sortMeetingsDesc([this.normalize(meeting), ...meetings]));
        }
      })
    );
  }
  updateMeeting(id: string, request: UpdateMeetingRequest, _participants?: User[]): Observable<Meeting> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.patch<Meeting>(`${this.apiUrl}/${id}`, request).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(meeting => {
        if (isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.replace(this.normalize(meeting));
        }
      })
    );
  }
  updateStatus(id: string, status: MeetingStatus): Observable<Meeting> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.patch<Meeting>(`${this.apiUrl}/${id}/status`, { status }).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(meeting => {
        if (isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.replace(this.normalize(meeting));
        }
      })
    );
  }
  getComments(meetingId: string): Observable<MeetingComment[]> {
    return this.http.get<MeetingComment[]>(`${this.apiUrl}/${meetingId}/comments`);
  }
  addComment(meetingId: string, body: string): Observable<MeetingComment> {
    return this.http.post<MeetingComment>(`${this.apiUrl}/${meetingId}/comments`, { body });
  }
  updateComment(meetingId: string, commentId: string, body: string): Observable<MeetingComment> {
    return this.http.patch<MeetingComment>(
      `${this.apiUrl}/${meetingId}/comments/${commentId}`,
      { body }
    );
  }
  getAttachments(meetingId: string): Observable<MeetingAttachment[]> {
    return this.http.get<MeetingAttachment[]>(`${this.apiUrl}/${meetingId}/attachments`);
  }
  uploadAttachment(meetingId: string, file: File): Observable<MeetingAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<MeetingAttachment>(`${this.apiUrl}/${meetingId}/attachments`, formData);
  }
  downloadAttachment(meetingId: string, attachmentId: string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/${meetingId}/attachments/${attachmentId}`, {
      responseType: 'blob'
    });
  }
  deleteAttachment(meetingId: string, attachmentId: string): Observable<{ id: string; deleted: boolean }> {
    return this.http.delete<{ id: string; deleted: boolean }>(
      `${this.apiUrl}/${meetingId}/attachments/${attachmentId}`
    );
  }
  deleteMeeting(id: string): Observable<void> {
    const expectedUserId = this.auth.currentUser()?.id ?? null;
    const expectedSession = currentAuthSessionVersion(this.auth);
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      takeUntil(sessionEndedStream(this.auth)),
      tap(() => {
        if (isSameAuthSession(this.auth, expectedUserId, expectedSession)) {
          this.meetingsSignal.update(meetings => meetings.filter(meeting => meeting.id !== id));
        }
      })
    );
  }

  private resetState(): void {
    this.loadSequence += 1;
    this.activeLoadSubscription?.unsubscribe();
    this.activeLoadSubscription = null;
    this.meetingsSignal.set([]);
    this.listError.set('');
    this.listLoading.set(false);
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
  private normalize(meeting: Meeting): Meeting {
    return {
      ...meeting,
      meetingDate: meeting.meetingDate.slice(0, 10),
      commentsCount: meeting._count?.comments ?? meeting.commentsCount ?? 0,
      attachmentsCount: meeting._count?.attachments ?? meeting.attachmentsCount ?? 0,
      participants: meeting.participants?.map((participant: User | { user: User }) => 'user' in participant ? participant.user : participant) ?? []
    };
  }
  private replace(meeting: Meeting): void { this.meetingsSignal.update(meetings => sortMeetingsDesc(meetings.map(existing => existing.id === meeting.id ? meeting : existing))); }
}
