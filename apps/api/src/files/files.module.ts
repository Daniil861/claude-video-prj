import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { FileStorageModule } from './file-storage.module';
import { FileStorageService } from './file-storage.service';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { MeetingAccessInterceptor } from './meeting-access.interceptor';
import { TempFileStorage } from './temp-file.storage';

@Module({
  imports: [
    AuthModule,
    MeetingsModule,
    FileStorageModule,
    // Every FileInterceptor of this module streams to FILES_DIR/.tmp instead of memory.
    MulterModule.registerAsync({
      imports: [FileStorageModule],
      inject: [FileStorageService],
      useFactory: (storage: FileStorageService) => ({ storage: new TempFileStorage(storage) }),
    }),
  ],
  controllers: [FilesController],
  providers: [FilesService, MeetingAccessInterceptor],
})
export class FilesModule {}
