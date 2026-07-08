// verbs.ts — the repo-health verb registry. Each verb is a verbspec VerbSpec, so
// it projects to CLI (proactive) + exit code (CI gate) + MCP for free, exactly
// like drift-gate. Report mode by default; `--gate` turns findings into exit 1.
import { z } from "zod";
import { defineVerb } from "verbspec";
import { detectCycles, importHubs } from "./graph.ts";
import { sizeReport } from "./size.ts";

const target = {
  root: z.string().default(Deno.cwd()),
  include: z.string().default("."),
};
const glob = (root: string, include: string) => `${root}/${include}/**/*.ts`;

export const cyclesVerb = defineVerb({
  id: "cycles",
  summary: "Import cycles via ts-morph (ignores comments/JSDoc). --gate exits 1 on any cycle.",
  actor: "work",
  positionals: [],
  input: z.object({ ...target, gate: z.boolean().optional() }),
  output: z.object({
    ok: z.boolean(),
    count: z.number(),
    cycles: z.array(z.object({ chain: z.array(z.string()) })),
  }),
  run: (i) => {
    const cycles = detectCycles([glob(i.root, i.include)], i.root);
    return { ok: i.gate ? cycles.length === 0 : true, count: cycles.length, cycles };
  },
  render: (o) =>
    o.count === 0
      ? "no import cycles ✓"
      : o.cycles.map((c, n) => `  ${n + 1}. ${c.chain.join(" → ")}`).join("\n") +
        `\n${o.count} cycle(s)`,
  exitCode: (o) => (o.ok ? 0 : 1),
});

export const godFilesVerb = defineVerb({
  id: "god-files",
  summary: "Files over a LOC/export budget (real ts-morph export counts). --gate exits 1.",
  actor: "work",
  positionals: [],
  input: z.object({
    ...target,
    maxLoc: z.coerce.number().default(400),
    maxExports: z.coerce.number().default(25),
    gate: z.boolean().optional(),
  }),
  output: z.object({
    ok: z.boolean(),
    overBudget: z.array(z.object({ file: z.string(), loc: z.number(), exports: z.number() })),
  }),
  run: (i) => {
    const over = sizeReport([glob(i.root, i.include)], i.root)
      .filter((f) => f.loc > i.maxLoc || f.exports > i.maxExports);
    return { ok: i.gate ? over.length === 0 : true, overBudget: over };
  },
  render: (o) =>
    o.overBudget.length === 0
      ? "no god-files ✓"
      : o.overBudget.map((f) => `  ${String(f.loc).padStart(4)} LOC · ${String(f.exports).padStart(3)} exp  ${f.file}`).join("\n"),
  exitCode: (o) => (o.ok ? 0 : 1),
});

export const hubsVerb = defineVerb({
  id: "hubs",
  summary: "Import fan-in ranking — which modules ripple widest when changed.",
  actor: "work",
  positionals: [],
  input: z.object({ ...target, top: z.coerce.number().default(10) }),
  output: z.object({
    ok: z.boolean(),
    hubs: z.array(z.object({ file: z.string(), importedBy: z.number() })),
  }),
  run: (i) => ({ ok: true, hubs: importHubs([glob(i.root, i.include)], i.root).slice(0, i.top) }),
  render: (o) => o.hubs.map((h) => `  ${String(h.importedBy).padStart(3)}×  ${h.file}`).join("\n"),
  exitCode: () => 0,
});

export const VERBS = {
  cycles: cyclesVerb,
  "god-files": godFilesVerb,
  hubs: hubsVerb,
};
