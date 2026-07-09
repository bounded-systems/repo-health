// verbs.ts — the repo-health verb registry. Each verb is a verbspec VerbSpec, so
// it projects to CLI (proactive) + exit code (CI gate) + MCP for free, exactly
// like drift-gate. Modes: report (default) · --gate (fail on any finding) ·
// --golden <path> (fail only on findings NEW vs a committed baseline).
import { z } from "zod";
import { defineVerb } from "verbspec";
import { detectCycles, importHubs } from "./graph.ts";
import { sizeReport } from "./size.ts";
import { applyGolden } from "./golden.ts";
import { fetchOpenPrs, resolveRepoSlug, stalePrs } from "./prs.ts";

const target = {
  root: z.string().default(Deno.cwd()),
  include: z.string().default("."),
};
const gating = {
  gate: z.boolean().optional(),
  golden: z.string().optional(),
};
const glob = (root: string, include: string) => `${root}/${include}/**/*.ts`;
const baselineField = z.enum(["written", "compared", "none"]);

export const cyclesVerb = defineVerb({
  id: "cycles",
  summary:
    "Import cycles via ts-morph (ignores comments/JSDoc). --gate / --golden for CI.",
  actor: "work",
  positionals: [],
  input: z.object({ ...target, ...gating }),
  output: z.object({
    ok: z.boolean(),
    baseline: baselineField,
    total: z.number(),
    new: z.number(),
    cycles: z.array(z.object({ chain: z.array(z.string()) })),
  }),
  run: (i) => {
    const cycles = detectCycles([glob(i.root, i.include)], i.root);
    const g = applyGolden(
      cycles,
      (c) => [...new Set(c.chain)].sort().join("|"),
      i,
    );
    return {
      ok: g.ok,
      baseline: g.baseline,
      total: cycles.length,
      new: g.fresh.length,
      cycles: g.baseline === "compared" ? g.fresh : cycles,
    };
  },
  render: (o) => {
    if (o.baseline === "written") {
      return `wrote baseline — ${o.total} cycle(s) accepted`;
    }
    const list = o.cycles.map((c, n) => `  ${n + 1}. ${c.chain.join(" → ")}`)
      .join("\n");
    if (o.baseline === "compared") {
      return o.new === 0
        ? `no new cycles ✓ (${o.total} baselined)`
        : `${list}\n${o.new} NEW cycle(s)`;
    }
    return o.total === 0
      ? "no import cycles ✓"
      : `${list}\n${o.total} cycle(s)`;
  },
  exitCode: (o) => (o.ok ? 0 : 1),
});

export const godFilesVerb = defineVerb({
  id: "god-files",
  summary:
    "Files over a LOC/export budget (real ts-morph export counts). --gate / --golden for CI.",
  actor: "work",
  positionals: [],
  input: z.object({
    ...target,
    ...gating,
    maxLoc: z.coerce.number().default(400),
    maxExports: z.coerce.number().default(25),
    exclude: z.string().optional().describe(
      "comma-separated globs (relative to root) to skip — e.g. generated files",
    ),
  }),
  output: z.object({
    ok: z.boolean(),
    baseline: baselineField,
    total: z.number(),
    new: z.number(),
    overBudget: z.array(
      z.object({ file: z.string(), loc: z.number(), exports: z.number() }),
    ),
  }),
  run: (i) => {
    const globs = [
      glob(i.root, i.include),
      ...(i.exclude ?? "").split(",").map((e) => e.trim()).filter(Boolean).map((
        e,
      ) => `!${i.root}/${e}`),
    ];
    const over = sizeReport(globs, i.root)
      .filter((f) => f.loc > i.maxLoc || f.exports > i.maxExports);
    const g = applyGolden(over, (f) => f.file, i);
    return {
      ok: g.ok,
      baseline: g.baseline,
      total: over.length,
      new: g.fresh.length,
      overBudget: g.baseline === "compared" ? g.fresh : over,
    };
  },
  render: (o) => {
    const row = (f: { file: string; loc: number; exports: number }) =>
      `  ${String(f.loc).padStart(4)} LOC · ${
        String(f.exports).padStart(3)
      } exp  ${f.file}`;
    if (o.baseline === "written") {
      return `wrote baseline — ${o.total} file(s) accepted`;
    }
    const list = o.overBudget.map(row).join("\n");
    if (o.baseline === "compared") {
      return o.new === 0
        ? `no newly-oversized files ✓ (${o.total} baselined)`
        : `${list}\n${o.new} NEW over budget`;
    }
    return o.total === 0 ? "no god-files ✓" : list;
  },
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
  run: (i) => ({
    ok: true,
    hubs: importHubs([glob(i.root, i.include)], i.root).slice(0, i.top),
  }),
  render: (o) =>
    o.hubs.map((h) => `  ${String(h.importedBy).padStart(3)}×  ${h.file}`).join(
      "\n",
    ),
  exitCode: () => 0,
});

export const stalePrsVerb = defineVerb({
  id: "stale-prs",
  summary:
    "Open PRs older than --stale-days (orphaned/forgotten). --gate / --golden for CI.",
  actor: "work",
  positionals: [],
  input: z.object({
    root: z.string().default(Deno.cwd()),
    repo: z.string().optional().describe(
      "owner/name — overrides GITHUB_REPOSITORY + git-remote detection",
    ),
    staleDays: z.coerce.number().default(14),
    ...gating,
  }),
  output: z.object({
    ok: z.boolean(),
    baseline: baselineField,
    repo: z.string(),
    total: z.number(),
    new: z.number(),
    stale: z.array(z.object({
      number: z.number(),
      title: z.string(),
      author: z.string(),
      ageDays: z.number(),
      isDraft: z.boolean(),
      url: z.string(),
    })),
  }),
  run: async (i) => {
    const slug = await resolveRepoSlug(i.root, i.repo);
    if (!slug) {
      throw new Error(
        "could not determine repo — pass --repo owner/name (or run inside a clone / GitHub Actions)",
      );
    }
    const stale = stalePrs(await fetchOpenPrs(slug), new Date(), i.staleDays);
    const g = applyGolden(stale, (p) => `#${p.number}`, i);
    return {
      ok: g.ok,
      baseline: g.baseline,
      repo: slug,
      total: stale.length,
      new: g.fresh.length,
      stale: g.baseline === "compared" ? g.fresh : stale,
    };
  },
  render: (o) => {
    const row = (
      p: {
        number: number;
        ageDays: number;
        isDraft: boolean;
        title: string;
        author: string;
      },
    ) =>
      `  #${String(p.number).padEnd(5)} ${String(p.ageDays).padStart(3)}d  ${
        p.isDraft ? "[draft] " : ""
      }${p.title}  (@${p.author})`;
    if (o.baseline === "written") {
      return `wrote baseline — ${o.total} stale PR(s) accepted`;
    }
    const list = o.stale.map(row).join("\n");
    if (o.baseline === "compared") {
      return o.new === 0
        ? `no new stale PRs ✓ (${o.total} baselined) — ${o.repo}`
        : `${list}\n${o.new} NEW stale PR(s) — ${o.repo}`;
    }
    return o.total === 0
      ? `no stale open PRs ✓ — ${o.repo}`
      : `${list}\n${o.total} stale open PR(s) — ${o.repo}`;
  },
  exitCode: (o) => (o.ok ? 0 : 1),
});

export const VERBS = {
  cycles: cyclesVerb,
  "god-files": godFilesVerb,
  hubs: hubsVerb,
  "stale-prs": stalePrsVerb,
};
