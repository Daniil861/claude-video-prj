import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import type { Meeting } from './../src/meetings/meeting.entity';
import type { PublicUser } from './../src/users/user.entity';

interface LoginBody {
  accessToken: string;
  user: PublicUser;
}

// Declared here rather than imported: the suite must compile before the files module exists.
interface MeetingFileBody {
  id: string;
  meetingId: string;
  originalName: string;
  mimeType: string;
  size: number;
  status: string;
  uploadedAt: string;
}

interface MeetingFilesBody {
  items: MeetingFileBody[];
}

const createApp = async (): Promise<INestApplication<App>> => {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await app.init();
  return app;
};

const filesDir = (): string => {
  const dir = process.env.FILES_DIR;

  if (!dir) {
    throw new Error('FILES_DIR is not set in apps/api/.env.test');
  }

  return resolve(dir);
};

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

describe('Meeting files (e2e)', () => {
  let app: INestApplication<App>;
  let uniqueEmailCounter = 0;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const registerFreshUser = async (): Promise<LoginBody> => {
    const email = `files-${Date.now()}-${(uniqueEmailCounter += 1)}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    return response.body as LoginBody;
  };

  const createMeeting = async (token: string): Promise<Meeting> => {
    const response = await request(app.getHttpServer())
      .post('/api/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'With files', date: '2026-10-01T10:00:00.000Z', participants: [] })
      .expect(201);
    return response.body as Meeting;
  };

  /** A fresh owner with one empty meeting: tests never share files. */
  const ownerWithMeeting = async () => {
    const { accessToken } = await registerFreshUser();
    const meeting = await createMeeting(accessToken);
    return { token: accessToken, meeting };
  };

  const upload = (
    token: string | undefined,
    meetingId: string,
    content: Buffer,
    filename: string,
    contentType = 'text/plain',
  ) => {
    const req = request(app.getHttpServer()).post(`/api/meetings/${meetingId}/files`);

    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }

    return req.attach('file', content, { filename, contentType });
  };

  const list = (token: string | undefined, meetingId: string) => {
    const req = request(app.getHttpServer()).get(`/api/meetings/${meetingId}/files`);

    if (token) {
      req.set('Authorization', `Bearer ${token}`);
    }

    return req;
  };

  describe('POST /api/meetings/:id/files', () => {
    it('stores the file and returns its record with status uploaded', async () => {
      const { token, meeting } = await ownerWithMeeting();
      const content = Buffer.from('Meeting notes\n');

      const response = await upload(token, meeting.id, content, 'notes.txt').expect(201);
      const body = response.body as MeetingFileBody;

      expect(typeof body.id).toBe('string');
      expect(body).toEqual({
        id: body.id,
        meetingId: meeting.id,
        originalName: 'notes.txt',
        mimeType: 'text/plain',
        size: content.length,
        status: 'uploaded',
        uploadedAt: body.uploadedAt,
      });
      expect(new Date(body.uploadedAt).toISOString()).toBe(body.uploadedAt);
    });

    it('writes the bytes to FILES_DIR under a server-generated key', async () => {
      const { token, meeting } = await ownerWithMeeting();
      const content = Buffer.from('exact bytes \u0000ÿ');

      const response = await upload(token, meeting.id, content, '../../escape.txt').expect(201);
      const body = response.body as MeetingFileBody;

      const meetingDir = join(filesDir(), 'meetings', meeting.id);
      expect(readdirSync(meetingDir)).toEqual([body.id]);
      expect(readFileSync(join(meetingDir, body.id))).toEqual(content);
      expect(existsSync(join(filesDir(), '..', 'escape.txt'))).toBe(false);
    });

    it('keeps a cyrillic file name with spaces intact', async () => {
      const { token, meeting } = await ownerWithMeeting();

      const response = await upload(
        token,
        meeting.id,
        Buffer.from('%PDF-1.4\n'),
        'Отчёт за 2026.pdf',
        'application/pdf',
      ).expect(201);

      expect((response.body as MeetingFileBody).originalName).toBe('Отчёт за 2026.pdf');
    });

    it('rejects a request without a file with 400', async () => {
      const { token, meeting } = await ownerWithMeeting();

      await request(app.getHttpServer())
        .post(`/api/meetings/${meeting.id}/files`)
        .set('Authorization', `Bearer ${token}`)
        .field('note', 'no file here')
        .expect(400);
    });

    it('returns 401 without a token', async () => {
      const { meeting } = await ownerWithMeeting();

      await upload(undefined, meeting.id, Buffer.from('x'), 'x.txt').expect(401);
    });

    it("returns 404 for somebody else's meeting and stores nothing", async () => {
      const { meeting } = await ownerWithMeeting();
      const stranger = await registerFreshUser();

      await upload(stranger.accessToken, meeting.id, Buffer.from('x'), 'x.txt').expect(404);

      expect(existsSync(join(filesDir(), 'meetings', meeting.id))).toBe(false);
    });

    it('returns 404 for a meeting that does not exist', async () => {
      const { token } = await ownerWithMeeting();

      await upload(token, 'mtg_does_not_exist', Buffer.from('x'), 'x.txt').expect(404);
    });
  });

  describe('GET /api/meetings/:id/files', () => {
    it('returns an empty list for a meeting without files', async () => {
      const { token, meeting } = await ownerWithMeeting();

      const response = await list(token, meeting.id).expect(200);

      expect(response.body).toEqual({ items: [] });
    });

    it('lists the uploaded files newest first, each with status uploaded', async () => {
      const { token, meeting } = await ownerWithMeeting();

      const first = (await upload(token, meeting.id, Buffer.from('1'), 'first.txt').expect(201))
        .body as MeetingFileBody;
      await wait(5);
      const second = (await upload(token, meeting.id, Buffer.from('22'), 'second.txt').expect(201))
        .body as MeetingFileBody;

      const response = await list(token, meeting.id).expect(200);

      expect(response.body).toEqual({ items: [second, first] });
      expect((response.body as MeetingFilesBody).items.map((file) => file.status)).toEqual([
        'uploaded',
        'uploaded',
      ]);
    });

    it('lists only the files of the requested meeting', async () => {
      const { token, meeting } = await ownerWithMeeting();
      const other = await createMeeting(token);

      const own = (await upload(token, meeting.id, Buffer.from('mine'), 'own.txt').expect(201))
        .body as MeetingFileBody;
      await upload(token, other.id, Buffer.from('other'), 'other.txt').expect(201);

      const response = await list(token, meeting.id).expect(200);

      expect(response.body).toEqual({ items: [own] });
    });

    it('returns 401 without a token', async () => {
      const { meeting } = await ownerWithMeeting();

      await list(undefined, meeting.id).expect(401);
    });

    it("returns 404 for somebody else's meeting", async () => {
      const { token, meeting } = await ownerWithMeeting();
      await upload(token, meeting.id, Buffer.from('secret'), 'secret.txt').expect(201);
      const stranger = await registerFreshUser();

      await list(stranger.accessToken, meeting.id).expect(404);
    });

    it('returns 404 for a meeting that does not exist', async () => {
      const { token } = await ownerWithMeeting();

      await list(token, 'mtg_does_not_exist').expect(404);
    });
  });

  it('keeps uploaded files across an application restart', async () => {
    const { token, meeting } = await ownerWithMeeting();
    const uploaded = (await upload(token, meeting.id, Buffer.from('durable'), 'durable.txt'))
      .body as MeetingFileBody;

    const restarted = await createApp();

    try {
      const response = await request(restarted.getHttpServer())
        .get(`/api/meetings/${meeting.id}/files`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toEqual({ items: [uploaded] });
    } finally {
      await restarted.close();
    }
  });
});
