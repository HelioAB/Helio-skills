#!/usr/bin/env node
// workitem — save plans/UAT records, keep a draft PR in sync, and close a
// work item. Local files are authoritative; gh failures leave a pending entry
// that "sync" retries. Zero dependencies, Node >= 18.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const USAGE = `workitem — GitHub Flow work-item helper

usage:
  node scripts/workitem.mjs plan save [--skill <name>] [--topic <topic>] [--title <title>]
  node scripts/workitem.mjs uat save --venue <worktree|sandbox> --session <id> --result <pass|findings> [--findings <text>]
  node scripts/workitem.mjs uat save --final --approval <yes|waiver> [--note <text>]
  node scripts/workitem.mjs close [--sandbox <dir>] [--dry-run | --yes]
  node scripts/workitem.mjs sync
  node scripts/workitem.mjs status

common options:
  --repo <path>   plan save: the main checkout (default: git worktree list
                  first entry); uat/sync/status/close: the work item worktree
                  (default: the current checkout)
  --gh <path>     gh executable, or a Node fake (default: $GH_BIN or "gh")
  --help          show this help

plan save:
  Reads the plan markdown from stdin when piped; otherwise reuses
  <worktree>/skills/<skill>/_dev/plan.md. Creates .worktree/<skill>/<topic>
  and branch <skill>/<topic> from main when needed, makes one empty commit,
  pushes, and creates or updates the draft PR body. Never commits _dev.

uat save:
  Appends a section to <worktree>/skills/<skill>/_dev/test-log.md and posts
  the same section as a PR comment. Repeating an identical section is a no-op.
  On gh failure the local file is still written and a pending entry is saved.

close:
  Preflights pending: 0, a clean worktree, and a main checkout on main, then
  readies the draft PR, rebase-merges it, fetches and fast-forwards main,
  points <sandbox>/.claude/skills back at main (when --sandbox is given),
  removes the worktree's own skill link, removes the worktree, deletes the
  local and remote branch, and verifies the result. The pull runs before
  cleanup, so a failed pull leaves the worktree in place and close can rerun.
  Dry-run by default; --yes executes. A PR that is already MERGED skips
  ready/merge, so an interrupted close can resume.

