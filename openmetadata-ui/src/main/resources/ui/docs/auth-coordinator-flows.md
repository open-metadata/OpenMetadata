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

| Provider | File | Renewer call | User visibility | Notes |
|---|---|---|---|---|
| **Basic** (email/password) | `BasicAuthAuthenticator.tsx` | `getAccessTokenOnExpiry()` → backend `/auth/refresh` | Silent | Uses HTTP refresh token stored server-side |
| **Generic** (SAML, LDAP, confidential OIDC) | `GenericAuthenticator.tsx` | `renewToken()` → backend `/auth/refresh` | Silent | Refresh token cookie set on login |
| **OIDC (public)** | `OidcAuthenticator.tsx` | `userManager.signinSilent()` → hidden iframe; falls back to `signinPopup()` on Safari ITP frame errors | Silent (iframe) or **popup** on ITP | Frame timeout / cookie block → popup |
| **MSAL (Azure AD)** | `MsalAuthenticator.tsx` | `instance.acquireTokenSilent({forceRefresh:true})`; falls back to `acquireTokenPopup()` on `InteractionRequiredAuthError` | Silent or **popup** on interaction-required | Popup fires on session expiry / MFA / consent |
| **Okta** | `OktaAuthenticator.tsx` | `oktaAuth.token.renewTokens()` **+ `tokenManager.setTokens(tokens)`** to keep Okta SDK cache in sync | Silent | The `setTokens` step is required — without it, later SDK reads see stale tokens |
| **Auth0** | `Auth0Authenticator.tsx` | `getAccessTokenSilently()` + `getIdTokenClaims()` | Silent | Auth0 SDK owns cache; we only read the resulting `__raw` idToken |

## Case × behavior matrix

| # | Case | Behavior | Where |
|---|---|---|---|
| 1 | Fresh login | Provider-native login flow → callback → `handleSuccessfulLogin` → `setOidcToken` → `setIsAuthenticated(true)`. Coordinator scheduler starts on the next `applyRefreshed`. | `AuthProvider.tsx:handleSuccessfulLogin` |
| 2 | Cold-load, fresh token | `initializeAuthState` decodes stored token → `!isExpired` → `setIsAuthenticated(true)` immediately, no network call. Timer arms on first `applyRefreshed`. | `useApplicationStore.ts:initializeAuthState` |
| 3 | Cold-load, expired token (Bug 1) | `initializeAuthState` sees `isExpired` → `await authCoordinator.ensureFreshToken()` **before** flipping `isAuthenticated`. If it succeeds, app renders authenticated; if it fails, user sees `/signin`. **Awaits `renewerReady`** so the lazy authenticator's mount has time to register. | `useApplicationStore.ts:76-133` |
| 4 | In-session 401 | Response interceptor: `isRefreshableAuthError(401,url)` → enqueue request → `pumpQueue` → `ensureFreshToken` → drain queue with new token. First-of-cycle 401 fires `onRefreshStart` → stores redirect path. Concurrent 401s share the same `inflight` promise. | `AuthCoordinator.ts:install` |
| 5 | Proactive timer fires | `bufferMs = 60_000` before `expiresAt` → `ensureFreshToken` runs silently. Emits `refreshed` (no state change; user was already authenticated). New timer scheduled from the fresh `expiresAt`. Never runs when `expiresAt <= 0` (opaque token guard). | `ProactiveTimer.ts` |
| 6 | Tab focus, fresh token (outside 60s pre-expiry buffer) | `onTabVisible` decodes stored token → not expired, plenty of headroom → **reschedules timer only, no network call**. | `AuthCoordinator.ts:onTabVisible` |
| 6a | Tab focus, near-expiry (< 60s left, still valid) | Same as case 6 through the storage read → `msUntilExpiry <= EXPIRY_THRESHOLD_MILLES` → `ensureFreshToken()`. This is the proactive-refresh buffer; matches `ProactiveTimer`'s own `bufferMs`. | Same |
| 6b | Tab focus, token has no `exp` claim / opaque / non-JWT | No usable expiry to reason about → **early return, no network call**. Covers both the `isNil(exp)` branch of `extractDetailsFromToken` **and** the `jwt-decode` throws branch (which returns `{exp:0, isExpired:true}`). The invalid-`exp` guard runs BEFORE the `isExpired` branch specifically to catch opaque tokens. The next real 401 will drive the refresh. | Same |
| 7 | Tab focus, expired token | Storage → `isExpired` → `ensureFreshToken()`. Rapid re-focus during in-flight is deduped via `this.inflight`. | Same |
| 8 | Tab focus, signed out (no token) | Early return, **zero network calls**. Pinned by `AuthCoordinator.test.ts › tab visibility gating`. | Same |
| 9 | Cross-tab, both expired | Web Locks pick leader. Leader calls renewer → `setOidcToken` → `notifyDone({idToken,expiresAt})`. Follower receives `done` payload, calls `applyRefreshed` **with the leader's payload directly** (no storage re-read race). Both tabs emit `refreshed` → both flip `isAuthenticated`. | `CrossTabLock.ts` + `AuthCoordinator.ts:doRefresh` |
| 10 | Cross-tab, leader renewer throws | Leader's `runExclusive` catches → broadcasts `{type:'failed',reason}` → rethrows. Follower receives `failed` → falls through to `doLocalRefresh(renewer)` (does its own refresh). Only if the local refresh **also** fails does the follower emit `refresh-failed` and log out. | `CrossTabLock.ts:runExclusive` + `AuthCoordinator.ts:doRefresh` |
| 11 | Cross-tab, leader timeout / tab closed | Follower waits up to `DEFAULT_WAIT_TIMEOUT_MS = 10_000` for `done`/`failed`. On `LockTimeoutError` → `doLocalRefresh(renewer)`. No force-logout. | `CrossTabLock.ts:waitForMessage` |
| 12 | Refresh failure → logout | `doRefresh` catches → emits `refresh-failed` → AuthProvider handler runs `resetUserDetails(true)` → `clearOidcToken()` + `onLogoutHandler` + toast "session expired". | `AuthProvider.tsx:511-513` |
| 13 | Post-refresh reauth (Bug 2) | User was bounced to `/signin` (`isAuthenticated=false`) by an earlier failed call. Silent refresh succeeds → `applyRefreshed` → emits `refreshed` → AuthProvider `setIsAuthenticated(true)` → router remounts authenticated. Works in both leader **and** follower tabs. | `AuthProvider.tsx:508-510` |
| 14 | Explicit logout | Provider-native logout (varies by SDK) → `handleSuccessfulLogout` → `resetUserDetails(false)` → `clearOidcToken` → navigate to `/signin`. Coordinator has no logout hook by design — the app owns the lifecycle. | Per-authenticator `invokeLogout` |
| 15 | Server restart (JWT still valid client-side) | Client keeps token; next API call gets 401 → case 4. Client keys re-issued means the JWT signature check fails (`JwtFilter.java:343 "Public key mismatch"`) → refresh call may also 401 → case 12. | Server-side; JWT hardening covered by DevOps key persistence |

