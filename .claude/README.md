# Claude Code project config

`skills/` is vendored from [claugmentations](https://github.com/cooperability/claugmentations) (private) — shared git/GitHub workflows used across repos. `../.claugmentations.json` lists exactly which files are managed.

**Do not edit a synced skill in place.** The next sync reports it as drift and the change gets lost. Edit it upstream in `claugmentations/templates/{claude,cursor}/`, then re-sync:

```bash
npx github:cooperability/claugmentations sync    # --force to take upstream over local edits
npx github:cooperability/claugmentations check   # exit 1 if this repo is stale
```

Anything not in the manifest is project-local and safe to edit here. This repo's stack is Python + Docker + GraphQL, so any skill that needs a concrete build or test command belongs here, not upstream — the shared skills are deliberately stack-agnostic.

A mirror for Cursor lives under `.cursor/`.
