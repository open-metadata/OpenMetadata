# Manual AutoPilot runs require application Trigger and target-service EditAll

- **Status:** Accepted
- **Revisions:** v1 2026-10-27 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `AppsResourceIT#test_autopilotTriggerRequiresEditAllOnEffectiveService`, `AppsResourceIT#test_autopilotInactiveDoesNotRequireTarget`, `AppsResourceIT#test_autopilotInvalidPayloadDoesNotStartWorkflow`
- **Related:** [PR #36356](https://github.com/open-metadata/OpenMetadata/pull/36356)

## Context

A manual AutoPilot run can create, deploy, and run ingestion agents for a service selected by
`entityLink`. Application `Trigger` permission alone does not express whether the caller can
manage that service. The target can come from stored configuration or a request override.

## Decision

`POST /api/v1/apps/trigger/AutoPilotApplication` requires `Trigger` on the application. For an active
run it also requires `EditAll` on the service named by the effective `entityLink`, before workflow
dispatch. Effective configuration is stored configuration overlaid with the request payload;
authorization and execution use the same merge.

Use service `EditAll` because AutoPilot manages agents across creation, deployment, and execution.
Service `Trigger` or pipeline creation permission alone does not cover that combined operation.
The check applies whether agents already exist or must be created.

A null `active` is invalid and returns HTTP 400. An active run requires a service entity link;
missing, null, empty, or malformed links return HTTP 400. An inactive run remains a no-op and
requires no target, while retaining the application `Trigger` check. Automatic service-event
workflows retain their existing automation identity and do not use this manual-request check.

## Consequences

Callers who can trigger the application must also be allowed to manage the selected service for
active runs. Clients should distinguish application permission from target-service permission;
showing the trigger button based only on application permission can still lead to HTTP 403.
No new permission operation or schema migration is needed. Revisiting the `EditAll` requirement
would require a permission that covers the complete agent-management operation.
