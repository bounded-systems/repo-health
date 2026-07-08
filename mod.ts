// @bounded-systems/repo-health — code-structure health signals (import cycles,
// god-files, import hubs) as a verbspec CLI / library / CI gate. Fills the org
// gap: cycles/coupling/dead-code have no bounded-systems tool; drift-gate covers
// public-surface drift, this covers internal structure. ts-morph engine (real
// import edges, not text) so comments/JSDoc can't produce phantom findings.
export { buildProject, detectCycles, importHubs, type Cycle } from "./src/graph.ts";
export { sizeReport, type FileSize } from "./src/size.ts";
export { applyGolden, loadGolden, saveGolden, type Golden } from "./src/golden.ts";
// The verbspec verb objects (VERBS, cyclesVerb, …) are the CLI projection — reach
// them via the `./cli` entry, not the library API. Keeping them out of `.` keeps
// the public library surface to the typed engine (and avoids JSR slow-types on
// defineVerb's inferred generics).
