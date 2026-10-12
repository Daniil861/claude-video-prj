import { Module } from '@nestjs/common';
import { FileStorageService } from './file-storage.service';

/** Separate from FilesModule so the multer options factory can inject the storage. */
@Module({
  providers: [FileStorageService],
  exports: [FileStorageService],
})
export class FileStorageModule {}
