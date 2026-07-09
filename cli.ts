// cli.ts — repo-health's CLI projection of the verb registry. Same shape as
// drift-gate: dispatch() parses argv against each verb's Zod input; a verb whose
// output has `ok:false` exits non-zero, so `--gate` drops straight into CI.
import { dispatch, render } from "verbspec";
import { VERBS } from "./src/verbs.ts";

const BIN = "repo-health";

function usage(): string {
  const lines = [
    "repo-health — repo health signals with no bounded-systems tool (cycles, god-files, hubs, stale-prs)",
    "",
    `Usage: ${BIN} <verb> [--flags]     (${BIN} <verb> --help for a verb's flags)`,
    "",
    "Verbs:",
  ];
  for (const [id, v] of Object.entries(VERBS)) {
    lines.push(
      `  ${id.padEnd(11)} ${(v as { summary?: string }).summary ?? ""}`,
    );
  }
  lines.push(
    "",
    "Examples:",
    `  ${BIN} cycles    --root . --include src`,
    `  ${BIN} cycles    --root . --include src --gate    # exit 1 on any cycle (CI)`,
    `  ${BIN} god-files --root . --include src --maxLoc 400 --gate`,
    `  ${BIN} hubs      --root . --include src --top 15`,
    `  ${BIN} stale-prs --stale-days 14                   # open PRs older than 14d (repo from git remote / GITHUB_REPOSITORY)`,
    `  ${BIN} stale-prs --repo bounded-systems/prx --gate # exit 1 if any stale open PR (CI)`,
  );
  return lines.join("\n");
}

if (import.meta.main) {
  const args = Deno.args;
  if (args.length === 0 || ["help", "--help", "-h"].includes(args[0])) {
    console.log(usage());
    Deno.exit(0);
  }
  try {
    const result = await dispatch(VERBS, args, BIN);
    if (result.kind === "help") {
      console.log(result.text);
      Deno.exit(0);
    }
    console.log(render(result.output));
    const out = result.output as { ok?: boolean };
    Deno.exit(out && typeof out === "object" && out.ok === false ? 1 : 0);
  } catch (e) {
    console.error(`${BIN}: ${e instanceof Error ? e.message : String(e)}\n`);
    console.error(usage());
    Deno.exit(2);
  }
}