sync / status:
  Retry pending remote writes / show branch, worktree, PR, and pending state.
  Pending and posted-comment hashes live in skills/<skill>/_dev/sync.json.`;

const VALUE_FLAGS = new Set([
  'skill', 'topic', 'title', 'venue', 'session', 'result', 'findings',
  'approval', 'note', 'repo', 'gh', 'sandbox',
]);
const BOOLEAN_FLAGS = new Set(['final', 'help', 'yes', 'dry-run']);
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function parseCli(argv) {
  const pos = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help') {
      flags.help = true;
    } else if (a.startsWith('--')) {
      const name = a.slice(2);
      if (BOOLEAN_FLAGS.has(name)) {
        flags[name] = true;
      } else if (VALUE_FLAGS.has(name)) {
        const value = argv[++i];
        if (value === undefined) die(`${a} needs a value`);
        flags[name] = value;
      } else {
        die(`unknown option "${a}"`);
      }
    } else {
      pos.push(a);
    }
  }
  return { pos, flags };
}

// ---------- process helpers ----------

function result(r) {
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: r.stdout || '',
    stderr: r.stderr || '',
  };
}

function errText(r) {
  return (r.stderr || r.stdout || r.error?.message || `exit ${r.status}`).trim();
}

function git(args, cwd, { allowFail = false } = {}) {
  const r = spawnSync('git', ['-C', cwd, ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) {
    if (allowFail) return { ok: false, status: -1, stdout: '', stderr: r.error.message };
    die(`git ${args.join(' ')} failed: ${r.error.message}`);
  }
  const out = result(r);
  if (!out.ok && !allowFail) die(`git ${args.join(' ')} failed: ${errText(out)}`);
  return out;
}

function toplevel(dir) {
  const r = git(['rev-parse', '--show-toplevel'], dir, { allowFail: true });
  return r.ok ? path.resolve(r.stdout.trim()) : null;
}

function mainWorktree(dir = process.cwd()) {
  const r = spawnSync('git', ['-C', dir, 'worktree', 'list', '--porcelain'], {
    encoding: 'utf8',
  });
  if (r.error || r.status !== 0)
    die(`git worktree list failed: ${r.error?.message || (r.stderr || '').trim() || `exit ${r.status}`}`);
  for (const line of r.stdout.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) return path.resolve(line.slice('worktree '.length));
  }
  die('git worktree list returned no worktrees');
}

function branchOf(dir) {
  const r = git(['rev-parse', '--abbrev-ref', 'HEAD'], dir, { allowFail: true });
  return r.ok ? r.stdout.trim() : null;
}

function worktreePaths(repo) {
  const r = git(['worktree', 'list', '--porcelain'], repo, { allowFail: true });
  if (!r.ok) return [];
  return r.stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith('worktree '))
    .map((line) => path.resolve(line.slice('worktree '.length)));
}

function samePath(a, b) {
  const x = path.resolve(a);
  const y = path.resolve(b);
  return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function parseBranch(branch) {
  const m = /^([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(branch || '');
  return m ? { skill: m[1], topic: m[2] } : null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- gh ----------

function ghBin(flags) {
  return flags.gh || process.env.GH_BIN || 'gh';
}

function gh(args, cwd, flags) {
  const bin = ghBin(flags);
  const nodeScript = /\.(?:mjs|js)$/i.test(bin);
  const cmd = nodeScript ? process.execPath : bin;
  const argv = nodeScript ? [bin, ...args] : args;
  const r = spawnSync(cmd, argv, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) return { ok: false, status: -1, stdout: '', stderr: r.error.message };
  return result(r);
}

function listPrs(branch, cwd, flags) {
  const r = gh(
    ['pr', 'list', '--head', branch, '--state', 'all', '--json', 'number,url,state,isDraft'],
    cwd,
    flags
  );
  if (!r.ok) return { ok: false, error: errText(r) };
  try {
    const prs = JSON.parse(r.stdout || '[]');
    return { ok: true, prs: Array.isArray(prs) ? prs : [] };
  } catch {
    return { ok: false, error: `gh pr list returned invalid JSON: ${r.stdout.slice(0, 200)}` };
  }
}

function createPr(branch, title, planPath, cwd, flags) {
  const r = gh(
    ['pr', 'create', '--draft', '--title', title, '--body-file', planPath, '--base', 'main', '--head', branch],
    cwd,
    flags
  );
  if (!r.ok) return { ok: false, error: errText(r) };
  const url = r.stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean).pop();
  return { ok: true, url: url || '(gh returned no URL)' };
}

function editPr(number, planPath, cwd, flags) {
  const r = gh(['pr', 'edit', String(number), '--body-file', planPath], cwd, flags);
  return r.ok ? { ok: true } : { ok: false, error: errText(r) };
}

function postComment(number, body, devDir, hash, cwd, flags) {
  ensureDir(devDir);
  const file = path.join(devDir, `.sync-comment-${hash.slice(0, 8)}.md`);
  fs.writeFileSync(file, body, 'utf8');
  const r = gh(['pr', 'comment', String(number), '--body-file', file], cwd, flags);
  fs.rmSync(file, { force: true });
  return r.ok ? { ok: true } : { ok: false, error: errText(r) };
}

// ---------- pending state ----------

function syncPath(devDir) {
  return path.join(devDir, 'sync.json');
}

function loadSync(devDir) {
  const state = readJson(syncPath(devDir), { pending: [], posted: {} });
  if (!Array.isArray(state.pending)) state.pending = [];
  if (!state.posted || typeof state.posted !== 'object') state.posted = {};
  return state;
}

function saveSync(devDir, state) {
  writeJson(syncPath(devDir), state);
}

function addUpsert(state, entry) {
  state.pending = state.pending.filter(
    (p) => !(p.type === 'pr-upsert' && p.branch === entry.branch)
  );
  state.pending.push(entry);
}

function addCommentPending(state, entry) {
  state.pending = state.pending.filter((p) => !(p.type === 'comment' && p.hash === entry.hash));
  state.pending.push(entry);
}

function clearPending(state, pred) {
  state.pending = state.pending.filter((p) => !pred(p));
}

// ---------- plan save ----------

function planContext(flags) {
  const repoArg = flags.repo ? path.resolve(flags.repo) : null;
  const repoTop = repoArg ? toplevel(repoArg) : null;
  if (repoArg && !repoTop) die(`--repo is not inside a git checkout: ${repoArg}`);
  const main = repoTop || mainWorktree();
  const cwdTop = toplevel(process.cwd());
  // Only a worktree of *this* repo can conflict with the requested target.
  // An explicit --repo from an unrelated cwd is a deliberate selection.
  const cwdInRepo =
    !!cwdTop && worktreePaths(main).some((p) => samePath(p, cwdTop));

  let skill = flags.skill;
  let topic = flags.topic;
  let worktree = null;

  if (skill && topic) {
    if (!KEBAB.test(skill)) die(`invalid skill name "${skill}" — expected kebab-case`);
    if (!KEBAB.test(topic)) die(`invalid topic "${topic}" — expected kebab-case`);
    worktree = path.join(main, '.worktree', skill, topic);
    if (cwdInRepo && !samePath(cwdTop, main) && !samePath(cwdTop, worktree))
      die(
        `current directory is a different worktree (${cwdTop}); ` +
          `cd to ${worktree} or run from the main checkout`
      );
  } else if (!skill && !topic) {
    if (!cwdInRepo || samePath(cwdTop, main))
      die('specify --skill and --topic (or run inside .worktree/<skill>/<topic>)');
    const rel = path.relative(path.join(main, '.worktree'), cwdTop);
    const parts = rel.split(path.sep);
    if (parts.length !== 2 || parts.some((p) => !p || p === '..' || p === '.'))
      die('cannot derive skill/topic from the current directory; pass --skill and --topic');
    [skill, topic] = parts;
    if (!KEBAB.test(skill) || !KEBAB.test(topic))
      die('cannot derive skill/topic from the current directory; pass --skill and --topic');
    worktree = cwdTop;
  } else {
    die('pass both --skill and --topic');
  }

  if (!fs.existsSync(path.join(main, 'skills', skill)))
    die(`unknown skill "${skill}" — ${path.join(main, 'skills', skill)} does not exist`);

  return { main, skill, topic, branch: `${skill}/${topic}`, worktree };
}

function warnMainAhead(main) {
  const r = git(['rev-list', '--left-right', '--count', 'main...origin/main'], main, {
    allowFail: true,
  });
  if (!r.ok) return;
  const [ahead, behind] = r.stdout.trim().split(/\s+/).map(Number);
  if (ahead > 0)
    console.error(
      `warning: local main is ${ahead} commit(s) ahead of origin/main; ` +
        'push main first so the PR carries only the work item commits'
    );
  if (behind > 0)
    console.error(
      `warning: local main is ${behind} commit(s) behind origin/main; rebase/update before merging`
    );
}

function printPlanResult(ctx, extra) {
  console.log(`worktree: ${ctx.worktree}`);
  console.log(`plan: ${path.join(ctx.worktree, 'skills', ctx.skill, '_dev', 'plan.md')}`);
  for (const line of extra) console.log(line);
}

function cmdPlanSave(flags) {
  const ctx = planContext(flags);
  const { main, skill, topic, branch } = ctx;
  warnMainAhead(main);

  let worktree = ctx.worktree;
  if (fs.existsSync(worktree)) {
    const top = toplevel(worktree);
    if (!top || !samePath(top, worktree))
      die(`${worktree} exists but is not a git worktree of this repository`);
    const current = branchOf(worktree);
    if (current !== branch)
      die(`worktree ${worktree} is on "${current}", expected "${branch}"`);
  } else {
    ensureDir(path.dirname(worktree));
    const branchExists = git(
      ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`],
      main,
      { allowFail: true }
    ).ok;
    const args = branchExists
      ? ['worktree', 'add', worktree, branch]
      : ['worktree', 'add', '-b', branch, worktree, 'main'];
    const r = git(args, main, { allowFail: true });
    if (!r.ok) die(`git worktree add failed: ${errText(r)}`);
  }

  const devDir = path.join(worktree, 'skills', skill, '_dev');
  const planPath = path.join(devDir, 'plan.md');

  let body = '';
  if (!process.stdin.isTTY) {
    try {
      body = fs.readFileSync(0, 'utf8');
    } catch {
      body = '';
    }
  }
  if (body.trim()) {
    ensureDir(devDir);
    fs.writeFileSync(planPath, body.endsWith('\n') ? body : `${body}\n`, 'utf8');
  } else if (!fs.existsSync(planPath)) {
    die(`no plan body: pipe markdown on stdin or create ${planPath}`);
  }

  const ahead = Number(git(['rev-list', '--count', 'main..HEAD'], worktree).stdout.trim());
  if (ahead === 0) {
    const commit = git(
      ['commit', '--allow-empty', '-m', `chore(${skill}): start ${topic}`],
      worktree,
      { allowFail: true }
    );
    if (!commit.ok) die(`empty commit failed: ${errText(commit)}`);
  }

  const state = loadSync(devDir);
  const title = flags.title || `${skill}: ${topic}`;

  const push = git(['push', '-u', 'origin', branch], worktree, { allowFail: true });
  if (!push.ok) {
    addUpsert(state, {
      type: 'pr-upsert',
      branch,
      skill,
      topic,
      title,
      planPath,
      worktree,
      createdAt: new Date().toISOString(),
    });
    saveSync(devDir, state);
    printPlanResult(ctx, [
      `warning: push failed: ${errText(push)}`,
      'PR: pending (sync to retry)',
    ]);
    return;
  }

  const list = listPrs(branch, worktree, flags);
  if (!list.ok) {
    addUpsert(state, {
      type: 'pr-upsert',
      branch,
      skill,
      topic,
      title,
      planPath,
      worktree,
      createdAt: new Date().toISOString(),
    });
    saveSync(devDir, state);
    printPlanResult(ctx, [
      `warning: gh pr list failed: ${list.error}`,
      'PR: pending (sync to retry)',
    ]);
    return;
  }

  if (list.prs.length) {
    const pr = list.prs[0];
    const edit = editPr(pr.number, planPath, worktree, flags);
    if (!edit.ok) {
      addUpsert(state, {
        type: 'pr-upsert',
        branch,
        skill,
        topic,
        title,
        planPath,
        worktree,
        createdAt: new Date().toISOString(),
      });
      saveSync(devDir, state);
      printPlanResult(ctx, [
        `warning: gh pr edit failed: ${edit.error}`,
        'PR: pending (sync to retry)',
      ]);
      return;
    }
    clearPending(state, (p) => p.type === 'pr-upsert' && p.branch === branch);
    saveSync(devDir, state);
    printPlanResult(ctx, [`PR: ${pr.url} (updated)`]);
    return;
  }

  const create = createPr(branch, title, planPath, worktree, flags);
  if (!create.ok) {
    addUpsert(state, {
      type: 'pr-upsert',
      branch,
      skill,
      topic,
      title,
      planPath,
      worktree,
      createdAt: new Date().toISOString(),
    });
    saveSync(devDir, state);
    printPlanResult(ctx, [
      `warning: gh pr create failed: ${create.error}`,
      'PR: pending (sync to retry)',
    ]);
    return;
  }
  clearPending(state, (p) => p.type === 'pr-upsert' && p.branch === branch);
  saveSync(devDir, state);
  printPlanResult(ctx, [`PR: ${create.url} (created)`]);
}

