#!/usr/bin/env node
// check — deterministic gate 1 for this repository: structure, frontmatter,
// relative links, script syntax, fixture tests, and repo invariants.
// Zero dependencies, Node >= 18, no network, no LLM. Usage: node scripts/check.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS = path.join(REPO, 'skills');
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const USAGE = `check — deterministic repository checks (gate 1)

usage: node scripts/check.mjs [--skill <name>] [--help]

Always checked:
  repo invariants    CLAUDE.md pointer, no tracked skills/**/_dev|_sources,
                     kebab-case skill dirs
  skill structure    SKILL.md, frontmatter name/description, relative links,
                     non-empty references/
  script syntax      node --check over skills/**/*.mjs and scripts/**/*.mjs
  fixture tests      scripts/tests/run.mjs

With --skill <name>, only that skill's structure and tests/run.mjs run
(repo invariants, script syntax, and script fixture tests still run).

Prints one PASS/FAIL line per check and exits 1 on any hard failure.`;

// ---------- output ----------

let passes = 0;
let failures = 0;
const warnings = [];

function pass(label) {
  passes++;
  console.log(`PASS ${label}`);
}

function fail(label, detail) {
  failures++;
  console.log(`FAIL ${label}`);
  if (detail)
    for (const line of String(detail).split(/\r?\n/)) console.log(`     ${line}`);
}

function warn(label, detail) {
  const text = `${label}${detail ? ` — ${detail}` : ''}`;
  warnings.push(text);
  console.log(`WARN ${text}`);
}

function rel(p) {
  return path.relative(REPO, p).split(path.sep).join('/');
}

// ---------- helpers ----------

function walk(dir, { filter = () => true, skipDir = () => false } = {}) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!skipDir(entry.name)) stack.push(full);
      } else if (entry.isFile() && filter(full)) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

function parseFrontmatter(text) {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end < 0) return null;
  const data = {};
  let key = null;
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const m = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (m) {
      key = m[1];
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      )
        value = value.slice(1, -1);
      data[key] = value;
    } else if (key && /^\s+/.test(line)) {
      data[key] = `${data[key] || ''} ${line.trim()}`.trim();
    }
  }
  return data;
}

