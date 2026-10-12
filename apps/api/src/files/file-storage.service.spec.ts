import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { FileStorageService } from './file-storage.service';

describe('FileStorageService', () => {
  let root: string;
  let storage: FileStorageService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'files-'));
    storage = new FileStorageService(new ConfigService({ FILES_DIR: root }));
    await storage.onModuleInit();
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('streams data into a temp file and reports the written size', async () => {
    const temp = await storage.writeTemp(Readable.from([Buffer.from('abc'), Buffer.from('de')]));

    expect(temp.path.startsWith(join(root, '.tmp'))).toBe(true);
    expect(readFileSync(temp.path, 'utf8')).toBe('abcde');
    expect(temp.size).toBe(5);
  });

  it('removes the partial temp file when the source stream fails', async () => {
    const failing = new Readable({
      read() {
        this.push(Buffer.from('partial'));
        this.destroy(new Error('connection reset'));
      },
    });

    await expect(storage.writeTemp(failing)).rejects.toThrow('connection reset');
    expect(readdirSync(join(root, '.tmp'))).toEqual([]);
  });

  it('moves a committed file to meetings/<meetingId>/<fileId>', async () => {
    const temp = await storage.writeTemp(Readable.from([Buffer.from('bytes')]));
    const key = storage.keyFor('mtg_1', 'file_1');

    await storage.commit(temp.path, key);

    expect(key).toBe('meetings/mtg_1/file_1');
    expect(readFileSync(join(root, 'meetings', 'mtg_1', 'file_1'), 'utf8')).toBe('bytes');
    expect(existsSync(temp.path)).toBe(false);
  });

  it('removes a committed file by its key', async () => {
    const temp = await storage.writeTemp(Readable.from([Buffer.from('bytes')]));
    const key = storage.keyFor('mtg_1', 'file_1');
    await storage.commit(temp.path, key);

    await storage.remove(key);

    expect(existsSync(join(root, 'meetings', 'mtg_1', 'file_1'))).toBe(false);
  });

  it('clears temp files left by a previous process on start', async () => {
    writeFileSync(join(root, '.tmp', 'leftover'), 'crashed upload');

    await storage.onModuleInit();

    expect(readdirSync(join(root, '.tmp'))).toEqual([]);
  });
});
