# Ontology definition status is derived from releases

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** Harsha
- **Guard:** `OntologyDefinitionStatusResolverTest`, `IndependentOntologyStatusIT`
- **Related:** ADR:2026-10-14-ontology-reviews-bind-workflow-tasks-to-revisions, ADR:2026-10-14-ontology-releases-seal-canonical-sql-members, #35981

## Context

Ontology Studio shows a status for each concept and a publication summary for each ontology. The
approval unit is an immutable release, and working definitions have no approval state of their own
(ADR:2026-10-14-ontology-reviews-bind-workflow-tasks-to-revisions). A stored or editable status on a
definition would be a second lifecycle that can disagree with the releases.

## Decision

`lifecycleStatus` on a concept, `publicationStatus` on an ontology, and `changeSummary` on a release
are read-only. The server never accepts them from a client and never stores the first two. They are
computed when a request asks for them with `fields`, from release membership and `ontology_state`.

A concept is `Approved` when it matches its member in the active release or in the latest `Approved`
release. Otherwise it is `InReview` when it matches its member in the `In Review` release. Otherwise
it is `Draft`. A deleted concept matches nothing.

`publicationStatus.unpublishedChanges` is the number of rows the working diff returns for the
ontology. `changeSummary` is stored when a release is captured. It counts the added, changed and
removed rows of the release diff against the captured base release.

Reading the status records nothing: no event, no task, no revision. Only capture, review and
activation change what the status reports.

## Consequences

The status cannot drift from the releases, and no migration or backfill exists for it. Releases
captured before this record carry no `changeSummary`. A list page reads the status with a fixed
number of SQL statements whatever its size.
