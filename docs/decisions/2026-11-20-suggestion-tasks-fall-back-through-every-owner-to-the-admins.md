# A suggestion task with no owner goes to the service owners, then the domain owners, then the admins

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial) · v2 2026-11-23 (the server, not the migration, deploys the workflow)
- **Deciders:** Shreyansh Verma
- **Guard:** `SetApprovalAssigneesImplTest`, `SuggestionTaskOwnerFallbackMigrationTest`, `MigrationArchitectureTest`, `WorkflowTaskAssigneesIT`
- **Related:** ADR:2026-10-22-agent-glossary-proposals-are-decided-through-the-approval-workflow, ADR:2026-11-11-a-data-migration-carries-its-own-logic, ADR:2026-11-23-a-changed-workflow-is-deployed-when-the-server-starts, #38297, open-metadata/openmetadata-collate#8552

## Context

Suggestion tasks, most of them proposed by AI automations, go to the asset's reviewers or its
owners, inherited ones included (a table inherits from its schema and database). An asset with no
owner on that path got a task nobody was assigned to, and nobody was notified. A database does not
inherit the owners of its service, and dashboards, pipelines, topics, containers, ML models and
search indexes inherit no owners at all. `addDomainOwners` adds domain owners next to the asset
owners rather than in their place. `emptyAssigneeStrategy: assignAdmins` existed, but was never set
on `SuggestionTaskWorkflow`.

## Decision

Assignees a task already carries are final; a task on an asset with its own owners is created
assigned to them. Otherwise a `userApprovalTask` resolves assignees in this order, and stops at the
first step that yields a user other than the requester after team expansion: the asset's reviewers
or its owners, own and inherited; when its `cascadeOwners` option is on, the owners of the asset's
service, then the owners of its domains; then `emptyAssigneeStrategy`. A team owner with no members yields nobody,
so the next step runs. Owner auto-assignment turned off for the workflow skips the service and
domain steps too.

`cascadeOwners` is off unless a node sets it. `SuggestionTaskWorkflow`'s `TaskReview` node sets it
and `emptyAssigneeStrategy: assignAdmins`, so a suggestion nobody owns goes to every admin except
its requester.

The 2.1.1 migration sets `cascadeOwners` on the stored `TaskReview` node, and replaces a stored
`emptyAssigneeStrategy` of `none` (the stored default) or no value with `assignAdmins`; `wait` and
`assignAdmins` are kept. A stored workflow without a `TaskReview` node with assignees fails the
migration rather than being guessed at. The migration only changes the row; the server deploys the
changed workflow when it starts
(ADR:2026-11-23-a-changed-workflow-is-deployed-when-the-server-starts).

## Consequences

Owners of a service and of a domain now receive suggestions for the unowned assets under them. An
automation run over unowned assets can give every admin one task per suggestion. Assignees are
still resolved once, when the task is created, so an owner added later does not receive a task
already open. Data product owners are not consulted. Other approval workflows behave as before
until a node turns `cascadeOwners` on.

## Amendment

v2 2026-11-23. The 2.1.1 migration deployed the workflow itself, as a named exception in
`MigrationArchitectureTest`. It now only changes the row, and the server deploys the changed
workflow on its next start (ADR:2026-11-23-a-changed-workflow-is-deployed-when-the-server-starts).
