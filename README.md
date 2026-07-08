# repo-health

**Code-structure health signals for TS/JS repos — a library, a verbspec CLI, and a CI gate.** Fills the bounded-systems gap: [`drift-gate`](https://github.com/bounded-systems/drift-gate) gates a package's *public surface*; `repo-health` gates its *internal structure* — the signals that otherwise only come from external tools (skott, dependency-cruiser).

Built on the TypeScript compiler via `ts-morph`, so findings are **real import/export edges, not text matches** — a `@example import …` in a JSDoc comment is not an edge and cannot produce a phantom cycle (the failure mode that fools grep- and some scanner-based tools).

## Verbs

```
repo-health cycles    --root . --include src            # import cycles
repo-health god-files --root . --include src            # files over a LOC/export budget
repo-health hubs      --root . --include src --top 15    # import fan-in — what ripples widest
```

Each verb is a [verbspec](https://github.com/bounded-systems/verbspec) `VerbSpec`, so the same definitions project to **CLI (proactive)**, **exit code (CI gate)**, and **MCP** for free.

## Proactive vs CI

- **Proactive** — run a verb, read the JSON/rendered report on demand.
- **CI gate** — add `--gate`: findings become **exit 1**, so it drops straight into a workflow.

```yaml
- run: deno run -A jsr:@bounded-systems/repo-health/cli cycles --include src --gate
- run: deno run -A jsr:@bounded-systems/repo-health/cli god-files --include src --maxLoc 400 --gate
```

Gate on **regressions**, not absolutes: pin the current findings as a committed baseline and fail only on new cycles / newly-oversized files, ratcheting the budget down over time — the same golden pattern drift-gate uses for surface. (Baseline/golden mode is the next increment; today `--gate` fails on any finding over the budget.)

## Status

v0.1.0 — `cycles`, `god-files`, `hubs` working. Known limits, honestly:
- The cycle detector reports a **cycle basis** (one representative cycle per back-edge in the DFS), not every elementary path — enough to flag a tangle and gate on it, but it can under-report distinct cycles that share a node. Tarjan-SCC / Johnson enumeration is the v0.2 upgrade.
- `dead`-code (unused files/exports) and `verbs` (verbspec registry health) verbs are planned; today knip covers the former externally.

## License

[MIT](LICENSE) — permissive, so it can gate any repo (including commercial pipelines), unlike the noncommercial bounded-systems products.
