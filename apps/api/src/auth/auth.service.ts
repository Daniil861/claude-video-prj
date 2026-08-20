import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { toPublicUser } from '../users/user.entity';
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
    const user = this.usersService.findByEmail(email);

    // Compare against a found user only, but fail with the same message either way
    // so the response does not reveal whether the email exists.
    if (!user || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: toPublicUser(user),
    };
  }

  getPublicUserById(id: string): PublicUser {
    const user = this.usersService.findById(id);

    if (!user) {
      throw new UnauthorizedException('Пользователь не найден');
    }

    return toPublicUser(user);
  }
}
