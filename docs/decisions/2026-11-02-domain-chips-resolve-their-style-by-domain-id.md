# Domain chips resolve their style by domain id

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Shrabanti Paul
- **Guard:** `DomainStyleReaderTest`; `DomainResourceIT.test_listStylesReturnsStyledDomainsAndDataProducts`; `DomainTags.test.tsx`; `DataProductsContainer.component.test.tsx`; `DataProductsSection.test.tsx`; `CoverImageUploadUtils.test.tsx`
- **Related:** #36511, PR #36464, PR #13233

## Context
Assets hold their domains and data products as `EntityReference`s, which have no `style`, so every
domain chip drew the default colour and globe. Copying the style onto `EntityReference`, in
responses and search documents, was built and rejected. `EntityReference` is the shared pointer
type for owners, followers, services, parents and reviewers, and stays identity-only (id, type,
name, FQN). Copying the colour would also need keeping it in sync across asset search documents,
`change_event` rows, and a PATCH rule. The colour is stored once, on the domain or data product
itself.

## Decision
- The server serves the styles from their one source. `GET /v1/domains/styles` (`DomainStyles`)
  returns the colour and icon of every domain and data product that has a style, never the cover
  image. Entities without a colour or an icon are omitted, so the list stays small. Callers need
  `VIEW_BASIC` on domains. The check is type-level, so a caller who passes it sees the colour and
  icon of every styled domain and data product, including ones a domain-only role hides; these
  carry no names, so this is accepted.
- `DomainStyleReader` reads only the styled rows (`listStyles` on the domain and data product
  DAOs) on each request, with no server-side cache to invalidate.
- The UI loads the list once into the React Query entry `['domain-styles']`. It is fresh for 5
  minutes, and refetched when the window regains focus only once it is older than that, since
  colours rarely change. Every chip reads it by the id its reference holds (`useDomainStyles`):
  domain chips (`DomainTags`, `DomainSelect`) and data product chips (`DataProductsContainer`,
  `DataProductsSection`, drawn with the core `DataProductTag`).
- Every UI write of a domain or data product invalidates that entry (`invalidateDomainStyles`):
  updates in `DomainDetailPage`, `DomainTreeView` and `DataProductsPage`, and creation through
  `createEntityWithCoverImage`.

## Consequences
`EntityReference`, search documents and change events carry no style, and a restyle is one row
update. A chip draws the default until the list first loads in a session. A restyle made in
another tab shows here within 5 minutes, on the next focus or page load after the entry goes stale. A new UI path that writes a
domain's or data product's style must call `invalidateDomainStyles`. A component that renders
`DomainTags`, `DomainSelect`, `DataProductsContainer` or `DataProductsSection` needs a
`QueryClientProvider` in tests, or a stubbed
`useDomainStyles`. If references ever need to carry display data in general, that is a separate
decision with the schema owners covering all styled entities, likely through a dedicated label
type like `TagLabel`.
