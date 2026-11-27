# Principal claim mappings preserve namespaced claim names

- **Status:** Accepted
- **Revisions:** v1 2026-11-20 (initial)
- **Deciders:** OpenMetadata maintainers (PR review)
- **Guard:** `PrincipalClaimMappingSchemaTest`, `SecurityUtil.buildPrincipalClaimsMapping`
- **Related:** #37056, #38219, #38302

## Context
Identity providers can name claims with URIs or OIDs containing colons, dots and slashes.
The previous schema pattern rejected these names even though the server preserves them.

## Decision
A `jwtPrincipalClaimsMapping` entry is `username:` or `email:` followed by a nonempty,
non-whitespace claim name. Claim names may contain colons, including URI and OID namespaces.
The server splits each entry on the first colon only; everything after it is the claim name.
The source JSON schema and UI schema use `^(username|email):[^\\s]+$` as the JSON-escaped
pattern. Generated clients carry the same field contract. This does not relax the existing
requirement to supply both username and email mappings when mappings are configured.

## Consequences
Namespaced provider claims can be configured without truncation or provider-specific rewriting.
Whitespace and empty claim names remain invalid. Legacy simple claim names remain valid.
Any future parsing or schema change must preserve the complete claim name after the first colon.
