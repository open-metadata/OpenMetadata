# Items created under a domain pick get that domain, and search-backed insights follow the pick

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Sonika Shah
- **Guard:** `DriveFileUploadIT.testUploadIntoDomain`, `UserResourceIT.test_pickNarrowsDataInsightCharts`,
  `UploadDocumentModal.test.tsx` ('uploads under the picked domain')
- **Related:** #36483, ADR:2026-10-29-mostly-global-lists-keep-unassigned-items-under-a-domain-pick

## Context
Under the strict rule a list under a pick hides items with no domain. A data product, metric or
uploaded document created while a domain was picked got no domain, so it vanished from the list it
was created in. Data Insights charts read search documents directly and ignored the pick, so the
charts disagreed with every list on the same screen.

## Decision
- An entity created while a navbar domain is picked is assigned that domain by the client: the
  data product and metric create forms prefill it, and document upload sends it as the multipart
  `domain` field of `POST /v1/contextCenter/drive/files/upload`. The user can still change it in a
  form before saving.
- Search-backed Data Insights system charts (`/analytics/dataInsights/system/charts` list and
  preview) add the pick as a query filter on `domains.fullyQualifiedName` (the domain and its
  sub-domains, `EntityUtil.navbarDomainSearchFilter`). Items with no domain are not kept, as with
  every strict-rule list. Bots and callers with no pick are unchanged.

## Consequences
A create flow added later that should land in the picked domain has to set it the same way, or its
items hide under the pick. Charts on a service's Insights tab follow the pick too. Revisit if
creation should ever default to no domain, or if charts need an explicit "all domains" override.
