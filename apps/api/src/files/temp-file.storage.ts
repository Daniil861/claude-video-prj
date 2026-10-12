import type { Request } from 'express';
import type { StorageEngine } from 'multer';
import type { FileStorageService } from './file-storage.service';

/**
 * Multer storage engine that streams each upload into a temp file of FileStorageService.
 * Multer calls `_removeFile` itself when the request is aborted or fails after the write.
 */
export class TempFileStorage implements StorageEngine {
  constructor(private readonly storage: FileStorageService) {}

  _handleFile(
    _req: Request,
    file: Express.Multer.File,
    callback: (error?: unknown, info?: Partial<Express.Multer.File>) => void,
  ): void {
    this.storage.writeTemp(file.stream).then(
      ({ path, size }) => callback(null, { path, size }),
      (error: unknown) => callback(error),
    );
  }

  _removeFile(
    _req: Request,
    file: Express.Multer.File,
    callback: (error: Error | null) => void,
  ): void {
    this.storage.removeTemp(file.path).then(
      () => callback(null),
      (error: unknown) => callback(error instanceof Error ? error : new Error(String(error))),
    );
  }
}
