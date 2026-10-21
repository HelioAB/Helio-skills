#!/usr/bin/env node
// Integration tests for scripts/workitem.mjs against a temporary bare repo +
// clone and a fake gh. Zero dependencies. Run: node scripts/tests/run.mjs
//
// Nothing here touches GitHub: --gh always points at fake-gh.mjs, and
// FAKE_GH_STATE is a file under the temporary test root.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const WORKITEM = path.join(ROOT, 'scripts', 'workitem.mjs');
const FAKE_GH = path.join(HERE, 'fake-gh.mjs');

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

function run(args, { cwd = ROOT, env = {}, input } = {}) {
  const r = spawnSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    input,
    env: { ...process.env, ...env },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  return r;
}

function ok(args, opts) {
  const r = run(args, opts);
  assert.equal(r.status, 0, `exit ${r.status}\nstdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  return r;
}

function git(cwd, args, { allowFail = false } = {}) {
  const r = spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) throw r.error;
  if (r.status !== 0 && !allowFail)
    assert.fail(`git ${args.join(' ')} in ${cwd} failed:\n${r.stderr}`);
  return { status: r.status, stdout: (r.stdout || '').trim(), stderr: r.stderr || '' };
}

function readGh(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readSync(worktree) {
  return JSON.parse(
    fs.readFileSync(path.join(worktree, 'skills', 'demo', '_dev', 'sync.json'), 'utf8')
  );
}

function withRepo(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'workitem-test-'));
  try {
    const remote = path.join(tmp, 'remote.git');
    let r = spawnSync('git', ['init', '--bare', '--initial-branch=main', remote], {
      encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr);

    const repo = path.join(tmp, 'repo');
    r = spawnSync('git', ['clone', remote, repo], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);

    git(repo, ['config', 'user.name', 'Workitem Test']);
    git(repo, ['config', 'user.email', 'workitem@example.test']);
    fs.mkdirSync(path.join(repo, 'skills', 'demo'), { recursive: true });
    fs.writeFileSync(
      path.join(repo, 'skills', 'demo', 'SKILL.md'),
      '---\nname: demo\ndescription: fixture skill\n---\n\n# demo\n'
    );
    fs.writeFileSync(path.join(repo, '.gitignore'), '.worktree/\nskills/**/_dev/\n');
    fs.writeFileSync(path.join(repo, 'CHANGELOG.md'), '# Changelog\n');
    git(repo, ['add', '-A']);
    git(repo, ['commit', '-m', 'chore: seed test repo']);
    git(repo, ['push', '-u', 'origin', 'main']);

    const ghState = path.join(tmp, 'gh.json');
    fs.writeFileSync(ghState, JSON.stringify({ prs: [], calls: [], nextNumber: 1 }, null, 2));
    return fn({ tmp, repo, remote, ghState, env: { FAKE_GH_STATE: ghState } });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function planSave(repo, env, plan, topic = 'first') {
  return ok(
    [WORKITEM, 'plan', 'save', '--repo', repo, '--skill', 'demo', '--topic', topic, '--gh', FAKE_GH],
    { input: plan, env }
  );
}

function uatSave(worktree, env, extra) {
  return ok(
    [
      WORKITEM, 'uat', 'save',
      '--venue', 'worktree',
      '--session', 'sess-1',
      '--result', 'pass',
      ...extra,
      '--gh', FAKE_GH,
    ],
    { cwd: worktree, env }
  );
}

// ---------- plan save ----------

test('plan save creates a worktree, branch, empty commit, and draft PR', () =>
  withRepo(({ repo, ghState, env }) => {
    const plan = '# Plan: first\n\nGoal: verify plan save.\n';
    const r = planSave(repo, env, plan);

    const worktree = path.join(repo, '.worktree', 'demo', 'first');
    assert.match(r.stdout, /^worktree: /m);
    assert.match(r.stdout, /^plan: /m);
    assert.match(r.stdout, /^PR: https:\/\/example\.test\/pr\/1 \(created\)$/m);
    assert.ok(fs.existsSync(worktree));
    assert.equal(git(worktree, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout, 'demo/first');
    assert.equal(git(worktree, ['log', '-1', '--pretty=%s']).stdout, 'chore(demo): start first');
    assert.equal(git(worktree, ['rev-list', '--count', 'main..HEAD']).stdout, '1');
    assert.equal(git(worktree, ['diff', '--stat', 'main..HEAD']).stdout, '');
    assert.equal(
      fs.readFileSync(path.join(worktree, 'skills', 'demo', '_dev', 'plan.md'), 'utf8'),
      plan
    );

    const gh = readGh(ghState);
    assert.equal(gh.prs.length, 1);
    assert.equal(gh.prs[0].draft, true);
    assert.equal(gh.prs[0].branch, 'demo/first');
    assert.equal(gh.prs[0].base, 'main');
    assert.equal(gh.prs[0].body, plan);
  }));

test('a second plan save edits the same PR and does not add another commit', () =>
  withRepo(({ repo, ghState, env }) => {
    planSave(repo, env, '# Plan: first\n');
    const worktree = path.join(repo, '.worktree', 'demo', 'first');
    const revised = '# Plan: first (revised)\n\nGoal: updated.\n';
    const r = ok([WORKITEM, 'plan', 'save', '--gh', FAKE_GH], {
      cwd: worktree,
      input: revised,
      env,
    });

    assert.match(r.stdout, /\(updated\)/);
    const gh = readGh(ghState);
    assert.equal(gh.prs.length, 1);
    assert.equal(gh.prs[0].body, revised);
    assert.ok(gh.calls.some((c) => c.args[0] === 'pr' && c.args[1] === 'edit'));
    assert.equal(git(worktree, ['rev-list', '--count', 'main..HEAD']).stdout, '1');
  }));

// ---------- uat save ----------

test('uat save appends test-log and posts the same section as a PR comment', () =>
  withRepo(({ repo, ghState, env }) => {
    planSave(repo, env, '# Plan: first\n');
    const worktree = path.join(repo, '.worktree', 'demo', 'first');
    const r = uatSave(worktree, env, []);

    const log = fs.readFileSync(
      path.join(worktree, 'skills', 'demo', '_dev', 'test-log.md'),
      'utf8'
    );
    assert.match(log, /## UAT \d{4}-\d{2}-\d{2} — pass/);
    assert.match(log, /- venue: worktree/);
    assert.match(log, /- session: sess-1/);
    assert.match(r.stdout, /PR comment: posted/);

    const gh = readGh(ghState);
    assert.equal(gh.prs[0].comments.length, 1);
    assert.ok(gh.prs[0].comments[0].body.includes('- session: sess-1'));
  }));

test('repeating an identical uat section does not duplicate the log or comment', () =>
  withRepo(({ repo, ghState, env }) => {
    planSave(repo, env, '# Plan: first\n');
    const worktree = path.join(repo, '.worktree', 'demo', 'first');
    uatSave(worktree, env, []);
    const r = uatSave(worktree, env, []);

    assert.match(r.stdout, /already present/);
    assert.match(r.stdout, /already posted/);
    const log = fs.readFileSync(
      path.join(worktree, 'skills', 'demo', '_dev', 'test-log.md'),
      'utf8'
    );
    assert.equal(log.match(/## UAT/g).length, 1);
    assert.equal(readGh(ghState).prs[0].comments.length, 1);
  }));

test('uat save --final appends the approval section and posts it', () =>
  withRepo(({ repo, ghState, env }) => {
    planSave(repo, env, '# Plan: first\n');
    const worktree = path.join(repo, '.worktree', 'demo', 'first');
    const r = ok(
      [WORKITEM, 'uat', 'save', '--final', '--approval', 'yes', '--note', 'looks good', '--gh', FAKE_GH],
      { cwd: worktree, env }
    );

    assert.match(r.stdout, /PR comment: posted/);
    const log = fs.readFileSync(
      path.join(worktree, 'skills', 'demo', '_dev', 'test-log.md'),
      'utf8'
    );
    assert.match(log, /## UAT close — yes/);
    assert.match(log, /- approval: yes/);
    assert.match(log, /- note: looks good/);
    assert.equal(readGh(ghState).prs[0].comments.length, 1);
    assert.match(readGh(ghState).prs[0].comments[0].body, /- approval: yes/);
  }));

test('a failed comment is written locally, left pending, then sync retries', () =>
  withRepo(({ repo, ghState, env }) => {
    planSave(repo, env, '# Plan: first\n');
    const worktree = path.join(repo, '.worktree', 'demo', 'first');
    const failEnv = { ...env, FAKE_GH_FAIL: 'comment' };
    const r = uatSave(worktree, failEnv, ['--result', 'findings', '--findings', 'broken layout']);

    assert.match(r.stdout, /PR comment: pending/);
    const log = fs.readFileSync(
      path.join(worktree, 'skills', 'demo', '_dev', 'test-log.md'),
      'utf8'
    );
    assert.match(log, /broken layout/);
    assert.equal(readSync(worktree).pending.length, 1);
    assert.equal(readSync(worktree).pending[0].type, 'comment');
    assert.equal(readGh(ghState).prs[0].comments.length, 0);

    const synced = ok([WORKITEM, 'sync', '--gh', FAKE_GH], { cwd: worktree, env });
    assert.match(synced.stdout, /synced: comment/);
    assert.equal(readGh(ghState).prs[0].comments.length, 1);
    assert.equal(readSync(worktree).pending.length, 0);
    assert.equal(Object.keys(readSync(worktree).posted).length, 1);
  }));

test('a failed PR create leaves a pending upsert; sync creates the PR later', () =>
  withRepo(({ repo, ghState, env }) => {
    const plan = '# Plan: second\n';
    const failEnv = { ...env, FAKE_GH_FAIL: 'create' };
    const r = planSave(repo, failEnv, plan, 'second');

    assert.match(r.stdout, /PR: pending/);
    const worktree = path.join(repo, '.worktree', 'demo', 'second');
    assert.ok(fs.existsSync(worktree));
    assert.equal(readSync(worktree).pending[0].type, 'pr-upsert');
    assert.equal(readGh(ghState).prs.length, 0);

    const synced = ok([WORKITEM, 'sync', '--gh', FAKE_GH], { cwd: worktree, env });
    assert.match(synced.stdout, /synced: pr-upsert/);
    assert.equal(readGh(ghState).prs.length, 1);
    assert.equal(readGh(ghState).prs[0].body, plan);
    assert.equal(readSync(worktree).pending.length, 0);
  }));

// ---------- status and safety ----------

test('status reports branch, worktree, PR, and pending count', () =>
  withRepo(({ repo, env }) => {
    planSave(repo, env, '# Plan: first\n');
    const worktree = path.join(repo, '.worktree', 'demo', 'first');
    uatSave(worktree, env, []);
    const r = ok([WORKITEM, 'status', '--gh', FAKE_GH], { cwd: worktree, env });

    assert.match(r.stdout, /^worktree: /m);
    assert.match(r.stdout, /^branch: demo\/first$/m);
    assert.match(r.stdout, /^PR: #1 https:\/\/example\.test\/pr\/1 \(OPEN\)$/m);
    assert.match(r.stdout, /^pending: 0$/m);
  }));

test('sync with nothing pending is a no-op', () =>
  withRepo(({ repo, env }) => {
    planSave(repo, env, '# Plan: first\n');
    const worktree = path.join(repo, '.worktree', 'demo', 'first');
    const r = ok([WORKITEM, 'sync', '--gh', FAKE_GH], { cwd: worktree, env });
    assert.match(r.stdout, /nothing pending/);
  }));

test('error paths return nonzero', () =>
  withRepo(({ repo, env }) => {
    let r = run([WORKITEM, 'plan', 'save', '--repo', repo, '--gh', FAKE_GH], {
      env,
      input: '# p\n',
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /specify --skill and --topic/);

    r = run(
      [WORKITEM, 'plan', 'save', '--repo', repo, '--skill', 'demo', '--topic', 'Bad Topic', '--gh', FAKE_GH],
      { env, input: '# p\n' }
    );
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /kebab-case/);

    planSave(repo, env, '# Plan: first\n');
    const worktree = path.join(repo, '.worktree', 'demo', 'first');
    r = run(
      [WORKITEM, 'plan', 'save', '--skill', 'demo', '--topic', 'second', '--gh', FAKE_GH],
      { cwd: worktree, env, input: '# p\n' }
    );
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /different worktree/);

    r = run(
      [WORKITEM, 'uat', 'save', '--venue', 'worktree', '--session', 's', '--result', 'pass', '--gh', FAKE_GH],
      { cwd: repo, env }
    );
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /not <skill>\/<topic>/);

    r = run([WORKITEM, 'uat', 'save', '--final', '--approval', 'maybe', '--gh', FAKE_GH], {
      cwd: worktree,
      env,
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /--approval/);
  }));

test('_dev never appears in git status or the tracked file list', () =>
  withRepo(({ repo, env }) => {
    planSave(repo, env, '# Plan: first\n');
    const worktree = path.join(repo, '.worktree', 'demo', 'first');
    uatSave(worktree, env, []);

    assert.equal(git(worktree, ['status', '--porcelain']).stdout, '');
    assert.equal(git(repo, ['status', '--porcelain']).stdout, '');
    assert.ok(!git(worktree, ['ls-files']).stdout.includes('_dev'));
  }));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
