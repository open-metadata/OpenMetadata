# Held changes to one field merge part by part, and a held column write answers 202

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Tomas Montiel
- **Guard:** `MutationPlannerTest` (`mergeKeepsTheColumnEditsOfBothChanges`,
  `rebaseReplaysAPendingColumnEditOntoThePublishedColumns`,
  `threeWayLetsTheirsWinWhereBothChangedTheSamePart`,
  `threeWayDropsAnElementOneSideRemovedAndKeepsAnotherSidesAddition`,
  `threeWayFallsBackToTheirsForAListWithoutNames`,
  `mergeAndRebaseKeepAChangeToATagLabelsStateInsideAColumn`,
  `threeWayTakesTheirReferenceWholeWhenBothSidesPickedADifferentOne`); `ChangeRequestImportAndBulkIT`
  (`heldColumnWritesAnswerAcceptedAndKeepEachColumnsEdit`)
- **Related:** #32038 (the approval gate); open-metadata/ai-platform#2019, #1863

## Context

A field whose elements carry no identity, such as `columns`, is held as one `set` op whose value
is the whole field. Every column write is planned against the asset as published, so a requester's
second column write, merged into their pending request, replaced the first write's `set columns`
with a value that never had the first edit: two tags written a second apart left one (reproduced
locally; on devrel it cost a PII tag). Rebasing a pending `set` onto a moved published value kept
the stale whole value too. Separately, `PUT /v1/columns/name/{fqn}` answered 200 for a held write
and dropped the impersonating bot, so no client could tell it had not been published.

## Decision

- `MutationPlanner.merge` replays a later `set` over an earlier one on the same target: the later
  op's edits (its base to its value) are applied onto the earlier op's value, and the merged op
  keeps the earlier base. `rebase` replays a drifted `set` onto the published value the same way.
- The replay (`threeWay`) merges objects key by key and lists element by element when every
  element has an identity or a `name`; a part only one side changed takes that side's value, and
  where both changed the same part differently the later change wins, as before. A value with no
  such structure (a scalar, a list of unnamed elements) is replaced whole, as before.
- The replay matches elements by identity but compares their content in full, so an edit to an
  element's other fields (a tag label's `state` or `labelType`) is a change to that element. Two
  references with different identities are never merged key by key: the later one is taken whole.
- A held column write answers `202 Accepted` with `X-OpenMetadata-Pending-Change` naming the
  request, like a held entity PATCH, keeps the impersonating actor, and records no parent change
  event, since nothing was published.

## Consequences

- Each held write's edit survives merging and rebasing whatever its field's shape, so a column
  edit no longer needs to be resent whole to be safe.
- A conflicting edit to the same part still resolves to the later change silently; surfacing that
  to the reviewer is a separate decision.
- Clients that read a column PUT's status as success now see 202 for a held write; the body is
  the column as submitted.
