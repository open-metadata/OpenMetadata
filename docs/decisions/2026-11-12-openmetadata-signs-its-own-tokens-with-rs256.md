# OpenMetadata signs its own tokens with RS256, whatever the identity provider uses

- **Status:** Accepted
- **Revisions:** v1 2026-11-12 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `SsoOidcPublicBearerIT` (OP-13), `JwtFilterTest`, `JWTTokenGeneratorTest`
- **Related:** 2.1.0 release testing, SSO row

## Context
`authenticationConfiguration.tokenValidationAlgorithm` names the algorithm of the identity
provider's tokens. The server also used it to sign and verify the tokens it issues itself with its
RSA key: bot tokens, personal access tokens, session tokens and MCP access tokens. Setting it to
RS512 for a provider that signs with RS512 made every token the server had issued fail
verification at once, the administrator's included, and an EC value left the server unable to
issue tokens at all.

## Decision
- Tokens signed with the server's own key (`jwtTokenConfiguration`, recognised by its key id) are
  signed with RS256 (`JWTTokenGenerator.SIGNING_ALGORITHM`).
- They are verified with the RSA algorithm their header names, limited to RS256, RS384 and RS512,
  so tokens issued by earlier releases under another setting keep working. Any other algorithm on
  a token carrying the server's key id is refused.
- `tokenValidationAlgorithm` applies only to the identity provider's tokens.
- The MCP OpenID discovery document advertises RS256 for the tokens the server issues.

## Consequences
Changing the provider algorithm no longer signs anyone out or breaks bots. The server's tokens
stay RS256 until a change to its own key type, which would need its own record.
