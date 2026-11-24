# Downstream context extensions reuse OpenMetadata's rule and execution paths

- **Status:** Accepted
- **Revisions:** v1 2026-11-24 (initial)
- **Deciders:** Pere Miquel Brull
- **Guard:** `ContextRuleEditor.test.tsx`, `ContextRuleCard.test.tsx`, `RdfToolExtensionTest`, `PersonaContextAccessTest`, `PersonaAIContextIT`

## Context

Collate authors company and persona context rules separately, projects the merged definition onto a
persona, and provides company context to callers without a persona. Its UI and MCP tools share
OpenMetadata's rule model and RDF checks.

## Decision

- Context rule components use the generated persona rule and section types. An editor can supply
  its preview operation for both live preview and submit validation. Card renderers can present
  version values, queries, badges, and authorized actions using the same delete confirmation.
- RDF tool subclasses can inject the repository and readiness resolver, receive the caller's
  authorizer, and reuse the grant, readiness, and admission checks. Composed tools supply their
  own write limits alongside their write operations.
- A server can register a shared persona context at startup for callers with no active persona.
  The supplier uses a stable cache identity distinct from stored personas. The existing endpoint
  resolves the authenticated caller first and applies caller visibility, refresh authorization,
  formatting, and cache policy. A missing context yields the existing 404.
- `PersonaRepository.patchProjectedContext` applies server-generated definitions through the
  normal persona PATCH pipeline with a 50-rule ceiling, allowing two authored sets of 25 rules.
  The allowance is scoped to the target persona during that call. Authored lists retain the
  25-rule limit. Edits can carry forward an existing projected list verbatim.

## Consequences

Downstream code owns harness policy and presentation. OpenMetadata owns rule validation,
authorization, materialization, and tool execution guards.
