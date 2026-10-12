import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { win32 } from 'node:path';
import { PrismaService } from '../prisma/prisma.service';
import { MeetingsService } from '../meetings/meetings.service';
import { FileStorageService } from './file-storage.service';
import type { MeetingFile as MeetingFileRow } from '@prisma/client';
import type { MeetingFile, PendingUpload } from './meeting-file.entity';

/** Meeting files: rows in Postgres, bytes in FileStorageService. */
@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorageService,
    private readonly meetingsService: MeetingsService,
  ) {}

  /**
   * Moves the temp file to its permanent place, then records it. The temp file is
   * removed whatever happens, and the committed file is removed if the insert fails.
   */
  async upload(ownerId: string, meetingId: string, upload: PendingUpload): Promise<MeetingFile> {
    try {
      await this.meetingsService.findOneByUser(ownerId, meetingId);

      const id = randomUUID();
      const storageKey = this.storage.keyFor(meetingId, id);
      await this.storage.commit(upload.tempPath, storageKey);

      try {
        const row = await this.prisma.meetingFile.create({
          data: {
            id,
            meetingId,
            // win32.basename strips both `/` and `\`, whatever the client sent.
            originalName: win32.basename(upload.originalName),
            mimeType: upload.mimeType,
            size: upload.size,
            storageKey,
          },
        });

        return toMeetingFile(row);
      } catch (error) {
        await this.storage.remove(storageKey);
        throw error;
      }
    } finally {
      await this.storage.removeTemp(upload.tempPath);
    }
  }

  /** Newest first. A foreign or missing meeting is a 404, as everywhere else. */
  async listForOwner(ownerId: string, meetingId: string): Promise<MeetingFile[]> {
    await this.meetingsService.findOneByUser(ownerId, meetingId);

    const rows = await this.prisma.meetingFile.findMany({
      where: { meetingId },
      orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
    });

    return rows.map(toMeetingFile);
  }
}

/** Explicit mapping: storageKey and future columns stay out of the response. */
function toMeetingFile(row: MeetingFileRow): MeetingFile {
  return {
    id: row.id,
    meetingId: row.meetingId,
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    status: row.status,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}
