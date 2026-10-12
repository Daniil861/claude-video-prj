import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { MeetingAccessInterceptor } from './meeting-access.interceptor';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { MeetingFile, MeetingFilesList } from './meeting-file.entity';
import type { JwtPayload } from '../auth/jwt-payload.interface';

@Controller('meetings/:id/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  /** One file per request, in the multipart field `file`. */
  @Post()
  @UseInterceptors(
    MeetingAccessInterceptor,
    FileInterceptor('file', {
      // Browsers send UTF-8 names without `filename*`; multer defaults to latin1.
      defParamCharset: 'utf8',
      limits: { files: 1, fields: 0 },
    }),
  )
  upload(
    @CurrentUser() user: JwtPayload,
    @Param('id') meetingId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<MeetingFile> {
    if (!file) {
      throw new BadRequestException('Файл не передан: ожидается поле file');
    }

    return this.filesService.upload(user.sub, meetingId, {
      tempPath: file.path,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });
  }

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Param('id') meetingId: string,
  ): Promise<MeetingFilesList> {
    return { items: await this.filesService.listForOwner(user.sub, meetingId) };
  }
}
