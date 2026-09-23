import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Meeting as MeetingRow } from '@prisma/client';
import type { CreateMeetingInput, Meeting, MeetingsPage } from './meeting.entity';

/** Meetings are stored in Postgres; consumers only depend on the methods below. */
@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateMeetingInput): Promise<Meeting> {
    const row = await this.prisma.meeting.create({
      data: {
        ...input,
        startsAt: new Date(input.startsAt),
        participants: normalizeParticipants(input.participants),
      },
    });

    return toMeeting(row);
  }

  /** Newest first; without a limit returns every meeting of the owner. */
  async findRecentByUser(ownerId: string, limit?: number): Promise<Meeting[]> {
    const rows = await this.prisma.meeting.findMany({
      where: { ownerId },
      orderBy: { startsAt: 'desc' },
      take: limit,
    });

    return rows.map(toMeeting);
  }

  /**
   * Somebody else's meeting is reported exactly like a missing one, so the
   * response does not reveal which ids exist.
   */
  async findOneByUser(ownerId: string, id: string): Promise<Meeting> {
    const row = await this.prisma.meeting.findFirst({ where: { id, ownerId } });

    if (!row) {
      throw new NotFoundException('Встреча не найдена');
    }

    return toMeeting(row);
  }

  countByUser(ownerId: string): Promise<number> {
    return this.prisma.meeting.count({ where: { ownerId } });
  }

  async findPageByUser(ownerId: string, limit?: number): Promise<MeetingsPage> {
    const [items, total] = await Promise.all([
      this.findRecentByUser(ownerId, limit),
      this.countByUser(ownerId),
    ]);

    return { items, total };
  }
}

/** Emails are case-insensitive: store them lowercased, keeping the first occurrence. */
function normalizeParticipants(emails: string[]): string[] {
  return [...new Set(emails.map((email) => email.trim().toLowerCase()))];
}

/** The API contract exposes startsAt as an ISO string, the column is a timestamp. */
function toMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    startsAt: row.startsAt.toISOString(),
    durationMinutes: row.durationMinutes,
    participants: row.participants,
  };
}
