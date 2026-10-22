# Agents' glossary-term proposals are decided through the approval workflow

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `GlossaryTermAutomationDraftIT`, `WorkflowEventConsumerTest`, `GlossaryApprovalWorkflowAutomationBranchTest`, `GlossaryAutomationProposalMigrationTest`, `GlossaryTermRepositoryStageDecisionTest`, `useGlossaryProposals.test.tsx`, `GlossaryReviewTab.test.tsx`, `GlossaryAiGeneratedTerm.spec.ts`
- **Related:** ADR:2026-10-19-memories-become-draft-glossary-terms-through-the-ai-provider

## Context

ADR:2026-10-19-memories-become-draft-glossary-terms-through-the-ai-provider let people decide an
automation's Draft term by changing its status directly, because a bot's write never starts the
approval workflow. No approval request was ever opened for an AI agent's term, reviewers moved its
stage outside the workflow that owns it, and the first event the workflow saw was a person's
edit, which approved the term outright: for anyone in a glossary without reviewers, which is every
glossary an agent creates, and for any reviewer elsewhere. Collate's writer also created the terms
through the repository inside a background job, so no change event was recorded for them at all.

## Decision

A bot's create of an entity whose provider is `automation` is a proposal: `WorkflowEventConsumer`
hands it to the entity's workflows as it does a person's change. Every other bot change stays
outside them, and governance-bot's writes never start one. A writer that creates such an entity
outside a request records its `entityCreated` change event itself, in the creating transaction.

`GlossaryTermApprovalWorkflow` checks for an automation term awaiting its first decision (Draft
or In Review, and never approved) before any step can approve it. Without an open approval request
about it, the term goes In Review with a request for its reviewers, else its owners, inherited ones
included, else every admin (`emptyAssigneeStrategy: assignAdmins`), and that request decides it.
With one open, the run ends: an edit refines the proposal but never approves it or replaces its
request. Once approved, an AI term's later changes are reviewed like any term's. The private rule
operators `hasBeenApproved` and `hasOpenApprovalTask` (matched by the term's id, since another
entity type can share its FQN) answer those checks. Seeding never updates a stored workflow, so the
2.1.0 migration starts Flowable and inserts the branch, read from the seed, in front of whatever
step the start led to.

The workflow owns an automation term's stage like any term's: a direct status change is refused,
and only its approval request decides it. A bot, or a workflow writing for one, never moves an
automation term to Approved, whatever a stored workflow says (`checkStageDecision`). The review
pages decide every proposal, an AI agent's or a person's, through its request; a proposal still
waiting for one offers no decision, only an edit, which opens it.

## Consequences

Rejecting a single AI proposal asks for a reason, as rejecting a person's always has; a bulk
rejection sends none, since the server requires one only for data access requests. An AI term's
requester is the agent's bot, so every assignee may decide it. A proposal whose request was closed
or terminated without a decision opens a new one on its next edit. As for any term, the editor is
left off its assignees while another reviewer or owner remains, and a sole reviewer or owner keeps
it; the admin fallback never includes the editor, so a sole admin then needs another reviewer,
owner or admin.

AI terms created between ADR:2026-10-19-memories-become-draft-glossary-terms-through-the-ai-provider
and this change have no request: the next edit sends them to review, or deleting them lets the
memory derive them again. Revisit the admin fallback if agents' proposals get a reviewer of their
own to route to.
