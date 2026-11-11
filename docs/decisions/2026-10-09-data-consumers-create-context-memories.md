# Data Consumers create context memories by default

- **Status:** Accepted
- **Revisions:** v1 2026-10-09 (initial); v2 2026-10-10 (extraction provenance and write-response visibility);
  v3 2026-11-03 (a non-admin's memory starts Unprocessed and only a review approves it);
  v4 2026-11-05 (review rules apply to distributions with reconciliation)
- **Deciders:** Pere Miquel Brull
- **Guard:** `DataConsumerPolicyGrantSqlMigrationTest` (the upgrade statement),
  `ContextMemoryCreateGrantIT` (the grant and the opt-out), `ContextMemoryWriteAccessTest` and
  `ContextMemoryWriteAccessIT` (what a non-admin may write), `ContextMemoryRepositoryTest` (the
  stage a non-admin's memory starts in, and who may approve it), `ContextMemoryLifecycleIT` (an
  owner's restore to Approved is refused)
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

Who writes a memory matters beyond the operation, because its owners and references decide what it
does. Collate injects the private user-global memories a user owns into that user's agent prompt as
their preferences, and a stored memory echoes the name of every entity it points at.

## Decision

- The seeded `DataConsumerPolicy` carries its own allow rule,
  `DataConsumerPolicy-CreateContextMemory-Rule`: `Create` on `contextMemory`, with no condition. It
  is separate from `DataConsumerPolicy-EditRule` so an admin can delete just this rule to make memory
  creation admin-only again. A role with a deny rule for `Create` on `contextMemory` withdraws it
  from chosen users.
- Existing installs get the rule from a native statement in the 2.1.0 `schemaChanges.sql`, for
  MySQL and PostgreSQL. Like the SPARQL grant it is recorded once in `SERVER_MIGRATION_SQL_LOGS`, so
  an admin who deletes the rule does not get it back on a later upgrade. The statement adds the
  rule only while an allow rule of `DataConsumerPolicy` still lists `EditDescription`.
- A writer who is neither an admin nor a bot (`ContextMemoryWriteAccess`; a bot acting for a user
  writes as that user):
  - owns every memory they create: naming anyone else as an owner is refused (403), and the owners
    of an existing memory cannot be changed (403), even by its owner;
  - may point a memory only at entities they can view, by the same rule that decides who reads an
    anchored memory, and only at memories they can read. A missing entity is refused with the same
    error as an unviewable one (400), so the answer does not reveal whether an id exists;
  - may not create a `FileExtraction` or `PageExtraction` memory, or change an existing memory's
    source into either value (403). These values establish extraction-engine provenance for
    company context and file-memory reuse. An unchanged extraction source is allowed, so readers
    can still tag or describe extracted pills. Content PATCHes keep the existing flip to `Manual`.
- Server writers must name their principal explicitly; a missing writer is refused. Extraction
  names the admin account, while a bot impersonating a user retains that user's restrictions.
- A memory's owner edits and deletes it through `OrganizationPolicy-Owner-Rule`. Data Consumers can
  also edit the description and tags of any memory they can read, as they can of any entity;
  editing its content needs `EditAll`. `PATCH`, PUT on an existing memory, and pin/unpin first
  enforce the memory's visibility, because they answer with the whole memory. An `EditAll` grant
  does not bypass that visibility.

## Consequences

- Every user can save memories through the agent and the Context Center. The Context Center's
  create action already follows `permissions.Create`, so the UI needs no change.
- Accepted risk: a memory is contributed knowledge, the same kind of contribution as a description,
  and Data Consumers already edit the description of every asset. A non-admin can now create an
  `Approved` memory with `Entity` visibility, which every reader of its asset sees, and every user
  sees when it has no asset; `upsertMemory` writes exactly that. Capture writes `Unprocessed`
  memories, which search does not admit until they are approved. An install that wants memories
  reviewed before other users see them removes the rule; this record adds no review step.
- Only admins hand a memory to someone else or add a co-owner. A writer who loses access to an
  entity their memory points at cannot save that memory until access is restored or the reference
  removed.
- Upgrade guard: an install that removed `EditDescription` from Data Consumer made it read-only
  and does not receive the grant; an admin who wants it adds the rule by hand. The check is as
  simple as the SPARQL one: it ignores a rule's condition and resources, does not count the `All`
  operation as `EditDescription`, and cannot see deny rules in other policies.
- Revisit if memories by non-admins must be reviewed before they are shown, which needs a
  create-time status rule rather than a permission, or if Data Consumer stops being a contributor
  role.

## Amendment — 2026-10-10: extraction provenance and write responses

Opening creation to Data Consumers also opened the previously admin-only extraction source values.
Company Context and file-memory reuse trust those values as engine provenance, so ordinary writers
may preserve them on an existing memory but cannot establish them. Server writes without a principal
now fail closed. PUT updates and pin/unpin enforce the same visibility as PATCH, since each returns
the complete memory. The accepted reach of user-authored Approved memories remains unchanged.

## Amendment — 2026-11-03: a non-admin's memory starts Unprocessed and only a review approves it

The revisit named above has happened: release testing found that a Data Steward could create an
Approved or Public memory through the API, skipping review.

- A memory created by anyone but an admin or a bot starts `Unprocessed`, whatever `entityStatus`
  it requests, so reconciliation decides it before anyone else grounds on it.
  `ContextMemoryRepository.prepare` applies this to every new memory: POST, MCP `create_entity`,
  and a PUT that creates, which runs the POST create so that it is prepared once (memories have no
  bulk endpoint). The rule runs before the stage stamps a review or checks stage-bound fields, so
  the memory never claims a review it did not have. It trusts no requested hold. The server's own
  evidence hold runs after it, so a memory citing a retired Query still starts in `Draft`.
- An update moves a memory into `Approved` only when an admin, a bot or a conflict review decision
  makes it (`ContextMemoryRepository.checkStageDecision`). A review's resolver writes as themselves
  through `governance-bot`, which a caller cannot claim without that bot's token. Any other PATCH
  into `Approved` is refused (403). A PUT re-sends its create request, stage included, so it keeps
  the stored stage instead; re-sending the same PUT stays repeatable. Sending a memory back to
  review or retiring it stays open to anyone who may edit it.
- Only an admin, a bot, or a bot writing for a user adds disputes, on create or update (403
  otherwise). Disputes open the conflict review, and that review is assigned to the owners of both
  sides, so anyone else could open a review over their own memory and approve it there. Collate's
  reconciliation writes disputes as its bot, or as a restricted memory's owner with the bot
  impersonating them.
- Who is affected:
  - unaffected: extraction (written as the admin account), Collate's reconciliation and governance
    bots, evidence holds, and capture or `upsertMemory`, which ask for `Unprocessed` and never
    patch the stage or disputes;
  - changed: an owner can no longer restore their own retired memory to `Approved`. They send it
    back to review (`Unprocessed`), or an admin restores it.

## Amendment — 2026-11-05: OSS publishes immediately and Collate requires review

ADR:2026-11-05-oss-memories-are-approved-without-reconciliation limits the November 3 creation and
approval rules to distributions that require review. OSS defaults new memories to Approved and
allows authorized owners to approve or restore their memories. Collate opts into the pending
creation and privileged approval rules through its repository extension, independently of app
availability. Ownership, reference visibility, extraction provenance, and dispute restrictions
remain common to both distributions.
