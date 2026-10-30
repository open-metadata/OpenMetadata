# The confidential OIDC callback takes only the authorization code

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** `AuthenticationCodeFlowHandlerTest` (`buildCredentials_keepsOnlyTheAuthorizationCode`
  and the code-less callback tests), `TestLoginOidcHandlerTest.aCallbackWithoutACodeFailsTokenValidation`
- **Related:** #35679

## Context

The confidential client asks the provider to redirect back in query mode (`response_mode=query`).
In that mode a provider returns an authorization code and never a token. The identity a sign-in
resolves to is read from an ID token, so where that token comes from decides who signs in. #35679
refused a callback without a code for code-flow response types, but the callback still copied any
ID token and access token present in the redirect itself.

## Decision

- The callback's credentials hold the authorization code and nothing else from the redirect.
- A callback without a code is refused with 400, whatever response type is configured.
- The ID token, and with it the signed-in identity, is the one the provider's token endpoint
  returns for that code.
- Test Login follows the same rule, so a configuration it passes is one the live sign-in accepts.

## Consequences

- A confidential client configured with an implicit response type (`id_token`, `token id_token`)
  cannot sign in. Standard providers already refuse to put tokens in a query-mode redirect, so such a
  configuration had no working sign-in to lose.
- Hybrid response types still sign in: the code is redeemed, and the redirect's own ID token is
  ignored in favour of the token endpoint's.
