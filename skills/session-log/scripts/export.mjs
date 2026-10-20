#!/usr/bin/env node
// export — dispatcher-level bundle exporter for session-log backends.
// Runs a backend's canonical views and writes <out>/<uuid8>-<view>.md.
// Zero dependencies, Node >= 18. Usage overview: run with --help.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// One entry per backend. A backend stays print-only; bundle orchestration,
// naming, and transcript rendering live here.
const BACKENDS = {
  'claude-code': {
    aliases: ['claude-code', 'claude', 'cc'],
    script: path.join(HERE, 'claude-code.mjs'),
    transcriptFlags: ['--no-tools', '--no-meta'],
  },
};

const VIEWS = ['summary', 'transcript', 'user', 'tools', 'usage'];

const USAGE = `export — write the canonical session-log export bundle

usage: node export.mjs <backend> <locator> [options]

backend     claude-code (aliases: claude, cc)
locator     a session log path, or "current" for the invoking session
views       summary, transcript, user, tools, usage

options:
  --out <dir>          target directory (default: <project-root>/session-logs)
  --views <list>       comma-separated subset of views
                       (default: summary,transcript,user,tools,usage)
  --include-current    pass through to every view (include the current
                       invocation when the locator is "current")
  --help               show this help

Writes <out>/<uuid8>-<view>.md, creating <out> and overwriting same-name files.
The bundle is regenerable from the source log; the .jsonl stays the record.`;

function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function parseCli(argv) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' || a === '--views') {
      const v = argv[++i];
      if (v === undefined) die(`${a} needs a value`);
      flags[a] = v;
    } else if (a === '--include-current' || a === '--help') {
      flags[a] = true;
    } else if (a.startsWith('--')) {
      die(`unknown option "${a}"`);
    } else {
      pos.push(a);
    }
  }
  return { pos, flags };
}

function backendEntry(name) {
  for (const [key, entry] of Object.entries(BACKENDS))
    if (entry.aliases.includes(name)) return { key, ...entry };
  return null;
}

function projectRoot() {
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return top || process.cwd();
  } catch {
    return process.cwd();
  }
}

function sessionKey(backend, locator) {
  const r = spawnSync(process.execPath, [backend.script, 'summary', locator, '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status === 0) {
    try {
      const first = r.stdout.trim().split(/\r?\n/)[0] || '{}';
      const id = JSON.parse(first).session?.sessionIds?.[0];
      if (id) return String(id).slice(0, 8);
    } catch {}
  }
  if (locator !== 'current') {
    const base = path.basename(locator).replace(/\.jsonl$/i, '');
    if (base) return base.slice(0, 8);
  }
  die('cannot determine the session id for file naming');
}

const { pos, flags } = parseCli(process.argv.slice(2));
if (flags['--help'] || !pos.length) {
  console.log(USAGE);
  process.exit(flags['--help'] ? 0 : 1);
}

const [backendArg, locator, ...extra] = pos;
if (!backendArg || !locator) die('usage: node export.mjs <backend> <locator> [options]');
if (extra.length) die(`unexpected argument "${extra[0]}"`);

const backend = backendEntry(backendArg);
if (!backend) die(`unknown backend "${backendArg}" — supported: claude-code`);

const views = (flags['--views'] || VIEWS.join(','))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (!views.length) die('--views is empty');
for (const v of views) if (!VIEWS.includes(v)) die(`unknown view "${v}" — supported: ${VIEWS.join(', ')}`);

const outDir = path.resolve(flags['--out'] || path.join(projectRoot(), 'session-logs'));
fs.mkdirSync(outDir, { recursive: true });
const key = sessionKey(backend, locator);

const written = [];
for (const view of views) {
  const args = [backend.script, view, locator];
  if (view === 'transcript') args.push(...backend.transcriptFlags);
  if (flags['--include-current']) args.push('--include-current');
  const r = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (r.error) die(`view "${view}" failed to run: ${r.error.message}`);
  if (r.status !== 0) {
    if (r.stderr) process.stderr.write(r.stderr);
    die(`view "${view}" failed (exit ${r.status})`);
  }
  const file = path.join(outDir, `${key}-${view}.md`);
  fs.writeFileSync(file, r.stdout, 'utf8');
  written.push(file);
}

for (const file of written) console.log(file);
