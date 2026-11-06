# OSS memories are approved without reconciliation

- **Status:** Accepted
- **Revisions:** v1 2026-11-05 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextMemoryRepositoryTest`, `ContextMemoryCreateGrantIT`,
  `ContextMemoryLifecycleIT`; Collate's `ContextMemoryRepositoryExtTest`,
  `ContextMemoryLifecycleIT`, and `CaipAiProviderTest`
- **Related:** ADR:2026-10-09-data-consumers-create-context-memories

## Context

OSS has no Memory Reconciliation application and no general approval action in the memory editor.
Starting every memory Unprocessed leaves ordinary users' contributions awaiting a reviewer that
OSS does not provide. Collate has reconciliation and requires review before publication.

## Decision

- The OSS `ContextMemoryRepository` defaults new memories to Approved. It preserves an explicitly
  requested stage and lets an authorized owner approve or restore their own memory.
- A distribution that requires review selects the protected repository constructor with
  `reviewRequired=true`. The same choice sets the default to Unprocessed, forces ordinary users'
  creates to Unprocessed, refuses their direct PATCH into Approved, and preserves the stored stage
  when their PUT would approve it. Admins, bots, and conflict-review decisions retain approval rights.
- Collate selects that policy through its repository extension. Its extraction provider also starts
  memories Unprocessed, including when extraction uses the built-in fallback or the AI platform is
  disabled. The policy does not depend on the reconciliation application's runtime state.
- Both policies retain ownership, visibility, extraction-provenance, dispute, and evidence checks.
  A server evidence hold can still place a newly created memory in Draft.
- This changes creation and authorized transitions. It does not rewrite existing memory states.

## Consequences

An OSS memory is usable immediately according to its visibility rules. Approved indicates
availability, without claiming that a person or an AI checked the fact. OSS can still store an
explicit Draft or Unprocessed memory, and its authorized owner can approve it through the API.

Collate keeps pending memories through app suspension and AI outages. Reconciliation or an
authorized approval is required before those memories become generally available.
