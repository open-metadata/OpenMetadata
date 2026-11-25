# Downstream context extensions reuse OpenMetadata's rule and execution paths

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `RdfToolExtensionTest`, `PersonaContextAccessTest`, `PersonaContextDefinitionValidationTest`, `PersonaAIContextIT`

## Context

Collate authors company and persona context rules separately, projects the merged definition onto a
persona, and provides company context to callers without a persona. Its MCP tools share
OpenMetadata's rule model and RDF checks.

## Decision

- RDF tool subclasses can inject the repository and readiness resolver, receive the caller's
  authorizer, and reuse the grant, readiness, and admission checks. Composed tools enforce their
  own write limits. Collate injects those limits through the composed tool's constructor.
- Servers can register a shared context at startup through `PersonaContextAccess`. REST and MCP
  use it when the authenticated caller has no active persona, and MCP search uses its search
  scope. The supplier uses a stable cache identity distinct from stored personas. Each path
  applies its existing visibility, refresh authorization, formatting, and cache rules.
- `PersonaRepository.patchProjectedContext` applies server-generated definitions through the
  normal persona PATCH pipeline with a 50-rule ceiling, allowing two authored sets of 25 rules.
  The schema accepts up to 50 rules, and the repository caps authored lists at 25. Generic PUT
  and PATCH can carry forward an existing projected list verbatim. A projection that changes
  the persona version records an `entityUpdated` event.

## Consequences

Downstream code owns harness policy and its UI, since OpenMetadata keeps only UI it uses itself. OpenMetadata owns rule validation,
authorization, materialization, and tool execution guards.
