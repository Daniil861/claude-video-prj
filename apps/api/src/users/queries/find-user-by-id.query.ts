import { Query } from '@nestjs/cqrs';
import type { User } from '../user.entity';

/** Resolves to `null` when the id is unknown. */
export class FindUserByIdQuery extends Query<User | null> {
  constructor(readonly id: string) {
    super();
  }
}
