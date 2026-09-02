import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Meeting as MeetingRow } from '@prisma/client';
import type { CreateMeetingInput, Meeting, MeetingsPage } from './meeting.entity';

const DEFAULT_LIMIT = 3;

/** Meetings are stored in Postgres; consumers only depend on the methods below. */
@Injectable()
export class MeetingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateMeetingInput): Promise<Meeting> {
    const row = await this.prisma.meeting.create({
      data: { ...input, startsAt: new Date(input.startsAt) },
    });

    return toMeeting(row);
  }

  async findRecentByUser(ownerId: string, limit: number = DEFAULT_LIMIT): Promise<Meeting[]> {
    const rows = await this.prisma.meeting.findMany({
      where: { ownerId },
      orderBy: { startsAt: 'desc' },
      take: limit,
    });

    return rows.map(toMeeting);
  }

  countByUser(ownerId: string): Promise<number> {
    return this.prisma.meeting.count({ where: { ownerId } });
  }

  async findPageByUser(ownerId: string, limit: number = DEFAULT_LIMIT): Promise<MeetingsPage> {
    const [items, total] = await Promise.all([
      this.findRecentByUser(ownerId, limit),
      this.countByUser(ownerId),
    ]);

    return { items, total };
  }
}

/** The API contract exposes startsAt as an ISO string, the column is a timestamp. */
function toMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    startsAt: row.startsAt.toISOString(),
    durationMinutes: row.durationMinutes,
  };
}
