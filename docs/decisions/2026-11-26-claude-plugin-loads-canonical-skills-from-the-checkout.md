# The Claude Code plugin loads canonical skills from the checkout

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial)
- **Deciders:** iamkiayun (PR author)
- **Guard:** `skill-discovery` in `scripts/harness/check_harness.py` checks the manifest inventory. Reviewers verify installation and hook loading.
- **Related:** #29192, #38826

## Context

Claude Code 2.1.117 looks up the argument to `plugin install` in a marketplace.
The repository keeps its skill directories directly under the plugin root. That
CLI rejects the root itself as a skill directory. Declaring the standard
`hooks/hooks.json` file explicitly also causes a duplicate-hook load error.

## Decision

Register `./skills` as a local marketplace and install
`openmetadata-skills@openmetadata-skills`. The plugin manifest lists each
top-level skill directory and `./vendor`. Each canonical skill supplies its
`/openmetadata-skills:<name>` command. Keep `commands` empty and let Claude
Code discover `hooks/hooks.json` automatically.

## Consequences

Contributors update the manifest when they add, rename, or remove a top-level
skill. A fresh session outside the checkout can use the same connector
instructions as a session inside it, and the plugin loads its startup workflow once.
