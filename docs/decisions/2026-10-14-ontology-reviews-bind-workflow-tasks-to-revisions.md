# Ontology releases use the existing approval workflow

- **Status:** Accepted
- **Revisions:** v1 2026-10-14 (initial); v12 2026-10-16 (sealed-content identity and recoverable review failures); v13 2026-10-22 (approval rule, recorded votes, reviewer lock and the review read model)
- **Deciders:** Harsha
- **Guard:** `OntologyReviewTest`, `OntologyApprovalWorkflowTest`, `OntologyEntityDAOTest`, `CreateTaskTest`, `TaskWorkflowHandlerTest`, `TaskReviewVotesTest`, `IndependentOntologyApprovalIT`, `IndependentOntologyReviewRecoveryIT`, `IndependentOntologyReviewRuleIT`, `IndependentOntologyReleaseIT`, `OntologyReviewPanel.test.tsx`, `OntologyReview.spec.ts`
- **Related:** ADR:2026-10-14-ontology-definitions-have-independent-entity-storage, ADR:2026-10-14-ontology-releases-seal-canonical-sql-members

## Context

The approval unit is a complete immutable ontology release. A second lifecycle for each working
concept, property or axiom adds conflicting decisions and duplicates the existing workflow system.
An editable status or a governance-bot identity cannot establish approval.

## Decision

Use existing `RequestApproval` tasks and configured Flowable approval workflows for `OntologyRelease`
only. Reject review submissions for working ontology definitions. The server captures release UUID,
entity-history version, sealed-content digest, author and owning ontology UUID in the task's immutable
`ontologyReview` field. The task already identifies its workflow. Runtime assignments, vote thresholds and
approval steps remain in Flowable; no ontology vote table or decision endpoint is added.

Submission requires `CreateTask` plus `EditAll` on the owning ontology. Reject a second open review
before inserting a task and recheck under the ontology lock. An approved or rejected release returns
409 on resubmission, including when active. To revise a rejected release, capture a new candidate.
Cancelling an undecided review returns its candidate to Draft and permits a new task; it never changes
an approved release or the active pointer.

The digest format is `ontology-review-v3`. Hash only the release UUID, release revision and sealed
manifest digest. Current reviewer eligibility is checked on every vote, including earlier
voters; the author cannot approve their own release. Working edits and owner/reviewer changes do not
reset an approved release. Execute the actual runtime approval step rather than interpreting a new
workflow definition mid-process. Do not duplicate Flowable's workflow identity or maintain a second
review revision counter for immutable content.

Resolution locks workflow, ontology state, active owning ontology and review target before consistent
reads. MySQL checks that must observe a recent commit use locking reads; bypassing application caches
alone cannot refresh a repeatable-read database snapshot. Cancellation takes ontology state before
locking the release, preserving the same lock order as writers and capture.

The submitted entity-history version must remain readable and match the target digest. A missing
version blocks resolution and leaves recovery pending; current content cannot substitute
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
for retry. Missing or archived targets and ineligible reviewers leave recovery pending for repair;
validation or authorization failures never irreversibly cancel a review. Explicit workflow failure or
cancellation terminates the workflow instance tree; its marker stays until execution cleanup finishes. Closed
reviews cannot be reopened or mutated, and active review tasks cannot be deleted. Repeated cancellation
returns the first result without rewriting its actor, timestamp or comment.

## Consequences

Working definitions retain normal history and optimistic write checks with no individual review
fields. Release review, activation and metadata assignment are distinct operations. Recovery handles
the existing separate Flowable and entity transactions; it is not another approval engine. Native
bulk/CSV authoring and cross-ontology imports are deferred. Glossary relationships and approval policy
retain their existing behavior.

## Amendment (v13, 2026-10-22)

An ontology carries an `approvalRule`, `AnyReviewer` by default or `AllReviewers`, and
`prepareReview` freezes it into the task's `ontologyReview` target. The rule reaches the workflow as
the start variable `approvalMode=allAssignees`, which `CreateTask` turns into the task's
`approvalThreshold`: the larger of the node's threshold and the number of assignee entries. Only an
ontology review sets the variable, so every other workflow keeps its node threshold, and
`handleMultiApproval`, `isAwaitingAdditionalVotes` and `ApprovalTaskCompletionValidator` read the
threshold unchanged. The reviewer rule stays one team or several users, so under `AllReviewers` a
team is one entry that any member covers, and the entry count equals the distinct-voter count the
workflow enforces. The requester's and the author's own user entries are left out of the assignees,
because neither can vote; a review with no other entry is refused at submission.

Each counted vote on a workflow approval task is recorded in `reviewVotes` as voter, covered entry,
decision, comment and timestamp, one per voter. This shared task behavior includes non-ontology
workflows. Typed vote details commit in the same Flowable command as the vote count, under a
variable keyed by task UUID, then project onto the task. Completed process history supplies the
same details during ontology reconciliation. This closes the race where a final vote could
reconstruct an earlier voter before that voter's task write, losing the original comment. The
Flowable lists remain the count. No ontology vote table or decision endpoint is added.

While any release of an ontology is `In Review`, a change to the ontology's `reviewers` or
`approvalRule` is refused with 409 under the ontology state lock that starting, deciding and
cancelling a review also take. Reviewer eligibility is still checked on every vote, and team
membership is not frozen. The repair path for a reviewer change during a review is to cancel the
review, change the reviewers, and submit a new review.

`GET /v1/ontologyReleases/{id}/review` and `GET /v1/ontologies/reviews?view=assigned|created|pending`
read a review from the task alone: each entry with `Pending`, `Approved` or `Rejected` and its vote,
the deciding vote with its verbatim reason, `callerCanVote`, and `callerCompletesRule` derived from
the frozen rule and the recorded votes. The list covers open reviews; a decided review is read
through its release. List rows and totals include only releases the caller can view under the
same policy check as the per-release endpoint. The scan follows bounded database pages through
all open reviews, so unrelated recent reviews cannot hide older assigned reviews.
