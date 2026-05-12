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
import { registerFilterSeparationSuite } from '../../../utils/searchSeparation';

test.use({ storageState: 'playwright/.auth/admin.json' });

registerFilterSeparationSuite({
  suiteName: 'MyEntity',
  reindexEntityType: 'myEntity', // matches ENTITY_PATH value
  entityFactory: () => new MyEntityClass(),
});
```

The entity class must expose `create(apiContext)`, `delete(apiContext)`,
and `patch({ apiContext, patchData })`. Classes with a positional `patch`
signature (`DatabaseClass`, `DatabaseSchemaClass` today) aren't covered yet
— normalize their signature or add an adapter before slotting them in.

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

## Not yet covered

- `Database`, `DatabaseSchema` — entity classes use a positional `patch`
  signature; needs adapter or class normalization.
- Service-level entities (`DatabaseService`, etc.) — covered by entity-level
  specs through cascade; if a service-specific filter regression surfaces,
  add an explicit spec here.
- Time-series entities (`testCaseResolutionStatus`, `testCaseResult`) — do
  not implement `TaggableIndex` and have no Tier/Cert/Tag/Glossary surface,
  so the separation contract doesn't apply.
