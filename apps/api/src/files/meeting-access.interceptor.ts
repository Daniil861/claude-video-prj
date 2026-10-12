import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Observable } from 'rxjs';
import { MeetingsService } from '../meetings/meetings.service';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';

/**
 * Rejects a foreign or missing meeting with 404 before the request body is read.
 * Must run before FileInterceptor: otherwise the whole upload is written to disk first.
 */
@Injectable()
export class MeetingAccessInterceptor implements NestInterceptor {
  constructor(private readonly meetingsService: MeetingsService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const meetingId = request.params.id;

    if (!request.user) {
      throw new UnauthorizedException('Запрос не аутентифицирован');
    }

    // Express 5 types params as `string | string[]`; `:id` is always a single segment.
    if (typeof meetingId === 'string') {
      await this.meetingsService.findOneByUser(request.user.sub, meetingId);
    }

    return next.handle();
  }
}
