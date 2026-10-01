import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { CreateUserCommand } from '../users/commands/create-user.command';
import { FindUserByEmailQuery } from '../users/queries/find-user-by-email.query';
import { FindUserByIdQuery } from '../users/queries/find-user-by-id.query';
import { toPublicUser } from '../users/user.entity';
import type { User } from '../users/user.entity';
import type { PublicUser } from '../users/user.entity';
import type { JwtPayload } from './jwt-payload.interface';

const BCRYPT_ROUNDS = 10;

export interface LoginResult {
  accessToken: string;
  user: PublicUser;
}

/**
 * Credentials and tokens. Users are read and created through the CQRS buses,
 * never by injecting the users module's services.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.queryBus.execute(new FindUserByEmailQuery(email));

    // Compare against a found user only, but fail with the same message either way
    // so the response does not reveal whether the email exists.
    if (!user || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    return this.issueToken(user);
  }

  async register(email: string, password: string): Promise<LoginResult> {
    // The users module rejects an email that is already taken, so registration
    // never silently overwrites an existing account.
    const user = await this.commandBus.execute(
      new CreateUserCommand(email, await hash(password, BCRYPT_ROUNDS)),
    );

    return this.issueToken(user);
  }

  private async issueToken(user: User): Promise<LoginResult> {
    const payload: JwtPayload = { sub: user.id, email: user.email };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: toPublicUser(user),
    };
  }

  async getPublicUserById(id: string): Promise<PublicUser> {
    const user = await this.queryBus.execute(new FindUserByIdQuery(id));

    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    return toPublicUser(user);
  }
}
