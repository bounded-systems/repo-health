# Changelog

## 0.2.0 — 2026-07-08

### Minor

- Add a `stale-prs` verb — open PRs older than `--stale-days` (default 14), so orphaned/forgotten PRs (e.g. a superseded release-hashes PR left open) surface as a health signal. Resolves the repo from `--repo owner/name`, `GITHUB_REPOSITORY`, or the git remote; supports the same `--gate` (CI exit 1) and `--golden <path>` (baseline, fail only on new) modes as the other verbs. It's the one signal that reaches the GitHub API (open PRs aren't in the source tree) and paginates so >100 open PRs aren't silently truncated; the pure scorer (`stalePrs`) is unit-tested and `deno test` now runs in CI.

## 0.1.0 — 2026-07-08

### Minor

- Initial release. Three verbs — `cycles`, `god-files`, `hubs` — computing structural code-health signals via the TypeScript compiler (ts-morph), so findings are real import/export edges, not text matches (JSDoc `@example` imports can't produce phantom cycles). Each is a verbspec `VerbSpec` projecting to CLI, exit-code CI gate, and MCP. Three modes: report (default), `--gate` (fail on any finding), and `--golden <path>` (baseline accepted findings, fail only on new regressions, ratchet down). `god-files` counts only **own-declared** exports (a re-export barrel/facade isn't a false god) and takes `--exclude <comma-separated globs>` to skip generated/vendored files, so the gate flags real smells rather than generated code or thin facades.
