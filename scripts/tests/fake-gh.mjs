#!/usr/bin/env node
// fake-gh — minimal gh stand-in for scripts/tests/run.mjs.
// State lives in $FAKE_GH_STATE (JSON). Supported:
//   gh pr list --head <branch> --state all --json number,url,state
//   gh pr create --draft --title <t> --body-file <f> --base main --head <branch>
//   gh pr edit <n> --body-file <f>
//   gh pr comment <n> --body-file <f>
//   gh pr view <n> --json number,url,state
// $FAKE_GH_FAIL is a comma-separated list of command substrings that must fail,
// e.g. "create,comment".

import fs from 'node:fs';

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
} else {
  console.error(`fake gh: unsupported command "${sub}"`);
  process.exit(2);
}
