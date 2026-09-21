#!/usr/bin/env node
/**
 * Entry point for hosts (Railway) whose zero-config builder needs a root
 * `start` script to detect the app at all, but where one repo root actually
 * holds several independently-run services (brief §2's monorepo layout).
 *
 * Dispatches to the right workspace's own `start` script based on
 * `SERVICE_TARGET`, an env var set per Railway service — not a shell
 * conditional, so this behaves identically on Windows (local dev) and the
 * Linux containers Railway builds in.
 */
import { spawnSync } from 'node:child_process';

const VALID_TARGETS = ['api', 'worker'];
const target = process.env.SERVICE_TARGET;

if (!VALID_TARGETS.includes(target)) {
  console.error(
    `SERVICE_TARGET must be one of ${VALID_TARGETS.join(', ')} (got ${JSON.stringify(target)}). ` +
      'Set it as an environment variable on the Railway service, e.g. `railway variable set SERVICE_TARGET=api --service api`.',
  );
  process.exit(1);
}

const result = spawnSync('npm', ['run', 'start', '-w', `@robinchan/${target}`], {
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
