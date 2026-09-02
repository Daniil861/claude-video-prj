import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { clearDatabase, seedDatabase } from '../prisma/seed';

const apiRoot = resolve(__dirname, '..');

/**
 * Brings the test database to a known state once per run: applies migrations
 * (creating the database if it does not exist yet), wipes every row left over
 * from the previous run, then seeds the same fixtures the app ships with.
 */
export default async function globalSetup(): Promise<void> {
  config({ path: resolve(apiRoot, '.env.test'), override: true, quiet: true });

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in apps/api/.env.test');
  }

  // Run the CLI entry point with the current node binary: no shell, no PATH lookup,
  // so this behaves the same on Windows and CI.
  execFileSync(process.execPath, [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'], {
    cwd: apiRoot,
    env: { ...process.env, DATABASE_URL: connectionString },
    stdio: 'ignore',
  });

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  try {
    await clearDatabase(prisma);
    await seedDatabase(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
