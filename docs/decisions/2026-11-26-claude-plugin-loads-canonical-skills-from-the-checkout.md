# The Claude Code plugin loads canonical skills from the checkout

- **Status:** Accepted
- **Revisions:** v1 2026-11-26 (initial), v2 2026-11-27 (command names and CLI compatibility)
- **Deciders:** iamkiayun (PR author)
- **Guard:** `skill-discovery` in `scripts/harness/check_harness.py` checks the manifest inventory. Reviewers verify installation and hook loading.
- **Related:** #29192, #38826

## Context

Claude Code 2.1.117 looks up the argument to `plugin install` in a marketplace.
The repository keeps its skill directories directly under the plugin root. That
CLI loads only the three vendored skills when the manifest specifies
`["./", "./vendor"]`. Claude Code 2.1.332 loads all 26. Declaring the standard
`hooks/hooks.json` file explicitly also causes a duplicate-hook load error.

## Decision

Register `./skills` as a local marketplace and install
`openmetadata-skills@openmetadata-skills`. The plugin manifest lists each
top-level skill directory and `./vendor`. Match each top-level skill’s
frontmatter name to its directory so individual entries use the same names as
in-repo discovery. Each canonical skill supplies its
`/openmetadata-skills:<name>` command. Keep `commands` empty and let Claude
Code discover `hooks/hooks.json` automatically.

## Consequences

Contributors update the manifest when they add, rename, or remove a top-level
skill. A fresh session outside the checkout can use the same connector
instructions as a session inside it, and the plugin loads its startup workflow once.
