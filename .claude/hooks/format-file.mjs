#!/usr/bin/env node
// PostToolUse hook: formats the file Claude just wrote with the repo's Prettier.
// Reads the hook payload as JSON on stdin and stays silent when there is nothing
// to do, so a missing dependency or an unexpected payload never blocks a tool call.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Run Prettier's JS entry point through node: on Windows spawning the .CMD
// shim requires a shell, and the repo-local binary keeps the version pinned.
const prettier = join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs');

let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) raw += chunk;

let file;

try {
  const payload = JSON.parse(raw);
  file = payload.tool_response?.filePath ?? payload.tool_input?.file_path;
} catch {
  process.exit(0);
}

if (!file || !existsSync(prettier)) {
  process.exit(0);
}

// Never touch files outside the repository — scratchpad and temp files included.
const target = resolve(String(file));
const insideRepo = relative(root, target);

if (!insideRepo || insideRepo.startsWith('..') || isAbsolute(insideRepo)) {
  process.exit(0);
}

// --ignore-unknown skips file types Prettier does not handle; .prettierignore is
// resolved from the repo root.
spawnSync(process.execPath, [prettier, '--write', '--ignore-unknown', target], {
  cwd: root,
  stdio: 'ignore',
});
