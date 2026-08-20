import { MeetingsService } from './meetings.service';

describe('MeetingsService', () => {
  let service: MeetingsService;

  const add = (ownerId: string, title: string, startsAt: string) =>
    service.create({ ownerId, title, startsAt, durationMinutes: 30 });

  beforeEach(() => {
    service = new MeetingsService();
    service.reset();
  });

  describe('findRecentByUser', () => {
    it('returns the user meetings sorted by start date, newest first', () => {
      add('usr_1', 'oldest', '2026-01-01T10:00:00.000Z');
      add('usr_1', 'newest', '2026-03-01T10:00:00.000Z');
      add('usr_1', 'middle', '2026-02-01T10:00:00.000Z');

      const titles = service.findRecentByUser('usr_1').map((meeting) => meeting.title);

      expect(titles).toEqual(['newest', 'middle', 'oldest']);
    });

    it('respects the limit', () => {
      add('usr_1', 'a', '2026-01-01T10:00:00.000Z');
      add('usr_1', 'b', '2026-02-01T10:00:00.000Z');
      add('usr_1', 'c', '2026-03-01T10:00:00.000Z');

      expect(service.findRecentByUser('usr_1', 2)).toHaveLength(2);
    });

    it('never leaks meetings owned by somebody else', () => {
      add('usr_1', 'mine', '2026-01-01T10:00:00.000Z');
      add('usr_2', 'theirs', '2026-02-01T10:00:00.000Z');

      const titles = service.findRecentByUser('usr_1').map((meeting) => meeting.title);

      expect(titles).toEqual(['mine']);
    });

    it('returns an empty list for a user without meetings', () => {
      expect(service.findRecentByUser('usr_unknown')).toEqual([]);
    });
  });

  describe('countByUser', () => {
    it('counts only the meetings of that user', () => {
      add('usr_1', 'a', '2026-01-01T10:00:00.000Z');
      add('usr_1', 'b', '2026-02-01T10:00:00.000Z');
      add('usr_2', 'c', '2026-03-01T10:00:00.000Z');

      expect(service.countByUser('usr_1')).toBe(2);
      expect(service.countByUser('usr_2')).toBe(1);
      expect(service.countByUser('usr_unknown')).toBe(0);
    });
  });

  describe('findPageByUser', () => {
    it('reports the limited page together with the full total', () => {
      add('usr_1', 'a', '2026-01-01T10:00:00.000Z');
      add('usr_1', 'b', '2026-02-01T10:00:00.000Z');
      add('usr_1', 'c', '2026-03-01T10:00:00.000Z');

      expect(service.findPageByUser('usr_1', 2)).toEqual({
        items: [expect.objectContaining({ title: 'c' }), expect.objectContaining({ title: 'b' })],
        total: 3,
      });
    });
  });
});
