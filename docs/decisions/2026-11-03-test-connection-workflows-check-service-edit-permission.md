# Test-connection workflows require service edit permission to use a registered connection

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `WorkflowResourceIT#testConnectionCreateRequiresServiceEdit`, `WorkflowResourceIT#testConnectionServiceOwnerCanReuseSecrets`, `ConnectionSecretsGuardTest`
- **Related:** [PR #36918](https://github.com/open-metadata/OpenMetadata/pull/36918),
  ADR:2026-10-26-service-connection-visibility-follows-edit-permission,
  ADR:2026-10-24-a-masked-connection-secret-is-kept-only-while-the-endpoint-is-unchanged

## Context

Test-connection workflow creation supports both registered services and services being configured.
The UI and SDK may submit a complete connection or retain masked fields from an existing service.
Workflow creation permission and permission to use a registered service's connection are separate
contracts and must be evaluated consistently by POST and PUT.

## Decision

- A POST or PUT that creates a `TEST_CONNECTION` workflow using a registered service's stored
  connection requires `EditAll` on that service before the connection is copied into the workflow.
  Resolve `serviceName` through the repository for the requested service type and authorize using
  the resolved service's canonical entity type and ID.
- This check applies whenever the named service exists and has a stored connection, including
  when the caller supplies fully specified credentials rather than masked fields. Workflow or
  ingestion-pipeline `Create` permission alone does not satisfy the service permission check.
- An unregistered service name with a caller-supplied connection requires workflow `Create`
  permission for creation; there is no registered service on which to require `EditAll`. Normal
  request validation still applies.
- The service permission check is additional to the endpoint-retarget guard described in
  ADR:2026-10-24-a-masked-connection-secret-is-kept-only-while-the-endpoint-is-unchanged. Passing
  `EditAll` does not replace that guard. Its existing conditions and admin/bot exceptions continue
  to apply.
- Workflow triggering has its own authorization. These creation rules do not grant permission
  to trigger a stored workflow.

## Consequences

UI and SDK callers must use service `EditAll` permission when enabling tests of registered service
connections, including requests that supply complete credentials. New-service setup can continue
to create workflows with caller-supplied connection details and workflow `Create` permission.

Existing-workflow updates that retain their execution inputs continue to use their existing update
permissions; status or result updates do not acquire a different service connection.
