import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { User } from './user.entity';

const UNIQUE_CONSTRAINT_FAILED = 'P2002';

/**
 * Users are stored in Postgres. Only the users module's command and query
 * handlers call this service; other modules go through the CQRS buses.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registers a new user. The name is derived from the local part of the email,
   * since registration only asks for credentials. The password must already be
   * hashed by the caller.
   */
  async create(email: string, passwordHash: string): Promise<User> {
    const normalized = normalizeEmail(email);

    if (await this.findByEmail(normalized)) {
      throw new ConflictException('Пользователь с таким email уже существует');
    }

    try {
      return await this.prisma.user.create({
        data: {
          email: normalized,
          name: localPartOf(normalized),
          passwordHash,
        },
      });
    } catch (error) {
      // The check above loses to a concurrent insert; the unique index does not.
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Пользователь с таким email уже существует');
      }

      throw error;
    }
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function localPartOf(email: string): string {
  return email.slice(0, email.indexOf('@'));
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === UNIQUE_CONSTRAINT_FAILED
  );
}
