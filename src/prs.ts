// prs.ts — open-PR hygiene. Unlike the ts-morph verbs (cycles/god-files/hubs),
// open PRs aren't in the source tree, so this is the one engine that reaches the
// GitHub API. The scoring core (`stalePrs`) and slug parsing are pure and
// unit-tested; `fetchOpenPrs` is the only networked seam.

const DAY_MS = 86_400_000;

/** An open pull request, projected to just what the health signal needs. */
export interface OpenPr {
  number: number;
  title: string;
  author: string;
  /** ISO-8601 creation timestamp (GitHub `created_at`). */
  createdAt: string;
  isDraft: boolean;
  url: string;
}

/** An open PR judged stale (older than the threshold), with its age. */
export interface StalePr {
  number: number;
  title: string;
  author: string;
  ageDays: number;
  isDraft: boolean;
  url: string;
}

/**
 * Pure: the open PRs at least `staleDays` old, oldest first. Deterministic given
 * `now`, so it unit-tests without a clock or the network. An orphaned PR (like a
 * superseded release-hashes PR left open) surfaces here as it ages.
 */
export function stalePrs(
  prs: OpenPr[],
  now: Date,
  staleDays: number,
): StalePr[] {
  const cutoff = staleDays * DAY_MS;
  const nowMs = now.getTime();
  return prs
    .map((p) => ({ pr: p, age: nowMs - new Date(p.createdAt).getTime() }))
    .filter((x) => x.age >= cutoff)
    .map(({ pr, age }): StalePr => ({
      number: pr.number,
      title: pr.title,
      author: pr.author,
      ageDays: Math.floor(age / DAY_MS),
      isDraft: pr.isDraft,
      url: pr.url,
    }))
    .sort((a, b) => b.ageDays - a.ageDays);
}

/** Pure: parse `owner/repo` from an https or ssh GitHub remote URL, else null. */
export function repoSlugFromRemote(url: string): string | null {
  const m = url.trim().match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?\/?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Pure: pull the origin remote URL out of a `.git/config` body, else null. */
export function originUrlFromGitConfig(config: string): string | null {
  const m = config.match(/\[remote "origin"\][^[]*?url\s*=\s*(\S+)/);
  return m ? m[1] : null;
}

/**
 * Resolve the `owner/repo` slug to query, in priority order:
 *   1. an explicit `repo` flag,
 *   2. `GITHUB_REPOSITORY` (set by GitHub Actions — the CI-gate path),
 *   3. the origin remote in `<root>/.git/config` (normal local clone).
 * Returns null when none resolve (caller should ask for `--repo owner/name`).
 */
export async function resolveRepoSlug(
  root: string,
  repoFlag?: string,
): Promise<string | null> {
  if (repoFlag && repoFlag.includes("/")) return repoFlag;
  const env = (() => {
    try {
      return Deno.env.get("GITHUB_REPOSITORY") ?? undefined;
    } catch {
      return undefined; // --allow-env not granted; fall through to disk
    }
  })();
  if (env && env.includes("/")) return env;
  try {
    const cfg = await Deno.readTextFile(`${root}/.git/config`);
    const url = originUrlFromGitConfig(cfg);
    return url ? repoSlugFromRemote(url) : null;
  } catch {
    return null;
  }
}

/** GitHub's `/pulls` item, narrowed to the fields we read. */
interface GitHubPull {
  number: number;
  title: string;
  user: { login: string } | null;
  created_at: string;
  draft: boolean;
  html_url: string;
}

/** Page size for the paginated open-PR fetch (GitHub caps `per_page` at 100). */
const OPEN_PR_PAGE = 100;

/**
 * Fetch every open PR for `slug` (`owner/repo`), following pagination so a repo
 * with >100 open PRs isn't silently truncated. Uses `GITHUB_TOKEN`/`GH_TOKEN`
 * when present (higher rate limit, private repos); works unauthenticated on
 * public repos. The only networked function in this package.
 */
export async function fetchOpenPrs(
  slug: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OpenPr[]> {
  const token = (() => {
    try {
      return Deno.env.get("GITHUB_TOKEN") ?? Deno.env.get("GH_TOKEN") ??
        undefined;
    } catch {
      return undefined;
    }
  })();
  const headers = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "bounded-systems-repo-health",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  };
  const all: OpenPr[] = [];
  for (let page = 1;; page++) {
    const res = await fetchImpl(
      `https://api.github.com/repos/${slug}/pulls?state=open&per_page=${OPEN_PR_PAGE}&page=${page}`,
      { headers },
    );
    if (!res.ok) {
      throw new Error(
        `GitHub API ${res.status} ${res.statusText} for ${slug}/pulls`,
      );
    }
    const pulls = (await res.json()) as GitHubPull[];
    for (const p of pulls) {
      all.push({
        number: p.number,
        title: p.title,
        author: p.user?.login ?? "(unknown)",
        createdAt: p.created_at,
        isDraft: p.draft,
        url: p.html_url,
      });
    }
    if (pulls.length < OPEN_PR_PAGE) break;
  }
  return all;
}
