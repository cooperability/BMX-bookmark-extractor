---
name: extract-chat-insights
description: >-
  Mine a past chat transcript for hard-won insights, then route each one to a
  durable home — in-repo documentation, a Cursor rule, or a change to the shared
  skills — so the chat can be deleted without losing anything. Use when the user
  wants to review old conversations, harvest learnings, clean up chat history, or
  asks what is worth keeping from a session.
---

# Extract Chat Insights

Turn a conversation into durable artifacts so it can be deleted with confidence.

The value in an old chat is rarely the answer — that is already in the code. It is the **things that were expensive to learn**: the approach that failed and why, the constraint nobody documents, the correction the user had to make twice. Those evaporate when the chat goes.

Success condition: every durable insight has a home, and you can say plainly which chats are now safe to delete.

## 1. Read for the expensive parts

Work through the transcript looking for these. They are the signal:

| Signal in the chat | Why it is worth keeping |
|---|---|
| An approach that was tried and abandoned | Stops the next session paying the same cost |
| A correction the user made, especially twice | Their standing preference; the strongest signal in any transcript |
| A constraint discovered by hitting it | Platform, tool, or plan limits that are not in any doc |
| A decision with a stated rationale | The *why* is what decays; the *what* is in the diff |
| A bug and its root cause | Especially when the symptom pointed elsewhere |
| Environment-specific behaviour | OS, package manager, shell, or config quirks that bit |

Ignore, without guilt:

- Narration of what was done — `git log` has it
- Anything already in `CLAUDE.md`, `AGENTS.md`, the README, or the code
- Session-local state: file paths, branch names, "now run the tests"
- Restatements of general knowledge that was not learned here

Most of a transcript is noise. Five real insights from a long session is a good yield; zero is a legitimate result.

## 2. Verify before enshrining

An old chat describes the repo as it was. Before writing an insight down, confirm it still holds — check that the file, flag, command, or setting it names still exists and still behaves that way.

Insights that no longer hold are not worthless: "we tried X, it broke on Y" stays true as history. Record it as a dated observation rather than as current fact, and say which it is.

## 3. Route each insight

| Scope | Destination |
|---|---|
| True only for one repo — commands, architecture, gotchas | That repo's `AGENTS.md`, `CLAUDE.md`, or `docs/` |
| Repo-specific and should apply automatically to certain files | A scoped rule in `.cursor/rules/*.mdc`, with a `globs:` pattern |
| A workflow rule that holds across repos | A change to the shared skills, as a PR |
| How this user works, or what they have corrected | An always-on `.cursor/rules/*.mdc`, or user-level Rules for AI |
| Interesting but actionable nowhere | Discard, and say you discarded it |

Three rules for every destination:

1. **Update, do not append.** Read the target first. If something close already exists, revise it in place — duplicated near-identical guidance is worse than none, because they drift apart.
2. **Write the reason, not the event.** "Used merge-base instead of `origin/main` when squashing, because resetting to the branch tip stages the inverse of missing base commits" beats "fixed the squash command".
3. **Put it where it will be read.** A note in `docs/` nobody opens is a deletion with extra steps. Repo conventions and commands belong in `CLAUDE.md`, which is loaded every session.

### In-repo documentation

Match the file's existing structure and voice. If an insight fits an existing section, extend it; add a new section only when it genuinely has no home.

### Cursor rules

One concern per `.mdc` file. Scope it as narrowly as it deserves: a `globs:` pattern for guidance that only applies to certain files, always-on only for rules that genuinely apply everywhere — an always-on rule set that grows without pruning stops being read.

Include the *why*, since a rule without its reason gets misapplied. Rules that are about the person rather than the project belong in user-level Rules for AI, not in the repo.

### A change to the shared skills

When an insight would have prevented the mistake in *any* repo, it belongs in the skill, not in a per-repo rule. Edit the skill upstream, open a PR, and note it in the report — do not edit a synced copy in place.

## 4. Report and clear for deletion

Close with the ledger the user needs in order to delete:

```
Chat: <identifier / date>

Kept
  <insight> → <exact destination>            (written / PR #N / pending)

Discarded
  <insight> — <why it is not durable>

Verdict: safe to delete | keep — <what is still unresolved>
```

Two rules:

- **Never say safe to delete while anything is pending.** A PR that is open, not merged, is pending. A file you intended to write and did not is pending.
- **Deleting is the user's action.** Do it only if they explicitly ask, and never on your own initiative.

When several chats are being worked through, keep one running ledger and give a verdict per chat, so progress survives across sessions.

## Cursor notes

- Where the user names a transcript, read it directly; where they paste an excerpt, work from that and say the scope was limited to what they provided.
- Writing rules and repo docs is safe to do directly. Anything that becomes a PR follows the usual draft-and-hand-off rule — see [git-hygiene](../git-hygiene/SKILL.md).
- Do not launch unrelated subagents unless the user asks.
