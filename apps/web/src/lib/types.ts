export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Meeting {
  id: string;
  ownerId: string;
  title: string;
  /** Scheduled start, ISO 8601 string. */
  startsAt: string;
  durationMinutes: number;
}

export interface MeetingsPage {
  items: Meeting[];
  total: number;
}
