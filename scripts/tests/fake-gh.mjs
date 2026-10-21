#!/usr/bin/env node
// fake-gh — minimal gh stand-in for scripts/tests/run.mjs.
// State lives in $FAKE_GH_STATE (JSON). Supported:
//   gh pr list --head <branch> --state all --json number,url,state
//   gh pr create --draft --title <t> --body-file <f> --base main --head <branch>
//   gh pr edit <n> --body-file <f>
//   gh pr comment <n> --body-file <f>
//   gh pr view <n> --json number,url,state
//   gh pr ready <n>
//   gh pr merge <n> --rebase [--delete-branch]
// $FAKE_GH_FAIL is a comma-separated list of command substrings that must fail,
// e.g. "create,comment".
//
// When FAKE_GH_REPO and FAKE_GH_WORKTREE are set, "pr merge --rebase" also
// simulates the git side: rebase the worktree branch onto main, fast-forward
// main in the repo, push, and optionally delete the remote branch. This is a
// flow simulation, not a reproduction of GitHub's rebase merge.

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const statePath = process.env.FAKE_GH_STATE;
if (!statePath) {
  console.error('fake-gh: FAKE_GH_STATE is required');
  process.exit(2);
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return { prs: [], calls: [], nextNumber: 1 };
  }
}

const state = load();
state.prs ??= [];
state.calls ??= [];
state.nextNumber ??= 1;
state.deletedBranches ??= [];

const args = process.argv.slice(2);
const sub = args.slice(0, 2).join(' ');
const failPatterns = (process.env.FAKE_GH_FAIL || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const shouldFail = failPatterns.some((p) => sub.includes(p));

state.calls.push({ args, failed: shouldFail });
fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

if (shouldFail) {
  console.error(`fake gh: forced failure for "${sub}"`);
  process.exit(1);
}

function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

function bodyFromFile() {
  const file = flag('--body-file');
  return file ? fs.readFileSync(file, 'utf8') : null;
}

function save() {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function findPr(number) {
  return state.prs.find((p) => p.number === Number(number));
}

const urlFor = (n) => `https://example.test/pr/${n}`;

function git(cwd, gitArgs) {
  const r = spawnSync('git', ['-C', cwd, ...gitArgs], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    const detail = (r.error?.message || r.stderr || `exit ${r.status}`).trim();
    console.error(`fake gh: git ${gitArgs.join(' ')} failed: ${detail}`);
    process.exit(1);
  }
  return r.stdout || '';
}

if (args[0] === 'pr' && args[1] === 'list') {
  const head = flag('--head');
  const prs = state.prs
    .filter((p) => !head || p.branch === head)
    .map((p) => ({ number: p.number, url: p.url, state: p.state }));
  console.log(JSON.stringify(prs));
} else if (args[0] === 'pr' && args[1] === 'create') {
  const branch = flag('--head');
  const number = state.nextNumber++;
  const pr = {
    number,
    url: urlFor(number),
    title: flag('--title') || '',
    branch,
    base: flag('--base') || 'main',
    draft: args.includes('--draft'),
    state: 'OPEN',
    body: bodyFromFile() || '',
    comments: [],
  };
  state.prs.push(pr);
  save();
  console.log(pr.url);
} else if (args[0] === 'pr' && args[1] === 'edit') {
  const pr = findPr(args[2]);
  if (!pr) {
    console.error(`fake gh: no pull request #${args[2]}`);
    process.exit(1);
  }
  pr.body = bodyFromFile() ?? pr.body;
  save();
  console.log(pr.url);
} else if (args[0] === 'pr' && args[1] === 'comment') {
  const pr = findPr(args[2]);
  if (!pr) {
    console.error(`fake gh: no pull request #${args[2]}`);
    process.exit(1);
  }
  const body = bodyFromFile() || '';
  pr.comments.push({ body, createdAt: new Date().toISOString() });
  save();
  console.log(`${pr.url}#issuecomment-${pr.comments.length}`);
} else if (args[0] === 'pr' && args[1] === 'view') {
  const pr = findPr(args[2]);
  if (!pr) {
    console.error(`fake gh: no pull request #${args[2]}`);
    process.exit(1);
  }
  console.log(JSON.stringify({ number: pr.number, url: pr.url, state: pr.state }));
} else if (args[0] === 'pr' && args[1] === 'ready') {
  const pr = findPr(args[2]);
  if (!pr) {
    console.error(`fake gh: no pull request #${args[2]}`);
    process.exit(1);
  }
  pr.draft = false;
  save();
  console.log(pr.url);
} else if (args[0] === 'pr' && args[1] === 'merge') {
  const pr = findPr(args[2]);
  if (!pr) {
    console.error(`fake gh: no pull request #${args[2]}`);
    process.exit(1);
  }
  if (pr.draft) {
    console.error('fake gh: Pull request is still a draft');
    process.exit(1);
  }
  const repo = process.env.FAKE_GH_REPO;
  const worktree = process.env.FAKE_GH_WORKTREE;
  if (repo && worktree) {
    git(worktree, ['rebase', 'main']);
    git(repo, ['merge', '--ff-only', pr.branch]);
    git(repo, ['push', 'origin', 'main']);
    if (args.includes('--delete-branch')) {
      git(repo, ['push', 'origin', '--delete', pr.branch]);
      state.deletedBranches.push(pr.branch);
    }
  }
  pr.state = 'MERGED';
  save();
  console.log(`Merged pull request #${pr.number}`);
} else {
  console.error(`fake gh: unsupported command "${sub}"`);
  process.exit(2);
}
