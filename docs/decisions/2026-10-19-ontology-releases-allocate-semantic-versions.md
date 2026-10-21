# Ontology releases allocate semantic versions during capture

- **Status:** Accepted
- **Revisions:** v1 2026-10-19 (initial)
- **Deciders:** Ontology Studio implementation review
- **Guard:** IndependentOntologyPublicationIT, OntologyReleasePublicationTest, OntologyReleaseHistoryTest, OntologyPublicationStorageTest
- **Related:** ADR:2026-10-14-ontology-releases-seal-canonical-sql-members

## Context

Reviewers need a version label and notes for each captured candidate. Concurrent captures and captures during history paging must not produce ambiguous versions or unstable pages.

## Decision

Versioned capture accepts a major, minor, or patch increment and up to 16,384 characters of notes. Under the existing capture lock, the server allocates the version from the latest versioned candidate, including rejected candidates. An expected latest-release revision supplements the existing working and activation revision checks. The initial version base is `0.0.0`; Studio defaults to a major increment for the first version and minor afterward.

The version and notes are immutable release metadata. They do not change semantic digests, entity history versions, release revisions, version IRIs, or review and activation rules. Existing callers may still capture unversioned releases, displayed as `release-N`.

Owner-scoped history orders releases by numeric release revision descending, with pages of 1 to 100 entries. Its cursor binds the owner and the first page's highest revision. Captures during paging cannot shift the remaining rows. Studio preserves a captured candidate after review-task submission fails and reconciles its task before retrying.

## Consequences

Versions identify captured candidates, so rejection leaves a gap in approved versions. Publication remains a separate review and activation workflow. Legacy releases remain readable alongside versioned releases.
