# References to styled entities carry their colour and icon

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Shrabanti Paul
- **Guard:** `ReferenceStylesTest`; `JsonUtilsTest.applyPatchSkipsReferenceStylesButNotTheEntityStyle`; `DomainResourceIT.test_domainReferencesCarryTheDomainStyle`, `test_dataProductReferencesCarryTheDataProductStyle`
- **Related:** #36511, PR #36464, PR #13233

## Context
Assets hold their domains and data products as `EntityReference`s, which had no `style`, so every
domain chip drew the default colour and globe. A first version filled the style in seven read and
write paths, parsed the full domain for each reference, and covered domains only. A frontend lookup
by id worked, but it cost a request per page, showed the default chip until the lookup returned,
let a restyle go stale for minutes, and every chip had to remember to use it.

## Decision
- `EntityReference` has an optional `style`. It is set only on references to styled entity types,
  domains and data products (`ReferenceStyles`), and holds only `color` and `iconURL`, never the
  cover image.
- The style is filled where references leave the server, in two places: `EntityResource.addHref`
  for every API response (children, domains, data products), and `SearchIndex` for every search
  document's domains and data products. Stored JSON, the relationship cache and the write paths
  never carry it.
- The lookup is cached by the entity's JSON string in `CACHE_WITH_ID`, compared by identity, with
  at most 1000 entries. Any update, cross-instance eviction or TTL expiry replaces that string, so
  a style is never staler than the entity cache and needs no invalidation of its own.
- Clients diff patches against responses that carry the style, so `JsonUtils.applyPatch` skips
  operations on `/domains|dataProducts|children/<n>/style`, as it skips `href`. The entity's own
  `/style` stays patchable.
- A restyle opens the search propagation pass for domains and data products, and
  `SearchRepository.relabelReferenceCopies` writes the new style into the copies.
- Ships on `main` only, not backported. The Python client requires a matching major.minor server
  (`server_mixin.validate_versions`), so no older client receives the field.

## Consequences
Clients draw a domain or data-product chip from the reference itself, with no extra request and no
stale cache. A response built outside `addHref`, or a search document built outside `SearchIndex`,
carries no style; its chips fall back to the default rather than failing. Search documents indexed
before this change pick up the style on reindex or the next restyle. Another styled entity type
joins by adding it to `ReferenceStyles` and opening its propagation pass.
