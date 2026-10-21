#!/usr/bin/env node
// link-skill — safely point a .claude/skills/<skill> link at a skill directory.
// Windows: directory junction; POSIX: symlink. Never deletes a real directory.
// Zero dependencies, Node >= 18.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const USAGE = `link-skill — switch a skill link safely

usage:
  node scripts/link-skill.mjs status [--link-dir <dir>]
  node scripts/link-skill.mjs <skill> main [--link-dir <dir>]
  node scripts/link-skill.mjs <skill> <worktree-path> [--link-dir <dir>]
  node scripts/link-skill.mjs remove <skill> [--link-dir <dir>]

  status            list each link in <link-dir>, its target, and whether the
                    target exists
  main              target the main worktree's skills/<skill> (the first entry
                    of "git worktree list", even when run inside a worktree)
  <worktree-path>   target <worktree-path>/skills/<skill>; must exist
  remove            delete only the link itself (idempotent)

options:
  --link-dir <dir>  link directory (default: <main-worktree>/.claude/skills)

Replacing an existing link removes only the link itself. A real directory or
file at the link path is refused — delete it manually first.

Run "remove" before "git worktree remove": on Windows, recursive deletion can
follow a junction into the main checkout.`;

function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const pos = [];
  let linkDir = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help') return { help: true, pos, linkDir };
    if (a === '--link-dir') {
      linkDir = argv[++i];
      if (!linkDir) die('--link-dir needs a value');
    } else if (a.startsWith('--')) {
      die(`unknown option "${a}"`);
    } else {
      pos.push(a);
    }
  }
  return { help: false, pos, linkDir };
}

function mainWorktree() {
  // Resolve from this script's checkout, not the caller's cwd: sandbox
  // sessions are not git checkouts but still need main/worktree links.
  const r = spawnSync('git', ['-C', HERE, 'worktree', 'list', '--porcelain'], {
    encoding: 'utf8',
  });
  if (r.error || r.status !== 0)
    die(`git worktree list failed: ${r.error?.message || r.stderr || `exit ${r.status}`}`);
  for (const line of r.stdout.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) return path.resolve(line.slice('worktree '.length));
  }
  die('git worktree list returned no worktrees');
}

function cleanLinkTarget(target, linkPath) {
  let t = target;
  if (process.platform === 'win32' && t.startsWith('\\\\?\\')) t = t.slice(4);
  return path.isAbsolute(t) ? path.resolve(t) : path.resolve(path.dirname(linkPath), t);
}

function isLink(stat) {
  return stat.isSymbolicLink();
}

function removeLink(linkPath) {
  try {
    fs.unlinkSync(linkPath);
  } catch (e) {
    // Windows junctions are reparse points: unlink can fail, but rmdir removes
    // the junction itself without touching its target.
    if (e.code === 'EPERM' || e.code === 'EISDIR' || e.code === 'EACCES') {
      fs.rmdirSync(linkPath);
    } else {
      throw e;
    }
  }
}

function ensureDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    die(`cannot create ${dir}: ${e.message}`);
  }
}

function checkSkillName(skill) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill))
    die(`invalid skill name "${skill}" — expected kebab-case`);
}

function status(linkDir) {
  if (!fs.existsSync(linkDir)) {
    console.log(`no link directory: ${linkDir}`);
    return;
  }
  const entries = fs.readdirSync(linkDir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
  if (!entries.length) {
    console.log(`no links in ${linkDir}`);
    return;
  }
  for (const entry of entries) {
    const linkPath = path.join(linkDir, entry.name);
    let stat;
    try {
      stat = fs.lstatSync(linkPath);
    } catch (e) {
      console.log(`${entry.name} (unreadable: ${e.message})`);
      continue;
    }
    if (!isLink(stat)) {
      console.log(`${entry.name} (not a link)`);
      continue;
    }
    const target = cleanLinkTarget(fs.readlinkSync(linkPath), linkPath);
    console.log(`${entry.name} -> ${target} (${fs.existsSync(target) ? 'ok' : 'MISSING'})`);
  }
}

function remove(skill, linkDir) {
  checkSkillName(skill);
  const linkPath = path.join(linkDir, skill);
  let stat;
  try {
    stat = fs.lstatSync(linkPath);
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.log(`no link at ${linkPath}`);
      return;
    }
    die(`cannot inspect ${linkPath}: ${e.message}`);
  }
  if (!isLink(stat))
    die(`refusing to remove a real directory/file at ${linkPath} — nothing deleted`);
  try {
    removeLink(linkPath);
  } catch (e) {
    die(`cannot remove link ${linkPath}: ${e.message}`);
  }
  console.log(`removed ${linkPath}`);
}

function link(skill, targetArg, linkDir) {
  checkSkillName(skill);
  const main = mainWorktree();
  const linkPath = path.join(linkDir, skill);

  let target;
  if (targetArg === 'main') {
    target = path.join(main, 'skills', skill);
  } else {
    const root = path.resolve(targetArg);
    if (!fs.existsSync(root)) die(`worktree path does not exist: ${root}`);
    if (!fs.statSync(root).isDirectory()) die(`not a directory: ${root}`);
    target = path.join(root, 'skills', skill);
  }
  if (!fs.existsSync(target)) die(`target skill does not exist: ${target}`);
  if (!fs.statSync(target).isDirectory()) die(`target is not a directory: ${target}`);

  ensureDir(linkDir);

  let existing = null;
  try {
    existing = fs.lstatSync(linkPath);
  } catch (e) {
    if (e.code !== 'ENOENT') die(`cannot inspect ${linkPath}: ${e.message}`);
  }
  if (existing) {
    if (!isLink(existing))
      die(`refusing to replace a real directory/file at ${linkPath} — delete it manually first`);
    try {
      removeLink(linkPath);
    } catch (e) {
      die(`cannot remove existing link ${linkPath}: ${e.message}`);
    }
  }

  try {
    if (process.platform === 'win32') fs.symlinkSync(target, linkPath, 'junction');
    else fs.symlinkSync(target, linkPath, 'dir');
  } catch (e) {
    die(`cannot create link ${linkPath} -> ${target}: ${e.message}`);
  }
  console.log(`${linkPath} -> ${target}`);
}

const { help, pos, linkDir } = parseArgs(process.argv.slice(2));
if (help) {
  console.log(USAGE);
  process.exit(0);
}
if (!pos.length) {
  console.error(USAGE);
  process.exit(1);
}

const main = mainWorktree();
const dir = path.resolve(linkDir || path.join(main, '.claude', 'skills'));

if (pos[0] === 'status') {
  if (pos.length > 1) die(`unexpected argument "${pos[1]}"`);
  status(dir);
} else if (pos[0] === 'remove') {
  if (pos.length !== 2) die('usage: node scripts/link-skill.mjs remove <skill> [--link-dir <dir>]');
  remove(pos[1], dir);
} else {
  if (pos.length !== 2) die('usage: node scripts/link-skill.mjs <skill> <main|worktree-path> [--link-dir <dir>]');
  link(pos[0], pos[1], dir);
}
