# AuthCoordinator — SSO flow validation matrix

Reference for the SPA silent-refresh path introduced by the AuthCoordinator
refactor. Cases are provider-agnostic (the coordinator owns the flow); only
the **Renewer** step differs per provider. To validate an SSO integration is
"done and dusted," walk every case below.

## Provider matrix — what each Renewer does

The `Renewer` contract (`utils/Auth/AuthCoordinator/types.ts`) is:

```ts
type Renewer = () => Promise<{ idToken: string; expiresAt: number }>;
```

Each authenticator registers its renewer from its own mount effect
(`authCoordinator.registerRenewer(getRenewer())`) — no ref indirection, no
race with the first 401.

A renewer never opens a popup: one opened from a timer or a 401 has no user
gesture and the browser blocks it. When silent renewal fails in a way a
top-level visit to the IdP could fix, the renewer throws `ReauthRequiredError`
(`utils/Auth/AuthCoordinator/ReauthRequiredError.ts`) and the authenticator's
`invokeSilentReauth` performs that visit with `prompt=none` (see case 12).

| Provider | File | Renewer call | `ReauthRequiredError` when | `invokeSilentReauth` |
|---|---|---|---|---|
| **Basic** (email/password) | `BasicAuthAuthenticator.tsx` | `getAccessTokenOnExpiry()` → backend `/auth/refresh` | never | none (no IdP session to lean on) |
| **Generic** (SAML, LDAP, confidential OIDC) | `GenericAuthenticator.tsx` | `renewToken()` → backend `/auth/refresh` | `/auth/refresh` answers 401 (OM session ended, revoked, or ended by the IdP) | `location.assign('/api/v1/auth/login?redirectUri=…/auth/callback&prompt=none')`; the server short-circuits on an active OM session, SAML ignores `prompt` |
| **OIDC (public)** | `OidcAuthenticator.tsx` | `userManager.signinSilent()` → hidden iframe | frame errors (third-party cookies blocked) or `login_required` / `interaction_required` / `consent_required` / `account_selection_required` | `clearStaleState()` + `signinRedirect({prompt:'none'})`; the `/callback` route completes it |
| **MSAL (Azure AD)** | `MsalAuthenticator.tsx` | `handleRedirectPromise()` (finishes a pending redirect first), then `acquireTokenSilent({forceRefresh:true})` | `InteractionRequiredAuthError`, or `errorCode` in `interaction_required` / `login_required` / `consent_required` / `no_account_error` / `monitor_window_timeout` / `block_iframe_reload` (Entra's fixed 24h SPA refresh-token lifetime ends here) | `acquireTokenRedirect({account, prompt:'none', redirectStartPage: location.href})`, or `loginRedirect` without a cached account |
| **Okta** | `OktaAuthenticator.tsx` | `oktaAuth.token.renewTokens()` **+ `tokenManager.setTokens(tokens)`** to keep Okta SDK cache in sync | interaction codes, `invalid_grant`, or the prompt=none iframe timing out | `signInWithRedirect({originalUri, prompt:'none'})` |
| **Auth0** | `Auth0Authenticator.tsx` | `getAccessTokenSilently()` + `getIdTokenClaims()` | interaction codes, `missing_refresh_token`, `invalid_grant`, `timeout` | `loginWithRedirect({prompt:'none', appState:{returnTo}})` |

MSAL schedules renewal off the **ID token's** `exp` (the bearer OM sees), not
the access token's `expiresOn`. The Okta `setTokens` step is required —
without it, later SDK reads see stale tokens.

## Case × behavior matrix

| # | Case | Behavior | Where |
|---|---|---|---|
| 1 | Fresh login | Provider-native login flow → callback → `handleSuccessfulLogin` → `setOidcToken` → `setIsAuthenticated(true)` → `authCoordinator.syncFromStoredToken()` arms the proactive timer. | `AuthProvider.tsx:handleSuccessfulLogin` |
| 2 | Cold-load, fresh token | `initializeAuthState` decodes stored token → `!isExpired` → `setIsAuthenticated(true)` immediately, no network call → `syncFromStoredToken()` arms the proactive timer, so the first renewal never waits for a 401. Not on a login callback route (case 3). | `useApplicationStore.ts:initializeAuthState` |
| 3 | Cold-load, expired token (Bug 1) | `initializeAuthState` sees `isExpired` → `await authCoordinator.ensureFreshToken()` **before** flipping `isAuthenticated`. If it succeeds, app renders authenticated; a `ReauthRequiredError` keeps `isAuthenticating` (the loader) up while case 12 redirects; any other failure shows `/signin`. On `/callback` and `/auth/callback` the stored token, **expired or not**, is the one a silent re-auth left behind, and the server may already have rejected it: the app renders signed out without refreshing it, so the callback mounts (Okta's, Auth0's and `/auth/callback` exist only in the signed-out routes) and stores the fresh one. **Awaits `renewerReady`** so the lazy authenticator's mount has time to register. | `useApplicationStore.ts:initializeAuthState` |
| 4 | In-session 401 | Response interceptor: `isRefreshableAuthError(401,url)` → enqueue request → `pumpQueue` → `ensureFreshToken` → drain queue with new token. First-of-cycle 401 fires `onRefreshStart` → stores redirect path. Concurrent 401s share the same `inflight` promise. | `AuthCoordinator.ts:install` |
| 5 | Proactive timer fires | `bufferMs = 60_000` before `expiresAt` → `ensureFreshToken` runs silently. Emits `refreshed` (no state change; user was already authenticated). New timer scheduled from the fresh `expiresAt`. Never runs when `expiresAt <= 0` (opaque token guard). | `ProactiveTimer.ts` |
| 6 | Tab focus, fresh token (outside 60s pre-expiry buffer) | `syncFromStoredToken` decodes stored token → not expired, plenty of headroom → **reschedules timer only, no network call**. | `AuthCoordinator.ts:syncFromStoredToken` |
| 6a | Tab focus, near-expiry (< 60s left, still valid) | Same as case 6 through the storage read → `msUntilExpiry <= EXPIRY_THRESHOLD_MILLES` → `ensureFreshToken()`. This is the proactive-refresh buffer; matches `ProactiveTimer`'s own `bufferMs`. | Same |
| 6b | Tab focus, token has no `exp` claim / opaque / non-JWT | No usable expiry to reason about → **early return, no network call**. Covers both the `isNil(exp)` branch of `extractDetailsFromToken` **and** the `jwt-decode` throws branch (which returns `{exp:0, isExpired:true}`). The invalid-`exp` guard runs BEFORE the `isExpired` branch specifically to catch opaque tokens. The next real 401 will drive the refresh. | Same |
| 7 | Tab focus, expired token | Storage → `isExpired` → `ensureFreshToken()`. Rapid re-focus during in-flight is deduped via `this.inflight`. | Same |
| 8 | Tab focus, signed out (no token) | Early return, **zero network calls**. Pinned by `AuthCoordinator.test.ts › tab visibility gating`. | Same |
| 9 | Cross-tab, both expired | Web Locks pick leader. Leader calls renewer → `setOidcToken` → `notifyDone({idToken,expiresAt})`. Follower receives `done` payload, calls `applyRefreshed` **with the leader's payload directly** (no storage re-read race). Both tabs emit `refreshed` → both flip `isAuthenticated`. | `CrossTabLock.ts` + `AuthCoordinator.ts:doRefresh` |
| 10 | Cross-tab, leader renewer throws | Leader's `runExclusive` catches → broadcasts `{type:'failed',reason}` → rethrows. Follower receives `failed` → falls through to `doLocalRefresh(renewer)` (does its own refresh). Only if the local refresh **also** fails does the follower emit `refresh-failed` and log out. | `CrossTabLock.ts:runExclusive` + `AuthCoordinator.ts:doRefresh` |
| 11 | Cross-tab, leader timeout / tab closed | Follower waits up to `DEFAULT_WAIT_TIMEOUT_MS = 10_000` for `done`/`failed`. On `LockTimeoutError` → `doLocalRefresh(renewer)`. No force-logout. | `CrossTabLock.ts:waitForMessage` |
| 12 | Refresh failure → one silent re-auth, then logout | `refresh-failed` carries `{reason, error?, source: 'renewer' \| 'follower' \| 'circuit-breaker', staleToken?}`, where `staleToken` is the token the failed refresh was meant to replace (the 401's bearer, or the stored token found expired). `AuthProvider.handleRefreshFailed`: no `invokeSilentReauth` (Basic/LDAP) → `resetUserDetails(true)` as before. Otherwise store the current path + query for the return trip, then: no stored token → sign out without the toast; storage already holds a replacement for `staleToken` (a different, unexpired token: a sibling re-authenticated while this tab's failure was in flight) → reload; `ReauthGuard.decideReauth()` says a **sibling tab** is re-authenticating → loader, wait until storage holds a replacement for `staleToken` and reload (sign out if the token is cleared or the cooldown ends); this tab's own renewer threw `ReauthRequiredError` and no attempt is on record → record the attempt, `pause()` the timer, keep the loader up, `invokeSilentReauth()` (top-level `prompt=none` redirect). Everything else — breaker trip, follower give-up with no sibling attempt, network errors, an attempt this tab already made within the cooldown, a record that cannot be persisted, a redirect that fails to start — signs out with the "session expired" toast. The first failure decides; later ones while it is being handled are ignored. | `AuthProvider.tsx:handleRefreshFailed`, `ReauthGuard.ts` |
| 13 | Post-refresh reauth (Bug 2) | User was bounced to `/signin` (`isAuthenticated=false`) by an earlier failed call. Silent refresh succeeds → `applyRefreshed` → emits `refreshed` → AuthProvider `setIsAuthenticated(true)` → router remounts authenticated. Works in both leader **and** follower tabs. | `AuthProvider.tsx:508-510` |
| 14 | Explicit logout | `onLogoutHandler` first calls `authCoordinator.pause()` so an armed timer cannot start a silent re-auth afterwards → provider-native logout (varies by SDK) → `handleSuccessfulLogout` → `resetUserDetails(false)` → `clearOidcToken` → navigate to `/signin`. | Per-authenticator `invokeLogout` |
| 16 | Silent re-auth comes back | The page reloads on the callback (`/auth/callback`, `/callback`) or, for MSAL, on the start page after `handleRedirectPromise`. The callback stores the new token → `handleSuccessfulLogin` → the stored redirect path (with its query) is restored by `PermissionProvider`. If the IdP session was dead (`login_required`), the callback's error path runs `handleFailedLogin` (clears the token, `/signin`); for confidential clients the server lands on `/signin`, where the next refresh failure finds this tab's attempt on record and signs out. | callbacks, `ReauthGuard.ts` |
| 15 | Server restart (JWT still valid client-side) | Client keeps token; next API call gets 401 → case 4. Client keys re-issued means the JWT signature check fails (`JwtFilter.java:343 "Public key mismatch"`) → refresh call may also 401 → case 12. | Server-side; JWT hardening covered by DevOps key persistence |

## Failure & recovery cheat sheet

| Scenario | Detection | Recovery | User impact |
|---|---|---|---|
| Renewer throws (network, IdP down) | Leader `runExclusive` catch | Emit `refresh-failed` → logout | Redirect to `/signin` with "session expired" toast |
| Renewer throws `ReauthRequiredError` (IdP session alive) | `refresh-failed` with `source:'renewer'` | One top-level `prompt=none` redirect | Brief loader, back on the same page; never `/signin` |
| Same, but the IdP session is dead | `login_required` on the callback, or a second failure within 3 minutes | Sign out | One redirect, then `/signin` |
| Several tabs fail at once | `om-reauth` record in localStorage | The first tab redirects; the others wait for its token and reload | Siblings show the loader until the first tab is back |
| Follower receives `failed` from leader | `outcome.message.type === 'failed'` | `doLocalRefresh(renewer)` | Silent retry; force-logout only if own refresh also fails |
| Cross-tab timeout | `LockTimeoutError` | `doLocalRefresh(renewer)` | Silent; adds ≤ 10s latency to a queued request |
| Opaque token (`expiresAt = 0`) | `ProactiveTimer.schedule` | No timer scheduled; next 401 drives refresh | Silent |
| Renewer registration race (cold-load 401 before mount) | `awaitRenewer` (5s timeout inside `ensureFreshToken`) | Waits for `renewerReady` promise | Silent; first request sees ≤ 5s of extra latency on cold-load |
| Okta SDK cache drift | Every renewer call ends with `tokenManager.setTokens(tokens)` | N/A — proactive sync | Silent |
| MSAL interaction-required | `InteractionRequiredAuthError` or an interaction `errorCode` | `ReauthRequiredError` → `acquireTokenRedirect({prompt:'none'})` | Top-level redirect, no popup |
| OIDC iframe blocked (Safari ITP) | `isFrameError(error)` inside renewer | `ReauthRequiredError` → `signinRedirect({prompt:'none'})` | Top-level redirect, no popup |

No renewer opens a popup any more: without a user gesture the browser blocks
it, which used to turn every interaction-required renewal into a sign-out.

## Coordinator invariants

These properties hold for every provider — regressing any is a P1:

1. **One refresh per cycle, per tab.** `ensureFreshToken` de-dupes via `this.inflight`.
2. **One refresh per cycle, across tabs.** Web Locks + BroadcastChannel; followers apply leader's payload.
3. **Storage persisted before broadcast.** `setOidcToken` → `notifyDone(payload)` — never inverted.
4. **Followers never force-logout on leader failure.** `failed`/timeout → local retry.
5. **Signed-out tab never hits the IdP on focus.** `getOidcToken()` empty → early return.
6. **Fresh-token tab never hits the IdP on focus.** `isExpired` false → reschedule timer only.
7. **No tight refresh loops on opaque tokens.** `ProactiveTimer` guards `expiresAt <= 0`.
8. **`isAuthenticated` flips back to true after a successful silent refresh.** `refreshed` event → `setIsAuthenticated(true)`; fires from both leader and follower paths.
9. **A failed refresh that ends in a sign-out clears storage.** `resetUserDetails` → `clearOidcToken()`.
10. **At most one silent re-auth redirect per tab per 3-minute cooldown, and one tab at a time.** The `om-reauth` localStorage record `{startedAt, tabId}` (tab id in sessionStorage, which survives the IdP round trip) turns a second failure in the same tab into a sign-out, and makes sibling tabs wait for the first tab's token instead of each starting a login (which would clobber `OM_SESSION` and fail the callback's state check). No record can be written → no redirect. A waiting tab compares storage against the token its own failed refresh was meant to replace, never against what storage holds when it handles the failure: a throttled tab can find the sibling's fresh token there already, and waiting for an even newer one would time out and sign that fresh session out for every tab. A replacement is any different, unexpired token; its `exp` may be earlier than the stale token's, because token lifetimes can change between the two (a lowered token validity, a provider policy).
11. **Only this tab's own renewer can ask for a redirect.** A tripped circuit-breaker, a follower give-up, or a network error never redirects to the IdP.

