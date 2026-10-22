# Identity-provider key sets are fetched with timeouts and a rate limit

- **Status:** Accepted
- **Revisions:** v1 2026-10-20 (initial)
- **Deciders:** Mohit Yadav
- **Guard:** `IdentityProviderKeysTest` (`madeUpKeyIdsCannotFetchTheKeySetBeyondItsBudget`,
  `discoveredKeySetKeepsItsBudgetAcrossLookups`,
  `keyThePublishedSetCarriesResolvesAfterMadeUpKeyIdsSpentTheBudget`,
  `keyDroppedFromTheSetStopsResolvingADayAfterTheLastFetchThatCarriedIt`,
  `keySetThatNeverAnswersFailsTheLookupAtTheReadTimeout`); `FetchBudgetTest`;
  `MultiUrlJwkProviderTest` (`tokenWithoutAKeyIdIsUnauthenticatedRatherThanAServerError`);
  `IdTokenValidatorTest` (`madeUpKeyIdsCannotFetchTheKeySetBeyondItsBudget`);
  `SsoOidcPublicBearerIT` (OP-08, OP-11, OP-15)
- **Related:** EPIC #34298

## Context
`JwtFilter` verifies an identity provider's token with the key its `kid` names, before checking the
signature. MCP's sign-in (`IdTokenValidator`) does the same for the ID token it receives. Both cached
keys by `kid`, and on a miss downloaded the configured key sets (`publicKeyUrls`, plus the discovery
`jwks_uri` of a confidential client) until one held the key.

The downloads had no timeouts and no limit. A key set that accepted the connection and never
answered held every request carrying a new `kid` until the client gave up, which exhausts request
threads during a provider's key rotation. Any caller could also send tokens with made-up key ids,
and each one downloaded every key set again: 25 such requests made 25 downloads. A token naming no
key at all reached the cache's null check and became a 500.

## Decision
- `IdentityProviderKeys` is the one lookup of an identity provider's keys. `JwtFilter` uses it
  through `MultiUrlJwkProvider`, after OpenMetadata's own key; MCP's `IdTokenValidator` uses it
  directly.
- Each key-set URL is fetched with a 5-second connect timeout and a 5-second read timeout.
- Each fetch caches every key of the set it downloads, not only the key it was made for, in a cache
  of at most 100 keys. A key stays usable for a fixed lifetime after the last fetch that carried it:
  a day for `JwtFilter` and six hours for MCP, the lifetimes each had before.
- Fetches per URL are rate limited to a burst of 10, then one fetch every 6 seconds
  (`KeySetFetchPolicy.DEFAULT`, enforced by `FetchBudget`). A miss beyond the limit fails like an
  unknown key: 401 `Token signing key not found`.
- Concurrent requests for the same key id share one load, so the requests that arrive with a newly
  rotated key cost one fetch. A resolved key is reused for at most a minute before the lookup reads
  the cache again, so the lifetime above is counted once.
- Every lookup keeps its own budgets, one per URL, for its life: the REST filter, the WebSocket
  filter, MCP's filters and MCP's ID-token validator. Applying the security configuration rebuilds
  the filters, and with them their budgets.
- A token without a `kid` is refused with 401 before any download.

## Consequences
A request can no longer wait longer than the timeouts on a key set. Made-up key ids cost at most ten
downloads a minute per URL after the first burst, for each lookup; a caller who sends them to every
entry point (REST, WebSocket, MCP) gets that many times as much on each pod. Because every allowed
fetch caches the whole set, a fetch triggered by a made-up key id also picks up a key the provider
has just rotated in, so under a sustained flood of made-up key ids a token signed with the new key
waits at most one refill interval (6 seconds) before it is accepted.

A key the provider drops stays usable until its lifetime runs out after the last fetch that carried
it, and a fetch a made-up key id triggered counts as such a fetch.

Raise the limit only with a measurement showing a provider whose key sets change faster than once
every 6 seconds.
