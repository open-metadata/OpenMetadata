# The Explore top-hit hint is the identity probe, and internal searches skip unread highlights

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** sonika-shah
- **Guard:** `SearchEntityTypeCountsTest#retainsTheGlobalHintWithoutUsingItsCountOrLeakingProbeFields`
  (the hint costs exactly one identifier-precision pass and returns only `entityType`);
  `SearchRankingHelperTest#projectedFirstPageUsesAnIndependentIdentityProbe` (the separate probe
  skips highlights, the results page keeps them)
- **Related:** #36484, #31502, #34255, #32316

## Context
Explore with no tab waits for `entityTypeCounts?include_top_hit=true` before it requests results.
The hint asked for `size=1` with only `entityType`, so `searchWithIdentifierPrecision` could not
reuse it as its top-10 probe and ran two ranked searches over the `dataAsset` alias back to back.
Both built highlights that nothing reads. On a ~200k-document column index, highlighting was
75–85% of the probe's cost (57–364 ms with, ~9 ms without).

## Decision
- The `entityTypeCounts` hint is requested at `SearchRankingHelper.identityProbeSize()`, from
  offset 0, with the default `_score` sort, projecting `entityType` plus `identityFields()`, so
  identifier precision reuses it as its probe and it costs one search (plus the precise re-run on
  an exact-identifier lookup, as before).
- Only the first hit is returned, and its `_source` holds `entityType` alone.
- `SearchRequest.includeHighlights` defaults to `true`. Only internal callers that never read
  highlights set it to `false`: the hint and the separate identity-probe window.

## Consequences
Changing the hint's size, offset, sort or projection silently brings the second search back; the
guard test fails instead. A caller that sets `includeHighlights: false` gets no `highlight` in its
hits. Counts, the selected top hit (same query and deterministic sort), and result-page highlights
are unchanged.
