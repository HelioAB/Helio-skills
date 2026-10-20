#!/usr/bin/env node
// claude-code — session-log backend: parse Claude Code conversation-history .jsonl files.
// Zero dependencies, Node >= 18. Usage overview: run without arguments.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// ---------- CLI ----------

const USAGE = `claude-code — session-log backend: Claude Code conversation-history .jsonl

usage: node claude-code.mjs <command> <file|current> [args] [options]

commands:
  summary              session overview: meta, timeline, counts, tools, tokens
  transcript           readable conversation (merged turns, [compact-summary] lines)
  user                 real user prompts only
  tools                tool calls with brief input + result status
  usage                token usage per assistant message + totals
  get <ref>            full JSON of one entry; ref = event idx | L<line> | uuid prefix
  grep <pattern>       regex search across text/thinking/tools/results/attachments

options:
  --sidechain          include isSidechain (subagent) entries; hidden by default
  --thinking           include thinking blocks (transcript, grep)
  --no-tools           hide tool call/result lines (transcript)
  --no-meta            hide harness-injected [meta] skill bodies (transcript)
  --no-cmd             hide harness command entries (transcript)
  --include-current    include the current invocation when the target is the
                       current session (by default the trailing turn is cut)
  --only <list>        transcript roles: user,assistant,attachment,compact-summary
                       (default user,assistant,compact-summary)
  --full               user: print full prompt text instead of preview
  --max-len <n>        truncate preview strings everywhere (user, tools, transcript);
                       per-view defaults 100/120/240 when unset
  --json               NDJSON output (summary: single JSON object)
  -i                   grep: case-insensitive

locator:
  current               instead of a file path, resolve this session's log:
                       \$CLAUDE_CODE_SESSION_ID →
                       \${CLAUDE_CONFIG_DIR:-~/.claude}/projects/<munged-cwd>/<id>.jsonl
                       (fallbacks: id search across project dirs, newest-file
                       heuristic); parses of it exclude the current invocation
                       by default; the resolution note goes to stderr`;

const VALUE_FLAGS = ['--max-len', '--only'];

function parseCli(argv) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--max-len' || a === '--only') flags[a] = argv[++i];
    else if (a.startsWith('--') || a === '-i') flags[a] = true;
    else pos.push(a);
  }
  return {
    pos,
    maxLen: flags['--max-len'] !== undefined ? Number(flags['--max-len']) : undefined,
    only: flags['--only'],
    sidechain: !!flags['--sidechain'],
    thinking: !!flags['--thinking'],
    noTools: !!flags['--no-tools'],
    noMeta: !!flags['--no-meta'],
    noCmd: !!flags['--no-cmd'],
    includeCurrent: !!flags['--include-current'],
    full: !!flags['--full'],
    json: !!flags['--json'],
    i: !!flags['-i'],
    help: !!flags['--help'],
  };
}

function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

// ---------- helpers ----------

const pad2 = (x) => String(x).padStart(2, '0');

function trunc(s, n) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n) + '…' : s;
}

const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

function fmtTs(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '?';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '?';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${fmtTs(iso)}`;
}

function fmtDur(ms) {
  if (!(ms >= 0)) return '?';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h${m % 60}m`;
}

function fmtBytes(n) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

function fmtTok(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(n);
}

const num = (n) => (n ?? 0).toLocaleString('en-US');

// ---------- current-session resolution ----------

// Claude Code stores session transcripts at
//   <root>/projects/<munged-cwd>/<session-id>.jsonl
// where <root> is $CLAUDE_CONFIG_DIR or ~/.claude and <munged-cwd> is the
// session's working directory with every non-alphanumeric char → one "-".
const FRESH_MS = 10 * 60 * 1000;