// ---------- uat save ----------

function workContext(flags) {
  const start = flags.repo ? path.resolve(flags.repo) : process.cwd();
  const worktree = toplevel(start);
  if (!worktree) die(`not inside a git checkout: ${start}`);
  const branch = branchOf(worktree);
  const parsed = parseBranch(branch);
  if (!parsed)
    die(
      `branch "${branch}" is not <skill>/<topic>; uat/sync/status/close must run inside a work item worktree`
    );
  const skillDir = path.join(worktree, 'skills', parsed.skill);
  if (!fs.existsSync(skillDir)) {
    if (parsed.skill === 'repo')
      die(
        `"${branch}" is a repository-level branch; workitem only serves ` +
          '<skill>/<topic> work items under skills/<skill> — handle repo work manually'
      );
    die(`skill directory does not exist: ${skillDir}`);
  }
  return {
    worktree,
    branch,
    skill: parsed.skill,
    topic: parsed.topic,
    devDir: path.join(skillDir, '_dev'),
  };
}

function buildSection(flags) {
  const date = today();
  if (flags.final) {
    if (!['yes', 'waiver'].includes(flags.approval))
      die('uat save --final needs --approval <yes|waiver>');
    return [
      `## UAT close — ${flags.approval}`,
      '',
      `- date: ${date}`,
      `- approval: ${flags.approval}`,
      `- note: ${flags.note || 'none'}`,
      '',
    ].join('\n');
  }
  if (!['worktree', 'sandbox'].includes(flags.venue))
    die('uat save needs --venue <worktree|sandbox>');
  if (!flags.session) die('uat save needs --session <id>');
  if (!['pass', 'findings'].includes(flags.result))
    die('uat save needs --result <pass|findings>');
  if (flags.result === 'findings' && !flags.findings)
    die('uat save --result findings needs --findings <text>');
  return [
    `## UAT ${date} — ${flags.result}`,
    '',
    `- date: ${date}`,
    `- venue: ${flags.venue}`,
    `- session: ${flags.session}`,
    `- result: ${flags.result}`,
    `- findings: ${flags.findings || 'none'}`,
    '',
  ].join('\n');
}

