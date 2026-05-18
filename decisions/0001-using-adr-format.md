# 0001 — Using ADR Format for Decisions

**Date:** 2026-05-18
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
