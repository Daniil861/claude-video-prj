import { Injectable, OnModuleInit } from '@nestjs/common';
import type { CreateMeetingInput, Meeting, MeetingsPage } from './meeting.entity';

const DEFAULT_LIMIT = 3;

const SEED_MEETINGS: CreateMeetingInput[] = [
  {
    ownerId: 'usr_1',
    title: 'Weekly sync',
    startsAt: '2026-08-24T09:00:00.000Z',
    durationMinutes: 30,
  },
  {
    ownerId: 'usr_1',
    title: 'Product review',
    startsAt: '2026-08-21T13:30:00.000Z',
    durationMinutes: 60,
  },
  {
    ownerId: 'usr_1',
    title: 'Design handoff',
    startsAt: '2026-08-19T15:00:00.000Z',
    durationMinutes: 45,
  },
  {
    ownerId: 'usr_1',
    title: 'Retrospective',
    startsAt: '2026-08-14T11:00:00.000Z',
    durationMinutes: 60,
  },
  {
    ownerId: 'usr_2',
    title: 'Onboarding call',
    startsAt: '2026-08-20T08:00:00.000Z',
    durationMinutes: 30,
  },
];

/**
 * In-memory meeting store. Swap the internals for a database repository later —
 * consumers only depend on the query methods below.
 */
@Injectable()
export class MeetingsService implements OnModuleInit {
  private meetings: Meeting[] = [];
  private nextId = 1;

  onModuleInit(): void {
    this.reset();
    for (const meeting of SEED_MEETINGS) {
      this.create(meeting);
    }
  }

  /** Drops every stored meeting. Used by the seed step and by tests. */
  reset(): void {
    this.meetings = [];
    this.nextId = 1;
  }

  create(input: CreateMeetingInput): Meeting {
    const meeting: Meeting = { id: `mtg_${this.nextId++}`, ...input };
    this.meetings.push(meeting);
    return meeting;
  }

  findRecentByUser(ownerId: string, limit: number = DEFAULT_LIMIT): Meeting[] {
    return this.meetings
      .filter((meeting) => meeting.ownerId === ownerId)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
      .slice(0, limit);
  }

  countByUser(ownerId: string): number {
    return this.meetings.filter((meeting) => meeting.ownerId === ownerId).length;
  }

  findPageByUser(ownerId: string, limit: number = DEFAULT_LIMIT): MeetingsPage {
    return {
      items: this.findRecentByUser(ownerId, limit),
      total: this.countByUser(ownerId),
    };
  }
}