function jsonlFiles(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => {
      const p = path.join(dir, f);
      try {
        const st = fs.statSync(p);
        return { p, mtime: st.mtimeMs, size: st.size };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);
}

function resolveCurrentInfo({ quiet = false } = {}) {
  const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
  const root = path.join(
    process.env.CLAUDE_CONFIG_DIR || path.join(home, '.claude'),
    'projects'
  );
  const munge = (p) => p.replace(/[^A-Za-z0-9]/g, '-');
  const id = process.env.CLAUDE_CODE_SESSION_ID;
  const dirByCwd = path.join(root, munge(process.cwd()));
  const note = (file, via) => {
    if (!quiet) console.error(`current → ${file} (via ${via})`);
    return { file, via };
  };

  if (id) {
    const direct = path.join(dirByCwd, `${id}.jsonl`);
    if (fs.existsSync(direct)) {
      // Documented edge: after --continue/--resume without an explicit id the
      // env var can still hold the startup session's id. If a different file in
      // the same directory was written within the freshness window, trust that.
      const top = jsonlFiles(dirByCwd)[0];
      if (top && path.resolve(top.p) !== path.resolve(direct) && Date.now() - top.mtime < FRESH_MS) {
        if (!quiet)
          console.error(`warning: env session id resolves to a file that is not the newest; using ${top.p}`);
        return note(top.p, 'newest, env id stale');
      }
      return note(direct, 'env id');
    }
    // Derived path missing (different cwd, >200-char munged name, config dir
    // mismatch): search every project dir for the id's file name.
    const hits = [];
    for (const d of fs.existsSync(root) ? fs.readdirSync(root) : []) {
      const p = path.join(root, d, `${id}.jsonl`);
      if (fs.existsSync(p)) hits.push(p);
    }
    if (hits.length) {
      hits.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      if (hits.length > 1 && !quiet)
        console.error(`warning: session id matches ${hits.length} files; using the newest`);
      return note(hits[0], 'id search');
    }
  } else {
    const top = jsonlFiles(dirByCwd)[0];
    if (top) return note(top.p, 'heuristic: newest in munged cwd, no CLAUDE_CODE_SESSION_ID');
  }

  if (!quiet) {
    console.error('error: cannot resolve the current session');
    console.error(
      id
        ? `  ($CLAUDE_CODE_SESSION_ID=${id} has no .jsonl under ${root}; session persistence may be disabled)`
        : '  (no $CLAUDE_CODE_SESSION_ID and no .jsonl in the munged-cwd project dir)'
    );
    const pool = jsonlFiles(dirByCwd);
    if (!pool.length && fs.existsSync(root)) {
      for (const d of fs.readdirSync(root))
        for (const f of jsonlFiles(path.join(root, d))) pool.push(f);
      pool.sort((a, b) => b.mtime - a.mtime);
    }
    if (pool.length) {
      console.error('  candidates (newest first):');
      for (const c of pool.slice(0, 5))
        console.error(`    ${c.p}  ${fmtDate(new Date(c.mtime).toISOString())}  ${fmtBytes(c.size)}`);
    }
  }
  return null;
}

function resolveCurrent() {
  const info = resolveCurrentInfo();
  if (!info) process.exit(1);
  return info.file;
}

function sameFile(a, b) {
  let ra = a;
  let rb = b;
  try { ra = fs.realpathSync.native(a); } catch {}
  try { rb = fs.realpathSync.native(b); } catch {}
  ra = path.resolve(ra);
  rb = path.resolve(rb);
  return process.platform === 'win32' ? ra.toLowerCase() === rb.toLowerCase() : ra === rb;
}

// An explicit path counts as the current session only when it matches a
// resolution backed by the session id. The env-less newest-file heuristic is
// too weak to justify trimming, so it fails open: at worst extra content stays.
function isCurrentSessionFile(file) {
  const info = resolveCurrentInfo({ quiet: true });
  if (!info || info.via.startsWith('heuristic')) return false;
  return sameFile(info.file, file);
}

// ---------- current-invocation boundary ----------

// The current invocation opens at the user entry from which the ongoing turn
// started. Anchor on the latest assistant call to this skill's scripts (the
// call being served is already recorded when the script runs), then walk back.
// The fallback is the last ordinary user entry.
function toolInvokesSkill(e) {
  if (e.isSidechain || e.type !== 'assistant' || !Array.isArray(e.message?.content)) return false;
  return e.message.content.some(
    (b) =>
      b.type === 'tool_use' &&
      b.name === 'Bash' &&
      typeof b.input?.command === 'string' &&
      /(?:claude-code|export)\.mjs\b/.test(b.input.command)
  );
}

function opensUserTurn(e) {
  if (e.isSidechain || e.parseError || e.type !== 'user' || e.isMeta) return false;
  const c = e.message?.content;
  if (typeof c === 'string') return true;
  if (Array.isArray(c)) return c.some((b) => b.type === 'text' && b.text);
  return false;
}

function findInvocationStartLine(entries) {
  let anchor = -1;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (toolInvokesSkill(entries[i])) {
      anchor = i;
      break;
    }
  }
  for (let i = anchor === -1 ? entries.length - 1 : anchor - 1; i >= 0; i--) {
    if (opensUserTurn(entries[i])) return entries[i].line;
  }
  return null;
}

