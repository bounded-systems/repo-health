// golden.ts — regression gating. A golden is a committed baseline of accepted
// findings; --gate then fails only on findings NOT in the baseline (new
// regressions), and you ratchet the baseline down over time. Same acknowledge-
// by-regenerating-the-diff model drift-gate uses for surface.
export interface Golden {
  keys: string[];
}

/** Load a golden's finding-keys, or null if the file doesn't exist yet. */
export function loadGolden(path: string): Set<string> | null {
  try {
    const parsed = JSON.parse(Deno.readTextFileSync(path)) as Golden;
    return new Set(parsed.keys ?? []);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return null;
    throw e;
  }
}

/** Write the current finding-keys as the accepted baseline. */
export function saveGolden(path: string, keys: string[]): void {
  const body = JSON.stringify({ keys: [...new Set(keys)].sort() }, null, 2);
  Deno.writeTextFileSync(path, body + "\n");
}

/**
 * Apply a golden to a set of keyed findings.
 * - no golden path            → gate on absolute presence (per `gate`)
 * - golden path, file absent  → write baseline, pass (records current state)
 * - golden path, file present → pass unless there are NEW keys vs baseline
 */
export function applyGolden<T>(
  findings: T[],
  keyOf: (f: T) => string,
  opts: { golden?: string; gate?: boolean },
): { ok: boolean; fresh: T[]; baseline: "written" | "compared" | "none" } {
  const keys = findings.map(keyOf);
  if (!opts.golden) {
    return { ok: opts.gate ? findings.length === 0 : true, fresh: findings, baseline: "none" };
  }
  const base = loadGolden(opts.golden);
  if (base === null) {
    saveGolden(opts.golden, keys);
    return { ok: true, fresh: [], baseline: "written" };
  }
  const fresh = findings.filter((f) => !base.has(keyOf(f)));
  return { ok: fresh.length === 0, fresh, baseline: "compared" };
}
