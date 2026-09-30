# Google (Public OIDC) — Manual Runbook

Google is **NOT** exercised in CI by any of the SSO Playwright fixtures. The
public-OIDC code path it drives (`OidcAuthenticator` + oidc-client
`UserManager`) is exercised end-to-end by `keycloak-oidc-public` — so we
don't lose coverage of the coordinator or the authenticator wrapper by
skipping the real Google handshake.

Google-specific things that only surface with a live tenant:

- OAuth consent screen wording and scope acceptance flow
- Google's cookie / storage semantics vs Keycloak's
- Domain verification for hosted-domain restrictions
- Google's aggressive session-expiry cadence in certain enterprise setups

Run this checklist before every release that touches
`src/components/Auth/**` or `src/utils/Auth/**`.

## Prerequisites

- A Google Cloud project with an OAuth 2.0 client of type "Web application"
- Authorized redirect URI: `http://localhost:8585/callback`
- `Client ID` + `Client Secret` available (secret only used server-side)
- A Google test account with `Sign in with Google` enabled

## Configure OpenMetadata

Update `conf/openmetadata.yaml`:

```yaml
authenticationConfiguration:
  provider: 'google'
  providerName: 'Google'
  publicKeyUrls:
    - 'https://www.googleapis.com/oauth2/v3/certs'
    - 'http://localhost:8585/api/v1/system/config/jwks'
  tokenValidationAlgorithm: 'RS256'
  authority: 'https://accounts.google.com'
  clientId: '<YOUR_GOOGLE_CLIENT_ID>'
  callbackUrl: 'http://localhost:8585/callback'
  jwtPrincipalClaims:
    - email
    - preferred_username
    - sub
  enableSelfSignup: true
  oidcConfiguration:
    id: '<YOUR_GOOGLE_CLIENT_ID>'
    type: 'google'
    secret: '<YOUR_GOOGLE_CLIENT_SECRET>'
    scope: 'openid email profile'
    discoveryUri: 'https://accounts.google.com/.well-known/openid-configuration'
    callbackUrl: 'http://localhost:8585/callback'
    serverUrl: 'http://localhost:8585'
    responseType: 'code'

authorizerConfiguration:
  principalDomain: '<your-domain>'
```

Restart the backend so the new config takes effect.

## The 9 SSO scenarios — manually

Walk each one and check the box.

- [ ] **Scenario 1: Login** — Navigate to `/signin`, click "Sign in with
      Google", complete Google's consent screen, land on `/my-data` as the
      authenticated user.
- [ ] **Scenario 2: Logout** — From authenticated state, click profile →
      logout, land on `/signin`, verify the stored token is cleared. Tokens
      live in the SW/IndexedDB `AppDataStore` DB, `keyValueStore` store,
      under the `app_state` key (see `SwTokenStorageUtils`, where the JSON's
      `primary` field is the id token and `secondary` is the refresh token).
      In DevTools: **Application → IndexedDB → AppDataStore → keyValueStore
      → app_state** should be absent (or its parsed value should have no
      `primary`). Browsers without SW+IndexedDB fall back to
      `localStorage['app_state']`; the legacy `localStorage['oidcIdToken']`
      key is no longer written but is worth double-checking is null too.
- [ ] **Scenario 3: Silent refresh** — In DevTools, edit the same
      IndexedDB entry (`AppDataStore → keyValueStore → app_state`) and
      replace its `primary` value with a mangled JWT whose `exp` is in the
      past, then navigate to `/my-data`. Verify Network tab shows a hidden
      iframe calling Google's `/o/oauth2/v2/auth` and the app renders
      authenticated without a redirect. For the localStorage-fallback path
      the equivalent edit is on `localStorage['app_state']`; the legacy
      `localStorage['oidcIdToken']` write no longer round-trips through the
      coordinator.
- [ ] **Scenario 4: Multi-tab handling** — Open two tabs on `/`. Both should
      render authenticated. Force-expire the token in tab A, navigate. Tab B
      should ALSO refresh silently on its next API call (cross-tab lock).
- [ ] **Scenario 5: Cross-tab coalescing** — Same as 4 but observe the
      Network tab of both tabs simultaneously — only ONE tab should show
      the actual `/o/oauth2/v2/auth` iframe request.
- [ ] **Scenario 6: Cold-load expired** — Force-expire the token, hard-
      reload the page. App should render authenticated within ~15s (Google's
      silent-refresh iframe can be slow on first hit).
- [ ] **Scenario 7: Lightweight silent-callback** — In DevTools, network tab,
      look at requests when a silent refresh fires. The `/silent-callback`
      iframe should load only `SilentCallback.tsx` and `oidc-client` — NOT
      the full app bundle. Assert size of the iframe document < 100 KB.
- [ ] **Scenario 8: Config validation early** — Restart backend with
      `oidcConfiguration.discoveryUri` removed. Navigate to `/signin`. The
      config-error page should render immediately, listing `discoveryUri` as
      missing. NO redirect to Google should occur.
- [ ] **Scenario 9: Config logging** — Same as 8, but check DevTools console
      for the exact log line: `[AuthConfig] ... discoveryUri ...`.

## Provider-specific pitfalls

- Google's `hd` claim (hosted-domain) — if you set `principalDomain`, only
  users in that Google Workspace domain will sign in. Test with an
  in-domain account.
- Google refresh tokens are `single_use`. If you're testing multiple
  refreshes back-to-back, ensure the server's refresh-token rotation stays
  in step; otherwise the second refresh will 400.
- `access_type: offline` on the initial authorize is required for the
  server to receive a refresh token at all — verify by inspecting the
  network's `/o/oauth2/v2/auth?...&access_type=offline`.

## Reporting

If any scenario fails, attach the failing scenario number + the browser's
Network HAR to the release ticket. Do not attempt to sign off the release
with a scenario in the "unknown / didn't check" state — cross it out on the
Github release checklist explicitly.
