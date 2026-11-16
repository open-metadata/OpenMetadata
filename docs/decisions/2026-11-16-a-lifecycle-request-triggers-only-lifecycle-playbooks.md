# A lifecycle request triggers only the lifecycle playbooks that take requests

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `FilterEntityImplTest#eventPath_lifecycleRequestOnly_*`,
  `WorkflowDefinitionResourceIT#test_lifecycleRequestLeavesTheSeededReviewOfAGlossaryTermAlone`
- **Related:** ADR:2026-11-16-requestable-stages-are-read-per-entity

## Context
A user asks an asset's lifecycle to move it to an on-request exit, such as Deprecated, by setting
the entity's `lifecycleRequest`. While that field sat in the `common` trigger fields, every
event-based workflow on the entity type fired on it. On a glossary term the seeded Glossary Term
Approval Workflow superseded the term's pending review, opened a second review beside the exit's
approval, and left that review open on a term the exit had just deprecated. Excluding the field in
each seeded workflow would need a data migration and would still miss the workflows customers build.

## Decision
`workflowTriggerFields.json` lists `lifecycleRequest` under `lifecycle`, not `common`. A change to a
`lifecycle` field triggers a workflow only when that workflow is the active lifecycle playbook that
owns the entity's stage and has an on-request exit (`EntityStatusWorkflows.takesLifecycleRequests`),
whatever its trigger `include`/`exclude`; it triggers no other workflow, and `WorkflowEventConsumer`
passes such a change on so the trigger can decide. The approval gate never holds the field, since it
is no trigger field, so the gate and the trigger agree that no other workflow reacts to it.

## Consequences
A request reaches the one lifecycle it is addressed to, and other workflows on the type see no
event for it; the workflow builder no longer offers the field to include or exclude. A future field
addressed to the lifecycle joins the `lifecycle` list. Revisit if a non-playbook workflow ever needs
to react to a request.
