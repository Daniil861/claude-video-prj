import { Command } from '@nestjs/cqrs';
import type { User } from '../user.entity';

/**
 * Creates a user. The password arrives already hashed: credentials are the auth
 * module's concern, the users module only stores them.
 */
export class CreateUserCommand extends Command<User> {
  constructor(
    readonly email: string,
    readonly passwordHash: string,
  ) {
    super();
  }
}
