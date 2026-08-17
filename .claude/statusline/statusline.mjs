#!/usr/bin/env node
/**
 * Claude Code status line — context window, plan limits, and session cost in one row.
 *
 * Claude Code pipes a JSON status payload on stdin and renders whatever this writes
 * to stdout. Every number below comes from that payload; the only disk reads are
 * `.git/HEAD` for the branch and, on CLIs too old to report context usage, a bounded
 * tail of the session transcript.
 *
 * Wiring, tuning, and the payload reference live in README.md next to this file.
 *
 * Zero dependencies, Node >= 18, and it never throws: a bad payload degrades to a
 * shorter line rather than an empty status bar.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** xterm-256 codes chosen to stay legible on both light and dark terminals. */
const PALETTE = { ok: 71, notice: 179, warn: 173, danger: 167, faint: 242, label: 245, accent: 110 };

const ANSI = /\u001b\[[0-9;]*m/g;
const DEFAULT_WIDTH = 100;
const BAR_CELLS = 5;
const SEPARATOR = '  ';
/** Left-to-right partial blocks, so a 5-cell bar resolves to 1/40th rather than 1/5th. */
const EIGHTHS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'];
/** Enough tail to hold the last assistant turn of any realistic transcript. */
const TRANSCRIPT_TAIL_BYTES = 512 * 1024;
/** Used only when an older CLI omits `context_window` and the window size is unknown. */
const ASSUMED_CONTEXT_WINDOW = 200_000;

// ---------------------------------------------------------------- formatting

/** Visible width, ignoring the colour codes woven through a segment. */
export const visibleWidth = (text) => text.replace(ANSI, '').length;

export function painter(useColor) {
  return (text, tone) => {
    const code = Object.hasOwn(PALETTE, tone ?? '') ? PALETTE[tone] : undefined;
    if (!useColor || !text || code === undefined) return text;
    return `\u001b[${tone === 'danger' ? '1;' : ''}38;5;${code}m${text}\u001b[0m`;
  };
}

/** Pressure to tone. The thresholds are where a human should start caring, not where limits bite. */
export function tone(fraction) {
  if (!Number.isFinite(fraction)) return 'label';
  if (fraction >= 0.9) return 'danger';
  if (fraction >= 0.75) return 'warn';
  if (fraction >= 0.5) return 'notice';
  return 'ok';
}

export function meter(fraction, { cells = BAR_CELLS, ascii = false } = {}) {
  const f = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  if (ascii) {
    const filled = f > 0 ? Math.max(1, Math.round(f * cells)) : 0;
    return '='.repeat(filled) + '-'.repeat(cells - filled);
  }
  // A non-zero fraction always shows something: "1% used" and "0% used" must differ.
  const eighths = Math.min(cells * 8, f > 0 ? Math.max(1, Math.round(f * cells * 8)) : 0);
  const head = '█'.repeat(Math.floor(eighths / 8)) + EIGHTHS[eighths % 8];
  return head + '░'.repeat(cells - head.length);
}

export function tokens(n) {
  if (!Number.isFinite(n) || n < 0) return '?';
  if (n < 1000) return String(Math.round(n));
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k < 10 ? k.toFixed(1) : Math.round(k)}k`;
  }
  return `${(n / 1_000_000).toFixed(1)}M`;
}

export function money(usd) {
  if (!Number.isFinite(usd) || usd < 0) return null;
  if (usd === 0) return '$0';
  if (usd < 0.01) return '<$0.01';
  if (usd < 10) return `$${usd.toFixed(2)}`;
  if (usd < 100) return `$${usd.toFixed(1)}`;
  return `$${Math.round(usd)}`;
}

/** Epoch seconds to a countdown. Coarse on purpose — "4d" is as actionable as "4d 03:12". */
export function until(epochSeconds, now = Date.now()) {
  if (!Number.isFinite(epochSeconds)) return null;
  const secs = Math.round(epochSeconds - now / 1000);
  if (secs <= 0) return 'now';
  const days = Math.floor(secs / 86400);
  const hours = Math.floor((secs % 86400) / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  if (days) return hours ? `${days}d${hours}h` : `${days}d`;
  if (hours) return mins ? `${hours}h${mins}m` : `${hours}h`;
  return `${Math.max(1, mins)}m`;
}

export function truncate(text, max) {
  return text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1))}~`;
}

// ------------------------------------------------------------------ payload

/**
 * Total context currently occupied, from the newest main-thread assistant turn.
 *
 * Only reached on CLIs that predate `context_window` in the status payload. Reads a
 * bounded tail rather than the whole file, because transcripts run to megabytes and
 * this executes on every render. Subagent turns are skipped: their context is their
 * own, and counting it would overstate the main thread's.
 */
