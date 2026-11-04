# Agent run duration is raw milliseconds, shown in compact units, and OSS merges before Collate

- **Status:** Accepted
- **Revisions:** v1 2026-11-04 (initial)
- **Deciders:** Sweta Agarwalla
- **Guard:** `RunHistoryDrawer.test.tsx`, `agentsDataMapper.test.ts`; paired build and merge-order review
- **Related:** [#37052](https://github.com/open-metadata/OpenMetadata/issues/37052), [OpenMetadata #37055](https://github.com/open-metadata/OpenMetadata/pull/37055), [Collate #8265](https://github.com/open-metadata/openmetadata-collate/pull/8265)

## Context

`AgentRun.duration` held decimal minutes, and the run history drawer printed it with a localized
"min" suffix, so a nearly three-hour run read as `165.6 min`. `AgentRun` is shared with Collate: it
is handed to Collate's `RenderRunAction` plugin, and Collate tests build `AgentRun` fixtures.

## Decision

`AgentRun.durationMs` is the run's `endDate − startDate` in milliseconds, or `0` when the run has
no end date. Display code formats it with `convertMillisecondsToHumanReadableFormat(ms, 2)`, which
gives at most two units (`2h 45m`, `3m 48s`, `42s`).

The units are the compact, non-localized `Y`/`M`/`d`/`h`/`m`/`s` suffixes of that helper in every
locale, matching the time-left text on the same page. `message.ran-for-duration` therefore carries
no unit of its own.

Merge OSS #37055 first, then Collate #8265, which renames its fixture field. Collate CI builds
against OpenMetadata `main`, so Collate's type check fails until both are in.

## Consequences

Consumers never convert units; a new display reads `durationMs` and formats it the same way.
Localizing the units would mean changing the shared helper for every surface that uses it, not
adding a unit word back to this string.
