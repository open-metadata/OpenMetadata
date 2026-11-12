# The Add-agent button shows for service-level creators, not only for global ingestionPipeline Create

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Reverse Metadata QA follow-up
- **Guard:** `AgentPermissionUtils` unit tests (`canAddAgent`) and the `Ingestion` / `MetadataAgentsWidget` Add-button tests
- **Related:** `src/utils/AgentPermissionUtils.ts`

## Context
The agents Add button was gated on the global `ingestionPipeline` Create permission alone. QA found
users who may edit or create on the parent service, and can therefore manage its agents, could not
see Add. Collate's AI mode already gates its Add on the service permission, so the two diverged.

## Decision
The Add-agent affordance shows when the user has Create or EditAll on the parent service, or the
global `ingestionPipeline` Create. The server's ingestionPipeline create authorization remains
authoritative, so a service-only grant may still be refused.

## Consequences
Authorized service editors can reach the Add flow and match AI mode. The trade-off is that a user
holding only a service-level grant may press Add and receive a 403 from the server; the UI does not
try to predict the server's decision. Revisit if the server starts authorizing agent creation
against the service, at which point the global flag can be dropped from the check.
