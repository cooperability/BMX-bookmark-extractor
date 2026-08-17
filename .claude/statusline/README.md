# statusline

A one-line instrument panel under the Claude Code prompt: how full the context window
is, how much of your plan limits you have spent, and what the session has cost.

```
ctx █▎░░░ 48k/200k  5h ███▏░ 62% 1h47m  wk ▉░░░░ 18% 4d  Opus 5 high  claugmentations@main  $1.24
```

Read it as three meters and some labels. `ctx` is the current conversation against the
model's context window. `5h` is the rolling session limit, `wk` the seven-day one, each
followed by how long until it resets. Bars fill left to right in eighths, and colour
shifts green → gold → orange → red as pressure rises.

**The bar carries the percentage, so the text beside it carries what the bar cannot** —
absolute tokens for context, time-to-reset for limits. That is why `ctx` shows
`48k/200k` and `5h` shows `62% 1h47m` rather than both showing the same thing twice.

## Wiring it up

```bash
npx github:cooperability/claugmentations init
```

That writes the block below, checks nothing else is already claiming the status line,
and renders it once with a sample payload to prove the path works. To do it by hand,
add this to `.claude/settings.json` in the repo (or `~/.claude/settings.json` to get it
everywhere, pointing at an absolute path):

```json
{
  "statusLine": {
    "type": "command",
    "command": "node .claude/statusline/statusline.mjs",
    "padding": 0
  }
}
```

`padding: 0` lets the line start at the first column. Add `"refreshInterval": 30` if you
want the reset countdowns to tick between messages rather than only when Claude replies.

The command runs from the project directory, so the relative path above is normally
right. If your status line comes up blank, that is the first thing to check — under a
shell that starts elsewhere, use `node "$CLAUDE_PROJECT_DIR/.claude/statusline/statusline.mjs"`.

One thing worth knowing before you debug a status line that "did nothing": Claude Code
merges its settings user → project → local → CLI flag → managed policy. A `statusLine`
in the gitignored `.claude/settings.local.json` outranks the one in
`.claude/settings.json`. `init` checks for exactly that and says so.

## Tuning

All optional, all environment variables, so you can set them per repo in the `env` block
of `.claude/settings.json`.

| Variable | Default | Effect |
|---|---|---|
| `CC_STATUSLINE_WIDTH` | terminal width, else `100` | Character budget for the line |
| `CC_STATUSLINE_SEGMENTS` | all | Comma-separated allow-list, in your order — e.g. `ctx,5h,wk` |
| `CC_STATUSLINE_ASCII` | unset | Draw bars as `=`/`-` for terminals without block glyphs |
| `NO_COLOR` | unset | Drop all colour (`CC_STATUSLINE_NO_COLOR` also works) |

Segment keys are `mode`, `ctx`, `5h`, `wk`, `model`, `agent`, `pr`, `where`, `cost`.

### How it narrows

The line never wraps. When everything does not fit, segments are given up
**cheapest-first, one at a time** — a segment goes to its short form, then disappears
entirely, before the next-cheapest is touched at all.

That ordering is deliberate. Demoting everything by one step first would strip the reset
times off the limit meters while still finding room for the session cost. Priority runs:
permission mode → context → session limit → weekly limit → model → PR → branch → cost.
The highest-priority segment is never dropped, so the line is never blank.

```
100 cols  ctx █▎░░░ 48k/200k  5h ███▏░ 62% 1h47m  wk ▉░░░░ 18% 4d  Opus 5 high  repo@main
 60 cols  ctx █▎░░░ 48k/200k  5h ███▏░ 62% 1h47m  wk ▉░░░░ 18% 4d
 32 cols  ctx █▎░░░ 48k/200k  5h ███▏░ 62%
```

## What shows up only when it matters

| Segment | Appears when |
|---|---|
| `PLAN` / `AUTO-EDIT` / `BYPASS` | Permission mode is not the default. `BYPASS` is bold red on purpose |
| `5h`, `wk` | You are on a subscription plan **and** the CLI has seen at least one API response this session. API-key and Bedrock/Vertex users have no unified limits, so these stay hidden |
| `#42` | The worktree is linked to a pull request |
| `[agent-name]` | Rendering for a subagent |
| `fast`, `no-think` | Fast mode is on, or extended thinking is off |

## Where the numbers come from

Claude Code pipes a JSON payload to the command on stdin and renders its stdout. This is
the shape as of CLI 2.1.x — everything the status line reads, and nothing is inferred:

```jsonc
{
  "session_id": "…",
  "transcript_path": "…",          // fallback source for context usage
  "cwd": "…",
  "permission_mode": "default",    // default | plan | acceptEdits | bypassPermissions
  "model": { "id": "claude-opus-5", "display_name": "Claude Opus 5" },
  "workspace": { "current_dir": "…", "project_dir": "…", "added_dirs": [] },
  "version": "2.1.225",
  "cost": {
    "total_cost_usd": 1.2412,
    "total_duration_ms": 900000,
    "total_api_duration_ms": 120000,
    "total_lines_added": 312,
    "total_lines_removed": 40
  },
  "context_window": {
    "total_input_tokens": 48279,   // input + cache_creation + cache_read
    "total_output_tokens": 4210,
    "context_window_size": 200000,
    "used_percentage": 24,         // integer, already clamped to 0–100
    "remaining_percentage": 76
  },
  "exceeds_200k_tokens": false,
  "fast_mode": false,
  "effort": { "level": "high" },   // only for models that take an effort level
  "thinking": { "enabled": true },
  "rate_limits": {                 // omitted entirely when there are none to report
    "five_hour": { "used_percentage": 62.4, "resets_at": 1786200000 },
    "seven_day": { "used_percentage": 18.2, "resets_at": 1786540000 }
  },
  "output_style": { "name": "default" },
  "agent": { "name": "…" },
  "pr": { "number": 42, "url": "…", "review_state": "…" },
  "worktree": { "name": "…", "path": "…", "branch": "…", "original_branch": "…" }
}
```

`resets_at` is **epoch seconds**, not milliseconds. `rate_limits.*.used_percentage` is a
float on a 0–100 scale, while `context_window.used_percentage` is a pre-rounded integer —
the bars use the raw token ratio instead, which is why they resolve finer than 20%.

Two reads touch the disk, both cheap enough to repeat on every render:

- **The branch** comes from `.git/HEAD`, not from shelling out to `git`. A status line
  re-renders on every message, and a spawned process each time is the one cost this
  script could actually be felt for. It follows the `gitdir:` pointer a worktree uses.
- **Context usage on older CLIs.** Before `context_window` existed in the payload, the
  only source was the transcript. The fallback reads a bounded 512 KB tail rather than
  the whole file — transcripts reach megabytes — and scans backwards for the newest
  assistant turn, skipping `isSidechain` records so a subagent's context is not counted
  as the main thread's. The transcript records tokens but not the window they were
  measured against, so this path assumes 200k; on a session with a larger window the
  denominator will read low and the bar will sit pegged. The payload path, which is what
  any current CLI takes, carries the real `context_window_size` and has no such gap.

## Failure behaviour

It never throws and always exits 0. A malformed payload, a missing field, or an
unreadable transcript costs you that segment, not the status bar. If rendering itself
fails, it falls back to printing the model name.

## No Cursor equivalent

Cursor has no status-line hook, so this ships only under `.claude/`. That asymmetry is
expected; do not go looking for the missing `.cursor/statusline/`.
