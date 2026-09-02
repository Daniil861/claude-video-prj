import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { SEED_MEETINGS, SEED_USERS } from './seed-data';

const BCRYPT_ROUNDS = 10;

/**
 * Idempotent seed: upserts by fixed ids, so running it twice changes nothing.
 * Called both by `pnpm db:seed` and by the e2e global setup.
 */
export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  const password = process.env.SEED_USER_PASSWORD ?? 'password123';
  const passwordHash = await hash(password, BCRYPT_ROUNDS);

  for (const user of SEED_USERS) {
    const email = user.email.trim().toLowerCase();

    await prisma.user.upsert({
      where: { id: user.id },
      update: { email, name: user.name, passwordHash },
      create: { id: user.id, email, name: user.name, passwordHash },
    });
  }

  for (const meeting of SEED_MEETINGS) {
    const data = {
      ownerId: meeting.ownerId,
      title: meeting.title,
      startsAt: new Date(meeting.startsAt),
      durationMinutes: meeting.durationMinutes,
    };

    await prisma.meeting.upsert({
      where: { id: meeting.id },
      update: data,
      create: { id: meeting.id, ...data },
    });
  }
}

/** Removes every row. Meetings cascade from users, but both are cleared explicitly. */
export async function clearDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.meeting.deleteMany();
  await prisma.user.deleteMany();
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — cannot seed the database.');
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

async function main(): Promise<void> {
  const prisma = createClient();

  try {
    await seedDatabase(prisma);
    console.warn(`Seeded ${SEED_USERS.length} users and ${SEED_MEETINGS.length} meetings.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
