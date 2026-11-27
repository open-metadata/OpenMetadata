# The confidential OIDC callback takes only the authorization code

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `AuthenticationCodeFlowHandlerTest`, `TestLoginOidcHandlerTest`
- **Related:** #35679

## Context

The confidential client signs users in with the authorization-code flow and asks the provider to
redirect back in query mode (`response_mode=query`), where a provider returns an authorization code.

## Decision

- From the callback redirect, only the authorization code is used.
- A callback without a code is refused with 400, whatever response type is configured.
- The signed-in identity comes from the ID token the provider's token endpoint returns for that code.
- Test Login follows the same rule, so a configuration it passes is one the live sign-in accepts.

## Consequences

- A confidential client configured with an implicit response type (`id_token`, `token id_token`)
  cannot sign in; providers do not return tokens in a query-mode redirect.
- Hybrid response types sign in through the code, with the ID token from the token endpoint.
