# Ontology definitions use independent entity storage

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial) · v2 2026-10-14 (semantic identity) · v3 2026-10-14 (native IRI creation) · v4 2026-10-14 (client IRI fidelity) · v5 2026-10-15 (native axiom ownership) · v6 2026-10-15 (derived reference index) · v7 2026-10-15 (unreleased 2.1.0 migrations and scoped axiom reset) · v8 2026-10-15 (metadata usage search by concept UUID) · v9 2026-10-15 (shared search and CSV definitions) · v10 2026-10-15 (release-only review and affected-definition validation) · v11 2026-10-15 (metadata annotations moved to a follow-up)
- **Deciders:** Harsha
- **Guard:** `OntologyEntityDAOTest`, `OntologyDefinitionTest`, `CollectionDAOCompositionTest`, `IndependentOntologyAxiomIT`, `OntologyReferencesTest`, `OntologyReferenceDAOTest`, `OntologyReleaseCaptureTest`, `IndependentOntologyReferenceIT`
- **Related:** [Organizational ontology design](../plans/2026-10-14-organizational-ontology-design.md)

## Context

Ontology Studio currently stores its formal model in glossaries and glossary terms. Organizations
need independently governed ontology definitions, while business glossaries must retain their
configurable relationships, tagging and Relations Graph. Ontology Studio is unreleased, so existing
glossaries need no conversion into ontology entities.

## Decision

Store `Ontology`, `OntologyConcept` and `OntologyProperty` in dedicated entity tables. Use the
existing `EntityDAO` JSON persistence, FQN hashing, generated database columns and native migration
mechanisms on both MySQL and PostgreSQL. Schema-first models carry explicit semantic IRIs and
ontology membership. Concepts and properties have separate identity and kind fields; neither is a
glossary term or a glossary relationship type.

Keep the existing `OntologyDAO` glossary graph queries and `RelationshipType` registry. Name the
new ontology entity accessor `ontologyEntityDAO` so adding independent storage does not retarget
glossary graph callers. Append all ontology DDL to the unreleased native `2.1.0` migration on
both databases. The runner reprocesses the highest executed version in each release train; adding
a later 2.1.x migration would prevent subsequent 2.1.0 additions from running on upgraded databases.
Use unique MySQL guard variables and statement names because the runner deduplicates statement
text across versions. Do not convert glossary records.

## Consequences

The storage foundation can be tested without a glossary or RDF store. Repository lifecycle,
approval enforcement, ontology API and Studio integration, release storage and metadata annotations
remain separate implementation steps from this storage change. Working definitions use ordinary
entity history. Only immutable releases carry an approval status; working edits never grant
publication approval. Metadata annotations, search projection and CSV support below are preserved
in a follow-up patch; the native entity/publishing change does not extend `TagLabel`.

The Studio UI and glossary Relations Graph remain supported. Reusing graph rendering does not
justify sharing their domain-specific persistence or mutation handlers.

## Amendment: semantic identity

Concept and property tables each enforce uniqueness of the exact semantic IRI within their owning
ontology, including soft-deleted definitions. Different ontology modules may reuse an IRI. Ontology
IRIs have a lookup index without deployment-wide uniqueness. An IRI is compared as its original
string, including case and Unicode; Java URI equality must not normalize scheme or host case for
this check. Changing a definition's IRI requires a new definition.

Use generated `iriHash` columns and `(ontologyId, iriHash)` unique indexes on both databases,
following the existing hashed identity lookup pattern. These are MD5 lookup keys, not integrity
proofs; reviewed content and workflow evidence continue to use SHA-256. A future IRI lookup must
compare the complete stored IRI after finding its hash. A hash collision must reject an insertion,
never resolve a different definition as the requested one.

## Amendment: native IRI creation

Concept and property creation may omit the IRI. Mint it once from the owning ontology's namespace
and the new entity UUID, using the existing IRI minter's namespace separator rules. Names and
labels do not participate. Imported definitions retain their explicitly supplied IRIs. PUT with
an omitted IRI preserves the existing definition's identity, including when restoring a deleted
definition. PATCH cannot remove it. Persisted entities still require an absolute IRI.

## Amendment: client IRI fidelity

Use the shared `ontologyIri` schema with JSON Schema `format: iri`. The generated Python model
must retain the original string; URL models normalize host/scheme casing, Unicode and escaping.
Java keeps `URI` for parsing and absolute-IRI validation, but set-valued semantic references use
lists and explicit string-based duplicate checks: Java URI equality can merge distinct semantic
identifiers. Ordered property chains permit repetition. Namespace uniqueness also compares the
exact string, without URI normalization. `test_ontology_iris.py`, `OntologyDefinitionTest` and the
ontology property/resource integration tests guard client-to-database round trips.

## Amendment: axiom ownership

`OntologyAxiom` belongs to an independent ontology and implements `OntologyDefinition`, as do
concepts and properties. Definitions have no individual review lifecycle. The shared ontology lock
coordinates axiom writes with release capture. Captured axiom members retain their payload after a working
edit or deletion and enforce axiom read permissions.

Native migration 2.1.0 replaces the unreleased axiom table's generated glossary owner column and
index with `ontologyId`. Before adding the non-null generated owner column, delete only
unreleased axiom rows without an ontology owner, their relationship/history rows and development
change sets containing axiom operations. This is an explicit reset of development Studio axioms;
export any wanted draft axioms before upgrading and recreate them under an ontology.
Existing native axiom rows survive replay. Glossaries, terms and configurable relations are not
modified or converted. Axiom listings filter by that ID. Concept, property and axiom listings use
`(ontologyId, deleted, name, id)` indexes to match the standard entity cursor order. Local property checks use only the owning ontology, with exact IRI
comparison after hashed property lookup. The glossary relationship-type registry does not define
ontology properties, and glossary export no longer reads independent axiom rows. Native imports
are deferred and nonempty import requests are rejected.

