# An ANY-mode authorization refuses when any requested resource is explicitly denied

- **Status:** Accepted
- **Revisions:** v1 2026-10-24 (initial)
- **Deciders:** backend security
- **Guard:** `DefaultAuthorizerTest.authorizeRequestsAnyRefusesWhenOneRequestIsDenied`
- **Related:** open-metadata/openmetadata-collate#7797

## Context

`Authorizer.authorizeRequests(..., AuthorizationLogic.ANY)` lets a caller through when any one of
several `AuthRequest`s is allowed — used where a resource can be reached by more than one permission
(listing a query checks `ViewBasic` on the query and `ViewQueries` on its parent table). A `Deny`
rule threw the same `AuthorizationException` as "no rule allowed it", so a Deny on one request was
indistinguishable from a plain miss and was overridden as soon as another request allowed access.

## Decision

- `CompiledRule.evaluateDenyRule` throws `PolicyDeniedException` (a subclass of
  `AuthorizationException`) when a Deny rule matches, distinct from the "not allowed" case.
- In `ANY` mode the authorizer evaluates **every** request, not stopping at the first allow. If any
  request raised `PolicyDeniedException`, the whole request is refused with it; otherwise one allow
  is enough. A plain "not allowed" is still skipped.
- The outcome does not depend on request order: `[allowed, denied]` and `[denied, allowed]` both
  refuse.

## Consequences

- A new `ANY` call site inherits deny-precedence for free; no call site should catch
  `PolicyDeniedException` and continue.
- `ANY` now always evaluates all requests (it no longer short-circuits on the first allow), a small
  cost paid for order-independence.
