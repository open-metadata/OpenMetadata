# Ontology releases use the existing approval workflow

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial); v11 2026-10-15 (release-only decisions and mandatory review content)
- **Deciders:** Harsha
- **Guard:** `OntologyReviewTest`, `OntologyApprovalWorkflowTest`, `OntologyEntityDAOTest`, `IndependentOntologyApprovalIT`, `IndependentOntologyReviewRecoveryIT`, `OntologyReviewPanel.test.tsx`, `OntologyReview.spec.ts`
- **Related:** ADR:2026-10-14-ontology-definitions-have-independent-entity-storage, ADR:2026-10-14-ontology-releases-seal-canonical-sql-members

## Context

The approval unit is a complete immutable ontology release. A second lifecycle for each working
concept, property or axiom adds conflicting decisions and duplicates the existing workflow system.
An editable status or a governance-bot identity cannot establish approval.

## Decision

Use existing `RequestApproval` tasks and configured Flowable approval workflows for `OntologyRelease`
only. Reject review submissions for working ontology definitions. The server captures release UUID,
entity-history version, content revision/digest, author, owning ontology UUID and workflow version/
digest in the task's immutable `ontologyReview` field. Runtime assignments, vote thresholds and
approval steps remain in Flowable; no ontology vote table or decision endpoint is added.

Submission requires `CreateTask` plus `EditAll` on the owning ontology. Reject a second open review
before inserting a task and recheck under the ontology lock. An approved or rejected release returns
409 on resubmission, including when active. To revise a rejected release, capture a new candidate.
Cancelling an undecided review returns its candidate to Draft and permits a new task; it never changes
an approved release or the active pointer.

The digest format is `ontology-review-v2`. Exclude owners, reviewers, operational status/audit fields
and derived hierarchy fields. Current reviewer eligibility is checked on every vote, including earlier
voters; the author cannot approve their own release. Working edits and owner/reviewer changes do not
reset an approved release. Preserve the submitted workflow fingerprint as evidence, while executing
the actual runtime approval step rather than interpreting a new workflow definition mid-process.

Resolution locks workflow, ontology state, active owning ontology and review target before consistent
reads. MySQL checks that must observe a recent commit use locking reads; bypassing application caches
alone cannot refresh a repeatable-read database snapshot. Cancellation takes ontology state before
locking the release, preserving the same lock order as writers and capture.

The submitted entity-history version must remain readable and match the target digest. A missing
version blocks resolution and recovery closes the invalid review; current content cannot substitute
for lost evidence. The review UI loads that version and compares its members against captured
`baseReleaseId`, showing before/after content and removed members. Missing or denied history, diff
or selected member content disables approval. Feed cards link to review instead of offering native
one-click approval. Required rejection comments remain enforced by the existing transition UI.

Native review submissions contain only transition, resolution and comment; they do not echo legacy
`newValue` or proposed entity JSON. No available transition means no legacy approval fallback. The
inbox preserves the returned task state after a vote, allowing multiple required votes.

Distinguish `RESOLUTION_FAILED` from a task completion followed by `PROCESS_FAILED`. Only ontology
release decisions require successful completion of the whole workflow. Preserve the shared metric
and glossary resolution contract. Multi-vote glossary approval retains deadlock retry around the
whole engine command with fresh variables on each attempt.

Persist a typed decision receipt in the Flowable transaction that records the decisive vote. A receipt
can be applied only after committed successful process history: an end time, no deletion/failure
reason and no error end. Intermediate stages accumulate voters without deciding the release.

Use the existing `entity_extension` table for the `ontology.reviewExecution` recovery marker and its
existing extension index. The managed reconciler checks at most 100 markers per pass, starts after
10 seconds and repeats every 30 seconds with cursor wraparound. It can recover the execution ID by
workflow key and task UUID. A recorded start failure cancels the review; a task with no execution
gets five minutes to start before cancellation. Existing workflows are not timed out by that grace.

Applying a valid receipt updates task resolution, release decision, durable release event and marker
in one retained entity transaction with fresh reads. A crash after the engine commit leaves the marker
for retry. Missing or archived targets and ineligible reviewers cancel the pending review. Cancellation
terminates the workflow instance tree; its marker stays until execution cleanup finishes. Closed
reviews cannot be reopened or mutated, and active review tasks cannot be deleted. Repeated cancellation
returns the first result without rewriting its actor, timestamp or comment.

## Consequences

Working definitions retain normal history and optimistic write checks with no individual review
fields. Release review, activation and metadata assignment are distinct operations. Recovery handles
the existing separate Flowable and entity transactions; it is not another approval engine. Native
bulk/CSV authoring and cross-ontology imports are deferred. Glossary relationships and approval policy
retain their existing behavior.
