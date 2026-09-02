import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Global so feature modules can inject PrismaService without importing this one. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
