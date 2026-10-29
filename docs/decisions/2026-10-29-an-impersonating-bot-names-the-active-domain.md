# A bot impersonating a user names the request's active domain in `X-OpenMetadata-Domain`

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `BotImpersonationIT.test_domainHeader_scopesImpersonatedListsOnly`,
  `ActiveDomainContextTest`
- **Related:** open-metadata/openmetadata-collate#7980,
  ADR:openmetadata-collate/2026-10-29-the-active-domain-scopes-every-agent-read,
  ADR:ai-platform/2026-10-29-the-active-domain-scopes-every-agent-read

## Context

Lists narrow to the caller's navbar domain through `CatalogSecurityContext.activeDomain()`, which
`JwtFilter` resolves from the user's persisted `defaultDomain`. Bot tokens and personal access
tokens deliberately carry no active domain: the selection is a UI view preference, and scripts,
ingestion and SDK calls must keep listing the whole catalog.

That rule also covered bots impersonating a user, which is how an AI agent run reads on a user's
behalf. Most list endpoints (`/v1/tables` and the other `EntityResource` lists) declare no `domain`
parameter, so the agent had no way to scope them: a user whose selected domain holds two tables
was told the catalog had 424.

## Decision

- `JwtFilter` reads `X-OpenMetadata-Domain` **only when a bot impersonates a user** (a valid
  `X-Impersonate-User`). The value becomes the request's active domain, and lists narrow exactly
  as they do for that user in the UI: the domain and its sub-domains, never past a domain-only
  role's own domains.
- The value is the domain's fully qualified name, percent-encoded as UTF-8 (RFC 3986). Only
  percent-escapes are decoded: `+` is a literal character, not a space.
- A name that does not resolve to a non-deleted domain fails the request with 400. The caller asked
  for a scope; an unscoped answer is the failure this header exists to prevent.
- Without the header, an impersonated request still carries no active domain. Plain bots, personal
  access tokens and user tokens ignore the header; user tokens keep resolving the persisted
  selection.
- The bot names the domain rather than the server re-reading the user's persisted selection, so
  one agent run keeps the scope it started with even if the user switches domains mid-run.

## Consequences

- An agent caller (ai-platform) sends the run's domain on every impersonated request; lists,
  counts and search all narrow consistently.
- The active domain stays a view filter: naming a domain never grants access to anything the
  impersonated user could not already read.
- The header name and encoding are a contract with ai-platform. Changing either, or honoring the
  header for non-impersonated bots, supersedes this record.
