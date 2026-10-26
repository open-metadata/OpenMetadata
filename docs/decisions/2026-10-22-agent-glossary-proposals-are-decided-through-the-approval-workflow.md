# Agents' glossary-term proposals are decided through the approval workflow

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial) · v2 2026-10-23 (a proposal branch after the start; lifecycles ask for an approval)
- **Deciders:** Pere Miquel Brull
- **Guard:** `GlossaryTermAutomationDraftIT`, `JSONLogicSearchClassBase.test.ts`, Collate `LifecycleWorkflow.behavior.test.ts`, `WorkflowEventConsumerTest`, `GlossaryApprovalWorkflowReviewTest`, `GlossaryAutomationReviewMigrationTest`, `GlossaryTermRepositoryStageDecisionTest`, `AutomationProposalsTest`, `ContextMemoryDerivationIT`, `useGlossaryProposals.test.tsx`, `ProposalCard.test.tsx`, `GlossaryAiGeneratedTerm.spec.ts`
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

`GlossaryTermApprovalWorkflow` keeps its steps: an automation's term takes the same path as anyone's
term, and only a person approves it. Its reviewers check also passes a term whose provider is
`automation`, so such a term goes In Review where anyone's term in a glossary without reviewers
would be approved outright. Its approval steps (`ApproveGlossaryTerm`, `ApprovalForUpdates`) fall
back from reviewers to owners to the admins (`emptyAssigneeStrategy: assignAdmins`) instead of
approving a term nobody was assigned. Otherwise the term is reviewed as any term is: a reviewer's
edit approves it, and anyone else's edit sends the change to review. Seeding never updates a
stored workflow, so a 2.1.0 migration step gives the stored workflow those settings in place, and
keeps a check or fallback an admin changed.

The workflow owns an automation term's stage like any term's: a direct status change is refused,
and only its approval request decides it. A bot, or a workflow writing for one, never moves an
automation term to Approved, whatever a stored workflow says (`checkStageDecision`). The review
pages decide every proposal, an AI agent's or a person's, through its request; a proposal still
waiting for one offers no decision, only an edit, which opens it.

A request about an automation's term that was never approved says so in its payload, a
`GlossaryApprovalPayload` whose `proposal` (`AutomationProposal`) names the provider, the agent
and its confidence from the term's latest derivation evidence, and the memories it was derived from
by id and type. Every user may read tasks while those memories may be Private or Shared, so the
request carries no agent reasons, memory names or term description; the memory derivations API
serves the reasons to whoever may read the memories. A published term's later reviews carry no
proposal. A deriver links its derivation before, or in the same transaction as, the term's creation
event, so the request can name the agent; the request's creator is the bot the deriver writes as.

## Consequences

Rejecting a single AI proposal asks for a reason, as rejecting a person's always has; a bulk
rejection sends none, since the server requires one only for data access requests. An AI term's
requester is the agent's bot, so every assignee may decide it. The editor of a change is left off
its assignees while another of its reviewers (or owners, when it has none) remains, and a sole one
keeps it; the admin fallback never includes the editor, so a sole admin's own edit to an AI term in
a glossary without reviewers or owners leaves nobody assigned, and the step approves it. A term
whose reviewers are teams without members now goes to the admins instead of being approved.

AI terms created between ADR:2026-10-19-memories-become-draft-glossary-terms-through-the-ai-provider
and this change have no request: the next edit sends them to review, or deleting them lets the
memory derive them again.

## Amendment (v2, 2026-10-23)

The automation clause no longer lives in the reviewers check. An admin may reshape the workflow
or rewrite that check, and the workflow editor could not show the clause and dropped it on save,
after which a proposal reached the auto-approve step, which a bot never takes, and stopped there
with no request. So:

- **A branch of its own, right after the start.** `CheckIfGlossaryTermIsAutomationProposal`
  (`provider == automation` and the term is not Approved) sends a proposal to approval steps of its
  own; every other term continues to the workflow's first step as before, and the reviewers check is
  the 2.0 check again. A new proposal that is rejected is Rejected; a rejected change to a proposal
  is rolled back. The 2.1.0 migration splices the branch onto the stored workflow's start edge, so
  it does not depend on the rest of the workflow's shape; a start with several edges is left for an
  admin to wire.
- **The editor shows `provider`.** The check node offers Provider (user, system, automation) for
  glossary terms, so the condition is visible and survives a save.
- **Lifecycles ask a person too.** Where a glossary term lifecycle moves a term to Approved by
  itself, the compiled workflow first asks whether an automation proposed the term; if it did, the
  move waits for a person's approval and a rejection makes it Rejected. Other terms move on by
  themselves as configured. A lifecycle published before this reads back unchanged and gains the
  approval when it is published again.

A reviewer's own edit still approves a proposal, as it approves any term: the branch checks it first.

- **A person's term is reviewed exactly as in 2.0.** Only the proposal branch's approval steps fall
  back to the admins. `ApproveGlossaryTerm` and `ApprovalForUpdates` keep no fallback, so a person's
  term nobody can be assigned is approved as before (v1's admin fallback on them, and its
  consequence for reviewers that are teams without members, is withdrawn), and the migration no
  longer touches them.
