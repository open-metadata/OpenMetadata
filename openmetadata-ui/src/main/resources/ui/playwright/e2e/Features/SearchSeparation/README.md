# SearchSeparation suite

End-to-end coverage for the doc-shape contract between live indexing and
SearchIndexApp reindex. Every spec runs the same two passes against a fresh
entity instance:

1. **Live indexing**: PATCH the entity to add Tier, Certification, a
   classification tag, and a glossary term. Open Explore and filter by each
   dedicated field (`tier.tagFQN`, `certification.tagLabel.tagFQN`,
   `tags.tagFQN`). The entity must appear under every filter.
2. **Recreate reindex**: POST `/api/v1/search/reindexEntities?recreate=true`
   for the entity, poll the search doc until the separation is preserved
   (Tier on `tier.tagFQN`, Cert on `certification.tagLabel.tagFQN`, no Tier
   leakage into `tags[]`), then re-run all four Explore filters.

If live and reindex paths diverge for any of the four facets, the second
pass fails and the offending facet is named in the assertion message.

## Adding a new entity

```ts
import { test } from '@playwright/test';
import { MyEntityClass } from '../../../support/entity/MyEntityClass';
import { registerFilterSeparationSuite } from './searchSeparationSuite';

test.use({ storageState: 'playwright/.auth/admin.json' });

registerFilterSeparationSuite({
  suiteName: 'MyEntity',
  reindexEntityType: 'myEntity', // matches ENTITY_PATH value
  entityFactory: () => new MyEntityClass(),
});
```

The entity class must expose `create(apiContext)`, `delete(apiContext)`,
and `patch({ apiContext, patchData })`. If a new entity class still uses
the legacy positional `patch(apiContext, payload)` signature, normalize it
to the object-based one (as was done for `DatabaseClass` /
`DatabaseSchemaClass`) before slotting it in.

## Current matrix

| Entity | Spec |
|---|---|
| Table | `ExploreFilterSeparation.spec.ts` |
| Dashboard | `Dashboard.spec.ts` |
| Topic | `Topic.spec.ts` |
| Pipeline | `Pipeline.spec.ts` |
| MlModel | `MlModel.spec.ts` |
| Container | `Container.spec.ts` |
| ApiEndpoint | `ApiEndpoint.spec.ts` |
| StoredProcedure | `StoredProcedure.spec.ts` |
| Metric | `Metric.spec.ts` |
| Database | `Database.spec.ts` |
| DatabaseSchema | `DatabaseSchema.spec.ts` |

## Painless-mutation cascade

`GlossaryRenameCascade.spec.ts` covers the live-update path that uses a
painless script rather than a full-doc rebuild: renaming a glossary term
fires `UPDATE_GLOSSARY_TERM_TAG_FQN_BY_PREFIX_SCRIPT` against every doc
tagged with the term. The script mutates `tags[]` in place and, because
`TAG_RESEPARATION_SCRIPT` is appended, also re-derives `tier`,
`classificationTags`, `glossaryTags` from the updated `tags[]`. If the
reseparation snippet is dropped from any tag-mutating script, this spec
fails — `glossaryTags[]` will keep the old FQN while `tags[]` has the new
one.

## Not yet covered

- Service-level entities (`DatabaseService`, `DashboardService`, etc.) —
  no entity-level Tier/Cert/Tag/Glossary surface separate from their
  children; their docs are covered transitively when the child specs run.
  Add an explicit spec here if a service-only filter regression surfaces.
- Time-series entities (`testCaseResolutionStatus`, `testCaseResult`) — do
  not implement `TaggableIndex` and have no Tier/Cert/Tag/Glossary surface,
  so the separation contract doesn't apply.
