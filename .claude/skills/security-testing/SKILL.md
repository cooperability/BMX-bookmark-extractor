---
name: security-testing
description: >-
  Audit local repository code for vulnerabilities, unprotected endpoints, auth
  gaps, injection sinks, secret leaks, and unsafe defaults. Use when the user
  asks for a security audit, penetration-style review, threat model of the
  codebase, or to probe for unprotected routes and vulns.
---

# Security Testing

Perform a **read-first, fix-only-when-asked** security audit of the local project. Generalize across stacks; infer framework from manifests and entrypoints.

## Scope

Default: entire repo. If the user names paths, PRs, or services, bound the audit to those.

Do **not** write exploits, PoCs that attack live systems, or payloads against remote endpoints—even if the user owns them. Local static/config review and defensive fixes only.

## 1. Map the attack surface

Identify quickly:

- App entrypoints (HTTP servers, serverless handlers, CLI that accepts input, webhooks)
- Authn/authz middleware and where it is *not* applied
- Public vs privileged routes; CORS; CSRF; cookie flags
- Data stores, ORMs, raw SQL, filesystem, shell, SSRF-capable fetches
- Secrets handling (env, vault, committed `.env*`, CI configs)
- Dependency/supply-chain posture (lockfiles, install scripts, postinstall)

Prefer codebase search + config reads over running scanners unless the repo already wires them.

## 2. Probe checklist (code-level)

For each finding, cite `file:line` and a reproduction sketch that stays in-process (request shape, missing check)—not a weaponized exploit.

**Access control**

- Unprotected or under-protected endpoints; IDOR via user-controlled IDs
- Broken role checks; “fail open” auth; trusting client-supplied roles
- Debug/admin routes reachable in production configs

**Injection & unsafe sinks**

- SQL/NoSQL/HTML/JS/shell/path injection from unsanitized input
- Prototype pollution / unsafe `JSON.parse` into privileged objects
- Template or Markdown rendering without sanitization where HTML is emitted

**Web & API**

- Missing rate limits on auth-sensitive routes
- Overly permissive CORS; missing security headers where the stack expects them
- Mass assignment / over-posting into models
- File upload without type/size/path constraints

**Secrets & supply chain**

- Hardcoded keys, tokens, private URLs in source or history-prone files
- Dangerous defaults (`verify: false`, open redirects, verbose errors in prod)
- Known-vulnerable dependency patterns if manifests make them obvious

**Concurrency / state**

- Race-prone auth or balance updates; unsafe caching of per-user data

## 3. Severity rubric

| Severity | Meaning |
|----------|---------|
| Critical | Remote unauth RCE, auth bypass, or secret exfil likely |
| High | Authz bypass, SQLi/XSS with clear reachability, exposed admin |
| Medium | Defense-in-depth gap, misconfig with conditions |
| Low | Hardening / hygiene |
| Info | Note / unclear reachability |

Mark reachability: `reachable` / `conditional` / `theoretical`.

## 4. Report format

Lead with a 2–4 sentence verdict, then a table:

| Severity | Location | Finding | Reachability | Fix sketch |

Sort Critical → Low. Group duplicates. Do not pad with generic advice unrelated to this repo.

End with **Top 3 fixes** (highest leverage). Apply code changes only if the user asks.

## Claude Code notes

- Use Grep/Glob/Read for surface mapping; use `gh` or GitHub MCP for code-scanning and Dependabot alerts when the repo is on GitHub.
- Stay in the local workspace; do not probe production URLs unless the user explicitly requests a non-destructive check and it is clearly their environment.
