import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * API dan worker dijalankan dari direktori kerja masing-masing, jadi jalur
 * `.data/` harus dipatok ke akar monorepo — bukan ke `process.cwd()`.
 */
export function repoRoot(): string {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 8; i += 1) {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg)) {
      try {
        const parsed = JSON.parse(readFileSync(pkg, 'utf8')) as {
          workspaces?: unknown;
        };
        if (parsed.workspaces) return dir;
      } catch {
        /* lanjut naik */
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function dataDir(): string {
  return process.env.RC_DATA_DIR ?? join(repoRoot(), '.data');
}
