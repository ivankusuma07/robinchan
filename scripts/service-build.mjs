#!/usr/bin/env node
/**
 * Root `build` script. `apps/api` and `apps/worker` run straight off
 * `tsx` (see their own `start` scripts) and have no separate build step —
 * only `apps/web` needs one. When `SERVICE_TARGET` marks this as an api or
 * worker deploy (Railway), skip the Next.js build entirely rather than
 * waste build minutes compiling a service that never gets served here.
 * With `SERVICE_TARGET` unset (local dev, and Vercel building apps/web),
 * this is unchanged from before: it just builds the web app.
 */
import { spawnSync } from 'node:child_process';

const target = process.env.SERVICE_TARGET;

if (target === 'api' || target === 'worker') {
  console.log(`Skipping the @robinchan/web build (SERVICE_TARGET=${target}).`);
  process.exit(0);
}

const result = spawnSync('npm', ['run', 'build', '-w', '@robinchan/web'], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
