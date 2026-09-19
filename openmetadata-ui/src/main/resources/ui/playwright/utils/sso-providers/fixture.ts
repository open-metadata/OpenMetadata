/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { APIRequestContext, Page } from '@playwright/test';
import { ProviderConfigOverride } from '../ssoAuth';

// Machine-key for every provider the scenario suite runs against. Matches the
// PROVIDER_SLUGS union in fixture registry — extending the union here forces a
// compile break at the registry site, which is the ledger for "we forgot one".
export type SsoProviderSlug =
  | 'basic'
  | 'ldap'
  | 'keycloak-saml'
  | 'keycloak-saml-crosssite'
  | 'keycloak-oidc-confidential'
  | 'keycloak-oidc-public'
  | 'okta'
  | 'msal-mock'
  | 'auth0-mock';

export type LoginKind =
  | 'redirect' // full-page redirect to IdP (SAML, most OIDC)
  | 'popup' // popup window (some OIDC public / Auth0)
  | 'form'; // in-app form (Basic, LDAP)

export interface SsoConfigureResult {
  // Rolls the backend config back to what it was before configure() ran.
  // Called from afterAll to keep the shared dev stack clean between suites.
  restore: () => Promise<void>;
}

// Every provider fixture implements this. The scenarios spec is written
// against the interface only — no per-provider `if` branches. If a scenario
// can't apply to a provider (e.g. cross-tab for Basic), the fixture flags it
// via a capability field below and the scenario is `.skip()`'d for that row.
export interface SsoProviderFixture {
  /** Human-readable label for the test title */
  name: string;
  /** Stable machine key for CI matrix filtering + report grouping */
  slug: SsoProviderSlug;
  /** OpenMetadata's clientType classification for this provider */
  clientType: 'public' | 'confidential';
  /** Shape of the login handshake the fixture drives */
  loginKind: LoginKind;

  // ── Capabilities (drives .skip() decisions in the scenarios spec) ───────

  /** true when the provider mints tokens shared across tabs via storage */
  supportsCrossTab: boolean;
  /** true when the backend config enables self-signup for new emails */
  supportsSelfSignup: boolean;
  /** true when the provider supports the /silent-callback iframe flow */
  supportsSilentCallback: boolean;
  /**
   * true when the AuthCoordinator's Renewer for this provider hits OM's
   * `/api/v1/auth/refresh` endpoint (Basic/LDAP via BasicAuthAuthenticator,
   * SAML + confidential OIDC via GenericAuthenticator). false when the
   * Renewer is browser-SDK-driven (MSAL's `acquireTokenSilent`, Auth0's
   * `getAccessTokenSilently`, oidc-client's `signinSilent`, Okta's
   * `renewTokens`) and produces no observable OM API call — those legs
   * can't assert scenarios 3 and 5 by waiting on `/auth/refresh`.
   */
  usesBackendRefresh: boolean;

  // ── Env gating ──────────────────────────────────────────────────────────

  /**
   * Returns true only when this fixture can run in the current env:
   * required docker services up, required secrets present, feature flags on.
   * If false, the whole provider row is skipped with the reason surfaced in
   * the report.
   */
  isAvailable: () => boolean;

  /**
   * Human-readable reason for `isAvailable() === false`. Rendered into
   * `test.skip(...)` so the report explains *why* a provider was skipped.
   */
  unavailableReason?: () => string;

  // ── Lifecycle hooks ─────────────────────────────────────────────────────

  /**
   * Configure the backend's `authenticationConfiguration` to this provider.
   * Returns a `restore` that must be called from `afterAll` to reset config.
   */
  configureBackend(apiContext: APIRequestContext): Promise<SsoConfigureResult>;

  // ── Test actions ────────────────────────────────────────────────────────

  /**
   * Drive the IdP login flow from `/signin` to authenticated app.
   * MUST resolve only once `useApplicationStore.isAuthenticated === true`.
   */
  performLogin(page: Page): Promise<void>;

  /**
   * Drive the logout flow. MUST resolve only once storage is cleared and
   * the browser is back on `/signin`.
   */
  performLogout(page: Page): Promise<void>;

  /**
   * Simulate a stored-token expiry (mangling the JWT `exp` claim in
   * storage is the default; some providers need to hit the IdP's admin
   * API to actually invalidate the session). MUST NOT log the user out —
   * next API call should 401 and trigger silent refresh.
   */
  forceTokenExpiry(page: Page): Promise<void>;

  // ── Metadata for scenario assertions ────────────────────────────────────

  /**
   * The `authenticationConfiguration.responseType` the backend advertises
   * for this provider. Only meaningful for public OIDC clients where the
   * front-channel `oidc-client` UserManager must echo it in the /authorize
   * request. Undefined for other kinds.
   */
  expectedResponseType?: string;

  /**
   * Regex the /signin sign-in-with button text must match. Kept as a regex
   * (not a literal) so we can accept "Sign in with X" and "Log in with X"
   * variants without the fixture caring about copy changes.
   */
  signInButtonPattern: RegExp;
}

// A slim adapter type so the migrated legacy fixtures can keep exposing
// their existing shape (buildConfigPayload + performProviderLogin) while
// this refactor incrementally rewrites each to full SsoProviderFixture.
// The scenarios spec MUST NOT depend on this — it's a migration bridge.
export interface LegacyProviderShim {
  buildConfigPayload: () =>
    | Promise<ProviderConfigOverride>
    | ProviderConfigOverride;
  performProviderLogin: (
    page: Page,
    creds: { username: string; password: string }
  ) => Promise<void>;
}
