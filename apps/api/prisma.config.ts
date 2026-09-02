import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 reads the connection URL from here instead of the schema file.
 * The URL still comes from DATABASE_URL, so .env / .env.test keep deciding
 * which database the CLI and the tests talk to.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