// Load one view. Parsing the current session excludes the ongoing invocation by
// default: a suffix cut at the invocation's opening user entry, which keeps
// every retained event idx and line reference valid. --include-current opts out.
function loadView(file, opts) {
  const { raw, entries: all } = loadEntries(file);
  let entries = all;
  if (opts.treatAsCurrent && !opts.includeCurrent) {
    const cutLine = findInvocationStartLine(all);
    if (cutLine != null) {
      const at = all.findIndex((e) => e.line >= cutLine);
      entries = at < 0 ? all : all.slice(0, at);
      console.error(`current invocation excluded from L${cutLine} — pass --include-current to include it`);
    }
  }
  return { raw, entries, all, rawLineCount: all.length };
}

// ---------- loading ----------

function loadEntries(file) {
  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (e) {
    die(`cannot read ${file}: ${e.message}`);
  }
  const entries = [];
  raw.split(/\r?\n/).forEach((l, i) => {
    if (!l.trim()) return;
    try {
      entries.push({ line: i + 1, ...JSON.parse(l) });
    } catch (e) {
      entries.push({ line: i + 1, parseError: e.message });
    }
  });
  return { raw, entries };
}

// Assistant turns arrive as several jsonl lines sharing one message.id, each
// line carrying only its new content block(s) (some older formats repeat all
// blocks cumulatively — mergeBlocks handles both).
function mergeBlocks(group, blocks) {
  if (!blocks.length) return;
  if (!group.blocks.length) {
    group.blocks = [...blocks];
    return;
  }
  const sameFirst =
    JSON.stringify(blocks[0]) === JSON.stringify(group.blocks[0]);
  if (sameFirst && blocks.length >= group.blocks.length) group.blocks = blocks;
  else group.blocks.push(...blocks);
}

function resultText(c) {
  if (typeof c === 'string') return c;
  if (Array.isArray(c))
    return c.map((b) => (b.type === 'text' ? b.text : `[${b.type}]`)).join('\n');
  return c == null ? '' : JSON.stringify(c);
}

