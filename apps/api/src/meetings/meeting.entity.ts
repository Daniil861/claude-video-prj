export interface Meeting {
  id: string;
  ownerId: string;
  title: string;
  /** Scheduled start, ISO 8601 string. */
  startsAt: string;
  durationMinutes: number;
}

export interface CreateMeetingInput {
  ownerId: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
}

export interface MeetingsPage {
  items: Meeting[];
  total: number;
}
