/** Seed data shared by the CLI seed script and the e2e setup. */

export interface SeedUserInput {
  id: string;
  email: string;
  name: string;
}

export interface SeedMeetingInput {
  id: string;
  ownerId: string;
  title: string;
  startsAt: string;
  durationMinutes: number;
}

export const SEED_USERS: SeedUserInput[] = [
  {
    id: 'usr_1',
    email: process.env.SEED_USER_EMAIL ?? 'demo@example.com',
    name: 'Demo User',
  },
  {
    id: 'usr_2',
    email: 'anna@example.com',
    name: 'Anna Petrova',
  },
];

export const SEED_MEETINGS: SeedMeetingInput[] = [
  {
    id: 'mtg_1',
    ownerId: 'usr_1',
    title: 'Weekly sync',
    startsAt: '2026-08-24T09:00:00.000Z',
    durationMinutes: 30,
  },
  {
    id: 'mtg_2',
    ownerId: 'usr_1',
    title: 'Product review',
    startsAt: '2026-08-21T13:30:00.000Z',
    durationMinutes: 60,
  },
  {
    id: 'mtg_3',
    ownerId: 'usr_1',
    title: 'Design handoff',
    startsAt: '2026-08-19T15:00:00.000Z',
    durationMinutes: 45,
  },
  {
    id: 'mtg_4',
    ownerId: 'usr_1',
    title: 'Retrospective',
    startsAt: '2026-08-14T11:00:00.000Z',
    durationMinutes: 60,
  },
  {
    id: 'mtg_5',
    ownerId: 'usr_2',
    title: 'Onboarding call',
    startsAt: '2026-08-20T08:00:00.000Z',
    durationMinutes: 30,
  },
];
