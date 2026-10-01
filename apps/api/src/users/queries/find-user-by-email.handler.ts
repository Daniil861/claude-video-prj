import { QueryHandler } from '@nestjs/cqrs';
import { FindUserByEmailQuery } from './find-user-by-email.query';
import { UsersService } from '../users.service';
import type { IQueryHandler } from '@nestjs/cqrs';
import type { User } from '../user.entity';

@QueryHandler(FindUserByEmailQuery)
export class FindUserByEmailHandler implements IQueryHandler<FindUserByEmailQuery> {
  constructor(private readonly usersService: UsersService) {}

  execute({ email }: FindUserByEmailQuery): Promise<User | null> {
    return this.usersService.findByEmail(email);
  }
}
