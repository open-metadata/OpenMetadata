# Governed organizational ontologies in Ontology Studio

**Status:** Reduced native scope implemented; focused validation completed. Metadata annotations are a separate follow-up.  
**Decision date:** 2026-10-15. **Code baseline:** `d099f6f553b`.

## Goal and scope

Organizations can author an ontology independently of their business glossaries, review a complete
immutable release through the existing approval workflow, activate it or roll back, and connect its
concepts to catalog metadata. SQL stores authoritative definitions and releases. Fuseki holds the
asserted model of each ontology's active release.

Ontology Studio is unreleased. Change its model now without converting existing glossaries. Keep
glossary terms, configurable term relationships and the glossary Relations Graph. Reuse the entity
repositories, JSON persistence, workflow engine, tag assignment, search and RDF outbox mechanisms.

The approved simplification has one approval unit: **the release**. Working concepts, properties and
axioms have ordinary entity history with no individual review lifecycle. Native cross-ontology
imports and native bulk/CSV authoring are deferred. Metadata annotations remain requested scope and
are preserved in a follow-up patch.
The main change contains native entities and publishing; it does not extend `TagLabel`.

| Deliverable | Supported claim | Boundary |
|---|---|---|
| Native authoring and release publishing | Governed, versioned organizational ontologies | Structure and supported OWL 2 DL profile checked; logical consistency is `NOT_RUN` |
| Metadata concept annotations (follow-up) | Link business meaning to catalog entities and nested fields | Metadata association, not warehouse-row identity or executable source mappings |
| Active RDF projection | Query the asserted active ontology in Fuseki | Asynchronous outbox delivery; no claim of complete OWL inference |
| Future Jena CHECK and reasoning | Consistency, classification and explained entailments | Remains in the [Fuseki reasoning plan](2026-10-07-fuseki-native-reasoning.md) |
| Future source mappings | Map properties, keys and relationships to source records | Needs a separate connector/execution design |

## Authoritative SQL storage

JSON Schemas are the contract; regenerate Java, Python and TypeScript models from them. All DDL is
in native `2.1.0`, for both MySQL and PostgreSQL. The migration runner reprocesses only the highest
executed version in a release train, so later 2.1.x directories must not be introduced while 2.1.0 is
unreleased. MySQL guard variables and prepared-statement names must be unique because statement text
is deduplicated across versions.

| Table | Authoritative content | Access pattern |
|---|---|---|
| `ontology_entity` | Root identity, IRI, namespace, description, owners and reviewers | Standard `EntityDAO` JSON, name/FQN hashing, entity history |
| `ontology_concept_entity` | Stable concept UUID/IRI, OWL/SKOS kind and concept mappings | Generated owner/IRI hash columns; unique `(ontologyId, iriHash)` |
| `ontology_property_entity` | Object/data/annotation kind, domains/ranges, inverses, characteristics, chains, typed enumerations and annotations | Same entity persistence and identity checks |
| `ontology_axiom_entity` | Ontology-owned recursive expressions and supported axioms, including named `SUBCLASS_OF` | Standard entity persistence; owner/type indexes |
| `ontology_reference` | Derived incoming-reference index | Replaced in the same transaction as each definition write |
| `ontology_state` | Working revision, release allocation, active release UUID and activation revision | One row per ontology; serialization lock and compare-and-set activation |
| `ontology_release_entity` | Immutable release header and workflow-owned review state | Standard entity/history mechanism; captured `baseReleaseId` |
| `ontology_release_member` | Frozen root, concept, property and axiom payloads with source version, digest and size | Canonical JSON text; `(releaseId, memberKind, memberId)` identity |
| `ontology_release_event` | Capture, decision and activation evidence | Append-only events independent of Flowable history cleanup |
| `tag_usage` (follow-up) | Concept-to-metadata assignments | Existing tag writers; appended `Ontology` source and stable ontology/concept UUIDs |

Concept, property and axiom listings use `(ontologyId, deleted, name, id)` indexes matching the
existing cursor order. The existing `entity_extension` index serves review recovery; no new index
on the version-history table is required.

IRIs remain exact strings across clients. Names/labels do not define semantic identity. Creation
may mint a concept/property IRI once from the namespace and UUID; later name, owner or display edits
do not replace it. Hashes accelerate lookups but never substitute for exact IRI equality.

Named subclass relationships have one source: axiom rows. Concept `superClasses` and `subClasses`
are derived, read-only fields, omitted from storage and semantic digests. Reject named subclass
cycles, subclass edges involving SKOS-only concepts and individual `sameAs` mappings on class kinds.

## Authoring, capture and validation

Working definitions use the existing repository template, optimistic version checks, history and
inheritance of owners/reviewers. Their writes share the ontology state lock with capture. Semantic
writes read only changed definitions, affected dependents, referenced declarations and relevant
subclass ancestors. Documentation and ownership edits do not reload the entire model. Invalid
unrelated draft content must not prevent the edit that repairs it.

