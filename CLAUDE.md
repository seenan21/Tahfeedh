# Claude Code Instructions — Tahfeedh

This project uses a lightweight decision-tracking system. Follow these rules whenever working in this repo.

---

## At the start of every session

Before writing any code:

1. Read `DESIGN.md` — at minimum the table of contents and any sections relevant to today's task.
2. List `decisions/` and read the 3–5 most recent ADRs (sorted by number, descending).
3. Read `CHANGELOG.md` `[Unreleased]` section.
4. If working in a feature folder that has a `WORKLOG.md`, read it.

Give the user a brief grounding summary before starting work:

```
Loaded context:
- DESIGN.md §X (relevant sections)
- Recent ADRs: 0007, 0006, 0005
- [Unreleased]: [summary]
- WORKLOG: currently on [task]

Open questions from prior session: [if any]
```

Don't dump everything. Summarize what's relevant.

---

## During work — capture decisions as ADRs

When a non-trivial decision is made, capture it as an ADR **before continuing implementation**. Don't ask first — write the file and show it to the user. They can edit after.

### What counts as non-trivial

Capture as ADR if the decision:
- Affects the schema (tables, columns, indexes, constraints)
- Affects the algorithm (weights, thresholds, ranking logic)
- Affects an API integration (which endpoint, auth flow, fallback)
- Sets a UX pattern (modal vs popover, sidebar vs tabs, mobile-specific behavior)
- Adds, removes, or replaces a dependency
- Defines an invariant or constraint
- Trades off two reasonable approaches and picks one
- Reverses or supersedes an earlier decision

### Do NOT capture

- Variable names, file paths, small refactors
- Bug fixes with one obvious correct answer
- Style choices already in the project
- Anything obvious enough that future-you wouldn't ask "why?"

When in doubt, lean toward capturing. ADRs are cheap.

### How to write an ADR

1. Find the next number: list `decisions/`, find highest `NNNN`, increment.
2. Filename: `decisions/NNNN-kebab-case-title.md` (3–6 word title)
3. Use this template:

```markdown
# NNNN — Title in Five Words

**Date:** YYYY-MM-DD
**Status:** Implemented
**Milestone:** MN

## Context
What problem or choice prompted this? 2–4 sentences.

## Decision
What did we decide? Specific enough to implement.

## Consequences
- ✅ Positive
- ⚠️ Negative or tradeoff

## Reverses
NNNN  (only if this supersedes an earlier ADR — delete otherwise)
```

4. Show the user:
   ```
   Captured as ADR NNNN: decisions/NNNN-title.md
   [paste contents]
   Edit if needed, then we'll continue.
   ```

5. If this reverses an earlier ADR: populate the `Reverses:` field AND edit the prior ADR's Status to `Superseded by NNNN`. Don't delete old ADRs — the graveyard is useful.

---

## During work — watch for drift

If implementation would contradict DESIGN.md or a prior ADR, **stop and surface the conflict** before writing code:

> "DESIGN.md §X says [thing]. We're about to write [other thing]. Two options:
> (a) Align the code with DESIGN.md
> (b) Write an ADR superseding DESIGN.md §X and update DESIGN.md
> Which?"

If (b), update DESIGN.md in the same operation as writing the ADR. DESIGN.md never silently drifts.

---

## At the end of a session

When the user signals wrap-up ("good for today", "wrapping up", "let's commit"):

1. **Recap.** What was built, what was decided, what was discussed but not concluded.

2. **Catch missed ADRs.** Scan the session for any non-trivial decisions that weren't captured. For each, ask: "Capture this as ADR NNNN?" If yes, write it.

3. **Update CHANGELOG.md `[Unreleased]`.** Add entries under appropriate headings (Added / Changed / Fixed / Removed / Deprecated). Be specific:
   - Good: "Wrong-verse error type uses QF Search API inline"
   - Bad: "Improved error logging"

4. **Update WORKLOG.md** if working in a feature folder:
   - Check off completed TODOs
   - Add new TODOs surfaced during the session
   - Note any open questions clearly

5. **Surface open questions** for next session.

6. **Propose a commit message** (don't commit — the user does that):
   ```
   feat(live-test): mushaf overlay + error logging modal

   - Adds MushafPage with overlay support
   - Adds ErrorLogModal with all 8 error types
   - Captures ADRs 0007 (popover on mobile), 0008 (overlay layering)
   ```

---

## Answering "why did we...?"

1. Search `decisions/` for keyword matches.
2. Search DESIGN.md.
3. Answer with citation:
   > "Per ADR 0005: we tracked at ayah level because [reason]."

If no record exists: "I don't find a decision logged for this. Want me to capture one now based on our discussion?"

---

## File conventions

- `DESIGN.md` — repo root. The constitution. Changes rarely and deliberately.
- `decisions/NNNN-kebab-case-title.md` — repo root. Build-time decisions.
- `CHANGELOG.md` — repo root. What changed per milestone.
- `WORKLOG.md` — inside feature folders (e.g., `apps/web/src/features/live-test/WORKLOG.md`). Optional, useful during active work.

---

## Tahfeedh milestone shorthand

| Shorthand | Means |
|---|---|
| "the mushaf" | MushafPage component (M2) |
| "the algorithm" | Session plan + revision priority logic (M5) |
| "live test" / "test screen" | `apps/web/src/features/live-test` (M4) |
| "today view" | Student dashboard landing (M3) |
| "post-test pipeline" | `apps/server/src/pipelines/post-test` (M4) |
| "teacher view" | `apps/web/src/features/teacher-dashboard` (M6) |
| "QUL" | Quranic Universal Library (static data) |
| "QF" | Quran Foundation (APIs) |

---

## Anti-patterns

- Don't write essays. ADRs are 5–15 lines per section.
- Don't silently edit old ADRs. Supersede with new ones.
- Don't skip the session-end ritual.
- Don't capture trivial choices (variable names, lint rules).
- Don't pre-code capture. Wait until a decision is actually made, not while imagining options.

---

## First-time setup

If `decisions/` doesn't exist yet, create it and write `decisions/0001-using-adr-format.md`:

```markdown
# 0001 — Using ADR Format for Decisions

**Date:** [today]
**Status:** Implemented
**Milestone:** M1

## Context
Solo AI-augmented build means decisions get made fast and easily forgotten across sessions. Without a record, the codebase silently drifts from DESIGN.md.

## Decision
Capture all non-trivial decisions as numbered ADR files in `decisions/`. See CLAUDE.md for the rules.

## Consequences
- ✅ Decisions stay anchored across sessions
- ✅ DESIGN.md stays clean while ADRs hold build-time evolution
- ⚠️ Requires the discipline of running session-end ritual
```

Then create `CHANGELOG.md` with this skeleton:

```markdown
# Changelog

## [Unreleased]

### Added
- (nothing yet)

### Changed
- (nothing yet)

### Fixed
- (nothing yet)
```

Done. Move on to the actual work.