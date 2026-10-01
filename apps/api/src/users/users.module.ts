import { Module } from '@nestjs/common';
import { CreateUserHandler } from './commands/create-user.handler';
import { FindUserByEmailHandler } from './queries/find-user-by-email.handler';
import { FindUserByIdHandler } from './queries/find-user-by-id.handler';
import { UsersService } from './users.service';

/**
 * Owns user records. Other modules do not inject UsersService: they send
 * commands and queries through the CQRS buses, so nothing is exported.
 */
@Module({
  providers: [UsersService, CreateUserHandler, FindUserByEmailHandler, FindUserByIdHandler],
})
export class UsersModule {}
