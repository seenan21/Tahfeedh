# apps/server/src/pipelines/

Server-side transactional pipelines. Each subfolder owns one pipeline that combines pure logic (range expansion, payload assembly) with one SECURITY DEFINER SQL function call.

## Index

| Path | What | When to read |
|---|---|---|
| `post-test/` | Post-test pipeline — range resolution and the `submit_test(uuid, jsonb)` RPC orchestrator (ADR 0017) | Touching the witnessed-test finish flow, page promotion, or error stat decay |