function appendSection(file, section) {
  ensureDir(path.dirname(file));
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (existing.includes(section.trim())) return false;
  const prefix = !existing ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
  fs.writeFileSync(file, existing + prefix + section, 'utf8');
  return true;
}

function sectionHash(section) {
  return crypto.createHash('sha256').update(section, 'utf8').digest('hex');
}

function cmdUatSave(flags) {
  const ctx = workContext(flags);
  const section = buildSection(flags);
  const hash = sectionHash(section);
  const logPath = path.join(ctx.devDir, 'test-log.md');
  const appended = appendSection(logPath, section);
  const state = loadSync(ctx.devDir);

  console.log(`test-log: ${logPath} (${appended ? 'appended' : 'already present'})`);

  if (state.posted[hash]) {
    console.log('PR comment: already posted');
    return;
  }
  if (state.pending.some((p) => p.type === 'comment' && p.hash === hash)) {
    console.log('PR comment: pending');
    return;
  }

  const list = listPrs(ctx.branch, ctx.worktree, flags);
  if (!list.ok || !list.prs.length) {
    addCommentPending(state, {
      type: 'comment',
      branch: ctx.branch,
      number: null,
      hash,
      body: section,
      createdAt: new Date().toISOString(),
    });
    saveSync(ctx.devDir, state);
    console.error(
      `warning: ${list.ok ? 'no pull request for this branch' : `gh pr list failed: ${list.error}`}`
    );
    console.log('PR comment: pending');
    return;
  }

  const pr = list.prs[0];
  const posted = postComment(pr.number, section, ctx.devDir, hash, ctx.worktree, flags);
  if (!posted.ok) {
    addCommentPending(state, {
      type: 'comment',
      branch: ctx.branch,
      number: pr.number,
      hash,
      body: section,
      createdAt: new Date().toISOString(),
    });
    saveSync(ctx.devDir, state);
    console.error(`warning: gh pr comment failed: ${posted.error}`);
    console.log('PR comment: pending');
    return;
  }

  state.posted[hash] = { branch: ctx.branch, at: new Date().toISOString() };
  clearPending(state, (p) => p.type === 'comment' && p.hash === hash);
  saveSync(ctx.devDir, state);
  console.log(`PR comment: posted (${pr.url})`);
}

