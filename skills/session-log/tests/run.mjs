#!/usr/bin/env node
// Fixture tests for the session-log claude-code backend and export dispatcher.
// Zero dependencies, Node >= 18. Run: node skills/session-log/tests/run.mjs
//
// Goldens are generated from the current implementation with TZ=UTC and a
// relative fixture path, then were inspected by hand. Keep this runner hermetic:
// every child gets TZ=UTC and no ambient CLAUDE_CODE_SESSION_ID /
// CLAUDE_CONFIG_DIR unless a test sets them explicitly.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND = path.join(HERE, '..', 'scripts', 'claude-code.mjs');
const EXPORT = path.join(HERE, '..', 'scripts', 'export.mjs');
const FIXTURE = 'fixtures/minimal.jsonl';
const GOLDEN = path.join(HERE, 'golden');
const SESSION_ID = '11111111-1111-4111-8111-111111111111';

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}`);
    for (const line of String(e?.stack || e).split(/\r?\n/)) console.log(`     ${line}`);
  }
}

function run(args, { cwd = HERE, env = {}, input } = {}) {
  const base = { ...process.env, TZ: 'UTC' };
  delete base.CLAUDE_CODE_SESSION_ID;
  delete base.CLAUDE_CONFIG_DIR;
  const r = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    input,
    env: { ...base, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  return r;
}

function runOk(args, opts) {
  const r = run(args, opts);
  assert.equal(r.status, 0, `exit ${r.status}\n${r.stderr}`);
  return r;
}

function golden(name) {
  return fs.readFileSync(path.join(GOLDEN, name), 'utf8').replace(/\r\n/g, '\n');
}

const normalize = (s) => s.replace(/\r\n/g, '\n');

// ---------- golden output ----------

for (const [name, args] of [
  ['summary', ['summary', FIXTURE]],
  ['transcript', ['transcript', FIXTURE]],
  ['user', ['user', FIXTURE]],
  ['tools', ['tools', FIXTURE]],
  ['usage', ['usage', FIXTURE]],
  ['get', ['get', FIXTURE, '1']],
]) {
  test(`golden: ${args.join(' ')}`, () => {
    const r = runOk([BACKEND, ...args]);
    assert.equal(normalize(r.stdout), golden(`${name}.txt`));
  });
}

// ---------- transcript flags ----------

test('transcript --no-meta hides meta bodies but keeps command entries', () => {
  const out = runOk([BACKEND, 'transcript', FIXTURE, '--no-meta']).stdout;
  assert.ok(!out.includes('Base directory for this skill'));
  assert.ok(out.includes('<command-name>/session-log</command-name>'));
  assert.ok(out.includes('(1 meta entries hidden'));
});

test('transcript --no-cmd hides command entries but keeps meta bodies', () => {
  const out = runOk([BACKEND, 'transcript', FIXTURE, '--no-cmd']).stdout;
  assert.ok(!out.includes('<command-name>/session-log</command-name>'));
  assert.ok(out.includes('Base directory for this skill'));
  assert.ok(out.includes('(1 command entries hidden'));
});

test('transcript --no-tools hides tool call and result lines', () => {
  const out = runOk([BACKEND, 'transcript', FIXTURE, '--no-tools']).stdout;
  assert.ok(!out.includes('→ Read'));
  assert.ok(!out.includes('← 33B'));
  assert.ok(out.includes("I'll inspect the README first."));
});

// ---------- JSON output ----------
// Known gaps in the current implementation, reported separately and not frozen
// here: transcript ignores --json, and usage --json appends its human-readable
// rows and total after the NDJSON records. get always prints JSON, so --json
// is a no-op there.

test('--json emits one JSON object for summary', () => {
  const out = runOk([BACKEND, 'summary', FIXTURE, '--json']).stdout.trim();
  assert.equal(out.split(/\r?\n/).length, 1);
  const obj = JSON.parse(out);
  assert.equal(obj.session.sessionIds[0], SESSION_ID);
  assert.equal(obj.conversation.toolCalls, 2);
  assert.equal(obj.conversation.userPrompts, 3);
  assert.equal(obj.usageByModel['claude-sonnet-5-5'].input, 990);
});

test('--json emits valid NDJSON for user/tools/grep', () => {
  const cases = [
    ['user', 5],
    ['tools', 2],
  ];
  for (const [cmd, count] of cases) {
    const lines = runOk([BACKEND, cmd, FIXTURE, '--json'])
      .stdout.trim()
      .split(/\r?\n/)
      .filter(Boolean);
    assert.equal(lines.length, count, `${cmd}: ${lines.length} lines`);
    for (const line of lines) JSON.parse(line);
  }
  const hits = runOk([BACKEND, 'grep', FIXTURE, 'README', '--json'])
    .stdout.trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  assert.equal(hits.length, 2);
  assert.equal(hits[0].idx, 1);
});

// ---------- grep invariants ----------

test('grep reports one line per matching event and -i is case-insensitive', () => {
  const out = runOk([BACKEND, 'grep', FIXTURE, 'README']).stdout;
  const lines = out.trim().split(/\r?\n/);
  assert.equal(lines.length, 2);
  assert.ok(lines[0].startsWith('#1'));
  assert.ok(lines[0].includes('⟦README⟧'));
  assert.equal(runOk([BACKEND, 'grep', FIXTURE, 'readme', '-i']).stdout, out);
});

// ---------- current-invocation trimming ----------

function withCurrentSession(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'session-log-current-'));
  try {
    const project = path.join(tmp, 'project');
    fs.mkdirSync(project, { recursive: true });
    const config = path.join(tmp, 'claude');
    const munge = (p) => p.replace(/[^A-Za-z0-9]/g, '-');
    const dir = path.join(config, 'projects', munge(project));
    fs.mkdirSync(dir, { recursive: true });
    const id = '22222222-2222-4222-8222-222222222222';
    const file = path.join(dir, `${id}.jsonl`);
    fs.copyFileSync(path.join(HERE, FIXTURE), file);
    return fn({
      cwd: project,
      file,
      env: { CLAUDE_CONFIG_DIR: config, CLAUDE_CODE_SESSION_ID: id },
    });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

test('current locator trims the invoking turn; --include-current restores it', () =>
  withCurrentSession(({ cwd, env }) => {
    const trimmed = runOk([BACKEND, 'user', 'current'], { cwd, env });
    assert.ok(!trimmed.stdout.includes('Now run the transcript parser.'));
    assert.ok(trimmed.stdout.includes('Show me how the fixture parser handles tool calls.'));
    assert.match(trimmed.stderr, /current invocation excluded from L10/);

    const full = runOk([BACKEND, 'user', 'current', '--include-current'], { cwd, env });
    assert.ok(full.stdout.includes('Now run the transcript parser.'));
  }));

test('an explicit path matching the current session is trimmed too', () =>
  withCurrentSession(({ cwd, file, env }) => {
    const trimmed = runOk([BACKEND, 'user', file], { cwd, env });
    assert.ok(!trimmed.stdout.includes('Now run the transcript parser.'));

    const full = runOk([BACKEND, 'user', file, '--include-current'], { cwd, env });
    assert.ok(full.stdout.includes('Now run the transcript parser.'));
  }));

test('an explicit path without env-backed resolution fails open (no trim)', () => {
  const out = runOk([BACKEND, 'user', FIXTURE]).stdout;
  assert.ok(out.includes('Now run the transcript parser.'));
});

// ---------- export dispatcher ----------

test('export writes the five views and reruns byte-identically', () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-log-export-'));
  try {
    const args = [EXPORT, 'claude-code', FIXTURE, '--out', outDir];
    runOk(args);
    const expected = [
      '11111111-summary.md',
      '11111111-tools.md',
      '11111111-transcript.md',
      '11111111-usage.md',
      '11111111-user.md',
    ];
    assert.deepEqual(fs.readdirSync(outDir).sort(), expected);

    const snapshot = Object.fromEntries(
      expected.map((f) => [f, fs.readFileSync(path.join(outDir, f), 'utf8')])
    );
    runOk(args);
    for (const f of expected)
      assert.equal(fs.readFileSync(path.join(outDir, f), 'utf8'), snapshot[f], f);

    assert.ok(!snapshot['11111111-transcript.md'].includes('→ Read'));
    assert.ok(!snapshot['11111111-transcript.md'].includes('Base directory for this skill'));
    assert.ok(snapshot['11111111-transcript.md'].includes('<command-name>/session-log</command-name>'));
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});

// ---------- errors and repeatability ----------

test('unknown command, missing file, and missing get ref exit nonzero', () => {
  assert.notEqual(run([BACKEND, 'bogus', FIXTURE]).status, 0);
  assert.notEqual(run([BACKEND, 'summary', 'fixtures/does-not-exist.jsonl']).status, 0);
  assert.notEqual(run([BACKEND, 'get', FIXTURE]).status, 0);
});

test('the same command twice is byte-identical', () => {
  const a = runOk([BACKEND, 'transcript', FIXTURE]).stdout;
  const b = runOk([BACKEND, 'transcript', FIXTURE]).stdout;
  assert.equal(a, b);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
