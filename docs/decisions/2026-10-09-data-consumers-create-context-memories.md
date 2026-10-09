# Data Consumers create context memories by default

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `DataConsumerPolicyGrantSqlMigrationTest` (the upgrade statement),
  `ContextMemoryCreateGrantIT` (the grant, ownership and the opt-out)
- **Related:** ai-platform#1580; OpenMetadata#34253, which made `ExecuteSparqlQuery` a Data
  Consumer default the same way (ADR:2026-09-16-agent-sparql-execution, §2a);
  open-metadata/openmetadata-collate#6965 (`MemoryCaptureGate`)

## Context

Every user inherits `OrganizationPolicy` and the `DataConsumer` role through the Organization
team, and neither granted `Create` on `contextMemory`. `OrganizationPolicy-Owner-Rule` (`All` when
`isOwner()`) never matches a create: `CreateResourceContext#getOwners` reads the owners of a parent,
and a memory has none. `POST` and `PUT /v1/contextCenter/memories` therefore returned 403 for every
non-admin. The agent's `upsertMemory` failed for them, and Collate's `MemoryCaptureGate`, which
evaluates the same rule before a turn, skipped capture. On a default install only admins wrote
memories.

## Decision

- The seeded `DataConsumerPolicy` carries its own allow rule,
  `DataConsumerPolicy-CreateContextMemory-Rule`: `Create` on `contextMemory`, with no condition. It
  is separate from `DataConsumerPolicy-EditRule` so an admin can delete just this rule to make memory
  creation admin-only again. A role with a deny rule for `Create` on `contextMemory` withdraws it
  from chosen users.
- Nothing else about memories changes. A memory created without owners is owned by its creator, so
  editing and deleting it come from `OrganizationPolicy-Owner-Rule`; editing another user's memory
  still needs `EditAll`. Who reads a memory is still decided by its `shareConfig`
  (`ContextMemoryVisibility`).
- Existing installs get the rule from a native statement in the 2.1.0 `schemaChanges.sql`, for
  MySQL and PostgreSQL. Like the SPARQL grant it is recorded once in `SERVER_MIGRATION_SQL_LOGS`, so
  an admin who deletes the rule does not get it back on a later upgrade. The statement adds the
  rule only while an allow rule of `DataConsumerPolicy` still lists `EditDescription`.

## Consequences

- Every user can save memories through the agent and the Context Center. The Context Center's
  create action already follows `permissions.Create`, so the UI needs no change.
- Accepted risk: a memory is contributed knowledge, the same kind of contribution as a description,
  and Data Consumers already edit the description of every asset. A non-admin can now create an
  `Approved` memory with `Entity` visibility, which every reader of its asset sees, and every user
  sees when it has no asset; `upsertMemory` writes exactly that. Capture writes `Unprocessed`
  memories, which search does not admit until they are approved. Create does not check that the
  creator can view the asset a memory is anchored to. An install that wants memories reviewed before
  other users see them removes the rule; this record adds no review step.
- Upgrade guard: an install that removed `EditDescription` from Data Consumer made it read-only
  and does not receive the grant; an admin who wants it adds the rule by hand. The check is as
  simple as the SPARQL one: it ignores a rule's condition and resources, does not count the `All`
  operation as `EditDescription`, and cannot see deny rules in other policies.
- Revisit if memories by non-admins must be reviewed before they are shown, which needs a
  create-time status rule rather than a permission, or if Data Consumer stops being a contributor
  role.