// Turn flat entries into an ordered event list:
//   user (text) · tool-result · assistant (merged) · attachment · compact-summary
// type:"summary" entries (compaction summaries, session-continuation chains)
// become compact-summary events. Other bookkeeping entries (mode, ai-title,
// file-history-snapshot, …) are skipped; summary reports them from raw entries.
function buildEvents(entries) {
  const events = [];
  const groups = new Map();
  for (const e of entries) {
    const base = {
      line: e.line,
      ts: e.timestamp,
      uuid: e.uuid,
      sidechain: !!e.isSidechain,
    };
    if (e.parseError) {
      events.push({ idx: events.length, kind: 'parse-error', error: e.parseError, ...base });
      continue;
    }
    if (e.type === 'user') {
      const content = e.message?.content;
      if (typeof content === 'string') {
        events.push({
          idx: events.length,
          kind: 'user',
          text: content,
          isMeta: !!e.isMeta,
          isCommand: content.trimStart().startsWith('<'),
          ...base,
        });
      } else if (Array.isArray(content)) {
        for (const b of content) {
          if (b.type === 'tool_result') {
            events.push({
              idx: events.length,
              kind: 'tool-result',
              toolUseId: b.tool_use_id,
              isError: !!b.is_error,
              text: resultText(b.content),
              ...base,
            });
          } else if (b.type === 'text' && b.text) {
            events.push({
              idx: events.length,
              kind: 'user',
              text: b.text,
              isMeta: !!e.isMeta,
              isCommand: b.text.trimStart().startsWith('<'),
              ...base,
            });
          }
        }
      }
    } else if (e.type === 'assistant') {
      const id = e.message?.id || e.uuid;
      let g = groups.get(id);
      if (!g) {
        g = {
          idx: events.length,
          kind: 'assistant',
          model: e.message?.model,
          messageId: id,
          blocks: [],
          usage: null,
          lineLast: e.line,
          ...base,
        };
        groups.set(id, g);
        events.push(g);
      }
      mergeBlocks(g, e.message?.content || []);
      if (e.message?.usage) g.usage = e.message.usage;
      g.lineLast = e.line;
    } else if (e.type === 'attachment') {
      const a = e.attachment || {};
      // Keep @-mentioned file bodies searchable; cap so huge dumps stay sane.
      let body = '';
      if (a.type === 'file' && typeof a.content?.file?.content === 'string')
        body = a.content.file.content.slice(0, 500 * 1024);
      events.push({
        idx: events.length,
        kind: 'attachment',
        sub: a.type,
        name: a.filename || a.hookName || a.toolName || '',
        body,
        ...base,
      });
    } else if (e.type === 'summary') {
      events.push({
        idx: events.length,
        kind: 'compact-summary',
        text: e.summary || '',
        leafUuid: e.leafUuid,
        ...base,
      });
    }
  }
  return events;
}

// Pair each assistant tool_use block with its tool-result event.
function pairTools(events) {
  const map = new Map();
  for (const ev of events) {
    if (ev.kind === 'assistant') {
      for (const b of ev.blocks)
        if (b.type === 'tool_use') map.set(b.id, { call: ev, block: b });
    } else if (ev.kind === 'tool-result' && map.has(ev.toolUseId)) {
      const p = map.get(ev.toolUseId);
      p.result = ev;
    }
  }
  return map;
}

function toolBrief(input) {
  const i = input || {};
  if (Array.isArray(i.questions))
    return i.questions.map((q) => q?.question || '').filter(Boolean).join(' | ');
  for (const k of [
    'file_path', 'path', 'notebook_path', 'command', 'cmd', 'pattern',
    'query', 'url', 'skill', 'prompt', 'description', 'script', 'agent_type',
  ]) {
    if (typeof i[k] === 'string' && i[k]) return i[k];
  }
  const j = JSON.stringify(i);
  return j === '{}' ? '' : j;
}

function header(ev, extra = '') {
  const tags = [ev.sidechain && 'side', ev.isMeta && 'meta', ev.isCommand && 'cmd']
    .filter(Boolean)
    .join(',');
  const label =
    ev.kind === 'assistant' ? `assistant ${ev.model || ''}`.trim() : ev.kind;
  const t = tags ? ` [${tags}]` : '';
  const x = extra ? ` · ${extra}` : '';
  return `── #${ev.idx} ${label}${t} · ${fmtTs(ev.ts)}${x} `.padEnd(72, '─');
}

function visible(ev, opts) {
  if (!opts.sidechain && ev.sidechain) return false;
  return true;
}

function sumUsage(list) {
  const t = { msgs: 0, input: 0, cacheRead: 0, cacheCreate: 0, output: 0 };
  for (const g of list) {
    const u = g.usage;
    if (!u) continue;
    t.msgs++;
    t.input += u.input_tokens || 0;
    t.cacheRead += u.cache_read_input_tokens || 0;
    t.cacheCreate += u.cache_creation_input_tokens || 0;
    t.output += u.output_tokens || 0;
  }
  return t;
}

// ---------- commands ----------

