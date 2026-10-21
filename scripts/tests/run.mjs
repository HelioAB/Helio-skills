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
    fs.writeFileSync(path.join(repo, '.gitignore'), '.worktree/\nskills/**/_dev/\n.claude/\n');
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

// ---------- full flow: plan -> UAT -> ready -> merge -> cleanup ----------

function linkScriptInRepo(repo) {
  const dir = path.join(repo, 'scripts');
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, 'link-skill.mjs');
  fs.copyFileSync(path.join(ROOT, 'scripts', 'link-skill.mjs'), target);
  return target;
}

function fakeGh(args, { cwd, env }) {
  const r = run([FAKE_GH, ...args], { cwd, env });
  assert.equal(r.status, 0, `fake gh ${args.join(' ')} failed:\n${r.stderr}`);
  return r;
}

function mergeAndCleanup({ repo, worktree, linkScript, env, branch }) {
  const flowEnv = { ...env, FAKE_GH_REPO: repo, FAKE_GH_WORKTREE: worktree };
  const sandboxDir = path.join(repo, '.claude', 'skills');
  const worktreeLinkDir = path.join(worktree, '.claude', 'skills');

  const draftMerge = run([FAKE_GH, 'pr', 'merge', '1', '--rebase'], {
    cwd: repo,
    env: flowEnv,
  });
  assert.notEqual(draftMerge.status, 0, 'a draft PR must not merge');
  assert.match(draftMerge.stderr, /still a draft/);

  fakeGh(['pr', 'ready', '1'], { cwd: repo, env: flowEnv });
  fakeGh(['pr', 'merge', '1', '--rebase'], { cwd: repo, env: flowEnv });

  git(repo, ['fetch', 'origin']);
  ok([linkScript, 'demo', 'main', '--link-dir', sandboxDir], { cwd: repo });
  ok([linkScript, 'remove', 'demo', '--link-dir', worktreeLinkDir], { cwd: worktree });
  git(repo, ['worktree', 'remove', worktree]);
  git(repo, ['pull', '--ff-only', 'origin', 'main']);
  git(repo, ['branch', '-D', branch]);
  git(repo, ['push', 'origin', '--delete', branch]);
  return sandboxDir;
}

function assertMergedAndClean({ repo, worktree, branch, sandboxDir }) {
  assert.ok(!fs.existsSync(worktree), `worktree still exists: ${worktree}`);
  assert.equal(
    git(repo, ['worktree', 'list', '--porcelain']).stdout.match(/^worktree /gm).length,
    1,
    'only the main checkout should remain'
  );
  assert.equal(git(repo, ['branch', '--list', branch]).stdout, '');
  assert.equal(git(repo, ['branch', '-r', '--list', `origin/${branch}`]).stdout, '');
  assert.ok(!fs.existsSync(path.join(repo, 'skills', 'demo', '_dev')));

  const norm = (p) => (process.platform === 'win32' ? p.toLowerCase() : p);
  assert.equal(
    norm(fs.realpathSync(path.join(sandboxDir, 'demo'))),
    norm(fs.realpathSync(path.join(repo, 'skills', 'demo'))),
    'the sandbox link must point back at the main checkout'
  );
}

test('fake-gh merge refuses drafts and --delete-branch removes the remote branch', () =>
  withRepo(({ repo, ghState, env }) => {
    planSave(repo, env, '# Plan: first\n');
    const worktree = path.join(repo, '.worktree', 'demo', 'first');
    fs.writeFileSync(
      path.join(worktree, 'skills', 'demo', 'check.mjs'),
      'export const ok = true;\n'
    );
    git(worktree, ['add', 'skills/demo/check.mjs']);
    git(worktree, ['commit', '-m', 'feat(demo): add check']);
    git(worktree, ['push', 'origin', 'demo/first']);

    const flowEnv = { ...env, FAKE_GH_REPO: repo, FAKE_GH_WORKTREE: worktree };
    const draft = run([FAKE_GH, 'pr', 'merge', '1', '--rebase'], { cwd: repo, env: flowEnv });
    assert.notEqual(draft.status, 0);
    assert.match(draft.stderr, /still a draft/);
    assert.equal(readGh(ghState).calls.at(-1).failed, true);

    fakeGh(['pr', 'ready', '1'], { cwd: repo, env: flowEnv });
    fakeGh(['pr', 'merge', '1', '--rebase', '--delete-branch'], { cwd: repo, env: flowEnv });

    const gh = readGh(ghState);
    assert.equal(gh.prs[0].state, 'MERGED');
    assert.deepEqual(gh.deletedBranches, ['demo/first']);
    assert.equal(git(repo, ['branch', '-r', '--list', 'origin/demo/first']).stdout, '');
    assert.equal(git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout, 'main');
    assert.equal(
      git(repo, ['show', 'main:skills/demo/check.mjs']).stdout,
      'export const ok = true;'
    );
  }));

