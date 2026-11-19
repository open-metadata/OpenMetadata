# An OpenMetadata token resolves to the account it names, and the authorizer uses that name whole

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `JwtFilterTest.anOpenMetadataTokenResolvesToTheAccountItNames`,
  `SecurityUtilTest.testGetUserNameIsTheWholePrincipalName`,
  `DefaultAuthorizerTest.aUserWhoseNameStartsWithAnotherUsersNameIsAuthorizedAsItself`,
  `UserResourceIT.test_userNamedLikeTheAdminWithASlash_cannotMakeItselfAdmin`
- **Related:** open-metadata/openmetadata-collate#8018

## Context
`jwtPrincipalClaims` describes the identity provider's tokens, and it was applied to OpenMetadata's
own tokens as well. Under the default order the email claim comes first,
so the user name was the email's local part. An account's name is not always that local part:
sign-up and provisioning add a suffix when the local part is taken. Separately,
`SecurityUtil.getUserName` cut the principal at the first `/` or `@`, so the subject the authorizer
loaded could differ from the principal `JwtFilter` built.

## Decision
- A token verified against OpenMetadata's own signing key, on a request or a WebSocket connection,
  resolves to `JWTTokenGenerator.mintedUserName`: `sub`, or `username` when `sub` carries the email, lowercased
  like the claim-order result. A token with neither falls back to the configured principal claims.
  Provider tokens keep the configured claims.
- The authorizer uses the principal name exactly as the authentication filter built it.

## Consequences
Every authentication filter must build the principal from the account name, as `JwtFilter`,
`NoopFilter` and the test-only OpenID header filter do. A user whose name contains `/` or `@` is
authorized as that user.
