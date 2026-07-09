---
bump: minor
---
Add a `stale-prs` verb — open PRs older than `--stale-days` (default 14), so orphaned/forgotten PRs (e.g. a superseded release-hashes PR left open) surface as a health signal. Resolves the repo from `--repo owner/name`, `GITHUB_REPOSITORY`, or the git remote; supports the same `--gate` (CI exit 1) and `--golden <path>` (baseline, fail only on new) modes as the other verbs. The one signal that reaches the GitHub API; pure scoring (`stalePrs`) is unit-tested.
