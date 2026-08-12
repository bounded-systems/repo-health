# Release intents

This repo uses [@bounded-systems/mint](https://github.com/bounded-systems/mint) for
versioning. Each PR with a user-facing change drops an intent file here; mint
resolves the strongest bump and cuts the release deterministically.

Format — `.release/<slug>.md`:

    ---
    bump: minor   # patch | minor | major
    ---
    short summary of the change (becomes the changelog line)

The `version` CI job runs `mint plan`, which validates every intent and previews
the next version. On a `v<version>` tag cut by `mint release`, `release.yml`
emits signed in-toto provenance, `publish-jsr.yml` publishes to JSR, and
`binaries.yml` attaches the compiled `drift` binaries.

## Cut releases with mint >= 0.5.0

This repo's JSR manifest is `deno.json`, and `jsr publish` versions by it. mint
only learned to bump `deno.json` in **0.5.0**; before that it wrote
`package.json`/`package-lock.json`/`jsr.json` only, so `mint version` would bump
`package.json` and leave `deno.json` behind — `jsr publish` then republished the
*old* version as a no-op-fail and the new version never shipped (#5).

The CI jobs above are pinned to a mint commit, so they are covered. `mint version`
is the one step run by hand, so it is the one that can still be run from a mint
too old to know about `deno.json`. mint has no `--version` flag to ask (`version`
is the bump verb), so check the bump itself before committing it:

    mint version && git diff --name-only   # must list deno.json AND package.json

If `deno.json` is absent from that list, the mint you just ran predates 0.5.0.
Discard the bump, update mint, and redo it — do not hand-edit `deno.json` to
match, which is how 0.2.0 shipped and why this is written down.

Do **not** "fix" this by adding a `jsr.json` alongside `deno.json`. When both are
present `deno publish` reads `deno.json` and ignores `jsr.json`, so mint would
bump a file the publish path never reads — the same silent no-op, wearing a fix.
