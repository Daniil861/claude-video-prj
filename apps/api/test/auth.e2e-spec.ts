import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import type { MeetingsPage } from './../src/meetings/meeting.entity';
import type { PublicUser } from './../src/users/user.entity';

const CREDENTIALS = { email: 'demo@example.com', password: 'password123' };
const DEMO_USER: PublicUser = { id: 'usr_1', email: CREDENTIALS.email, name: 'Demo User' };

interface LoginBody {
  accessToken: string;
  user: PublicUser;
}

describe('Auth and meetings (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const postLogin = (body: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/api/auth/login').send(body);

  const loginAsDemoUser = async (): Promise<LoginBody> => {
    const response = await postLogin(CREDENTIALS).expect(200);
    return response.body as LoginBody;
  };

  describe('POST /api/auth/login', () => {
    it('returns a token and the public user for valid credentials', async () => {
      const body = await loginAsDemoUser();

      expect(typeof body.accessToken).toBe('string');
      expect(body.accessToken.split('.')).toHaveLength(3);
      expect(body.user).toEqual(DEMO_USER);
    });

    it('never leaks the password hash', async () => {
      const body = await loginAsDemoUser();

      expect(body.user).not.toHaveProperty('passwordHash');
    });

    it('returns 401 for a wrong password', async () => {
      await postLogin({ ...CREDENTIALS, password: 'wrong-password' }).expect(401);
    });

    it('returns 401 for an unknown email', async () => {
      await postLogin({ ...CREDENTIALS, email: 'nobody@example.com' }).expect(401);
    });

    it('returns 400 for a malformed body', async () => {
      await postLogin({ email: 'not-an-email', password: 'x' }).expect(400);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the current user for a valid token', async () => {
      const { accessToken } = await loginAsDemoUser();

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect(DEMO_USER);
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('returns 401 for a garbage token', async () => {
      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer not-a-jwt')
        .expect(401);
    });
  });

  describe('GET /api/meetings', () => {
    const getMeetings = async (token: string, query = ''): Promise<MeetingsPage> => {
      const response = await request(app.getHttpServer())
        .get(`/api/meetings${query}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      return response.body as MeetingsPage;
    };

    it('returns the three most recent meetings plus the full total', async () => {
      const { accessToken } = await loginAsDemoUser();

      const page = await getMeetings(accessToken);

      expect(page.total).toBe(4);
      expect(page.items.map((meeting) => meeting.title)).toEqual([
        'Weekly sync',
        'Product review',
        'Design handoff',
      ]);
    });

    it('honours the limit query parameter', async () => {
      const { accessToken } = await loginAsDemoUser();

      const page = await getMeetings(accessToken, '?limit=1');

      expect(page.items).toHaveLength(1);
      expect(page.total).toBe(4);
    });

    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).get('/api/meetings').expect(401);
    });
  });
});
