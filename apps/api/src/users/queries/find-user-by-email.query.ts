import { Query } from '@nestjs/cqrs';
import type { User } from '../user.entity';

/** Resolves to `null` when no user has this email; matching ignores case. */
export class FindUserByEmailQuery extends Query<User | null> {
  constructor(readonly email: string) {
    super();
  }
}
