import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import type { JwtPayload } from './jwt-payload.interface';

/** Reads the JWT payload that JwtAuthGuard attached to the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!user) {
      throw new UnauthorizedException('Запрос не аутентифицирован');
    }

    return user;
  },
);
