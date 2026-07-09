// @bounded-systems/repo-health — repo health signals (import cycles, god-files,
// import hubs, stale open PRs) as a verbspec CLI / library / CI gate. Fills the
// org gap: cycles/coupling/dead-code have no bounded-systems tool; drift-gate
// covers public-surface drift, this covers internal structure + repo hygiene.
// ts-morph engine (real import edges, not text) so comments/JSDoc can't produce
// phantom findings; the PR signal is the one part that reaches the GitHub API.
export {
  buildProject,
  type Cycle,
  detectCycles,
  importHubs,
} from "./src/graph.ts";
export { type FileSize, sizeReport } from "./src/size.ts";
export {
  applyGolden,
  type Golden,
  loadGolden,
  saveGolden,
} from "./src/golden.ts";
// Open-PR hygiene engine (the one networked signal; pure scoring is `stalePrs`).
export {
  fetchOpenPrs,
  type OpenPr,
  originUrlFromGitConfig,
  repoSlugFromRemote,
  resolveRepoSlug,
  type StalePr,
  stalePrs,
} from "./src/prs.ts";
// The verbspec verb objects (VERBS, cyclesVerb, …) are the CLI projection — reach
// them via the `./cli` entry, not the library API. Keeping them out of `.` keeps
// the public library surface to the typed engine (and avoids JSR slow-types on
// defineVerb's inferred generics).
