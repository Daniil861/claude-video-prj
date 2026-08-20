import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { hash } from 'bcryptjs';
import type { User } from './user.entity';

const BCRYPT_ROUNDS = 10;

interface SeedUser {
  id: string;
  email: string;
  name: string;
  password: string;
}

/**
 * In-memory user store. Swap the internals for a database repository later —
 * consumers only depend on findByEmail/findById.
 */
@Injectable()
export class UsersService implements OnModuleInit {
  private readonly users = new Map<string, User>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const defaultPassword = this.config.get<string>('SEED_USER_PASSWORD') ?? 'password123';

    const seed: SeedUser[] = [
      {
        id: 'usr_1',
        email: this.config.get<string>('SEED_USER_EMAIL') ?? 'demo@example.com',
        name: 'Demo User',
        password: defaultPassword,
      },
      {
        id: 'usr_2',
        email: 'anna@example.com',
        name: 'Anna Petrova',
        password: defaultPassword,
      },
    ];

    for (const { password, ...rest } of seed) {
      this.users.set(rest.id, { ...rest, passwordHash: await hash(password, BCRYPT_ROUNDS) });
    }
  }

  findByEmail(email: string): User | undefined {
    const normalized = email.trim().toLowerCase();
    return [...this.users.values()].find((user) => user.email.toLowerCase() === normalized);
  }

  findById(id: string): User | undefined {
    return this.users.get(id);
  }
}