function cmdSummary(file, opts) {
  const { raw, entries, all, rawLineCount } = loadView(file, opts);
  const events = buildEvents(entries);

  const typeCounts = {};
  for (const e of entries) {
    if (e.parseError) continue;
    const t = e.type || '(none)';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }
  const parseErrors = all.filter((e) => e.parseError).length;

  const stamps = entries.filter((e) => e.timestamp).map((e) => e.timestamp);
  const first = stamps[0];
  const last = stamps[stamps.length - 1];

  const sessionIds = [...new Set(all.map((e) => e.sessionId).filter(Boolean))];
  const versions = [...new Set(all.map((e) => e.version).filter(Boolean))];
  const branches = [...new Set(all.map((e) => e.gitBranch).filter(Boolean))];
  const cwds = [...new Set(all.map((e) => e.cwd).filter(Boolean))];
  const title = [...all.filter((e) => e.type === 'ai-title')].pop()?.aiTitle;
  const summaries = entries.filter((e) => e.type === 'summary');
  const leaves = summaries.map((e) => e.leafUuid).filter(Boolean);

  const shown = events.filter((ev) => visible(ev, opts));
  const prompts = shown.filter((e) => e.kind === 'user' && !e.isCommand && !e.isMeta);
  const cmds = shown.filter((e) => e.kind === 'user' && (e.isCommand || e.isMeta));
  const assistants = shown.filter((e) => e.kind === 'assistant');
  const sideHidden = events.filter((e) => e.sidechain).length;

  const toolPairs = [...pairTools(events).values()];
  const toolHist = {};
  let toolErrors = 0;
  for (const p of toolPairs) {
    toolHist[p.block.name] = (toolHist[p.block.name] || 0) + 1;
    if (p.result?.isError) toolErrors++;
  }
  const attachHist = {};
  for (const ev of shown)
    if (ev.kind === 'attachment') attachHist[ev.sub] = (attachHist[ev.sub] || 0) + 1;

  const byModel = {};
  for (const g of assistants) {
    const m = g.model || '?';
    byModel[m] = byModel[m] || { msgs: 0, ...{ input: 0, cacheRead: 0, cacheCreate: 0, output: 0, msgs: 0 } };
    const u = g.usage;
    byModel[m].msgs++;
    if (u) {
      byModel[m].input += u.input_tokens || 0;
      byModel[m].cacheRead += u.cache_read_input_tokens || 0;
      byModel[m].cacheCreate += u.cache_creation_input_tokens || 0;
      byModel[m].output += u.output_tokens || 0;
    }
  }

  const out = {
    file: { path: file, bytes: Buffer.byteLength(raw), lines: rawLineCount, parseErrors },
    session: {
      sessionIds, versions, gitBranches: branches, cwds,
      aiTitle: title || null,
      compactSummaries: summaries.length,
      continuesFrom: leaves,
      start: first || null,
      end: last || null,
      durationMs: first && last ? new Date(last) - new Date(first) : null,
    },
    entryTypes: typeCounts,
    conversation: {
      userPrompts: prompts.length,
      commandOrMeta: cmds.length,
      assistantMessages: assistants.length,
      sidechainEventsHidden: sideHidden,
      toolCalls: toolPairs.length,
      toolErrors,
      toolHistogram: toolHist,
      attachments: attachHist,
    },
    usageByModel: byModel,
  };

  if (opts.json) {
    console.log(JSON.stringify(out));
    return;
  }

  const kv = (k, v) => console.log(`${k.padEnd(8)}${v}`);
  const { bytes, lines } = out.file;
  kv('file', `${file} (${fmtBytes(bytes)}, ${lines} lines${parseErrors ? `, ${parseErrors} parse errors` : ''})`);
  kv('session', sessionIds.join(', ') || '?');
  if (versions.length) kv('version', versions.join(', '));
  if (branches.length) kv('branch', branches.join(', '));
  if (title) kv('title', title);
  if (cwds.length) kv('cwd', cwds.join(' | '));
  kv('time', `${fmtDate(first)} → ${fmtDate(last)} (${fmtDur(new Date(last) - new Date(first))})`);
  kv('entries', Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t} ${c}`).join(' · '));
  if (summaries.length)
    kv('compact', `${summaries.length} summar${summaries.length > 1 ? 'ies' : 'y'}${leaves.length ? ` · continues ${leaves.map((l) => String(l).slice(0, 8)).join(', ')}` : ''}`);
  const c = out.conversation;
  kv('turns', `${c.userPrompts} user prompts${c.commandOrMeta ? ` (+${c.commandOrMeta} command/meta)` : ''} · ${c.assistantMessages} assistant messages${sideHidden ? ` · ${sideHidden} sidechain events hidden` : ''}`);
  kv('tools', `${c.toolCalls} calls${c.toolErrors ? `, ${c.toolErrors} errors` : ''}` + (Object.keys(toolHist).length ? ' · ' + Object.entries(toolHist).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(' · ') : ''));
  if (Object.keys(attachHist).length)
    kv('attach', Object.entries(attachHist).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(' · '));
  for (const [m, u] of Object.entries(byModel)) {
    kv('tokens', `${m}: ${u.msgs} msgs · in ${fmtTok(u.input)} · cache-read ${fmtTok(u.cacheRead)} · cache-create ${fmtTok(u.cacheCreate)} · out ${fmtTok(u.output)}`);
  }
}

function cmdTranscript(file, opts) {
  const { entries } = loadView(file, opts);
  const events = buildEvents(entries);
  const tools = pairTools(events);
  const only = new Set(
    (opts.only || 'user,assistant,compact-summary').split(',').map((s) => s.trim()).filter(Boolean)
  );
  let hiddenSide = 0;
  let hiddenMeta = 0;
  let hiddenCmd = 0;
  for (const ev of events) {
    if (ev.sidechain && !opts.sidechain) { hiddenSide++; continue; }
    if (ev.kind === 'parse-error') { console.log(header(ev, `PARSE ERROR: ${ev.error}`)); continue; }
    if (!only.has(roleKey(ev))) continue;
    if (opts.noMeta && ev.kind === 'user' && ev.isMeta) { hiddenMeta++; continue; }
    if (opts.noCmd && ev.kind === 'user' && ev.isCommand) { hiddenCmd++; continue; }
    printEvent(ev, opts, tools);
  }
  if (hiddenSide) console.log(`\n(${hiddenSide} sidechain events hidden — use --sidechain)`);
  if (hiddenMeta) console.log(`(${hiddenMeta} meta entries hidden — remove --no-meta to show)`);
  if (hiddenCmd) console.log(`(${hiddenCmd} command entries hidden — remove --no-cmd to show)`);
}

function roleKey(ev) {
  if (ev.kind === 'user' || ev.kind === 'tool-result' || ev.kind === 'assistant') {
    // tool-result prints attached to its assistant call, so route it there
    return ev.kind === 'tool-result' ? 'assistant' : ev.kind;
  }
  return ev.kind;
}

function printEvent(ev, opts, tools) {
  const ml = opts.maxLen ?? 240;
  if (ev.kind === 'user') {
    console.log(header(ev));
    console.log(ev.text);
    console.log();
  } else if (ev.kind === 'assistant') {
    console.log(header(ev, `L${ev.line}-${ev.lineLast}`));
    for (const b of ev.blocks) {
      if (b.type === 'text' && b.text) console.log(b.text);
      else if (b.type === 'thinking' && opts.thinking)
        console.log(`  [thinking] ${trunc(oneLine(b.thinking), ml)}`);
      else if (b.type === 'tool_use' && !opts.noTools) {
        console.log(`  → ${b.name}  ${trunc(oneLine(toolBrief(b.input)), ml)}`);
        const p = tools.get(b.id);
        if (p?.result) {
          const r = p.result;
          if (r.isError) console.log(`  ← ERROR ${trunc(oneLine(r.text.replace(/^<tool_use_error>\s*/, '')), ml)}`);
          else if (r.text) console.log(`  ← ${fmtBytes(Buffer.byteLength(r.text))}`);
        } else if (!opts.noTools) console.log('  ← (no result)');
      }
    }
    console.log();
  } else if (ev.kind === 'attachment') {
    console.log(header(ev, `${ev.sub}${ev.name ? ` · ${ev.name}` : ''}${ev.body ? ` · ${fmtBytes(Buffer.byteLength(ev.body))} body` : ''}`));
    console.log();
  } else if (ev.kind === 'compact-summary') {
    console.log(header(ev, ev.leafUuid ? `continues ${String(ev.leafUuid).slice(0, 8)}` : ''));
    console.log(trunc(oneLine(ev.text), ml));
    console.log();
  }
}

function cmdUser(file, opts) {
  const { entries } = loadView(file, opts);
  const events = buildEvents(entries);
  for (const ev of events) {
    if (ev.kind !== 'user' || !visible(ev, opts)) continue;
    const tags = [ev.sidechain && 'side', ev.isMeta && 'meta', ev.isCommand && 'cmd'].filter(Boolean);
    if (opts.json) {
      console.log(JSON.stringify({ idx: ev.idx, ts: ev.ts, tags, text: ev.text }));
    } else if (opts.full) {
      console.log(header(ev));
      console.log(ev.text);
      console.log();
    } else {
      const t = tags.length ? ` [${tags.join(',')}]` : '';
      console.log(`#${String(ev.idx).padEnd(5)} ${fmtTs(ev.ts)} ${trunc(oneLine(ev.text), opts.maxLen ?? 100)}${t}`);
    }
  }
}

