export interface Meeting {
  id: string;
  ownerId: string;
  title: string;
  /** Scheduled start, ISO 8601 string. */
  startsAt: string;
  durationMinutes: number;
  /** Invitee emails, lowercased and unique. Visible to the owner only. */
  participants: string[];
}

export interface CreateMeetingInput {
  ownerId: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
  participants: string[];
}

export interface MeetingsPage {
  items: Meeting[];
  total: number;
}
