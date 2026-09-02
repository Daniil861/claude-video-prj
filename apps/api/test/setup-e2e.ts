import { config } from 'dotenv';
import { resolve } from 'node:path';

// Loaded before any module import: PrismaClient reads DATABASE_URL when it is
// constructed, not through ConfigService, so the test database must be selected
// before Nest boots.
config({ path: resolve(__dirname, '..', '.env.test'), override: true, quiet: true });