## Test coverage (Jest)

| Invariant | Test file |
|---|---|
| Single refresh per cycle (in-tab dedup) | `AuthCoordinator.test.ts › de-dupes concurrent ensureFreshToken calls` |
| `refreshed` event emitted on success | `AuthCoordinator.test.ts › emits refreshed on success` |
| `refresh-failed` emitted on renewer error | `AuthCoordinator.test.ts › emits refresh-failed and rejects on renewer error` |
| Renewer registration race safety | `AuthCoordinator.test.ts › ensureFreshToken waits for renewer registration…` |
| Signed-out tab: no refresh on focus | `AuthCoordinator.test.ts › tab visibility gating › does NOT call the renewer when storage has no token` |
| Fresh tab: no refresh on focus | `AuthCoordinator.test.ts › tab visibility gating › does NOT call the renewer when the stored token is still fresh` |
| Near-expiry: proactive refresh on focus | `AuthCoordinator.test.ts › tab visibility gating › fires the renewer when the token is within the pre-expiry buffer` |
| No-exp claim: no refresh on focus | `AuthCoordinator.test.ts › tab visibility gating › does NOT call the renewer when the token has no exp claim` |
| Opaque / undecodable token: no refresh on focus | `AuthCoordinator.test.ts › tab visibility gating › does NOT call the renewer for an opaque / undecodable token (jwt-decode threw)` |
| Rapid re-focus dedup | `AuthCoordinator.test.ts › tab visibility gating › fires exactly one renewer call…` |
| Cross-tab leader/follower with `done` payload | `CrossTabLock.test.ts › follower receives leader payload…` |
| Cross-tab `failed` broadcast | `CrossTabLock.test.ts › runExclusive broadcasts failed when the leader work throws` |
| Cross-tab timeout error | `CrossTabLock.test.ts › throws LockTimeoutError if the leader never notifies` |
| ProactiveTimer opaque-token guard | `ProactiveTimer.test.ts › does not schedule when expiresAt is 0` |
| Okta `tokenManager.setTokens` in sync | `OktaAuthenticator.test.tsx › getRenewer › should return a fresh idToken…` (asserts `setTokens` called) |
| `refresh-failed` payload carries `source`, the renewer error and the stale token | `AuthCoordinator.test.ts › hands the renewer error itself to refresh-failed subscribers`, `… reports source "follower"…`, `… the token a failed refresh was meant to replace`, circuit-breaker tests |
| Proactive timer armed after login / cold load | `AuthCoordinator.test.ts › syncFromStoredToken`, `useApplicationStore.test.ts › arms the proactive renewal timer…`, `AuthProvider.test.tsx › arms the proactive renewal timer after a successful login` |
| Loop / multi-tab guard | `ReauthGuard.test.ts` (decision table, unpersistable record, replacement rule, sibling wait incl. a late tab), `AuthProvider.test.tsx › reloads at once when the sibling already replaced the token this tab saw fail` |
| Refresh failure → silent re-auth decision table | `AuthProvider.test.tsx › refresh failure → one silent re-authentication, then sign-out` |
| No popups; `ReauthRequiredError` classification + `invokeSilentReauth` | `MsalAuthenticator.test.tsx`, `OidcAuthenticator.test.tsx`, `GenericAuthenticator.test.tsx`, `OktaAuthenticator.test.tsx`, `Auth0Authenticator.test.tsx` |
| Loader kept up for a silent re-auth; callback routes never refreshed or signed in on the stale token | `useApplicationStore.test.ts`, `OidcAuthenticator.test.tsx › keeps the page while authentication is still settling…` |