## Failure & recovery cheat sheet

| Scenario | Detection | Recovery | User impact |
|---|---|---|---|
| Renewer throws (network, IdP down) | Leader `runExclusive` catch | Emit `refresh-failed` → logout | Redirect to `/signin` with "session expired" toast |
| Follower receives `failed` from leader | `outcome.message.type === 'failed'` | `doLocalRefresh(renewer)` | Silent retry; force-logout only if own refresh also fails |
| Cross-tab timeout | `LockTimeoutError` | `doLocalRefresh(renewer)` | Silent; adds ≤ 10s latency to a queued request |
| Opaque token (`expiresAt = 0`) | `ProactiveTimer.schedule` | No timer scheduled; next 401 drives refresh | Silent |
| Renewer registration race (cold-load 401 before mount) | `awaitRenewer` (5s timeout inside `ensureFreshToken`) | Waits for `renewerReady` promise | Silent; first request sees ≤ 5s of extra latency on cold-load |
| Okta SDK cache drift | Every renewer call ends with `tokenManager.setTokens(tokens)` | N/A — proactive sync | Silent |
| MSAL interaction-required | `catch (InteractionRequiredAuthError)` | `acquireTokenPopup(request)` | **Popup** appears |
| OIDC iframe blocked (Safari ITP) | `isFrameError(error)` inside renewer | `userManager.signinPopup()` | **Popup** appears |

Only **MSAL** and **OIDC public** can surface a popup during refresh — both
gated on real interaction/ITP failures, not on every refresh.

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
9. **A failed refresh clears storage.** `refresh-failed` → `resetUserDetails(true)` → `clearOidcToken()`.

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
- [ ] **Case 12** — Refresh failure: block `/auth/refresh` in DevTools, force-expire, trigger request → redirected to `/signin` with "session expired" toast.
- [ ] **Case 13** — Post-refresh reauth: land on `/signin` after a failure, then unblock refresh and trigger a valid request from a sibling tab → this tab flips back to authenticated.
- [ ] **MSAL/OIDC only** — Force `InteractionRequiredAuthError` (MSAL) or Safari ITP block (OIDC) → popup appears, closes cleanly.
- [ ] **Case 14** — Explicit logout: click logout → provider-native logout completes → land on `/signin` with cleared storage.
- [ ] **Case 15** — Server restart: restart backend → verify existing session survives (JWT keys are persisted via DevOps secrets manager).

Provider-specific extra checks:

- [ ] **Okta**: after a refresh cycle, open DevTools console and call `oktaAuth.tokenManager.get('idToken')` — should return the *new* token, not the pre-refresh one.
- [ ] **MSAL / OIDC**: verify no popup fires under happy-path refresh; popups should be gated on the specific error class.
- [ ] **Basic / Generic**: refresh cookie is HttpOnly + SameSite=Strict; `/auth/refresh` is the only endpoint that reads it.
