# SSO integration testing with mock identity providers

The `Sso*IT` classes log in to the embedded test server through identity providers that run inside the
integration-test JVM. The server runs its production OIDC code unchanged: the tests point it at the
mocks through the same admin API an administrator uses (`PUT /v1/system/security/config`). No server
flag, endpoint or seam exists for mocking, and the mocks live only in the IT module's test sources.

## What the harness gives you

Everything is in `openmetadata-integration-tests/src/test/java/org/openmetadata/it/sso/`.

| Class | Use it to |
|---|---|
| `oidc.MockOidcProvider` | Run an OpenID provider on `http://localhost:<port>`: discovery, authorize, token, JWKS, userinfo. It signs RS256 ID tokens with keys it generates, and records every request. |
| `oidc.MockOidcIdentity` | Describe the user signed in at the provider and the claims their tokens carry. |
| `oidc.IdTokenDefect`, `oidc.TokenForgery`, `oidc.RefreshOutcome`, `oidc.IssuerParameter` | Make the provider misbehave: a wrong audience, issuer, nonce or key, an expired token, an unsigned or algorithm-confused token, a rejected or failing refresh. |
| `MockResponseGate` | Hold one token or JWKS response until the test releases it, to line up concurrent requests or time out the server's call. |
| `browser.SsoBrowser` | Follow the redirects of a login between the server and the provider one hop at a time, keep cookies, and stop where the single-page app takes over. `navigate(url, stopBefore)` stops early so a test can tamper with the callback. |
| `config.SsoConfigs` | Build a confidential or public OIDC configuration that targets a mock provider and the server's ephemeral port. |
| `config.SecurityConfigSwap` | Snapshot the live configuration unmasked, apply a baseline for the class, run one test under a variant, and restore and verify the original. |
| `state.StoredSessions`, `state.SessionStateInjector` | Read stored sessions; expire a session, its idle window, its refresh lease or its refresh token without waiting. |
| `SsoFlows` | Common steps: `login`, `loginUpToCallback`, `idTokenFrom`, `requireActiveSession`, `assertLoginRefused`, `editQuery`. |

A typical test:

```java
@BeforeAll
static void pointTheServerAtTheMockProvider() {
  provider = MockOidcProvider.start();
  securityConfig = SecurityConfigSwap.snapshotLiveConfig();
  securityConfig.applyBaseline(SsoConfigs.confidentialOidc(securityConfig.originalCopy(), provider));
}

@Test
void loginRoundTrip(TestNamespace ns) {
  provider.signIn(MockOidcIdentity.forEmail(ns.shortPrefix("alice") + "@open-metadata.org"));
  SsoBrowser browser = new SsoBrowser();

  String idToken = SsoFlows.idTokenFrom(SsoFlows.login(browser));

  assertEquals(200, SsoFlows.loggedInUser(browser, idToken).statusCode());
}
```

## Rules for new SSO tests

- **Name the class `Sso*IT`, annotate it `@Isolated` and `@Execution(SAME_THREAD)`.** The classes swap
  the server-wide authentication provider, so the pom runs them serially in the global-state lane, and
  the local test planner recognises the lane by class name. A multi-node class must not start with
  `Sso`; list it in `integrationTests.multiNodeTests` instead.
- **Restore through `SecurityConfigSwap`.** Restoring from a masked `GET` would keep any secret a test
  changed, because the server fills masked values from what is stored.
- **Use a fresh identity per test** (`ns.shortPrefix(...)`). The lockout counters, the email-to-name
  cache and the permission cache are JVM-wide.
- **Never reuse a key id.** The server caches each key set it downloads for a day and resolves a
  `kid` from it; `MockOidcKeys` mints a new id for every key.
- **Edit stored sessions through `SessionStateInjector`.** It bumps the session's version and
  refreshes the server's 10-second session cache; a raw `UPDATE` is overwritten or ignored.
- **Use `localhost`, never `127.0.0.1`,** in any URL the server validates: its outbound URL policy
  refuses loopback IP literals.
- **Keep cookies in `SsoBrowser`.** `java.net.CookieManager` re-sends them in RFC 2965 form, which the
  server rejects, so a login would loop back to the sign-in page.

## Running them

```bash
mvn verify -pl :openmetadata-integration-tests -am -Pmysql-elasticsearch \
  -DintegrationTests.lane=global-state -DintegrationTests.skipParallel=true \
  -Dit.test='Sso*IT' -Dfailsafe.failIfNoSpecifiedTests=false \
  -Dtest=NoSuchUnitTest -Dsurefire.failIfNoSpecifiedTests=false
```

Check for a `Tests run:` line per class: a lane run without an engine profile runs nothing and still
reports success.

## Coverage

| Area | Class | Scenarios |
|---|---|---|
| Confidential OIDC login | `SsoOidcConfidentialLoginIT` | OC-01, 04, 05, 06, 14, 20, 21, 22, 23, 24, 27, 28 |
| Confidential callback hardening | `SsoOidcCallbackHardeningIT` | OC-08, 09, 10, 11, 13 |
| Public OIDC bearer tokens | `SsoOidcPublicBearerIT` | OP-01, 02, 03, 04, 06, 08, 09, 10, 11, 12, 14, 15, 16 |
| Session renewal | `SsoTokenRenewalIT` | RN-01 to RN-09, RN-12, RN-16 |
| Provider shapes (Okta, Google, Auth0, Cognito, Keycloak, Entra) | `SsoOidcProviderProfilesIT` | OC-02, OC-03, OP-01 per provider |

SAML, LDAP, identity resolution, role sync, settings changes, Test Login, multi-node sessions and
SCIM follow the same pattern and are added phase by phase.

## Known limits

- **Azure confidential clients:** pac4j builds their discovery URL from the tenant and ignores
  `discoveryUri`, so they cannot reach a mock until the authority host is configurable. Entra-shaped
  tokens run through the generic client meanwhile, with a single-tenant issuer: the multi-tenant
  `{tenantid}` issuer template parses only with the Azure client type.
- **The in-JVM multi-node harness** shares one `SecurityConfigurationManager` across nodes. It cannot
  prove that a configuration change propagates between pods.