The reference index supplies these reads. MySQL locking reads cover both reference and definition
rows, so a writer waiting behind another writer sees the committed edge despite an older transaction
snapshot. Iterative cycle detection identifies all participants, independent of traversal order.

Capture accepts `expectedWorkingRevision`, locks the state and freezes the complete working model.
Authorize every definition before storing the release. Validate structure and the supported OWL 2 DL
profile against the complete frozen model. Runtime validation uses existing validators and a
release-scoped `OwlProfileGuard`; OWLAPI remains test-scoped and checks projected models in tests.
Logical consistency is explicitly `NOT_RUN` until Jena CHECK is available.

Bound members to 1 MiB, releases to 10,000 members and total payloads to 64 MiB. Capture checks a
cooperative 30-second budget between operations. Overflow, authorization or validation failure rolls
back the entire capture. Canonical JSON preserves strings and decimals, rejects NUL, sorts object
keys and hashes UTF-8 bytes with SHA-256. Sealed members cannot be edited or appended to.

## Whole-release approval

1. An editor captures a candidate. Its baseline is the active release at capture time.
2. Submission creates an existing `RequestApproval` task about that release. Require `CreateTask`
   and `EditAll` on the owning ontology. Reject duplicate open reviews before writing a task row.
3. The reviewer sees the submitted header version and a comparison against the captured baseline,
   including before/after payloads and removals. Missing or denied review content blocks approval.
4. Flowable applies the configured assignments, independent-review checks and vote thresholds.
   Task actions submit transition, resolution and comment only. Feed cards open the review screen;
   required rejection comments remain required.
5. A successful workflow decision changes the release state and records durable decision evidence.
   An approved or rejected release cannot be re-reviewed. Capture a new candidate after rejection.
   Cancellation can return an undecided candidate to Draft for a new task.

There is no per-definition approval engine and no direct endpoint that grants approval. Working edits
cannot change a sealed review target. Owners/reviewers and derived fields are excluded from the review
digest; current reviewer eligibility is rechecked at voting time.

The existing recovery marker in `entity_extension` bridges the Flowable/entity transaction boundary.
A typed receipt is recorded with the final engine vote and applied only after successful committed
process history. The reconciler uses fresh reads, bounded scans and consistent lock order. It recovers
start/completion crashes and terminates cancelled workflows. Ontology-specific strict completion
must not change glossary or metric approval contracts. Multi-vote glossary retry wraps the whole
engine command with fresh variables on each attempt.

## Activation, rollback and Fuseki

`PUT /v1/ontologies/{id}/activation` accepts `{releaseId, expectedActivationRevision}` and requires
`EditAll`. Validate the immutable members and RDF projectability before taking write locks.
Under the lock, recheck ontology ownership, release status and expected activation revision, update
the pointer, append an event, then enqueue the existing RDF outbox write as the
last operation in the transaction. Return 409 when the expected revision is stale. Rollback activates
an older approved release through the same operation; it does not rewrite historical content.

The projection worker reads the current pointer and replaces
`https://open-metadata.org/graph/ontology/{id}` through atomic Graph Store PUT. Fuseki holds only the
active release. Replayed or reordered events reread SQL instead of replaying an obsolete payload.
Archive removes the graph; restore and RDF rebuild reproject the active pointer. Rebuild journaling
retains activation writes. Projection is asynchronous, so SQL state and Fuseki can temporarily differ.

Retained releases prevent hard deletion of the owning ontology. Archive working definitions while
retaining release headers, members, events and authorized export. Permanent release expiry/purge
requires a later policy. Release exports and diagnostics work from SQL without a running RDF store.

## Linking concepts to catalog metadata

Reuse `tag_usage` and `TagLabel`; append the `Ontology` source without changing classification or
glossary source ordinals. Store stable ontology/concept UUIDs alongside the existing assignment state,
label type, actor and timestamp. A new assignment must refer to a concept in an approved release.
Resolve displayed meaning from the active release, without falling back to a mutable draft.

When the concept is absent from the active release or its ontology is archived, retain the assignment
as unresolved. Rollback can resolve it again. Reusing a working name cannot rebind its UUID. Cached
assignments refresh active meaning on read. Column datatype changes preserve existing annotations
and provenance, including unresolved links. They do not constitute new assignments.

Use shared, chunked DAO reads for batch binding. Project `ontologyConceptIds` through the shared
search mapping loader and common tag projection, rather than copying a field into every language
mapping. Reverse asset lists use UUID filters and normal search access controls.

Metadata CSV uses one optional `ontologyAnnotations` column and the shared tag codec. An omitted
column preserves annotations; an explicit empty cell clears them. This is metadata interchange,
separate from deferred native ontology-definition bulk/CSV authoring.

## Studio and glossary compatibility

