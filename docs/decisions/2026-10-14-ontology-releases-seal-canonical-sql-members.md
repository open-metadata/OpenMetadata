# Ontology releases seal canonical SQL members

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial); v10 2026-10-15 (single-ontology releases, captured comparison baseline, active-only projection)
- **Deciders:** Harsha
- **Guard:** `OntologyReleaseManifestTest`, `OntologyReleaseDAOTest`, `OntologyReleaseCaptureTest`, `OntologyWorkingStateTest`, `OntologyReleaseProjectionTest`, `OntologyStructureValidatorTest`, `OntologyReleaseComparisonTest`, `OntologyReleaseComparisonStorageTest`, `IndependentOntologyReleaseDiffIT`, `IndependentOntologyReleaseIT`, `IndependentOntologyReleaseExportIT`, `IndependentOntologyRetentionIT`
- **Related:** [Organizational ontology design](../plans/2026-10-14-organizational-ontology-design.md)

## Context

An approved ontology must survive working edits, deletion of individual definitions and ordinary
entity-history cleanup. Reviewers must decide a complete, reproducible release. SQL remains the
authoritative store; Fuseki serves the active release's asserted RDF.

## Decision

Use the existing `EntityDAO` JSON header and retained transactions. Store immutable member payloads
in `ontology_release_member` as MySQL `LONGTEXT` or PostgreSQL `TEXT`, addressed by release ID, kind
and entity UUID. Canonical text preserves exact decimal values and strings across both databases.
Sort object keys, preserve array order, normalize insignificant decimal trailing zeros, reject NUL
characters, and hash UTF-8 bytes with SHA-256. The member manifest binds source entity versions,
payload digests and byte counts; it excludes the release UUID and has no per-definition review revision.

Capture freezes one ontology root and its concepts, properties and axioms. Native cross-ontology
imports, dependency tables and dependency resolution are deferred. Nonempty import requests fail
explicitly. Existing glossary import tools do not supply native release content.

Initially bound each member to 1 MiB, each release to 10,000 members and total payloads to 64 MiB.
Capture locks `ontology_state`, checks `expectedWorkingRevision`, reads definitions in pages of 100,
and checks a cooperative 30-second budget between operations. All authoring writes share that lock.
Quota, authorization or validation failures roll back the header, members, revision and capture event.
Sealing verifies the count; sealed content cannot be edited, resealed or appended to.

`ontology_state` stores working, release-allocation and activation revisions plus the active release
UUID. Capture records the current active release as `baseReleaseId`. The review UI passes this frozen
baseline to the diff endpoint; a later activation does not change what the reviewer compares.

The capture gate checks structure and the supported OWL 2 DL profile. OWLAPI is test-scoped and verifies
projected models in tests. Runtime checks use the structure validator and release-scoped
`OwlProfileGuard`. Logical consistency is explicitly `NOT_RUN` until the planned Jena-fork CHECK
execution exists. Passing this gate does not prove consistency or source-data validity.

The configured task workflow approves or rejects the whole sealed release. Working edits do not
invalidate its review. A decided release cannot be reviewed again. Decision events bind the digest,
review target, workflow and task IDs, voters and outcome, independently of Flowable history retention.
Neither capture nor approval changes the active pointer.

`PUT /v1/ontologies/{id}/activation` requires `EditAll` and accepts an approved, sealed release owned by
that ontology with `expectedActivationRevision`. A stale revision returns 409. Activation rechecks
structural/projectability gates, changes the pointer, appends its event and enqueues the existing RDF
outbox write as the final transaction operation. Rollback activates an older approved release through
the same endpoint. An archived ontology cannot be activated.

Fuseki contains one graph per ontology, `https://open-metadata.org/graph/ontology/{id}`, holding only
its active release. The outbox consumer rereads the active SQL pointer and replaces that graph using
Graph Store PUT, so late or repeated events cannot restore an obsolete release. Archive removes the
graph; restore and rebuild reproject the active pointer. The rebuilding RDF store journals these writes.
SQL commits before asynchronous projection; consumers must not mistake outbox lag for current RDF.

Member reads, export, diagnostics and comparisons verify the manifest and authorize the frozen
snapshots under current policies. A missing working definition does not erase its release member.
A denied member fails the operation; header visibility alone does not authorize the complete model.

Export supports Turtle, RDF/XML, N-Triples and JSON-LD from SQL without a running RDF store. Projection
preserves exact IRIs, OWL/SKOS concept kinds, property kinds and characteristics, ordered chains,
recursive expressions and all six supported axiom kinds. Axiom annotations preserve member provenance.
Typed enumerations use release-scoped datatype IRIs to preserve RDF-parser round trips. Units and
identifier intent are annotations, not conversions, OWL keys or source uniqueness guarantees.
Unsupported members fail export rather than disappearing.

`GET /v1/ontologyReleases/{id}/diff?baseReleaseId=...` compares two authorized releases of the same
ontology by member kind and UUID, excluding operational and derived fields from semantic comparison.
It returns additions, changes and removals with before/after release IDs. An omitted base means empty
content, suitable for the first release. Cursors bind the release pair and sorted position; both
complete snapshots are authorized before a page is returned. This is an asserted-content comparison,
not a proof of logical equivalence.

An ontology retaining releases cannot be hard-deleted. Check retention with a current locking read
under the same lock as capture, before cascading into working definitions. Soft deletion archives
working definitions while preserving release content and audit events. It cancels pending review
and removes the active RDF graph. Restore retains the active pointer and frozen release content.
Automated release expiry and purge policy are deferred.

## Consequences

No new object store, cache, broker or approval engine is required. Releases consume full-snapshot
space within explicit bounds. This is an unreleased storage contract: development databases created
with the earlier per-definition/import manifests must be reset before validating this version; do
not reinterpret an old sealed digest under the revised contract. Business glossaries are not converted.
