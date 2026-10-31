# Article custom properties are defined on the page type and shown on Articles only

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial)
- **Deciders:** karanh37
- **Guard:** `KnowledgeCenterIT.testArticleCustomPropertyIsStoredOnCreateAndPatch`, `ArticleCustomProperties.spec.ts`
- **Related:** #35754

## Context
Context Center Articles and Quick Links are one entity, `page`, told apart by `pageType`. Custom
properties are defined per entity type, so a property cannot target Articles without also being
valid on Quick Links. Splitting Article into its own entity type would move storage, search
indexing, permissions and every Knowledge Center API.

## Decision
`page.json` and `createPage.json` carry the standard `extension` field, and custom properties for
Articles are defined on the `page` type (Settings → Custom Properties → Articles maps to `page`).
The UI shows the Custom Properties tab only on the Article detail page; Quick Links have no
surface for them. The tab renders full width: no page tree, no right properties panel.

## Consequences
Articles reuse the generic extension handling (storage, PUT/PATCH, versioning, validation, search
mapping) with no Knowledge Center specific code. The API still accepts extension values on Quick
Links. Revisit if Quick Links need their own property set, which would require a separate entity
type rather than a per-`pageType` filter.