// ---------- close ----------

function linkScriptRun(main, args) {
  const r = spawnSync(
    process.execPath,
    [path.join(main, 'scripts', 'link-skill.mjs'), ...args],
    { cwd: main, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  if (r.error) die(`link-skill ${args.join(' ')} failed: ${r.error.message}`);
  const out = result(r);
  if (!out.ok) die(`link-skill ${args.join(' ')} failed: ${errText(out)}`);
  return out;
}

function localBranchExists(main, branch) {
  return git(['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], main, {
    allowFail: true,
  }).ok;
}

function remoteBranchExists(main, branch) {
  return git(['ls-remote', '--heads', 'origin', branch], main).stdout.trim() !== '';
}

function verifySandboxLink(sandbox, main, skill) {
  const linkPath = path.join(sandbox, '.claude', 'skills', skill);
  let stat;
  try {
    stat = fs.lstatSync(linkPath);
  } catch {
    die(`sandbox link is missing: ${linkPath}`);
  }
  if (!stat.isSymbolicLink()) die(`sandbox path is not a link: ${linkPath}`);
  let target;
  try {
    target = fs.realpathSync(linkPath);
  } catch (e) {
    die(`sandbox link is broken: ${linkPath} (${e.message})`);
  }
  const expected = fs.realpathSync(path.join(main, 'skills', skill));
  if (!samePath(target, expected))
    die(`sandbox link points at ${target}, expected ${expected}`);
}

function cmdClose(flags) {
  if (flags.yes && flags['dry-run']) die('close accepts either --yes or --dry-run, not both');
  const dryRun = !flags.yes;
  const ctx = workContext(flags);
  const { worktree, branch, skill, devDir } = ctx;
  const main = mainWorktree(worktree);

  // Preflight: every check fails closed before anything is changed.
  const state = loadSync(devDir);
  if (state.pending.length)
    die(
      `pending: ${state.pending.length} unsynced write(s); ` +
        'run "node scripts/workitem.mjs sync" first'
    );

  const worktreeStatus = git(['status', '--porcelain'], worktree);
  if (worktreeStatus.stdout.trim())
    die(
      `worktree has uncommitted changes; commit or discard them first:\n` +
        worktreeStatus.stdout.trim()
    );

  const mainBranch = branchOf(main);
  if (mainBranch !== 'main')
    die(`main checkout (${main}) is on "${mainBranch}", expected "main"`);
  // Unrelated changes in the main checkout are fine: pull --ff-only leaves
  // them alone, and if it cannot, it fails before any cleanup.

  const list = listPrs(branch, worktree, flags);
  if (!list.ok) die(`gh pr list failed: ${list.error}`);
  if (!list.prs.length) die(`no pull request for branch "${branch}"`);
  const pr = list.prs[0];
  if (!['OPEN', 'MERGED'].includes(pr.state))
    die(`pull request #${pr.number} is ${pr.state}; only OPEN or MERGED can be closed`);

  let sandbox = null;
  if (flags.sandbox) {
    sandbox = path.resolve(flags.sandbox);
    let ok = false;
    try {
      ok = fs.statSync(sandbox).isDirectory();
    } catch {
      ok = false;
    }
    if (!ok) die(`--sandbox is not a directory: ${sandbox}`);
  }

  const sandboxLinkDir = sandbox ? path.join(sandbox, '.claude', 'skills') : null;
  const worktreeLinkDir = path.join(worktree, '.claude', 'skills');

  console.log(`worktree: ${worktree}`);
  console.log(`branch: ${branch}`);
  console.log(`PR: #${pr.number} ${pr.url} (${pr.state}${pr.isDraft ? ', draft' : ''})`);

  function step(label, skipReason, action) {
    if (skipReason) {
      console.log(`skip: ${label} (${skipReason})`);
      return;
    }
    if (dryRun) {
      console.log(`would run: ${label}`);
      return;
    }
    console.log(`run: ${label}`);
    action();
  }

  step(
    `gh pr ready ${pr.number}`,
    pr.state === 'MERGED'
      ? 'PR already merged'
      : pr.isDraft
        ? null
        : 'PR is not a draft',
    () => {
      const r = gh(['pr', 'ready', String(pr.number)], main, flags);
      if (!r.ok) die(`gh pr ready failed: ${errText(r)}`);
    }
  );

  step(`gh pr merge ${pr.number} --rebase`, pr.state === 'MERGED' ? 'PR already merged' : null, () => {
    const r = gh(['pr', 'merge', String(pr.number), '--rebase'], main, flags);
    if (!r.ok) die(`gh pr merge failed: ${errText(r)}`);
    const after = listPrs(branch, main, flags);
    if (!after.ok) die(`gh pr list failed after merge: ${after.error}`);
    if (!after.prs.length || after.prs[0].state !== 'MERGED')
      die(`PR #${pr.number} did not reach MERGED (state: ${after.prs[0]?.state || 'missing'})`);
  });

  step(`git -C ${main} fetch origin`, null, () => git(['fetch', 'origin'], main));

  step('git pull --ff-only origin main', null, () =>
    git(['pull', '--ff-only', 'origin', 'main'], main)
  );

  if (sandbox)
    step(`link-skill ${skill} main --link-dir ${sandboxLinkDir}`, null, () =>
      linkScriptRun(main, [skill, 'main', '--link-dir', sandboxLinkDir])
    );
  else console.log('skip: sandbox link (no --sandbox)');

  step(`link-skill remove ${skill} --link-dir ${worktreeLinkDir}`, null, () =>
    linkScriptRun(main, ['remove', skill, '--link-dir', worktreeLinkDir])
  );

  step(`git -C ${main} worktree remove ${worktree}`, null, () => {
    // The caller may be sitting in the worktree; step out before deleting it.
    process.chdir(main);
    git(['worktree', 'remove', worktree], main);
  });

  step(
    `git branch -D ${branch}`,
    localBranchExists(main, branch) ? null : 'local branch already deleted',
    () => git(['branch', '-D', branch], main)
  );

  step(
    `git push origin --delete ${branch}`,
    remoteBranchExists(main, branch) ? null : 'remote branch already deleted',
    () => git(['push', 'origin', '--delete', branch], main)
  );

  if (dryRun) {
    console.log('would verify: worktree gone, local and remote branch gone, sandbox link on main');
    console.log(`dry run: no changes made (PR ${pr.url})`);
    return;
  }

  if (worktreePaths(main).some((p) => samePath(p, worktree)))
    die(`worktree still present after removal: ${worktree}`);
  if (localBranchExists(main, branch)) die(`local branch still exists: ${branch}`);
  if (remoteBranchExists(main, branch)) die(`remote branch still exists on origin: ${branch}`);
  if (sandbox) verifySandboxLink(sandbox, main, skill);

  console.log(
    'verify: worktree removed, local and remote branch deleted' +
      (sandbox ? ', sandbox link points at main' : '')
  );
  console.log(`close complete: ${pr.url}`);
}

// ---------- sync ----------

function cmdSync(flags) {
  const ctx = workContext(flags);
  const state = loadSync(ctx.devDir);
  if (!state.pending.length) {
    console.log('nothing pending');
    return;
  }

  let failed = 0;
  for (const entry of [...state.pending]) {
    if (entry.type === 'pr-upsert') {
      if (!fs.existsSync(entry.planPath)) {
        console.error(`warning: plan file is gone: ${entry.planPath}`);
        failed++;
        continue;
      }
      const push = git(['push', '-u', 'origin', entry.branch], ctx.worktree, { allowFail: true });
      if (!push.ok) {
        console.error(`warning: push failed for ${entry.branch}: ${errText(push)}`);
        failed++;
        continue;
      }
      const list = listPrs(entry.branch, ctx.worktree, flags);
      if (!list.ok) {
        console.error(`warning: gh pr list failed: ${list.error}`);
        failed++;
        continue;
      }
      let done;
      if (list.prs.length) {
        done = editPr(list.prs[0].number, entry.planPath, ctx.worktree, flags);
      } else {
        done = createPr(entry.branch, entry.title, entry.planPath, ctx.worktree, flags);
      }
      if (!done.ok) {
        console.error(`warning: gh pr upsert failed: ${done.error}`);
        failed++;
        continue;
      }
      clearPending(state, (p) => p === entry);
      saveSync(ctx.devDir, state);
      console.log(`synced: pr-upsert ${entry.branch}`);
      continue;
    }

    if (entry.type === 'comment') {
      const list = listPrs(entry.branch, ctx.worktree, flags);
      if (!list.ok || !list.prs.length) {
        console.error(
          `warning: ${list.ok ? 'no pull request for this branch' : `gh pr list failed: ${list.error}`}`
        );
        failed++;
        continue;
      }
      const pr = list.prs[0];
      const posted = postComment(pr.number, entry.body, ctx.devDir, entry.hash, ctx.worktree, flags);
      if (!posted.ok) {
        console.error(`warning: gh pr comment failed: ${posted.error}`);
        failed++;
        continue;
      }
      state.posted[entry.hash] = { branch: entry.branch, at: new Date().toISOString() };
      clearPending(state, (p) => p === entry);
      saveSync(ctx.devDir, state);
      console.log(`synced: comment ${entry.hash.slice(0, 8)}`);
      continue;
    }

    console.error(`warning: unknown pending entry type "${entry.type}"`);
    failed++;
  }

  if (failed) {
    console.error(`pending: ${failed} item(s) still unsynced`);
    process.exit(1);
  }
  console.log('sync: all pending items sent');
}

// ---------- status ----------

function cmdStatus(flags) {
  const start = flags.repo ? path.resolve(flags.repo) : process.cwd();
  const worktree = toplevel(start);
  if (!worktree) die(`not inside a git checkout: ${start}`);
  const branch = branchOf(worktree);
  const parsed = parseBranch(branch);

  console.log(`worktree: ${worktree}`);
  console.log(`branch: ${branch}`);
  if (!parsed) {
    console.log('PR: n/a (not inside a work item worktree)');
    console.log('pending: n/a');
    return;
  }

  const skillDir = path.join(worktree, 'skills', parsed.skill);
  if (!fs.existsSync(skillDir)) die(`skill directory does not exist: ${skillDir}`);
  const devDir = path.join(skillDir, '_dev');

  const list = listPrs(branch, worktree, flags);
  if (!list.ok) {
    console.log(`PR: unknown (gh pr list failed: ${list.error})`);
  } else if (!list.prs.length) {
    console.log('PR: none');
  } else {
    const pr = list.prs[0];
    console.log(`PR: #${pr.number} ${pr.url} (${pr.state || 'unknown'})`);
  }

  const state = loadSync(devDir);
  const types = [...new Set(state.pending.map((p) => p.type))];
  console.log(`pending: ${state.pending.length}${types.length ? ` (${types.join(', ')})` : ''}`);
}

// ---------- main ----------

const { pos, flags } = parseCli(process.argv.slice(2));
if (flags.help) {
  console.log(USAGE);
  process.exit(0);
}

const [cmd, sub, ...extra] = pos;
if (!cmd) {
  console.error(USAGE);
  process.exit(1);
}
if (extra.length) die(`unexpected argument "${extra[0]}"`);

if (cmd === 'plan' && sub === 'save') {
  cmdPlanSave(flags);
} else if (cmd === 'uat' && sub === 'save') {
  cmdUatSave(flags);
} else if (cmd === 'close' && sub === undefined) {
  cmdClose(flags);
} else if (cmd === 'sync' && sub === undefined) {
  cmdSync(flags);
} else if (cmd === 'status' && sub === undefined) {
  cmdStatus(flags);
} else {
  die(`unknown command "${[cmd, sub].filter(Boolean).join(' ')}" — see --help`);
}
