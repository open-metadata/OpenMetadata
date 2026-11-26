# An OpenMetadata token resolves to the account it names, and the authorizer uses that name whole

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial) · v2 2026-11-18 (a bot token's email under a claims
  mapping, #38081)
- **Deciders:** Mohit Yadav
- **Guard:** `JwtIdentityResolverTest` (`testInternalToken*`),
  `JWTTokenGeneratorTest.defaultClaimOrderPreservesStoredUsername`,
  `SecurityUtilTest.testGetUserNameIsTheWholePrincipalName`,
  `DefaultAuthorizerTest.aUserWhoseNameStartsWithAnotherUsersNameIsAuthorizedAsItself`,
  `EmailFirstIdentityIT`, `UserResourceIT.test_aUserIsAuthorizedAsItsWholeName_notAsTheAdmin`,
  `JwtIdentityResolverTest.testInternalBotTokenUnderMappingKeepsTheBotsStoredEmail`,
  `JWTTokenGeneratorTest.botTokenMintedUnderMappingResolvesToTheBotsStoredEmail`
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

## Amendment: a bot token's email under a claims mapping (#38081)

**Context.** Bot resolution skips `jwtPrincipalClaimsMapping` and takes the first claim in
`jwtPrincipalClaims`. In a bot token minted under a mapping that claim can hold the bare name
(`upn` under `username:upn`; `email` under `username:email`), which became
`<name>@<principalDomain>`. When the bot's stored email has another domain, the lookup failed with
"Account already exists" and a regenerated bot token stopped working.

**Decision.**
- Under a principal-claims mapping, an OpenMetadata-issued bot token resolves its email from the
  mapped `email` claim. `JWTTokenGenerator.putConfiguredPrincipalClaims` always writes the stored
  address there, after the username claim, so it wins when both map to one claim. A token whose
  mapped email claim holds no address falls back to the configured principal claims.
- Tokens of people and provider tokens are unchanged.

**Consequences.** `JwtIdentityResolver` depends on the generator writing the mapped email claim
last. `JWTTokenGeneratorTest.botTokenMintedUnderMappingResolvesToTheBotsStoredEmail` mints real
tokens under `username:upn` and `username:email`, so reordering those writes fails it.
