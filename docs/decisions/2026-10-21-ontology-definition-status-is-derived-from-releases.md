# Ontology definition status is derived from releases

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial); v2 2026-10-23 (clarify publication response and working-change counts); v3 2026-10-25 (separate deprecation counts at stack integration); v4 2026-10-25 (distinguish available and unavailable review locks)
- **Deciders:** Harsha
- **Guard:** `OntologyDefinitionStatusResolverTest`, `OntologyPublicationStatusResolverTest`, `OntologyDerivedStatusStorageTest`, `IndependentOntologyStatusIT`
- **Related:** ADR:2026-10-14-ontology-reviews-bind-workflow-tasks-to-revisions, ADR:2026-10-14-ontology-releases-seal-canonical-sql-members, #35981, #36184

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

`publicationStatus` has optional `active` and `latest` release summaries. `active` identifies the
currently published release. `latest` identifies the release with the highest release revision,
regardless of approval state. Its `stage` is `Draft`, `InReview`, `ChangesRequested`, `Approved`, or
`Published`. These publication stages are distinct from a concept's `lifecycleStatus`.

`publicationStatus.unpublishedChanges` is the total across all working diff pages for the ontology,
using the same governed-content comparison against the active release. Without an active release,
every working member counts as added. The count uses batched membership, version and content reads;
it does not fetch only the first diff page. `changeSummary` is stored when a release is captured. It
counts the added, changed and removed rows of the release diff against the captured base release.

Both fields are readable with `ViewBasic`. They disclose membership of a release the caller can
already read and a count, never member content. The diff endpoints keep their per-definition check.

Reading the status records no event, task or revision. Capture, review, activation, working edits and
deletions can change what the status reports.

## Consequences

The status cannot drift from the releases, and no migration or backfill exists for it. Releases
captured before this record carry no `changeSummary`. Status reads batch release metadata and version
checks across the requested page. Definitions whose versions changed need additional batched payload
reads for the governed-content comparison.

## Amendment v2, 2026-10-23

Clarify the existing response names and stage vocabulary, the complete working-change count, and the
writes that affect derived status. This amendment changes no API or stored data.

## Amendment v3, 2026-10-25

Release change summaries partition the default-base diff rows into added, changed, removed and
deprecated counts. Newly deprecating an existing concept or property counts only as deprecated,
even when its other governed fields also change. Adding an already deprecated definition counts
as added. Editing a definition that was already deprecated, or clearing its flag, counts as
changed. Removing a deprecated definition counts as removed.

New captures always store all four counts, including zero. The schema leaves `deprecated` optional
with no default. A historical summary without this bucket has an unavailable total; readers must
not infer zero. Existing captures are immutable and receive no backfill.

`OntologyReleaseComparisonTest.summaryPartitionsDeprecationsAndOtherChangesWithoutDoubleCounting`
and `unchangedAndNewClosuresHaveAnExplicitZeroDeprecationCount` guard the partition and explicit zero.

## Amendment v4, 2026-10-25

A successful publication-status projection always includes `reviewLock`. An empty object means
the server checked and found no open review. Missing or null means unavailable, including an older
server response. The UI must not interpret unavailable as unlocked.

When any release is in review, the envelope's `inReview` identifies the newest open review with
only its release ID, release revision and optional semantic version. A newer Draft does not clear
this lock. The existing bounded release-role query supplies this owner-scoped hint without reading
tasks or exposing reviewer, task or release-content details. Reading release details retains its
separate authorization check.

The envelope is derived, never stored or accepted in writes. The server's existing 409 guard on
reviewer and approval-rule changes remains authoritative. Both configured JSON serializers must
preserve the empty object so clients can distinguish an unlocked result from an unavailable one.
