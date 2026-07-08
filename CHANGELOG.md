# Changelog

## 0.1.0 — 2026-07-08

### Minor

- Initial release. Three verbs — `cycles`, `god-files`, `hubs` — computing structural code-health signals via the TypeScript compiler (ts-morph), so findings are real import/export edges, not text matches (JSDoc `@example` imports can't produce phantom cycles). Each is a verbspec `VerbSpec` projecting to CLI, exit-code CI gate, and MCP. Three modes: report (default), `--gate` (fail on any finding), and `--golden <path>` (baseline accepted findings, fail only on new regressions, ratchet down).
