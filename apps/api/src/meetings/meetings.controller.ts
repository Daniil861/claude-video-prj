import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { MeetingsPage } from './meeting.entity';
import type { JwtPayload } from '../auth/jwt-payload.interface';

const MAX_LIMIT = 50;

@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Get()
  findMine(
    @CurrentUser() user: JwtPayload,
    @Query('limit', new DefaultValuePipe(3), ParseIntPipe) limit: number,
  ): Promise<MeetingsPage> {
    return this.meetingsService.findPageByUser(user.sub, Math.min(Math.max(limit, 1), MAX_LIMIT));
  }
}