The Studio entry point uses native ontologies. One selected ontology drives graph/tree browsing,
concept/property/axiom authoring and release publishing. Reuse the existing graph and tree renderers
and controls. The metadata-label follow-up adds published-concept links and the asset view.
The query console starts with the selected ontology's active named graph.

The focused native scope defers the glossary-based AI assistant, library, templates, import/subset/
merge tools and native graph mutation shortcuts. Their native semantics and workflow integration
need a later slice. Preserve business-glossary configurable relationships and its Relations Graph;
do not treat a glossary as a native ontology or display its terms as native concepts.

Browser coverage follows those boundaries: native authoring, hierarchy, review and publication replace
the former global glossary-Studio flows. Glossary graph, cardinality and cross-glossary checks run at
Relations Graph. Existing glossary RDF/API checks remain; browser checks for deferred global Studio
features are removed with those entry points.

## Review and delivery boundaries

| Review unit | Includes | Depends on |
|---|---|---|
| Shared fixes | Approval retry/transition correctness, SDK patch/error handling and entity lifecycle events | Existing platform |
| Native entities | Schemas, DAOs, native 2.1.0 DDL, reference index, working authoring and Studio data selection | Shared entity framework |
| Publishing | Immutable captures, release-only workflow, comparison, activation/rollback and active RDF projection | Native entities |
| Metadata annotations | `tag_usage` identity, catalog/field UI, shared search projection and CSV | Native entities and approved releases |

Generated clients accompany the schema that changes them. A new shared `TagLabel` source necessarily
regenerates consumers; that does not require manually editing every search mapping or CSV header.
Keep unrelated test-environment/POM fixes outside these review units.

## Acceptance and validation record

Required scenarios:

- Create an ontology with concepts/properties/axioms; verify SQL ownership and standard history.
- Reject opposite subclass writes concurrently on MySQL and PostgreSQL, including older snapshots.
- Permit unrelated documentation edits and repair of an invalid draft; fail capture until repaired.
- Capture, independently approve, activate, change the draft, capture again, compare, reject or
  approve, and roll back. Refuse duplicate reviews and re-review of decided releases.
- Exercise multi-vote workflow, rejection comments, cancellation, process errors and crash recovery;
  verify glossary and metric workflows retain their behavior.
- Read/export frozen content after working deletion; deny unreadable members; retain ontology owners.
- Replace only the active graph; validate retry, archive/restore and rebuild behavior.
- Follow-up only: apply labels to assets/nested fields; preserve identity, assignment state and provenance through
  activation changes, cache hits, datatype changes, CSV and name reuse. Reject unapproved new links.
- Use one ontology selection across native Studio graph/tree, authors and publication. Exercise
  browser review/capture/activation and keep the glossary Relations Graph covered.

Focused local validation completed on 2026-10-15:

| Check | Result |
|---|---|
| MySQL API tests, including glossary and metric regressions | 1,053 passed; 127 skipped by the test framework |
| PostgreSQL ontology API tests with real Fuseki | 240 passed; 36 skipped; both active-graph lifecycle tests passed |
| Ontology/service unit tests | 551 passed, including both-dialect DAO/concurrency checks; shared lifecycle subset also passed |
| SDK / MCP | 29 SDK and 12 MCP tests passed |
| Existing multi-vote workflow integration test | Passed; task stays open until the configured threshold |
| UI / generated Python models | 298 UI tests passed; 14 tests passed after browser fixes; 21 Python IRI tests passed |
| Browser | All 66 targeted native and glossary graph scenarios passed across focused runs |
| Formatting / generation | Spotless, changed-file UI formatting, Playwright lint, locale sync, app docs and licence checks passed |

Browser failures exposed obsolete selectors for the removed global Studio statistics bar and the
required axiom input; these were corrected against actual DOM and graph state. Native screenshots
were inspected, and publication/action labels and review-list spacing were corrected.

Full UI type checks remain red on the baseline: HEAD has 580 errors versus 569 in this change,
with no added file/error-code occurrences. Playwright types retain 116 baseline errors. The token
audit reports 76 errors in untouched styles. Java builds used a command-line JUnit 5.11.4 override;
the SDK POM and search-container environment changes remain outside this scope. Coverage percentage,
the entire repository suite and integration with the newer main branch were not verified. Metadata
annotations require their own validation when the follow-up is applied. No logical-consistency or
production-readiness claim follows from these focused checks.

Development databases created with the earlier unreleased per-definition/import release manifests
must be reset for this contract. Native 2.1.0 explicitly resets glossary-owned development axioms,
their relationship/history rows, and development change sets containing axiom operations before
adding the non-null ontology owner; it does not convert or delete business glossaries.

Storage and recovery details: ADR:2026-10-14-ontology-definitions-have-independent-entity-storage,
ADR:2026-10-14-ontology-releases-seal-canonical-sql-members,
ADR:2026-10-14-ontology-reviews-bind-workflow-tasks-to-revisions.
