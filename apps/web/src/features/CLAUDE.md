# apps/web/src/features/

Feature-folder subdirectories — each is a self-contained surface (route + supporting components + hooks) tied to one user-facing flow. Compare to `routes/` (file-based router) and `components/` (shared primitives): a feature folder owns *all* the moving parts for one experience, and its top-level file is the component the route renders.

## Index

| Path | What | When to read |
|---|---|---|
| `live-test/` | The live-test surface (Phase D / M4): two-pane mushaf + error log, error logging modal with inline QF Search for wrong-verse, post-test summary | Touching the witnessed-test flow |