function cmdTools(file, opts) {
  const { entries } = loadView(file, opts);
  const events = buildEvents(entries);
  const tools = pairTools(events);
  const rows = [];
  for (const [id, p] of tools) {
    const ev = p.call;
    if (!visible(ev, opts)) continue;
    rows.push({
      idx: ev.idx,
      ts: ev.ts,
      name: p.block.name,
      input: toolBrief(p.block.input),
      isError: !!p.result?.isError,
      resultBytes: p.result ? Buffer.byteLength(p.result.text) : null,
      errorText: p.result?.isError ? p.result.text : undefined,
      hasResult: !!p.result,
      line: ev.line,
      toolUseId: id,
    });
  }
  rows.sort((a, b) => a.idx - b.idx);
  if (opts.json) {
    for (const r of rows) console.log(JSON.stringify(r));
    return;
  }
  for (const r of rows) {
    const status = !r.hasResult ? '(no result)'
      : r.isError ? `ERROR ${trunc(oneLine(String(r.errorText).replace(/^<tool_use_error>\s*/, '')), opts.maxLen ?? 120)}`
      : r.resultBytes == null ? '' : fmtBytes(r.resultBytes);
    console.log(
      `#${String(r.idx).padEnd(5)} ${fmtTs(r.ts)} ${r.name.padEnd(12)} ${trunc(oneLine(r.input), opts.maxLen ?? 100)}`
    );
    console.log(`${' '.repeat(21)}← ${status}`);
  }
  console.log(`\ntotal: ${rows.length} calls, ${rows.filter((r) => r.isError).length} errors`);
}

