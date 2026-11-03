# Search applies the same access rules as entity reads

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `SearchAccessRulesIT`, `McpSearchEmailIT`, `PrivateFieldReferencesTest`,
  `PrivateSearchFieldsTest`, `ElasticSearchPrivateFieldsTest`, `OpenSearchPrivateFieldsTest`,
  `ElasticSearchRBACConditionEvaluatorTest.aTagConditionMatchesADocumentsOwnLabelsOrItsPolicyTags`,
  `BuildSearchIndexDocTest.aRunDocumentCarriesItsPipelinesAccessFields`,
  `SearchRepositoryBehaviorTest` (`bulkIndexPipelineExecutionsBuildsExecutionDocuments`,
  `tableTagOnlyChangeRebuildsColumnDocsUnderSearchAccessControl`),
  `PIIMaskerTest.aUserChangeEventIsMaskedAsAReadOfTheUserIs`,
  `AuditLogRepositoryTest.anEventAboutAUserListsItsEmailMaskedForCallersWhoDoNotReadEmails`
- **Related:** open-metadata/openmetadata-collate#8018;
  ADR:2026-10-08-column-entries-carry-only-their-own-tags

## Context
With "Enable Roles & Policies in Search" on, search compiles the caller's policies into the query,
but a condition can only test fields of the document it filters, and a rule on a resource covers
only the indexes mapped to it. Pipeline run documents carried none of their pipeline's owners,
domains, tags, tier or certification, and their index was not covered by rules on `pipeline`.
Column documents carry only their own tags, so a tag rule that denies a table through one column
did not reach the others. Data Insights charts aggregated search documents under no policy, and
any caller naming the same chart joined another user's streaming session. Vector search returned
every hit. User emails, masked on other reads for callers other than admins and bots, came back
from search and could be searched on, and the audit-log and alert event listings carried them.

## Decision
- A pipeline run document carries its pipeline's owners, domains, tags (its tasks' included),
  tier, certification and service, and the run index is a child of `pipeline` for search access
  control. A change to one of those fields on the pipeline re-stamps its runs, and reindexing
  pipelines re-stamps the runs of each batch, which also fills in runs written before. A
  table-observability document in the same index carries the pipeline's fields; one whose pipeline
  does not resolve is not written.
- Table and column documents carry `policyTags`, every tag the table's own endpoints decide on.
  `matchAnyTag` and `matchAllTags` match a document's own labels or its `policyTags`.
- Live Data Insights charts aggregate under the caller's search access policies. Charts and
  previews read from snapshots, which those policies do not cover, so a restricted caller's own
  filter is dropped there. A streaming session is joined only by the user who started it, with the
  same filter.
- Vector search keeps only the hits the caller may view.
- For callers other than admins and bots, a search that can reach user documents (the user index
  by name or alias, or a wildcard matching it) returns `email` in no hit, top hit or sort value and
  matches on it nowhere: free text searches the user index without its email fields, and a query,
  filter, sort, field query or aggregation that names an email field (`email`, a sub-field, or a
  field pattern matching one), searches every field, or carries a filter that is not plain JSON is
  refused with 400 on every search endpoint. An NLQ translation that names one runs as keyword
  search instead. Values are not references: a filter on a column called `email` or on the tag
  `PII.Email`, or an address typed as free text, is an ordinary search. The audit-log and alert
  event listings mask user emails, the audit-log summary included.

## Consequences
- Documents written before this change get the new fields from a reindex; until then they are
  filtered on what they carry.
- While access control is off, a table's tag change reaches its column entries' `policyTags` at
  their next rebuild (a column change or a reindex), so turning access control on calls for a
  reindex.
- A change that reaches a pipeline without updating it (a domain or owner inherited from its
  service, the bulk and domain-move paths) reaches its runs at the pipeline's next update or the
  next reindex.
- A reference to an email field is refused rather than dropped, so a client that ORs an email
  clause into a user search gets a 400 for such a caller. The Settings → Bots search does, so a
  non-admin allowed to view bots gets an error there until it sends that clause for admins only.
- A new index that copies part of an entity copies the fields that entity's rules read and is
  registered as its child for search access control.
