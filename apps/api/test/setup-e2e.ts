import { config } from 'dotenv';
import { resolve } from 'node:path';

const apiRoot = resolve(__dirname, '..');

// Loaded before any module import: PrismaClient reads DATABASE_URL when it is
// constructed, not through ConfigService, so the test database must be selected
// before Nest boots.
config({ path: resolve(apiRoot, '.env.test'), override: true, quiet: true });

// Anchor the storage directory to apps/api, not to wherever jest was started from.
if (process.env.FILES_DIR) {
  process.env.FILES_DIR = resolve(apiRoot, process.env.FILES_DIR);
}