function cmdUsage(file, opts) {
  const { entries } = loadView(file, opts);
  const events = buildEvents(entries);
  const assistants = events.filter((e) => e.kind === 'assistant' && visible(e, opts));
  if (opts.json) {
    for (const g of assistants)
      console.log(JSON.stringify({ idx: g.idx, ts: g.ts, model: g.model, usage: g.usage }));
  }
  for (const g of assistants) {
    const u = g.usage || {};
    console.log(
      `#${String(g.idx).padEnd(5)} ${fmtTs(g.ts)} ${(g.model || '?').padEnd(10)} in ${num(u.input_tokens)} · cache-r ${num(u.cache_read_input_tokens)} · out ${num(u.output_tokens)}`
    );
  }
  const t = sumUsage(assistants);
  console.log(
    `\ntotal: ${t.msgs} msgs · input ${fmtTok(t.input)} · cache-read ${fmtTok(t.cacheRead)} · cache-create ${fmtTok(t.cacheCreate)} · output ${fmtTok(t.output)}`
  );
}

function cmdGet(file, ref, opts) {
  const { entries } = loadView(file, opts);
  const events = buildEvents(entries);
  let ev = null;
  let rawEntry = null;
  if (/^\d+$/.test(ref)) {
    ev = events[Number(ref)];
    if (!ev) die(`no event #${ref} (view has events 0..${events.length - 1}; --include-current searches the full log)`);
  } else if (/^L\d+$/i.test(ref)) {
    const n = Number(ref.slice(1));
    rawEntry = entries.find((e) => e.line === n);
    if (!rawEntry) die(`no line ${n} (view has ${entries.length} lines; --include-current searches the full log)`);
  } else {
    const lower = ref.toLowerCase();
    ev = events.find((e) => e.uuid?.toLowerCase().startsWith(lower));
    if (!ev) rawEntry = entries.find((e) => e.uuid?.toLowerCase().startsWith(lower));
    if (!ev && !rawEntry) die(`no uuid matching prefix "${ref}"`);
  }
  if (rawEntry) {
    console.log(JSON.stringify(rawEntry, null, 2));
    return;
  }
  // assistant events are merged views; show the merged shape plus raw line refs
  const view = { ...ev };
  delete view.call;
  console.log(JSON.stringify(view, null, 2));
}

