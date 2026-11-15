# An OpenMetadata token resolves to the account it names, and the authorizer uses that name whole

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `JwtIdentityResolverTest` (`testInternalToken*`),
  `JWTTokenGeneratorTest.defaultClaimOrderPreservesStoredUsername`,
  `SecurityUtilTest.testGetUserNameIsTheWholePrincipalName`,
  `DefaultAuthorizerTest.aUserWhoseNameStartsWithAnotherUsersNameIsAuthorizedAsItself`,
  `EmailFirstIdentityIT`, `UserResourceIT.test_aUserIsAuthorizedAsItsWholeName_notAsTheAdmin`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
`jwtPrincipalClaims` describes the identity provider's tokens. OpenMetadata mints its own tokens for
an account by name, and an account's name is not always the local part of its email: sign-up and
provisioning add a suffix when the local part is taken. So an OpenMetadata token resolves to the
account it names, and the authorizer loads the principal exactly as the authentication filter built
it.

## Decision
- On the legacy flow, a token verified against OpenMetadata's own signing key resolves to
  `JWTTokenGenerator.mintedUserName`: `sub`, or `username` when `sub` carries the email, lowercased
  like the claim-order result. A token with neither falls back to the configured principal claims.
  Provider tokens keep the configured claims.
- The authorizer uses the principal name exactly as the authentication filter built it.

## Consequences
Every authentication filter must build the principal from the account name, as `JwtFilter`,
`NoopFilter` and the test-only OpenID header filter do. A user whose name contains `/` or `@` is
authorized as that user.
