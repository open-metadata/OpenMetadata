# Search access policies apply to vector chunk documents through their denormalized access fields

- **Status:** Accepted
- **Revisions:** v1 2026-10-23 (initial)
- **Deciders:** Shreyansh Verma
- **Guard:** `SearchAccessFilterTest`, `OpenSearchRBACConditionEvaluatorTest` (the chunk cases),
  `VectorSearchQueryBuilderTest` (the access filter cases), `VectorSearchAccessTest`,
  `VectorDocBuilderChunkTest` (the access field and column tag cases), `OpenSearchVectorServiceTest`
  (the restamp, outage and invalidation cases), `SearchRepositoryBehaviorTest` (the chunk
  withholding cases), `AIContextFinderTest`, `VectorSearchAccessFilterIT`, and Collate's
  `HybridSearchAccessControlIT`
- **Related:** ADR:2026-10-09-search-admits-memories-of-pinned-anchors;
  ADR:2026-10-15-search-admits-a-subjects-own-pending-memories-on-request

## Context

With `enableAccessControl` on, normal search ANDs the caller's compiled policies
(`RBACConditionEvaluator`) into every query, but vector search rendered only context memory
visibility. A caller denied a table could not find it on `/v1/search/query` and still got it,
description included, from `/v1/search/vector/query` and from Collate's hybrid and NLQ search.

The compiled query cannot simply be ANDed into a vector search, because vector hits are mostly chunk
documents, and those differ from entity documents in the two places a policy looks:

- Resources are scoped by `_index`. Chunks of every entity type share one chunk index, so a deny on
  `table` never matches a table's chunk, and the seeded `DataConsumer` and `Organization` grants on
  resource `all` (which compile to the `all` alias) match no chunk at all. Measured on a live
  cluster: the `all` alias held 943 entity documents and 0 chunks.
- Entity ids are read from `id.keyword`; a chunk carries its entity's id as `parentId`, and had no
  `domains.id`, `service.id` or `reviewers.id`.

Dropping chunks for restricted callers was rejected: chunks are what make multi-chunk entities
rankable (each chunk carries the entity's keyword, filter and semantic evidence), and on clusters
whose entity indices carry no `knn_vector` they are the only semantic results.

## Decision

- `RBACConditionEvaluator.compile(subject, SearchDocumentFields)` compiles the caller's rules for
  one kind of document. `ENTITY_DOCUMENTS` is exactly what `evaluateConditions` has always returned.
  `CHUNK_DOCUMENTS` scopes resources by `entityType`, treats resource `all` in any case as
  unscoped, and reads entity ids from `parentId`. Every other field a policy reads has the same name
  on both kinds. `compile` also reports `grantsEverything`: no deny clause restricts anything (a
  deny that compiles to `match_none`, such as the untranslated `!matchTeam()`, restricts nothing)
  and some allow clause admits every document.
- `SearchAccessFilter.build(subject)` is the one clause for any search whose hits can be either
  kind: `should[ exists(id) AND entity policy, NOT exists(id) AND chunk policy ]`, every branch in
  filter context so it never scores. It is null under the same condition as normal search (access
  control off, no subject, admin); bots are evaluated.
- Chunk documents carry `domains[].id`, `id` on `service` / `database` / `databaseSchema`,
  `reviewers[].id` and `accessStamp`, a hash of the values policies read (owner, domain, reviewer
  and service ids; tag, tier and certification FQNs). `CHUNK_DOC_VERSION` is 9.
- Chunk `tags` and `tier` come from the tag set authorization evaluates
  (`Entity.getEntityTags`, a repository's `getAllTags`: a table's column and data-model tags
  included), split as entity documents split them: the Tier tag in `tier`, never in `tags`. A
  struct-nested column's tags, which the table index adds by its own flattening but `getAllTags`
  does not, are not on chunks; there vector search follows REST.
- A chunk whose stored `accessStamp` differs from its entity's is restamped (no re-embedding), the
  same way memory status and anchor are, also while the embedding provider is unavailable. None of
  these values may enter the embedding fingerprint.
- A propagation that rewrites child entity documents' access fields in place (inherited owners,
  domains, tags, reviewers or certification; inherited domains; glossary tag propagation; a
  certification tag or tag rename; a domain, tag or glossary term delete) first removes
  `accessStamp` from the matched entities' chunks (`VectorIndexService.invalidateChunkAccess`), since
  no lifecycle event reaches those children. The removal runs before the rewrite, so a match on a
  replaced value still finds them. A failure is logged at ERROR; the entity documents update
  regardless.
- A chunk with no `accessStamp` was written before chunks carried access fields and cannot be
  evaluated. A caller whose chunk policy does not grant everything does not see it; everyone else
  does. The gate is the presence of the field, not a version number, so a later
  `CHUNK_DOC_VERSION` bump never hides chunks again.
- Vector services resolve `VectorSearchAccess` (readable anchors and the access clause) once per
  request and pass it to every over-fetch page. `VectorSearchQueryBuilder` renders the clause as the
  second element of the knn filter's `filter` array, after the memory clause, in filter context.
  Its overloads without a `VectorSearchAccess` render no access clause and stay pure; every
  production caller passes one.
- A hybrid caller ANDs the same clause into its lexical, fallback and aggregation legs, and passes it
  to the knn leg through `VectorSearchAccess`. Collate's `HybridSearchService` does so, and also into
  the lookup that hydrates chunk winners with their entity source, as a named clause that marks the
  entity docs the caller may see: a winner whose entity doc exists but is not marked is withheld,
  and one whose entity doc does not exist at all (deleted or re-created under a new id) is kept
  from its chunk fields exactly as without a policy, since its chunk already passed the caller's
  chunk policy.
- Every vector search made for a caller passes the caller's subject, the AI context knowledge search
  (`AIContextFinder`) included.
- Elasticsearch has no chunk index, so there the clause filters entity documents only; the chunk
  branch matches nothing.

## Consequences

- Vector, hybrid and NLQ search return what normal search lets the caller see, and their totals and
  aggregation buckets count only that.
- Admins, and every caller when access control is off, are unaffected. A plain Data Consumer is
  unaffected too: its chunk policy grants everything.
- After upgrading, a restricted caller loses semantic hits that only pre-upgrade chunks provide until
  Search Reindex restamps them (reusing stored embeddings, no embedding cost). Operators with access
  control on should reindex after upgrading.
- A direct owner, domain, reviewer, tag, tier or certification change restamps the entity's chunks
  on its own update. A propagated change withholds the affected chunks from restricted callers
  until each child's next update or a Search Reindex restamps them, so restricted callers can lose
  semantic hits in that subtree for a while; admins and callers whose chunk policy grants everything
  keep them.
- `TeamOnlyPolicy` stays unenforced by search, for chunks as for entity documents, because
  `matchTeam()` has no search translation.
- A new production caller of `VectorSearchQueryBuilder` must pass `VectorSearchAccess`; the pure
  overloads exist for rendering without a request subject.