// Remove fenced code blocks and inline code so examples are not treated as
// links. Skill docs legitimately show sample link syntax inside fences.
function stripCode(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/`[^`\n]*`/g, '');
}

function markdownLinks(text) {
  const targets = [];
  const stripped = stripCode(text);
  for (const m of stripped.matchAll(/!?\[[^\]]*\]\(([^)]*)\)/g)) targets.push(m[1]);
  for (const m of stripped.matchAll(/^\s{0,3}\[[^\]]+\]:\s*(\S+)/gm)) targets.push(m[1]);
  return targets;
}

function normalizeLinkTarget(raw) {
  let target = raw.trim();
  if (!target) return null;
  if (target.startsWith('<')) {
    const end = target.indexOf('>');
    if (end < 0) return null;
    target = target.slice(1, end);
  } else {
    target = target.split(/\s+/)[0];
  }
  if (!target || target.startsWith('#') || target.startsWith('/') || target.startsWith('//'))
    return null;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(target)) return null; // http:, mailto:, data:, …
  target = target.split('#')[0].split('?')[0];
  if (!target) return null;
  try {
    target = decodeURIComponent(target);
  } catch {}
  return target;
}

// ---------- repo invariants ----------

function checkClaudePointer() {
  const label = 'repo: CLAUDE.md is a fixed pointer to AGENTS.md';
  const expected =
    '@AGENTS.md\n\n<!-- 固定指针文件：永远不要编辑本文件，所有约定只写 AGENTS.md。此不变式由 .githooks/pre-commit 强制。 -->';
  let actual;
  try {
    actual = fs.readFileSync(path.join(REPO, 'CLAUDE.md'), 'utf8');
  } catch (e) {
    fail(label, e.message);
    return;
  }
  actual = actual.replace(/\r/g, '').replace(/\n+$/, '');
  if (actual === expected) pass(label);
  else fail(label, 'content differs from the fixed pointer; edit AGENTS.md instead');
}

function trackedFiles() {
  const r = spawnSync('git', ['-C', REPO, 'ls-files', '-z'], { encoding: 'utf8' });
  if (r.error || r.status !== 0)
    throw new Error(`git ls-files failed: ${r.error?.message || r.stderr || `exit ${r.status}`}`);
  return r.stdout.split('\0').filter(Boolean);
}

function checkTrackedDevDirs() {
  const label = 'repo: no tracked skills/**/_dev or _sources';
  const bad = trackedFiles().filter((f) => /^skills\/.*\/_(?:dev|sources)\//.test(f));
  if (!bad.length) pass(label);
  else fail(label, `${bad.length} tracked file(s):\n${bad.slice(0, 10).join('\n')}`);
}

function skillDirs() {
  if (!fs.existsSync(SKILLS)) return [];
  return fs
    .readdirSync(SKILLS, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

function checkSkillNames(skills) {
  const label = 'repo: skill directories are kebab-case';
  const bad = skills.filter((s) => !KEBAB.test(s));
  if (!bad.length) pass(label);
  else fail(label, bad.join(', '));
}

// ---------- skill structure ----------

function checkSkill(name) {
  const dir = path.join(SKILLS, name);
  const errors = [];
  const skillFile = path.join(dir, 'SKILL.md');

  if (!fs.existsSync(skillFile)) {
    errors.push('SKILL.md is missing');
  } else {
    let text;
    try {
      text = fs.readFileSync(skillFile, 'utf8');
    } catch (e) {
      errors.push(`SKILL.md cannot be read: ${e.message}`);
    }
    if (text !== undefined) {
      if (!text.trim()) errors.push('SKILL.md is empty');
      const fm = parseFrontmatter(text);
      if (!fm) {
        errors.push('SKILL.md frontmatter is missing or unterminated');
      } else {
        if (fm.name !== name) errors.push(`frontmatter name "${fm.name || ''}" != directory "${name}"`);
        if (!fm.description || !fm.description.trim()) errors.push('frontmatter description is empty');
      }
      for (const target of markdownLinks(text)) {
        const file = normalizeLinkTarget(target);
        if (!file) continue;
        const resolved = path.resolve(path.dirname(skillFile), file);
        if (!fs.existsSync(resolved)) errors.push(`broken relative link in SKILL.md: ${target}`);
      }
    }
  }

  const references = path.join(dir, 'references');
  if (fs.existsSync(references)) {
    for (const file of walk(references)) {
      if (fs.statSync(file).size === 0) errors.push(`empty reference file: ${rel(file)}`);
      if (!file.toLowerCase().endsWith('.md')) continue;
      let text;
      try {
        text = fs.readFileSync(file, 'utf8');
      } catch (e) {
        errors.push(`${rel(file)} cannot be read: ${e.message}`);
        continue;
      }
      for (const target of markdownLinks(text)) {
        const link = normalizeLinkTarget(target);
        if (!link) continue;
        const resolved = path.resolve(path.dirname(file), link);
        if (!fs.existsSync(resolved)) errors.push(`broken relative link in ${rel(file)}: ${target}`);
      }
    }
  }

  const label = `skills/${name}: structure, frontmatter, links, references`;
  if (!errors.length) pass(label);
  else fail(label, errors.join('\n'));
}

// ---------- script syntax ----------

function checkScriptSyntax() {
  const files = [
    ...walk(SKILLS, {
      filter: (f) => f.endsWith('.mjs'),
      skipDir: (d) => d.startsWith('_'),
    }),
    ...walk(path.join(REPO, 'scripts'), {
      filter: (f) => f.endsWith('.mjs'),
      skipDir: (d) => d.startsWith('_'),
    }),
  ];
  const bad = [];
  for (const file of files) {
    const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (r.status !== 0)
      bad.push(`${rel(file)}:\n${(r.stderr || r.stdout || `exit ${r.status}`).trim()}`);
  }
  const label = `scripts: node --check (${files.length} file${files.length === 1 ? '' : 's'})`;
  if (!bad.length) pass(label);
  else fail(label, bad.join('\n'));
}

// ---------- fixture tests ----------

function runTest(label, file) {
  const r = spawnSync(process.execPath, [file], {
    cwd: REPO,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status === 0) {
    pass(label);
    return;
  }
  const detail = [r.stdout, r.stderr].filter(Boolean).join('\n').trim();
  fail(label, detail || `exit ${r.status}`);
}

function checkScriptTests() {
  const file = path.join(REPO, 'scripts', 'tests', 'run.mjs');
  if (fs.existsSync(file)) runTest('scripts/tests/run.mjs', file);
}

function checkSkillTests(skills) {
  for (const name of skills) {
    const file = path.join(SKILLS, name, 'tests', 'run.mjs');
    if (fs.existsSync(file)) runTest(`skills/${name}/tests/run.mjs`, file);
  }
}

// ---------- CHANGELOG soft check (GitHub Actions only) ----------

function checkChangelog() {
  if (!process.env.GITHUB_ACTIONS || !process.env.GITHUB_BASE_REF) return;
  const base = `origin/${process.env.GITHUB_BASE_REF}`;
  const r = spawnSync(
    'git',
    ['-C', REPO, 'diff', '--name-only', `${base}...HEAD`],
    { encoding: 'utf8' }
  );
  if (r.status !== 0) {
    warn('changelog: cannot diff against base', (r.stderr || '').trim() || `exit ${r.status}`);
    return;
  }
  const files = r.stdout.split(/\r?\n/).filter(Boolean);
  if (files.some((f) => f.startsWith('skills/')) && !files.includes('CHANGELOG.md'))
    warn('changelog: skills/ changed but CHANGELOG.md did not', `${base}...HEAD`);
}

// ---------- main ----------

const argv = process.argv.slice(2);
let skillFilter = null;
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--help') {
    console.log(USAGE);
    process.exit(0);
  } else if (argv[i] === '--skill') {
    skillFilter = argv[++i];
    if (!skillFilter) {
      console.error('error: --skill needs a value');
      process.exit(1);
    }
  } else {
    console.error(`error: unknown argument "${argv[i]}"`);
    console.error(USAGE);
    process.exit(1);
  }
}

const allSkills = skillDirs();
if (skillFilter && !allSkills.includes(skillFilter)) {
  console.error(`error: unknown skill "${skillFilter}" — found: ${allSkills.join(', ') || '(none)'}`);
  process.exit(1);
}
const selected = skillFilter ? [skillFilter] : allSkills;

console.log(`check: repository root${skillFilter ? ` (skill ${skillFilter})` : ''}\n`);

checkClaudePointer();
checkTrackedDevDirs();
checkSkillNames(allSkills);
for (const name of selected) checkSkill(name);
checkScriptSyntax();
checkSkillTests(selected);
checkScriptTests();
checkChangelog();

console.log(
  `\n${passes} passed, ${failures} failed${warnings.length ? `, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''}`
);
process.exit(failures ? 1 : 0);