export function contextFromTranscript(file, tailBytes = TRANSCRIPT_TAIL_BYTES) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const { size } = fs.fstatSync(fd);
    const start = Math.max(0, size - tailBytes);
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);

    const lines = buf.toString('utf8').split('\n');
    if (start > 0) lines.shift(); // The window almost certainly cut the first record mid-JSON.

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (!line.startsWith('{')) continue;
      let row;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }
      if (row.isSidechain) continue;
      const usage = row.message?.usage;
      if (!usage) continue;
      return (
        (usage.input_tokens ?? 0) +
        (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0)
      );
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch {
        /* already gone */
      }
    }
  }
}

/**
 * Current branch, by reading `.git/HEAD` rather than shelling out to git.
 *
 * A status line re-renders on every message; spawning a process each time is the one
 * cost this script can actually feel. Handles the `gitdir:` indirection a worktree uses.
 */
export function gitBranch(startDir, { fs: io = fs } = {}) {
  try {
    let dir = path.resolve(startDir);
    for (let depth = 0; depth < 40; depth++) {
      const dotGit = path.join(dir, '.git');
      let stat = null;
      try {
        stat = io.statSync(dotGit);
      } catch {
        stat = null;
      }
      if (stat) {
        let gitDir = dotGit;
        if (stat.isFile()) {
          const pointer = io.readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+)$/m);
          if (!pointer) return null;
          gitDir = path.resolve(dir, pointer[1].trim());
        }
        const head = io.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
        const ref = head.match(/^ref:\s*refs\/heads\/(.+)$/);
        return ref ? ref[1] : head.slice(0, 7); // Detached: the short SHA is the best label.
      }
      const parent = path.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
    return null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------------------- segments

const MODES = {
  plan: { text: 'PLAN', tone: 'accent' },
  acceptEdits: { text: 'AUTO-EDIT', tone: 'notice' },
  bypassPermissions: { text: 'BYPASS', tone: 'danger' },
};

/**
 * Build every segment the payload can support, each in a full and a short form.
 *
 * The bar already encodes the percentage, so the text beside it carries what the bar
 * cannot: absolute tokens for context, time-to-reset for limits. `short` is what
 * survives when the line has to give ground.
 */
export function buildSegments(data, opts) {
  const { color: c, ascii, now } = opts;
  const segs = [];
  const add = (key, priority, full, short = full) => segs.push({ key, priority, full, short });

  const gauge = (label, fraction, tail, shortTail) => {
    const t = tone(fraction);
    const bar = meter(fraction, { ascii });
    const empty = ascii ? '-' : '░';
    const cut = bar.indexOf(empty);
    const painted =
      cut === -1 ? c(bar, t) : c(bar.slice(0, cut), t) + c(bar.slice(cut), 'faint');
    const head = `${c(label, 'label')} ${painted}`;
    return [`${head} ${c(tail, t)}`, `${head} ${c(shortTail, t)}`];
  };

  // hasOwn, not a bare lookup: an unexpected mode string must not reach Object.prototype.
  const mode = Object.hasOwn(MODES, data.permission_mode ?? '') ? MODES[data.permission_mode] : null;
  if (mode) add('mode', 100, c(mode.text, mode.tone));

  const window = data.context_window ?? {};
  const size = Number(window.context_window_size) || ASSUMED_CONTEXT_WINDOW;
  let used = Number(window.total_input_tokens);
  if (!Number.isFinite(used) && data.transcript_path) {
    used = contextFromTranscript(data.transcript_path);
  }
  if (Number.isFinite(used)) {
    const fraction = size > 0 ? used / size : 0;
    const percent = Number.isFinite(window.used_percentage)
      ? window.used_percentage
      : Math.round(fraction * 100);
    add('ctx', 95, ...gauge('ctx', fraction, `${tokens(used)}/${tokens(size)}`, `${percent}%`));
  }

  for (const [key, label, priority] of [
    ['five_hour', '5h', 90],
    ['seven_day', 'wk', 85],
  ]) {
    const limit = data.rate_limits?.[key];
    if (!limit || !Number.isFinite(limit.used_percentage)) continue;
    const percent = Math.round(limit.used_percentage);
    const resets = until(limit.resets_at, now);
    add(
      label,
      priority,
      ...gauge(label, limit.used_percentage / 100, resets ? `${percent}% ${resets}` : `${percent}%`, `${percent}%`),
    );
  }

  const model = String(data.model?.display_name || data.model?.id || '').replace(/^Claude\s+/i, '');
  if (model) {
    const badges = [];
    if (data.effort?.level) badges.push(data.effort.level);
    if (data.fast_mode) badges.push('fast');
    if (data.thinking && data.thinking.enabled === false) badges.push('no-think');
    add(
      'model',
      70,
      badges.length ? `${model} ${c(badges.join(' '), 'faint')}` : model,
      model,
    );
  }

  if (data.agent?.name) add('agent', 65, c(`[${truncate(data.agent.name, 18)}]`, 'accent'));

  const branch = data.worktree?.branch ?? gitBranch(data.workspace?.current_dir || data.cwd || '.');
  const repo = data.worktree?.name || path.basename(data.workspace?.project_dir || data.cwd || '');
  if (repo || branch) {
    const where = branch ? `${repo}${repo ? '@' : ''}${branch}` : repo;
    add('where', 60, c(truncate(where, 34), 'accent'), c(truncate(branch || repo, 16), 'accent'));
  }

  if (Number.isFinite(data.pr?.number)) add('pr', 63, c(`#${data.pr.number}`, 'accent'));

  const cost = money(data.cost?.total_cost_usd);
  if (cost) {
    const added = data.cost?.total_lines_added;
    const removed = data.cost?.total_lines_removed;
    const churn = Number.isFinite(added) && Number.isFinite(removed) ? `+${added}/-${removed}` : '';
    add('cost', 50, churn ? `${cost} ${c(churn, 'faint')}` : cost, cost);
  }

  return segs;
}

/**
 * Shrink the line to a width budget, cheapest information first.
 *
 * Each segment is spent completely — short form, then gone — before the next-cheapest
 * is touched. Demoting every segment first would be the wrong trade: it strips the
 * reset times off the limit meters while still showing the session cost. The
 * highest-priority segment is never dropped, so the line is never blank.
 */
export function fit(segments, budget, separatorWidth = SEPARATOR.length) {
  if (segments.length === 0) return [];
  const state = new Map(segments.map((s) => [s, 'full']));
  const cheapestFirst = [...segments].sort((a, b) => a.priority - b.priority);
  const last = cheapestFirst[cheapestFirst.length - 1];

  const total = () => {
    const kept = segments.filter((s) => state.get(s) !== 'drop');
    const text = kept.reduce((sum, s) => sum + visibleWidth(state.get(s) === 'full' ? s.full : s.short), 0);
    return text + Math.max(0, kept.length - 1) * separatorWidth;
  };

  for (const seg of cheapestFirst) {
    if (total() <= budget) break;
    if (seg.full !== seg.short) {
      state.set(seg, 'short');
      if (total() <= budget) break;
    }
    if (seg !== last) state.set(seg, 'drop');
  }

  return segments.filter((s) => state.get(s) !== 'drop').map((s) => (state.get(s) === 'full' ? s.full : s.short));
}

/**
 * Width budget for one line.
 *
 * Claude Code does not pass the terminal size in the payload, so this takes whatever
 * the environment happens to expose and falls back to a width that fits an unhelpfully
 * narrow terminal. The slack keeps the line off the last column, where a wrap would
 * make the status bar look broken.
 */
export function budgetFor(env = {}, columns) {
  const explicit = Number(env.CC_STATUSLINE_WIDTH);
  if (explicit > 0) return explicit;
  const detected = Number(columns) || Number(env.COLUMNS);
  return detected > 40 ? detected - 4 : DEFAULT_WIDTH;
}

export function render(data, options = {}) {
  const env = options.env ?? {};
  const useColor = options.color ?? !(env.NO_COLOR || env.CC_STATUSLINE_NO_COLOR);
  const budget = budgetFor(env, options.columns);

  let segments = buildSegments(data ?? {}, {
    color: painter(useColor),
    ascii: options.ascii ?? Boolean(env.CC_STATUSLINE_ASCII),
    now: options.now ?? Date.now(),
  });

  const wanted = String(env.CC_STATUSLINE_SEGMENTS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (wanted.length) {
    segments = wanted.map((key) => segments.find((s) => s.key === key)).filter(Boolean);
  }

  return fit(segments, budget).join(SEPARATOR);
}

// --------------------------------------------------------------------- main

async function readStdin() {
  // Run by hand from a terminal there is no payload coming, and waiting for EOF would
  // just look like a hang. Claude Code always pipes, so isTTY is a reliable tell.
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  let data = {};
  try {
    data = JSON.parse(await readStdin()) ?? {};
  } catch {
    // No payload (a manual run, or a CLI that changed its contract): still print something.
  }
  try {
    const line = render(data, { env: process.env, columns: process.stdout.columns });
    if (line) process.stdout.write(`${line}\n`);
  } catch {
    // A status line must never take the session down with it.
    const fallback = data.model?.display_name || data.model?.id;
    if (fallback) process.stdout.write(`${fallback}\n`);
  }
}

/** Run only when invoked as a command; importing this for tests must not print. */
function invokedDirectly() {
  if (!process.argv[1]) return false;
  // Windows paths differ only by case often enough that a raw compare misfires.
  const same = (a, b) =>
    process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  return same(path.resolve(process.argv[1]), fileURLToPath(import.meta.url));
}

if (invokedDirectly()) await main();
