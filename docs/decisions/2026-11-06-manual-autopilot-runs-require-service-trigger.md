# Manual AutoPilot runs require application and service Trigger

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `AppsResourceIT#test_autopilotTriggerRequiresTriggerOnEffectiveService`, `AppsResourceIT#test_autopilotRequiresBothTriggerPermissions`, `PermissionsResourceIT#testServiceResourcesExposeTrigger`

## Context

Operators need to run AutoPilot without receiving permission to edit service information.
AutoPilot manages ingestion agents for a service selected by the effective `entityLink`.

## Decision

Manual AutoPilot runs require `Trigger` on the application and, for active runs, `Trigger` on
the target service. Service `Trigger` authorizes the complete AutoPilot operation, including
creating, deploying, and running its ingestion agents. Service `EditAll` does not substitute
for `Trigger`, and is not required to run AutoPilot.

Native applications declare runtime parameters through `getRuntimeTriggerParameters()` and
prepare a run through `prepareTrigger()`. The prepared `AppTrigger` carries authorization requests
and the action using the validated target; the REST resource authorizes the requests before
dispatch. AutoPilot subclasses inherit this preparation, and direct triggers share its validation.
Stored configuration is overlaid with the request payload. Only `entityLink` is an AutoPilot
runtime parameter; changing other configured values requires application `EditAll`.

Service resources expose `Trigger` through their permission descriptors. The service page shows
the AutoPilot button when both Trigger permissions are allowed. Application configuration
overrides still require application `EditAll`; an already-inactive run remains a no-op without
a target-service permission check. After service creation, the UI requests a normal manual run
as the creator. The creator satisfies the service check through ownership under the default
organization policy, and still needs application `Trigger`.

## Consequences

Roles can delegate AutoPilot execution separately from editing service information. The default
Data Steward policy grants `Trigger` on all resources, so it permits AutoPilot across services.
Owners retain access through the organization policy's `All` grant. Custom roles used for AutoPilot
need application `Trigger` and a target-service `Trigger` grant when ownership does not provide it.
Existing ingestion-pipeline runs continue to check `Trigger` on the pipeline itself. No new metadata
operation or schema migration is needed.
