import { QueryHandler } from '@nestjs/cqrs';
import { FindUserByIdQuery } from './find-user-by-id.query';
import { UsersService } from '../users.service';
import type { IQueryHandler } from '@nestjs/cqrs';
import type { User } from '../user.entity';

@QueryHandler(FindUserByIdQuery)
export class FindUserByIdHandler implements IQueryHandler<FindUserByIdQuery> {
  constructor(private readonly usersService: UsersService) {}

  execute({ id }: FindUserByIdQuery): Promise<User | null> {
    return this.usersService.findById(id);
  }
}
