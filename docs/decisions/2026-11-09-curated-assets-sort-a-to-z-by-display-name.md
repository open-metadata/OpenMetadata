# The Curated Assets and Following widgets sort A to Z by the visible title

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial)
- **Deciders:** shrabantipaul-collate
- **Guard:** `Widgets.constant.test.ts` (the A to Z / Z to A sort field, and every
  `CURATED_ASSETS_LIST` index mapping `displayName.keyword` with `lowercase_normalizer` in every
  language; it runs on any UI change and in the nightly UI run, not on a mapping-only PR),
  `CuratedAssetsWidget.test.tsx` ("sorts A to Z by the visible title"),
  `BuildSearchIndexDocTest.testEntityInterface_getsCommonFields` (`displayName` falls back to
  `name`)
- **Related:** open-metadata/openmetadata-collate#2578, #37396

## Context
The A to Z and Z to A options of the Curated Assets widget sorted on `name.keyword`, but the
widget shows `displayName`. An asset named `dim_customer` with the title "01 Customer" sorted
under "d", and numbered titles drifted out of order. The Following widget shares the same sort
field through `getSortField`.

## Decision
- `getSortField` (`constants/Widgets.constant.ts`) maps A to Z and Z to A to
  `displayName.keyword`, ascending and descending.
- Every index the Curated Assets widget can query (the entity types in `CURATED_ASSETS_LIST`)
  maps `displayName.keyword` with `lowercase_normalizer`, in every language, so the order is
  case-insensitive. A new curated entity type must do the same.
- Search documents fill `displayName` from `name` when it is unset
  (`SearchIndex.populateCommonFields`), so an untitled asset sorts by its name instead of
  dropping to the end.
- The order compares characters, not numbers: "01, 02, 10" orders correctly, "2. X" sorts after
  "10. X". Titles that should order numerically must be zero-padded.

## Consequences
The order users pick matches the titles they see. The Following widget searches the `all` index,
which also holds services and test cases; their `displayName.keyword` has no normalizer, so when
a user follows more than one page (25) of assets, capitalised service titles take earlier places
on the A to Z page. The page itself is re-sorted by title in the browser. Normalizing those
mappings needs a reindex. Numeric ordering would need ICU collation (`icu_collation_keyword`
with `numeric: true`), which the default search stack does not ship; adopting it would revisit
this record.
