# The certification picker searches the tag index a page at a time

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** anuj-kumary
- **Guard:** `Certification.test.tsx` (first page on open, next page on scroll, none past the total, server-side search); `CertificationDropdown.spec.ts` and `SystemCertificationTags.spec.ts` (disabled tags and a disabled classification stay hidden)
- **Related:** #35222, ADR:2026-10-10-data-product-picker-pages-50-and-loads-near-the-end

## Context
The certification picker loaded every page of `/tags?parent=Certification` before it showed a row,
then searched that list locally. `/tags` has no search parameter, so loading only part of the list
would have hidden every certification on a page that had not loaded yet.

## Decision
- The `Certification` picker reads from the tag search index (`searchQuery`, `SearchIndex.TAG`),
  filtered by `classification.name.keyword` = `Certification` and `disabled` = `false`, sorted by
  `name.keyword` ascending so pages never overlap or skip.
- It requests `PAGE_SIZE_LARGE` (50) per page: the first on open, the next through `FilterSelect`'s
  `onLoadMore`. Typing replaces the list with the server's matches for the search.
- Gold, Silver and Bronze are moved to the top of the loaded rows. The rest keep the server's order.

## Consequences
Opening the picker costs one request however many certifications exist, and search reaches all of
them. The list now reflects the search index, so a certification is offered only once it is
indexed, and one created moments ago may be missing until then. Revisit if certifications need to
be offered before indexing completes, which would need a search parameter on `/tags`.

A certification past the first page is reached by searching, so Playwright helpers that pick one
by name (`searchCertification` in `playwright/utils/entity.ts`) search for it first. Gold, Silver
and Bronze lead only when they are among the loaded rows: in a catalog with more than 50
certifications, a later page can hold one of them.
