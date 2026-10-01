import { CommandHandler } from '@nestjs/cqrs';
import { CreateUserCommand } from './create-user.command';
import { UsersService } from '../users.service';
import type { ICommandHandler } from '@nestjs/cqrs';
import type { User } from '../user.entity';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(private readonly usersService: UsersService) {}

  execute({ email, passwordHash }: CreateUserCommand): Promise<User> {
    return this.usersService.create(email, passwordHash);
  }
}