test('flow A: plan -> UAT -> ready -> rebase merge -> cleanup -> next item', () =>
  withRepo(({ repo, ghState, env }) => {
    const worktree = path.join(repo, '.worktree', 'demo', 'first');
    const linkScript = linkScriptInRepo(repo);

    planSave(repo, env, '# Plan: first\n');

    fs.writeFileSync(
      path.join(worktree, 'skills', 'demo', 'check.mjs'),
      'export const ok = true;\n'
    );
    git(worktree, ['add', 'skills/demo/check.mjs']);
    git(worktree, ['commit', '-m', 'feat(demo): add check']);
    git(worktree, ['push', 'origin', 'demo/first']);
    ok(['--check', path.join(worktree, 'skills', 'demo', 'check.mjs')]);

    const sandboxDir = path.join(repo, '.claude', 'skills');
    ok([linkScript, 'demo', worktree, '--link-dir', sandboxDir], { cwd: repo });
    ok(
      [linkScript, 'demo', worktree, '--link-dir', path.join(worktree, '.claude', 'skills')],
      { cwd: worktree }
    );

    uatSave(worktree, env, []);
    const repeat = uatSave(worktree, env, []);
    assert.match(repeat.stdout, /already present/);
    assert.match(repeat.stdout, /already posted/);
    ok([WORKITEM, 'uat', 'save', '--final', '--approval', 'yes', '--gh', FAKE_GH], {
      cwd: worktree,
      env,
    });
    const status = ok([WORKITEM, 'status', '--gh', FAKE_GH], { cwd: worktree, env });
    assert.match(status.stdout, /^pending: 0$/m);

    mergeAndCleanup({ repo, worktree, linkScript, env, branch: 'demo/first' });
    assertMergedAndClean({ repo, worktree, branch: 'demo/first', sandboxDir });
    assert.equal(
      git(repo, ['show', 'main:skills/demo/check.mjs']).stdout,
      'export const ok = true;'
    );

    planSave(repo, env, '# Plan: second\n', 'second');
    assert.ok(fs.existsSync(path.join(repo, '.worktree', 'demo', 'second')));
    assert.equal(git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).stdout, 'main');
    assert.equal(readGh(ghState).prs.length, 2);
  }));

test('flow B: main advances while the work item is open', () =>
  withRepo(({ repo, env }) => {
    const worktree = path.join(repo, '.worktree', 'demo', 'first');
    const linkScript = linkScriptInRepo(repo);

    planSave(repo, env, '# Plan: first\n');

    fs.writeFileSync(path.join(repo, 'MAIN.md'), 'main side\n');
    git(repo, ['add', 'MAIN.md']);
    git(repo, ['commit', '-m', 'docs: main side change']);
    git(repo, ['push', 'origin', 'main']);

    fs.writeFileSync(
      path.join(worktree, 'skills', 'demo', 'check.mjs'),
      'export const ok = true;\n'
    );
    git(worktree, ['add', 'skills/demo/check.mjs']);
    git(worktree, ['commit', '-m', 'feat(demo): add check']);

    git(worktree, ['fetch', 'origin']);
    git(worktree, ['merge', 'origin/main', '-m', 'merge: sync with main']);
    git(worktree, ['push', 'origin', 'demo/first']);
    ok(['--check', path.join(worktree, 'skills', 'demo', 'check.mjs')]);

    const sandboxDir = path.join(repo, '.claude', 'skills');
    ok([linkScript, 'demo', worktree, '--link-dir', sandboxDir], { cwd: repo });
    ok(
      [linkScript, 'demo', worktree, '--link-dir', path.join(worktree, '.claude', 'skills')],
      { cwd: worktree }
    );

    uatSave(worktree, env, []);
    ok([WORKITEM, 'uat', 'save', '--final', '--approval', 'yes', '--gh', FAKE_GH], {
      cwd: worktree,
      env,
    });
    const status = ok([WORKITEM, 'status', '--gh', FAKE_GH], { cwd: worktree, env });
    assert.match(status.stdout, /^pending: 0$/m);

    const sandbox = mergeAndCleanup({ repo, worktree, linkScript, env, branch: 'demo/first' });
    assertMergedAndClean({ repo, worktree, branch: 'demo/first', sandboxDir: sandbox });
    assert.equal(git(repo, ['show', 'main:MAIN.md']).stdout, 'main side');
    assert.equal(
      git(repo, ['show', 'main:skills/demo/check.mjs']).stdout,
      'export const ok = true;'
    );
  }));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
