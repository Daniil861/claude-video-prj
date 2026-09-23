import { PrismaService } from './../src/prisma/prisma.service';
import { MeetingsService } from './../src/meetings/meetings.service';

/**
 * Integration counterpart of the former meetings.service unit tests: sorting,
 * limiting and owner filtering now happen in SQL, so they are exercised against
 * the real test database instead of an in-memory array.
 */
describe('MeetingsService (integration)', () => {
  let prisma: PrismaService;
  let service: MeetingsService;
  let ownerId: string;
  let otherOwnerId: string;
  let suffix = 0;

  const uniqueId = (prefix: string) => `${prefix}-${Date.now()}-${(suffix += 1)}`;

  const createOwner = async (): Promise<string> => {
    const id = uniqueId('owner');
    await prisma.user.create({
      data: { id, email: `${id}@example.com`, name: id, passwordHash: 'x' },
    });
    return id;
  };

  const add = (owner: string, title: string, startsAt: string) =>
    service.create({ ownerId: owner, title, startsAt, durationMinutes: 30, participants: [] });

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.onModuleInit();
    service = new MeetingsService(prisma);
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  // Every test works with freshly created owners, so the seeded fixtures and the
  // other suites in this run cannot influence the result.
  beforeEach(async () => {
    ownerId = await createOwner();
    otherOwnerId = await createOwner();
  });

  describe('findRecentByUser', () => {
    it('returns the user meetings sorted by start date, newest first', async () => {
      await add(ownerId, 'oldest', '2026-01-01T10:00:00.000Z');
      await add(ownerId, 'newest', '2026-03-01T10:00:00.000Z');
      await add(ownerId, 'middle', '2026-02-01T10:00:00.000Z');

      const meetings = await service.findRecentByUser(ownerId);

      expect(meetings.map((meeting) => meeting.title)).toEqual(['newest', 'middle', 'oldest']);
    });

    it('returns startsAt as an ISO string, not a Date', async () => {
      await add(ownerId, 'only', '2026-01-01T10:00:00.000Z');

      const [meeting] = await service.findRecentByUser(ownerId);

      expect(meeting?.startsAt).toBe('2026-01-01T10:00:00.000Z');
    });

    it('respects the limit', async () => {
      await add(ownerId, 'a', '2026-01-01T10:00:00.000Z');
      await add(ownerId, 'b', '2026-02-01T10:00:00.000Z');
      await add(ownerId, 'c', '2026-03-01T10:00:00.000Z');

      await expect(service.findRecentByUser(ownerId, 2)).resolves.toHaveLength(2);
    });

    it('never leaks meetings owned by somebody else', async () => {
      await add(ownerId, 'mine', '2026-01-01T10:00:00.000Z');
      await add(otherOwnerId, 'theirs', '2026-02-01T10:00:00.000Z');

      const meetings = await service.findRecentByUser(ownerId);

      expect(meetings.map((meeting) => meeting.title)).toEqual(['mine']);
    });

    it('returns an empty list for a user without meetings', async () => {
      await expect(service.findRecentByUser(ownerId)).resolves.toEqual([]);
    });
  });

  describe('countByUser', () => {
    it('counts only the meetings of that user', async () => {
      await add(ownerId, 'a', '2026-01-01T10:00:00.000Z');
      await add(ownerId, 'b', '2026-02-01T10:00:00.000Z');
      await add(otherOwnerId, 'c', '2026-03-01T10:00:00.000Z');

      await expect(service.countByUser(ownerId)).resolves.toBe(2);
      await expect(service.countByUser(otherOwnerId)).resolves.toBe(1);
      await expect(service.countByUser('usr_unknown')).resolves.toBe(0);
    });
  });

  describe('findPageByUser', () => {
    it('reports the limited page together with the full total', async () => {
      await add(ownerId, 'a', '2026-01-01T10:00:00.000Z');
      await add(ownerId, 'b', '2026-02-01T10:00:00.000Z');
      await add(ownerId, 'c', '2026-03-01T10:00:00.000Z');

      await expect(service.findPageByUser(ownerId, 2)).resolves.toEqual({
        items: [expect.objectContaining({ title: 'c' }), expect.objectContaining({ title: 'b' })],
        total: 3,
      });
    });
  });
});
