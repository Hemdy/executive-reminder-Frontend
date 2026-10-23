import { User } from '../../..../../core/models/user.model';

export type MeetingType =
  | 'IN_PERSON'
  | 'ONLINE'
  | 'PHONE'
  | 'HYBRID';

export type MeetingStatus =
  | 'SCHEDULED'
  | 'RESCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface Meeting {
  id: string;

  title: string;
  description?: string;
  agenda?: string;

  organizer: User;
  participants: User[];

  meetingDate: string;
  startTime: string;
  endTime: string;

  location?: string;
  meetingType: MeetingType;

  status: MeetingStatus;

  createdAt: string;
  updatedAt: string;

  commentsCount: number;
  attachmentsCount: number;
  _count?: {
    comments: number;
    attachments: number;
  };
}

export interface MeetingComment {
  id: string;
  body: string;
  createdAt: string;
  author: Pick<User, 'id' | 'title' | 'firstName' | 'lastName'>;
}

export interface MeetingAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  uploader: Pick<User, 'id' | 'firstName' | 'lastName'>;
}

export interface CreateMeetingRequest {
  title: string;
  description?: string;
  agenda?: string;
  participantIds: string[];
  meetingDate: string;
  startTime: string;
  endTime: string;
  location?: string;
  meetingType: MeetingType;
}

export interface UpdateMeetingRequest {
  title: string;
  description?: string;
  agenda?: string;
  participantIds: string[];
  meetingDate: string;
  startTime: string;
  endTime: string;
  location?: string;
  meetingType: MeetingType;
  status: MeetingStatus;
}