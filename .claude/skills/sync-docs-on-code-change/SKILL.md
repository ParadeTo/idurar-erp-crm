---
name: sync-docs-on-code-change
description: Use when making code changes to a project that has a docs/ directory with API, model, route, or architecture documentation. Triggers on: adding/removing API endpoints, changing DB schemas, adding frontend routes, changing Redux state shape, adding external dependencies, or changing architectural conventions.
---

# Sync Docs on Code Change

## Overview

Code changes without doc updates leave the next reader (human or agent) with a misleading map. Update the affected section of the relevant doc **in the same commit** as the code change.

## Code Change → Doc to Update

| What changed in code | Doc(s) to patch |
|---|---|
| API endpoint added / removed / renamed | `docs/api-list.md` |
| Mongoose schema field added / removed / renamed | `docs/backend-data-model.md` · `docs/domain-model.md` |
| Frontend route added / removed | `docs/routes-pages.md` · `docs/ui-actions.md` |
| Redux slice shape or actions changed | `docs/frontend-state-model.md` |
| External service / env var added or removed | `docs/external-integrations.md` |
| New middleware, service call, or data flow step | `docs/data-flow.md` |
| Architectural convention or project rule changed | `CLAUDE.md` |
| Major structural change (new layer, new module) | Relevant SVG in `docs/` |

## Process

1. Before committing, identify which row(s) above apply.
2. Open only the affected doc — read the relevant section.
3. Edit in place: patch the affected rows/sentences only. Do not regenerate the whole doc.
4. Stage code + doc changes together in one commit.

## Red Flags — Stop and Update Docs

- "I'll update the docs later" → later never comes; do it now.
- Committing code without touching any doc → check the table above.
- Rewriting the entire doc when one row changed → patch only what changed.
- Updating docs but leaving them unstaged → always commit together.

## What "Out of Sync" Looks Like

- `api-list.md` describes an endpoint that no longer exists.
- `backend-data-model.md` shows a field that was removed.
- `routes-pages.md` has a path that 404s.
- `CLAUDE.md` describes a convention that was silently changed.
