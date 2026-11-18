# Workflow node factories are discovered from the classpath

- **Status:** Accepted
- **Revisions:** v1 2026-11-18 (initial)
- **Deciders:** Ram Narayan Balaji
- **Guard:** `NodeFactoryRegistryTest` (discovery, broken providers skipped); in Collate, the test
  that builds `DataAccessRequestTaskWorkflow` and `AutoPilotWorkflow` from the discovered provider
- **Related:** #36979, #36987

## Context

Some node subtypes are defined in the OpenMetadata schema but implemented by a distribution, today
`policyAgentTask` and `createAndRunAIAutomationTask` in Collate. `NodeFactory` builds them through
`NodeFactoryRegistry`, which the distribution filled by calling `register` from its server startup.

`migrate` runs in its own process and never runs that startup, so the registry was empty there. The
2.0.8 data migration redeploys every governance workflow, and on Collate clusters the two workflows
that hold those nodes failed to build: `Redeployed 24 of 26 governance workflow definition(s)`. Any
migration that builds a workflow had the same gap, and the only alternative was a second, Collate
copy of each such migration.

## Decision

A distribution implements `NodeFactoryProvider` and lists it in
`META-INF/services/org.openmetadata.service.governance.workflows.elements.NodeFactoryProvider`.
`NodeFactoryRegistry` registers the factories of every listed provider when it is created, so any
process with the distribution's jar on the classpath builds its nodes, whichever entry point
started it.

- A provider only returns its factories; it never calls `NodeFactoryRegistry.getInstance()`, which
  is still being created when the provider is asked.
- A provider that cannot be loaded, created or asked is logged and skipped. The built-in nodes and
  the other providers still build.
- Discovery stops after 100 failed registrations (`MAX_DISCOVERY_ERRORS`), because
  `ServiceLoader`'s iterator throws instead of skipping one and does not promise the next call
  advances. Providers listed after the cap are not registered, and the stop is logged as an error.
  The value only bounds a loop at startup; a classpath has a handful of providers.
- `register` stays public. Code that registers explicitly keeps working, and the last registration
  for a subtype wins.

## Consequences

A migration in OpenMetadata that builds or redeploys workflows builds the distribution's nodes too,
with no matching migration in the distribution. A distribution's migration is still needed when it
changes the definition of a workflow only it ships, since OpenMetadata does not know it.

This covers node factories only. Sink providers (`SinkProviderRegistry`) are still registered by
the distribution's server startup, and building a workflow reads them to exclude the entity types a
sink cannot sync. Under `migrate` that registry is empty, so a workflow whose sink is implemented
by the distribution deploys without those exclusions until it is saved again.

A distribution that also registers explicitly at server startup hides a missing or misnamed
services file there; it surfaces only in a process without that startup, such as `migrate`, when an
affected workflow is built. The distribution's test of its provider listing is what catches it.
