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

  describe('POST /api/auth/register', () => {
    let uniqueEmailCounter = 0;

    // The user store is in-memory and shared by every test in this file, so each
    // registration test claims its own address instead of a fixed one.
    const uniqueEmail = () => `reg-${Date.now()}-${(uniqueEmailCounter += 1)}@example.com`;

    const postRegister = (body: Record<string, unknown>) =>
      request(app.getHttpServer()).post('/api/auth/register').send(body);

    const register = async (body: Record<string, unknown>): Promise<LoginBody> => {
      const response = await postRegister(body).expect(201);
      return response.body as LoginBody;
    };

    it('creates the user and returns a token plus the public user', async () => {
      const email = uniqueEmail();

      const body = await register({ email, password: 'password123' });

      expect(typeof body.accessToken).toBe('string');
      expect(body.accessToken.split('.')).toHaveLength(3);
      expect(body.user.email).toBe(email);
      expect(body.user.id).toEqual(expect.any(String));
    });

    it('derives the name from the local part of the email', async () => {
      const email = uniqueEmail();

      const body = await register({ email, password: 'password123' });

      expect(body.user.name).toBe(email.split('@')[0]);
    });

    it('never leaks the password hash', async () => {
      const body = await register({ email: uniqueEmail(), password: 'password123' });

      expect(body.user).not.toHaveProperty('passwordHash');
    });

    it('persists the user so the same credentials log in afterwards', async () => {
      const credentials = { email: uniqueEmail(), password: 'password123' };
      const registered = await register(credentials);

      const response = await postLogin(credentials).expect(200);

      expect((response.body as LoginBody).user).toEqual(registered.user);
    });

    it('issues a token that identifies the new user on GET /api/auth/me', async () => {
      const registered = await register({ email: uniqueEmail(), password: 'password123' });

      await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${registered.accessToken}`)
        .expect(200)
        .expect(registered.user);
    });

    it('returns 409 when the email is already registered', async () => {
      const credentials = { email: uniqueEmail(), password: 'password123' };
      await register(credentials);

      await postRegister(credentials).expect(409);
    });

    it('treats emails differing only in case as already registered', async () => {
      const email = uniqueEmail();
      await register({ email, password: 'password123' });

      await postRegister({ email: email.toUpperCase(), password: 'password123' }).expect(409);
    });

    it('returns 409 for a seeded email and leaves that user untouched', async () => {
      await postRegister({ ...CREDENTIALS, password: 'a-different-password' }).expect(409);

      const body = await loginAsDemoUser();
      expect(body.user).toEqual(DEMO_USER);
    });

    it('returns 400 for a malformed body', async () => {
      await postRegister({ email: 'not-an-email', password: 'x' }).expect(400);
    });

    it('does not create a user on login, only on register', async () => {
      const credentials = { email: uniqueEmail(), password: 'password123' };

      // Logging in with an unknown email must not register it as a side effect,
      // otherwise the registration below would collide with 409.
      await postLogin(credentials).expect(401);

      const body = await register(credentials);
      expect(body.user.email).toBe(credentials.email);
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
