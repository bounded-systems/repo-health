import { assertEquals } from "jsr:@std/assert@^1";
import {
  fetchOpenPrs,
  type OpenPr,
  originUrlFromGitConfig,
  repoSlugFromRemote,
  resolveRepoSlug,
  stalePrs,
} from "./prs.ts";

const NOW = new Date("2026-07-08T00:00:00Z");
const pr = (
  number: number,
  daysAgo: number,
  extra: Partial<OpenPr> = {},
): OpenPr => ({
  number,
  title: `pr ${number}`,
  author: "bot",
  createdAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
  isDraft: false,
  url: `https://github.com/o/r/pull/${number}`,
  ...extra,
});

Deno.test("stalePrs flags only PRs at or over the threshold", () => {
  const stale = stalePrs([pr(1, 20), pr(2, 14), pr(3, 13), pr(4, 1)], NOW, 14);
  assertEquals(stale.map((p) => p.number), [1, 2]); // 13d and 1d are fresh
});

Deno.test("stalePrs sorts oldest-first and reports ageDays", () => {
  const stale = stalePrs([pr(1, 5), pr(2, 30), pr(3, 10)], NOW, 3);
  assertEquals(stale.map((p) => [p.number, p.ageDays]), [[2, 30], [3, 10], [
    1,
    5,
  ]]);
});

Deno.test("stalePrs with staleDays 0 returns every open PR", () => {
  assertEquals(stalePrs([pr(1, 0), pr(2, 2)], NOW, 0).length, 2);
});

Deno.test("stalePrs carries the draft flag through", () => {
  const [only] = stalePrs([pr(9, 40, { isDraft: true })], NOW, 14);
  assertEquals(only.isDraft, true);
});

Deno.test("repoSlugFromRemote parses https and ssh, rejects non-github", () => {
  assertEquals(
    repoSlugFromRemote("https://github.com/bounded-systems/prx.git"),
    "bounded-systems/prx",
  );
  assertEquals(
    repoSlugFromRemote("git@github.com:bounded-systems/repo-health.git"),
    "bounded-systems/repo-health",
  );
  assertEquals(repoSlugFromRemote("https://github.com/o/r"), "o/r");
  assertEquals(repoSlugFromRemote("https://gitlab.com/o/r.git"), null);
});

Deno.test("originUrlFromGitConfig extracts the origin remote url", () => {
  const cfg =
    `[core]\n\tbare = false\n[remote "origin"]\n\turl = git@github.com:o/r.git\n\tfetch = +refs/heads/*:refs/remotes/origin/*\n[branch "main"]\n`;
  assertEquals(originUrlFromGitConfig(cfg), "git@github.com:o/r.git");
  assertEquals(originUrlFromGitConfig("[core]\n\tbare = false\n"), null);
});

Deno.test("resolveRepoSlug prefers the explicit flag over any detection", async () => {
  assertEquals(
    await resolveRepoSlug("/no/such/path", "owner/name"),
    "owner/name",
  );
});

Deno.test("fetchOpenPrs maps the GitHub payload via an injected fetch", async () => {
  const fake: typeof fetch = () =>
    Promise.resolve(
      new Response(
        JSON.stringify([
          {
            number: 7,
            title: "t",
            user: { login: "alice" },
            created_at: "2026-06-01T00:00:00Z",
            draft: true,
            html_url: "u",
          },
          {
            number: 8,
            title: "t2",
            user: null,
            created_at: "2026-06-02T00:00:00Z",
            draft: false,
            html_url: "u2",
          },
        ]),
        { status: 200 },
      ),
    );
  const prs = await fetchOpenPrs("o/r", fake);
  assertEquals(prs[0], {
    number: 7,
    title: "t",
    author: "alice",
    createdAt: "2026-06-01T00:00:00Z",
    isDraft: true,
    url: "u",
  });
  assertEquals(prs[1].author, "(unknown)"); // null user → placeholder
});

Deno.test("fetchOpenPrs throws on a non-ok response", async () => {
  const fake: typeof fetch = () =>
    Promise.resolve(
      new Response("nope", { status: 404, statusText: "Not Found" }),
    );
  let threw = false;
  try {
    await fetchOpenPrs("o/r", fake);
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});
