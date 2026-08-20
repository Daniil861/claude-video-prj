import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash } from 'bcryptjs';
import { AuthService } from './auth.service';
import type { UsersService } from '../users/users.service';
import type { User } from '../users/user.entity';

describe('AuthService', () => {
  const password = 'password123';
  let user: User;
  let service: AuthService;
  let jwtService: JwtService;

  beforeAll(async () => {
    user = {
      id: 'usr_1',
      email: 'demo@example.com',
      name: 'Demo User',
      passwordHash: await hash(password, 4),
    };
  });

  beforeEach(() => {
    const usersService = {
      findByEmail: (email: string) => (email.toLowerCase() === user.email ? user : undefined),
      findById: (id: string) => (id === user.id ? user : undefined),
    } as unknown as UsersService;

    jwtService = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '1h' } });
    service = new AuthService(usersService, jwtService);
  });

  describe('login', () => {
    it('returns a signed token and the public user for valid credentials', async () => {
      const result = await service.login(user.email, password);

      expect(result.user).toEqual({ id: user.id, email: user.email, name: user.name });
      expect(jwtService.verify(result.accessToken)).toMatchObject({
        sub: user.id,
        email: user.email,
      });
    });

    it('never returns the password hash', async () => {
      const result = await service.login(user.email, password);

      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('accepts the email case-insensitively', async () => {
      await expect(service.login('DEMO@Example.com', password)).resolves.toBeDefined();
    });

    it('rejects a wrong password', async () => {
      await expect(service.login(user.email, 'wrong-password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an unknown email', async () => {
      await expect(service.login('nobody@example.com', password)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getPublicUserById', () => {
    it('returns the public user', () => {
      expect(service.getPublicUserById(user.id)).toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
      });
    });

    it('throws for an unknown id', () => {
      expect(() => service.getPublicUserById('usr_missing')).toThrow(UnauthorizedException);
    });
  });
});