Each renewer's happy path + failure path is covered per provider in
`<Provider>Authenticator.test.tsx › getRenewer`.

## Test coverage (Playwright)

`playwright/e2e/Auth/SsoScenarios.spec.ts` runs the 9 SSO flow cases across
every provider fixture in the matrix — Basic, LDAP, Keycloak (SAML +
confidential OIDC + public OIDC), Okta, MSAL (SDK-mocked), Auth0
(SDK-mocked). Fixtures are gated by `isAvailable()`; when secrets or docker
services are absent the whole provider row skips with the reason surfaced
in the report.

| # | Case | Playwright coverage |
|---|---|---|
| 1 | Fresh login | `SsoScenarios.spec.ts › login` × every fixture |
| 2 | Explicit logout | `SsoScenarios.spec.ts › logout` × every fixture (asserts oidcIdToken cleared) |
| 3 | Silent refresh on expiry | `SsoScenarios.spec.ts › silent refresh recovers an expired token` |
| 4 | Multi-tab handling | `SsoScenarios.spec.ts › multi-tab shares auth state after refresh in one tab` (fixture opts in via supportsCrossTab) |
| 5 | Cross-tab coalescing | `SsoScenarios.spec.ts › cross-tab refresh coalesces to a single /auth/refresh call` |
| 6 | Cold-load expired timing | `SsoScenarios.spec.ts › cold-load with an expired stored token renders authenticated within budget` |
| 7 | Lightweight silent-callback | `SsoScenarios.spec.ts › silent-callback iframe does not load the full app` |
| 8 | Config validation early | `SsoScenarios.spec.ts › broken config renders ConfigErrorPage before IdP redirect` |
| 9 | Config logging | `SsoScenarios.spec.ts › broken config surfaces the specific field in a console.warn` |
| 11 | Silent re-auth restores the deep link | `SsoScenarios.spec.ts › silent re-auth restores the deep link without /signin` (fixtures with `supportsSilentReauth`: Keycloak confidential + public OIDC, MSAL mock) |
| 12 | Dead IdP session, no loop | `SsoScenarios.spec.ts › dead IdP session signs out after one silent re-auth, no loop` (fixtures with `killIdpSession`: Keycloak confidential + public OIDC) |