function cmdGrep(file, pattern, opts) {
  let re;
  try {
    re = new RegExp(pattern, opts.i ? 'gi' : 'g');
  } catch {
    re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), opts.i ? 'gi' : 'g');
  }
  const { entries } = loadView(file, opts);
  const events = buildEvents(entries);
  const tools = pairTools(events);
  let hits = 0;
  for (const ev of events) {
    if (!visible(ev, opts) || ev.kind === 'parse-error') continue;
    const parts = [];
    if (ev.kind === 'user') parts.push(ev.text);
    else if (ev.kind === 'compact-summary') parts.push(ev.text);
    else if (ev.kind === 'attachment') { if (ev.body) parts.push(ev.body); if (ev.name) parts.push(ev.name); }
    else if (ev.kind === 'assistant') {
      for (const b of ev.blocks) {
        if (b.type === 'text' && b.text) parts.push(b.text);
        else if (b.type === 'thinking' && opts.thinking) parts.push(b.thinking || '');
        else if (b.type === 'tool_use') parts.push(`${b.name} ${JSON.stringify(b.input)}`);
      }
    }
    if (ev.kind === 'tool-result') parts.push(ev.text);
    for (const s of parts) {
      re.lastIndex = 0;
      const m = re.exec(String(s));
      if (!m) continue;
      const at = m.index;
      const ctx =
        oneLine(s.slice(Math.max(0, at - 40), at)) +
        '⟦' + oneLine(m[0]) + '⟧' +
        oneLine(s.slice(at + m[0].length, at + m[0].length + 80));
      if (opts.json) console.log(JSON.stringify({ idx: ev.idx, ts: ev.ts, kind: ev.kind, text: ctx }));
      else console.log(`#${String(ev.idx).padEnd(5)} ${ev.kind.padEnd(11)} ${ctx}`);
      hits++;
      break; // one line per event
    }
  }
  if (!hits) console.error('(no matches)');
}

// ---------- main ----------

const { pos, ...opts } = parseCli(process.argv.slice(2));
const [cmd, file] = pos;

if (!cmd || cmd === 'help' || opts.help) {
  console.log(USAGE);
  process.exit(cmd ? 0 : 1);
}
if (!file) die(`missing <file> — see "help"`);
if (!['summary', 'transcript', 'user', 'tools', 'usage', 'get', 'grep'].includes(cmd))
  die(`unknown command "${cmd}" — see "help"`);

let sessionFile;
let treatAsCurrent;
if (file === 'current') {
  sessionFile = resolveCurrent();
  treatAsCurrent = true;
} else {
  sessionFile = file;
  treatAsCurrent = isCurrentSessionFile(file);
}
opts.treatAsCurrent = treatAsCurrent;

switch (cmd) {
  case 'summary': cmdSummary(sessionFile, opts); break;
  case 'transcript': cmdTranscript(sessionFile, opts); break;
  case 'user': cmdUser(sessionFile, opts); break;
  case 'tools': cmdTools(sessionFile, opts); break;
  case 'usage': cmdUsage(sessionFile, opts); break;
  case 'get': {
    const ref = pos[2];
    if (!ref) die('get needs a ref: event idx | L<line> | uuid prefix');
    cmdGet(sessionFile, ref, opts);
    break;
  }
  case 'grep': {
    const pattern = pos.slice(2).join(' ');
    if (!pattern) die('grep needs a pattern');
    cmdGrep(sessionFile, pattern, opts);
    break;
  }
}
