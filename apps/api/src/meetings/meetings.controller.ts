import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Meeting, MeetingsPage } from './meeting.entity';
import type { JwtPayload } from '../auth/jwt-payload.interface';

const MAX_LIMIT = 50;
const DEFAULT_DURATION_MINUTES = 30;

@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateMeetingDto): Promise<Meeting> {
    return this.meetingsService.create({
      ownerId: user.sub,
      title: dto.title,
      startsAt: dto.date,
      durationMinutes: dto.durationMinutes ?? DEFAULT_DURATION_MINUTES,
      participants: dto.participants,
    });
  }

  /** Without `limit` returns every meeting; with it, the newest `limit` (1..50). */
  @Get()
  findMine(
    @CurrentUser() user: JwtPayload,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ): Promise<MeetingsPage> {
    return this.meetingsService.findPageByUser(
      user.sub,
      limit === undefined ? undefined : Math.min(Math.max(limit, 1), MAX_LIMIT),
    );
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string): Promise<Meeting> {
    return this.meetingsService.findOneByUser(user.sub, id);
  }
}
