import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { AuthService } from './auth.service';
import { CreateUserCommand } from '../users/commands/create-user.command';
import { FindUserByEmailQuery } from '../users/queries/find-user-by-email.query';
import { FindUserByIdQuery } from '../users/queries/find-user-by-id.query';
import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { User } from '../users/user.entity';

describe('AuthService', () => {
  const password = 'password123';
  let user: User;
  let service: AuthService;
  let jwtService: JwtService;
  let createdCommands: CreateUserCommand[];

  beforeAll(async () => {
    user = {
      id: 'usr_1',
      email: 'demo@example.com',
      name: 'Demo User',
      passwordHash: await hash(password, 4),
      createdAt: new Date(),
    };
  });

  beforeEach(() => {
    createdCommands = [];

    // Stand-ins for the users module: AuthService only talks to it through the buses.
    const queryBus = {
      execute: (query: unknown) => {
        if (query instanceof FindUserByEmailQuery) {
          return Promise.resolve(query.email.toLowerCase() === user.email ? user : null);
        }
        if (query instanceof FindUserByIdQuery) {
          return Promise.resolve(query.id === user.id ? user : null);
        }
        return Promise.reject(new Error('Unexpected query'));
      },
    } as unknown as QueryBus;

    const commandBus = {
      execute: (command: unknown) => {
        if (command instanceof CreateUserCommand) {
          createdCommands.push(command);
          return Promise.resolve({
            ...user,
            id: 'usr_new',
            email: command.email,
            passwordHash: command.passwordHash,
          });
        }
        return Promise.reject(new Error('Unexpected command'));
      },
    } as unknown as CommandBus;

    jwtService = new JwtService({ secret: 'test-secret', signOptions: { expiresIn: '1h' } });
    service = new AuthService(commandBus, queryBus, jwtService);
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

  describe('register', () => {
    it('sends a bcrypt hash to the users module, never the plain password', async () => {
      await service.register('new@example.com', password);

      expect(createdCommands).toHaveLength(1);
      const [command] = createdCommands;
      expect(command?.email).toBe('new@example.com');
      expect(command?.passwordHash).not.toBe(password);
      await expect(compare(password, command?.passwordHash ?? '')).resolves.toBe(true);
    });

    it('returns a token for the created user', async () => {
      const result = await service.register('new@example.com', password);

      expect(result.user).toEqual({ id: 'usr_new', email: 'new@example.com', name: user.name });
      expect(jwtService.verify(result.accessToken)).toMatchObject({ sub: 'usr_new' });
    });
  });

  describe('getPublicUserById', () => {
    it('returns the public user', async () => {
      await expect(service.getPublicUserById(user.id)).resolves.toEqual({
        id: user.id,
        email: user.email,
        name: user.name,
      });
    });

    it('rejects an unknown id', async () => {
      await expect(service.getPublicUserById('usr_missing')).rejects.toThrow(UnauthorizedException);
    });
  });
});
