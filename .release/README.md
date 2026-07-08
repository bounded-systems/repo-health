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