**Manual-only (not in CI):** Google — see `playwright/e2e/Auth/manual/Google.md`.

## Manual smoke checklist (per provider)

Run through this list for each provider before signing off:

- [ ] **Case 1** — Fresh login: sign in, verify authenticated app renders.
- [ ] **Case 3** — Cold-load with expired token: force-expire in DevTools, hard reload, verify seamless app render (no `/signin` blink).
- [ ] **Case 4** — In-session 401: force-expire, click any tab that fires an API call, verify request retries transparently.
- [ ] **Case 5** — Proactive timer: set expiry to ~90s away, watch Network for the refresh call at ~30s.
- [ ] **Case 6** — Tab focus, fresh: switch tabs and back with a fresh token → no refresh call in Network.
- [ ] **Case 7** — Tab focus, expired: force-expire, switch tabs, return → one refresh call.
- [ ] **Case 8** — Signed-out: log out, switch tabs and back on `/signin` → no refresh call.
- [ ] **Case 9** — Cross-tab: open two tabs, force-expire in both, trigger request in one → both tabs recover with one refresh call.
- [ ] **Case 12** — Refresh failure with a live IdP session: delete the `OM_SESSION` cookie (confidential) or block third-party cookies (public), force-expire, trigger a request → one `prompt=none` redirect, back on the same page, never `/signin`.
- [ ] **Case 12, dead IdP** — additionally end the session at the IdP → exactly one redirect, then `/signin`; no further redirects.
- [ ] **Case 13** — Post-refresh reauth: land on `/signin` after a failure, then unblock refresh and trigger a valid request from a sibling tab → this tab flips back to authenticated.
- [ ] **MSAL/OIDC only** — Force `InteractionRequiredAuthError` (MSAL) or a Safari ITP block (OIDC) → no popup; one top-level `prompt=none` redirect instead.
- [ ] **Case 14** — Explicit logout: click logout → provider-native logout completes → land on `/signin` with cleared storage.
- [ ] **Case 15** — Server restart: restart backend → verify existing session survives (JWT keys are persisted via DevOps secrets manager).

Provider-specific extra checks:

- [ ] **Okta**: after a refresh cycle, open DevTools console and call `oktaAuth.tokenManager.get('idToken')` — should return the *new* token, not the pre-refresh one.
- [ ] **MSAL / OIDC**: verify no popup ever fires during refresh.
- [ ] **Basic / Generic**: refresh cookie is HttpOnly + SameSite=Strict; `/auth/refresh` is the only endpoint that reads it.
