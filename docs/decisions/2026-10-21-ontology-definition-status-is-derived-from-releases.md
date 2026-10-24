# Ontology definition status is derived from releases

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** Harsha
- **Guard:** `OntologyDefinitionStatusResolverTest`, `OntologyDerivedStatusStorageTest`, `IndependentOntologyStatusIT`
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

A concept matches a member when its governed content equals the member's, which is the identity the
working diff and the release diff already use. An equal entity version proves a match without reading
the member payload, because capture projected exactly that stored revision. A moved version is not a
mismatch: owner and reviewer edits move the version and project nothing, and an edit that is reverted
restores the content. The resolver reads the member payload for those pairs and compares content. Only
version equality, as the plan first described it, would show `Draft` for a concept that the working
diff does not list, so the pill and `unpublishedChanges` could disagree on one page.

`publicationStatus.unpublishedChanges` is the number of rows the working diff returns for the
ontology. `changeSummary` is stored when a release is captured. It counts the added, changed and
removed rows of the release diff against the captured base release.

Both fields are readable with `ViewBasic`. They disclose membership of a release the caller can
already read and a count, never member content. The diff endpoints keep their per-definition check.

Reading the status records nothing: no event, no task, no revision. Only capture, review and
activation change what the status reports.

## Consequences

The status cannot drift from the releases, and no migration or backfill exists for it. Releases
captured before this record carry no `changeSummary`. A list page reads the status with a fixed
number of SQL statements whatever its size.
