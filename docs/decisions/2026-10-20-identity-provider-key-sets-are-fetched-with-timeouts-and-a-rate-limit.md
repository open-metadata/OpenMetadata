# Identity-provider key sets are fetched with timeouts and a rate limit

- **Status:** Accepted
- **Revisions:** v1 2026-10-20 (initial) · v2 2026-10-22 (each key set cached whole and asked in
  configured order; failed sets skipped)
- **Deciders:** Mohit Yadav
- **Guard:** `IdentityProviderKeysTest` (`madeUpKeyIdsCannotFetchTheKeySetBeyondItsBudget`,
  `discoveredKeySetKeepsItsBudgetAcrossLookups`,
  `keyIdTwoKeySetsPublishResolvesToTheFirstConfiguredSet`,
  `firstConfiguredSetWinsOnceItRecoversFromAFailedDownload`,
  `firstConfiguredSetWinsAfterItsCachedCopyExpiresBeforeTheSecondSets`,
  `firstConfiguredSetWinsAfterADownloadFailedWhileItWasCached`,
  `laterSetsCachedCopyAnswersWhenTheEarlierSetIsDownloadedAgain`,
  `keyThePublishedSetCarriesResolvesAfterMadeUpKeyIdsSpentTheBudget`,
  `keyDroppedFromTheSetStopsResolvingOnceADownloadNoLongerCarriesIt`,
  `downloadedKeySetIsUsedForItsLifetimeThenDownloadedAgain`,
  `keyOfASetLargerThanTheCacheIsReadFromItsDownload`,
  `keySetOfSeveralHundredKeysIsCachedWhole`,
  `failingKeySetIsNotDownloadedAgainByLookupsTheCacheAnswers`,
  `hangingKeySetDoesNotHoldUpLookupsTheCacheAnswers`,
  `keySetThatAnswersWithNoKeysKeepsItsCachedKeys`,
  `keyIdRepeatedInOneSetResolvesToItsFirstEntry`,
  `keySetThatNeverAnswersFailsTheLookupAtTheReadTimeout`); `FetchBudgetTest`;
  `MultiUrlJwkProviderTest` (`tokenWithoutAKeyIdIsUnauthenticatedRatherThanAServerError`);
  `IdTokenValidatorTest` (`madeUpKeyIdsCannotFetchTheKeySetBeyondItsBudget`);
  `SsoOidcPublicBearerIT` (OP-08, OP-11, OP-15)
- **Related:** EPIC #34298; #35894 (v1), its review threads (v2)

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

## Amendment — 2026-10-22: cache each key set whole and ask the sets in order

Review of #35894 found two flaws in v1's cache of keys by key id alone. When two key sets published
the same id with different keys, a download of the later set, even one a made-up id triggered,
replaced the earlier set's key, and tokens signed with it were refused. And a download read the key
it was made for back from the 100-key cache, which a large set could already have evicted.

These rules replace v1's bullet on what a fetch caches, and the Consequences paragraph on dropped
keys:
- Each download of a key set is cached whole, under the set's URL, and replaces that set's previous
  download. A cached download lives for the lifetimes v1 set: a day for `JwtFilter`, six hours for
  MCP. The cache holds at most 1,000 keys across sets, and a key is always read from the download
  that found it, so a set larger than the cache still verifies its tokens.
- Sets are asked in configured order, so when two sets publish the same key id the first one wins,
  as it did before v1. Cached downloads answer only up to the first set with no cached download.
  Otherwise the sets are asked in order from the first: a set whose cached download holds the id
  answers, and every other set is downloaded, because the id may have just been rotated into it.
  When one set lists an id twice, its first entry counts.
- A set whose download fails (an error, a timeout, or an answer with no keys) keeps its cached copy.
  A set that fails with no cached copy is skipped by cached lookups until a lookup of an id no set
  holds downloads it again, or a key lifetime passes; asking it on every lookup would hold requests
  up for its timeouts each time a resolved key is looked up again. A set that fails while it has a
  cached copy is not marked, because the mark would outlive the copy. A refusal by the rate limit is
  not a failure.

Consequences: a key the provider drops stops verifying when its set is next downloaded, which any
unknown key id triggers within the rate limit, and at the latest one lifetime after the last
download that carried it. An answer with no keys counts as a failed download, so one empty answer
cannot refuse every token; the set's cached keys keep verifying until their lifetime ends. While a
set that failed with no cached copy is skipped, an id it shares with a later set resolves to the
later set's key. An unreachable set listed first holds a request up for its timeouts about once a
lifetime, as it did before v1.