Nested expression and literal IRIs use the shared exact-IRI schema. Enumeration members retain
string-distinct identifiers in generated clients and reject exact duplicates in the authoring
guard.

The authoring guard permits an IRI to name both a class and an individual, as specified by
[OWL 2 entity declarations](https://www.w3.org/TR/owl-primer/#Entity_Declarations). The previous
class/individual exclusion applied an OWL 1 restriction to an OWL 2 editor. Assertions and
restrictions must instead respect each declared property's object/data/annotation kind. The
profile tests, native axiom API tests and an OWL API round trip guard these rules.

## Amendment: derived references

Native migration 2.1.0 adds `ontology_reference` on both databases. Definition JSON remains the
source of truth. Replace a definition's reference rows in the same retained transaction and under
the same ontology lock as its write. The shared write boundary covers ordinary edits, deletion
and restoration. Native bulk/CSV authoring is deferred. A failed write rolls back both representations.
Released payloads do not depend on this working index.

Index property domains, ranges, inverses, chains and disjointness; concept mapping targets and
schemes; and every IRI in an axiom, including nested expressions and literal datatypes. Deduplicate
only matching role and exact IRI spelling, retaining multiple roles for the same target. Iterative
expression traversal and reference collection have a combined 10,000-step limit per definition;
overflow fails the write instead of storing an incomplete index.

Use `(sourceType, sourceId, role, iriHash)` as the primary key and index
`(ontologyId, iriHash, sourceType, sourceId, role)` for reverse lookup. SHA-256 hashes the exact IRI
bytes for this index; a hash match still requires full, case-sensitive IRI equality. No IRI lookup
resolves a definition from an unrelated module. The working-reference API pages by source type,
source UUID and role and requires read authorization on each returned source definition. This is
local reference impact, not transitive import resolution or proof of logical consistency.

## Follow-up: metadata usage search

Keep `tag_usage` authoritative for metadata annotations. Project the distinct UUIDs from native
ontology labels into the keyword field `ontologyConceptIds` in asset search documents. Include
annotated child fields in their parent asset's document and retain separate column documents when
column indexing is enabled. Never derive this field from another label source, even when it carries
the same FQN or metadata keys. Reindexing and live tag-update scripts produce the same projection.

Reverse asset lists and counts use the existing search endpoint and its access controls. Query by
concept UUID rather than FQN, preserving unresolved assignments after working-definition deletion
or name reuse. The search projection is eventually consistent; SQL remains the assignment record.
Published concept pages authorize the sealed definition before showing associated assets. Search
failures have an explicit retry state and do not imply zero associations. Existing indexes require
the normal mapping update and reindex to populate the new field. `ParseTagsTest`, `TaggableIndexTest`,
`CustomIndexTest`, and `IndependentOntologyLabelsIT` guard this projection.

Define the shared keyword field in `IndexMapping.readMapping`, used by index creation, updates,
rebuilds, mapping lookup and version fingerprints. Language-specific JSON files retain their existing
fields and analyzers; they do not repeat the ontology field. This field is independent of optional
search hardening settings.

## Follow-up: metadata CSV annotations

Append an optional `ontologyAnnotations` column to metadata CSV formats. Its value is a JSON array
of existing `TagLabel` objects carrying source `Ontology`, stable ontology/concept UUIDs, assignment
state, label type and provenance. Export omits derived display fields and the computed `resolved`
flag. Classification and glossary columns keep their existing meanings and positions.

An omitted column preserves each target's current ontology annotations; an explicitly empty cell
removes them. Import validates supplied identities through `OntologyLabelResolver`, including in
dry runs, and persists through the existing repository/tag-usage mechanisms. The same codec serves
entity, nested-column, bulk-column and search-result exports. The bulk edit grid displays concept
names and suggestion state, retains the serialized annotations, and keeps this structured column
read-only. CSV files can replace the column explicitly; malformed or forged assignments fail the row.

Define the annotation header once in `OntologyAnnotationCsv`, applied by the existing documentation
loader and CSV constructor to formats with a tag column. This also covers headers declared in Java.
Row builders use `CsvUtil.addOntologyAnnotations`, alongside the existing classification and glossary
helpers; the generic two-argument record writer stays unchanged.

## Amendment: validation cost and hierarchy

Store named subclass relationships only as ontology-owned `OntologyAxiom` rows. Concept reads
expose derived, read-only `superClasses` and `subClasses`; these are neither persisted nor included
in semantic digests. Reject named subclass cycles and subclass relations on SKOS-only concepts.
Class concepts cannot use individual `sameAs` mappings as a substitute for class equivalence.

Documentation and ownership edits do not reload the complete ontology. Semantic writes read the
changed definitions, their dependent definitions, referenced declarations and subclass ancestors
through the reference index. These reads share the ontology state lock; MySQL reads that must see
recently committed changes use locking reads, including both sides of the reference/axiom join.
Cycle detection identifies every member of a strongly connected component without recursion.
An invalid unrelated draft does not prevent repairs. Capture still validates the complete model.

In the metadata follow-up, annotations reuse the existing `tag_usage` store and shared tag writers. Batch writes
resolve identities and approved/active content together through existing chunked DAO queries.
Cached assignments refresh their meaning from the active release on read. A column datatype
change carries its existing annotation identity, assignment state and provenance forward, even
when its concept is no longer active; it does not authorize a new assignment to an unapproved concept.
