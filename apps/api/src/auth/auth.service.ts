import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { toPublicUser } from '../users/user.entity';
import type { User } from '../users/user.entity';
import type { PublicUser } from '../users/user.entity';
import type { JwtPayload } from './jwt-payload.interface';

export interface LoginResult {
  accessToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.usersService.findByEmail(email);

    // Compare against a found user only, but fail with the same message either way
    // so the response does not reveal whether the email exists.
    if (!user || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    return this.issueToken(user);
  }

  async register(email: string, password: string): Promise<LoginResult> {
    // UsersService rejects an email that is already taken, so registration never
    // silently overwrites an existing account.
    const user = await this.usersService.create(email, password);

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
    const user = await this.usersService.findById(id);

    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    return toPublicUser(user);
  }
}
