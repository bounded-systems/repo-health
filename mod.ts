// @bounded-systems/repo-health — code-structure health signals (import cycles,
// god-files, import hubs) as a verbspec CLI / library / CI gate. Fills the org
// gap: cycles/coupling/dead-code have no bounded-systems tool; drift-gate covers
// public-surface drift, this covers internal structure. ts-morph engine (real
// import edges, not text) so comments/JSDoc can't produce phantom findings.
export { buildProject, detectCycles, importHubs, type Cycle } from "./src/graph.ts";
export { sizeReport, type FileSize } from "./src/size.ts";
export { VERBS, cyclesVerb, godFilesVerb, hubsVerb } from "./src/verbs.ts";
