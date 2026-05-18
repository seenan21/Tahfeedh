# packages/shared

`@tahfeedh/shared` — types and Zod schemas consumed by both `apps/web` and `apps/server`. No runtime code beyond schema validation.

The package emits ESM JS + `.d.ts` to `dist/` and `package.json` `exports` point at those built artifacts. Web (Vite) and server (compiled to JS for `node dist/index.js`) both load from the built output. **Shared must be built before web/server start or build** — the root `dev` / `build` scripts enforce this order; the `predev` hook compiles shared on cold start and `dev:shared` watches it during a dev session.

## Index

| Path | What | When to read |
|---|---|---|
| `src/` | Types + Zod schemas (the source) | Adding or changing a cross-app type/schema |
| `dist/` | **Generated.** Compiled ESM + declaration files (`tsc -p tsconfig.build.json`). Do not edit. Not committed — gitignored | Debugging an import resolution; never edit |
| `package.json` | Workspace package definition. `exports` map points at `./dist/*.js` and `./dist/*.d.ts` | Adding a dependency or a new export subpath |
| `tsconfig.json` | Typecheck-only TS config (`noEmit`) | Adjusting strictness / library options |
| `tsconfig.build.json` | Emit config used by the `build` script | Changing emit target, declaration maps, etc. |

## Operational

```
npm run build --workspace=@tahfeedh/shared   # one-shot emit to dist/
npm run dev   --workspace=@tahfeedh/shared   # tsc --watch — rebuilds on src/ changes
```
