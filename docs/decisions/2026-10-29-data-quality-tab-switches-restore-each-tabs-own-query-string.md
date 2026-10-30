# Data Quality tab switches restore each tab's own query string

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** TeddyCr
- **Guard:** `openmetadata-ui/.../pages/DataQuality/DataQualityPage.test.tsx` and `openmetadata-ui/.../components/observability/DataQuality/DataQualityPage.test.tsx` — `should restore each tab query string when switching between tabs`, `should restore a tab latest URL even when the user left it via history back`, `should not capture another route search while app mode keeps the page mounted`
- **Related:** #36481, #36595

## Context
The Data Quality tab panels unmount on switch, and the URL query string is the only home for their
filters. Tab switches navigated to the bare tab path, so returning to Test Cases dropped its filters
(Last Run, status, …) while the provider refetched `dataQualityReport/batch` without them: the
Healthy Data Asset counts stopped matching the filtered listing.

## Decision
On both Data Quality pages (classic `pages/DataQuality/DataQualityPage.tsx` and observability
`components/observability/DataQuality/DataQualityPage.tsx`):

- A tab switch navigates to the target tab's path with **that tab's own last query string**, or an
  empty one if the tab was never visited. Filters never carry across tabs — Test Suites never
  receives test-case-only params.
- The per-tab search is recorded from the URL by an effect (so history back/forward and deep links
  keep it current), not captured in the tab handler.
- On the observability page, which app mode keeps mounted after another route takes the URL, a
  search is recorded only while the page owns the URL.
- The URL stays the single source of filter state; the provider and the batch API are unchanged.

## Consequences
Returning to a tab reproduces what the user left, and the summary requests carry the same filters as
the listing. The memory is per page instance and bounded by the fixed tab enum; it is lost on a full
reload, where the URL itself is the state. A `:subTab` path segment is not restored, only the query
string. Going back to bare path navigation, or sharing one search across tabs, reintroduces the
count mismatch.
