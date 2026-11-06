# Manual AutoPilot runs require application and service Trigger

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `AppsResourceIT#test_autopilotTriggerRequiresTriggerOnEffectiveService`, `AppsResourceIT#test_autopilotRequiresBothTriggerPermissions`, `PermissionsResourceIT#testServiceResourcesExposeTrigger`
- **Related:** ADR:2026-10-27-manual-autopilot-runs-require-service-edit-permission

## Context

Operators need to run AutoPilot without receiving permission to edit service information.
AutoPilot manages ingestion agents for a service selected by the effective `entityLink`.

## Decision

Manual AutoPilot runs require `Trigger` on the application and, for active runs, `Trigger` on
the target service. Service `Trigger` authorizes the complete AutoPilot operation, including
creating, deploying, and running its ingestion agents. Service `EditAll` does not substitute
for `Trigger`, and is not required to run AutoPilot.

Service resources expose `Trigger` through their permission descriptors. The service page shows
the AutoPilot button when both Trigger permissions are allowed. Application configuration
overrides still require application `EditAll`; an already-inactive run remains a no-op without
a target-service permission check. Automatic service-event workflows retain their existing path.

## Consequences

Roles can delegate AutoPilot execution separately from editing service information. The default
Data Steward policy grants `Trigger` on all resources, so it permits AutoPilot across services.
Owners retain access through the organization policy's `All` grant. Custom roles with only service
`EditAll` need an additional `Trigger` grant. Existing ingestion-pipeline runs continue to check
`Trigger` on the pipeline itself. No new metadata operation or schema migration is needed.
