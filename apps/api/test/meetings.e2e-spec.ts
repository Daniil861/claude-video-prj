import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import type { Meeting, MeetingsPage } from './../src/meetings/meeting.entity';
import type { PublicUser } from './../src/users/user.entity';

const DEMO_CREDENTIALS = { email: 'demo@example.com', password: 'password123' };

interface LoginBody {
  accessToken: string;
  user: PublicUser;
}

describe('Meetings (e2e)', () => {
  let app: INestApplication<App>;
  let demoToken: string;
  let uniqueEmailCounter = 0;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send(DEMO_CREDENTIALS)
      .expect(200);
    demoToken = (response.body as LoginBody).accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  // Meetings created by a test belong to a freshly registered user, so the seeded
  // demo account keeps exactly its four fixtures for the listing assertions.
  const registerFreshUser = async (): Promise<LoginBody> => {
    const email = `mtg-${Date.now()}-${(uniqueEmailCounter += 1)}@example.com`;
    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);
    return response.body as LoginBody;
  };

  const postMeeting = (token: string, body: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/api/meetings')
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  const validBody = () => ({
    title: 'Planning',
    date: '2026-10-01T10:00:00.000Z',
    participants: ['anna@example.com', 'bob@example.com'],
  });

  describe('POST /api/meetings', () => {
    it('creates a meeting owned by the current user', async () => {
      const { accessToken, user } = await registerFreshUser();

      const response = await postMeeting(accessToken, validBody()).expect(201);
      const body = response.body as Meeting;

      expect(typeof body.id).toBe('string');
      expect(body).toEqual({
        id: body.id,
        ownerId: user.id,
        title: 'Planning',
        startsAt: '2026-10-01T10:00:00.000Z',
        durationMinutes: 30,
        participants: ['anna@example.com', 'bob@example.com'],
      });
    });

    it('accepts an explicit duration', async () => {
      const { accessToken } = await registerFreshUser();

      const response = await postMeeting(accessToken, { ...validBody(), durationMinutes: 45 });

      expect((response.body as Meeting).durationMinutes).toBe(45);
    });

    it('accepts a meeting without participants', async () => {
      const { accessToken } = await registerFreshUser();

      const response = await postMeeting(accessToken, { ...validBody(), participants: [] });

      expect(response.status).toBe(201);
      expect((response.body as Meeting).participants).toEqual([]);
    });

    it('lowercases participant emails and drops duplicates', async () => {
      const { accessToken } = await registerFreshUser();

      const response = await postMeeting(accessToken, {
        ...validBody(),
        participants: ['Bob@Example.com', 'bob@example.com', 'anna@example.com'],
      }).expect(201);

      expect((response.body as Meeting).participants).toEqual([
        'bob@example.com',
        'anna@example.com',
      ]);
    });

    it('persists the meeting so it is listed and readable by id', async () => {
      const { accessToken } = await registerFreshUser();
      const created = (await postMeeting(accessToken, validBody()).expect(201)).body as Meeting;

      const list = await request(app.getHttpServer())
        .get('/api/meetings')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const single = await request(app.getHttpServer())
        .get(`/api/meetings/${created.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(list.body).toEqual({ items: [created], total: 1 });
      expect(single.body).toEqual(created);
    });

    it('does not let the client choose the owner', async () => {
      const { accessToken } = await registerFreshUser();

      await postMeeting(accessToken, { ...validBody(), ownerId: 'usr_2' }).expect(400);
    });

    it.each([
      ['a missing title', { title: undefined }],
      ['an empty title', { title: '' }],
      ['a missing date', { date: undefined }],
      ['a date that is not ISO 8601', { date: 'tomorrow' }],
      ['missing participants', { participants: undefined }],
      ['participants that are not an array', { participants: 'anna@example.com' }],
      ['a participant that is not an email', { participants: ['not-an-email'] }],
      ['a non-positive duration', { durationMinutes: 0 }],
    ])('returns 400 for %s', async (_case, override) => {
      const { accessToken } = await registerFreshUser();

      await postMeeting(accessToken, { ...validBody(), ...override }).expect(400);
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).post('/api/meetings').send(validBody()).expect(401);
    });
  });

  describe('GET /api/meetings', () => {
    const getMeetings = async (query = ''): Promise<MeetingsPage> => {
      const response = await request(app.getHttpServer())
        .get(`/api/meetings${query}`)
        .set('Authorization', `Bearer ${demoToken}`)
        .expect(200);

      return response.body as MeetingsPage;
    };

    it('returns every meeting of the current user, newest first', async () => {
      const page = await getMeetings();

      expect(page.total).toBe(4);
      expect(page.items.map((meeting) => meeting.title)).toEqual([
        'Weekly sync',
        'Product review',
        'Design handoff',
        'Retrospective',
      ]);
    });

    it('honours the limit query parameter', async () => {
      const page = await getMeetings('?limit=1');

      expect(page.items).toHaveLength(1);
      expect(page.total).toBe(4);
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/api/meetings').expect(401);
    });
  });

  describe('GET /api/meetings/:id', () => {
    const getMeeting = (id: string, token = demoToken) =>
      request(app.getHttpServer())
        .get(`/api/meetings/${id}`)
        .set('Authorization', `Bearer ${token}`);

    it('returns a meeting of the current user', async () => {
      const response = await getMeeting('mtg_1').expect(200);

      expect(response.body).toEqual({
        id: 'mtg_1',
        ownerId: 'usr_1',
        title: 'Weekly sync',
        startsAt: '2026-08-24T09:00:00.000Z',
        durationMinutes: 30,
        participants: [],
      });
    });

    it('returns 404 for an unknown id', async () => {
      await getMeeting('mtg_does_not_exist').expect(404);
    });

    it('returns 404 for a meeting owned by somebody else', async () => {
      // mtg_5 belongs to usr_2: a 403 would confirm that the id exists.
      await getMeeting('mtg_5').expect(404);
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/api/meetings/mtg_1').expect(401);
    });
  });
});
