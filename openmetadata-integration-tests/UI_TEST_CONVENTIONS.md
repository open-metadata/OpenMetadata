# UI test conventions

Read this before writing or porting any `*UIIT.java`. It exists so the suite stays
consistent as we migrate 258 specs.

## Layering — strict, top-only depends down

```
playwright.scenarios.<domain>.*UIIT.java        — tests
        ↓
playwright.ui.pages.*Page.java                  — Page Objects (locators + actions)
        ↓
playwright.ui.{SessionBrowser,UiSession,UiSessionExtension,TraceRecorder}
it.auth.{AuthBackend,AuthSession,BasicJwtBackend,OidcBackend,…}
        ↓
it.server.*, it.search.*                        — server lifecycle + SDK helpers
```

**Rule:** prefer keeping `Locator` / `Page` / `BrowserContext` use inside Page Objects.
Page Objects may expose `Locator`-returning accessors when a test legitimately needs to
make a Playwright-level assertion on a specific element, and `PageObject.rawPage()` is a
documented escape hatch for URL assertions and SSO redirect flows. If a test reaches for
Playwright primitives for routine interactions (clicks, typing, navigation), promote the
interaction into a Page Object method.

## Test skeleton

```java
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
class FooUIIT {

  @BeforeAll
  static void setup() {
    SdkClients.useFluentApis(UiTestServer.get().sdk());
    Apps.setDefaultClient(UiTestServer.get().sdk());
  }

  @Test
  void scenario(final UiSession ui, final TestNamespace ns) {
    Table t = TableTestFactory.createSimple(ns);                     // SDK setup
    FooPage page = FooPage.open(ui, t.getFullyQualifiedName());      // page object navigation
    page.doSomething();                                              // page object action
    assertThat(page.someResult()).isVisible();                       // assertion
  }
}
```

Setup via SDK. Cleanup via `TestNamespace`. Never click through the UI to seed state.

## Page Objects

- One class per page, ≤ 200 lines. Split if bigger.
- Static `open(...)` factory navigates and returns a loaded instance.
- Actions return `this` (or another `PageObject`) for chaining.
- Locators: `getByTestId` > `getByRole`/`getByLabel` > `getByPlaceholder` > text > CSS.
- Define every selector as `private static final` — no inline literals.
- `waitForLoaded()` overridden per page — the readiness signal must be page-specific
  (a known testid visible, an API response done) not a generic `networkidle` if a better
  signal exists.

## Auth

The whole suite is parameterized by an `AuthBackend`. Pick one with `-Djpw.auth=<name>`
(or `JPW_AUTH=<name>`); the same UI tests run unchanged regardless of which is active.

| `jpw.auth` | OM auth provider | Token acquired by |
|---|---|---|
| `basic` *(default)* | OM built-in JWT | `JwtAuthProvider` (admin signing key) |
| `sso-google-public` | Google + public client (`response_type=id_token`) | mock IdP `/google/token` (password grant) |
| `sso-google-confidential` | Google + confidential client (`response_type=code`) | same |
| `sso-okta-public` | Okta + public client | mock IdP `/okta/token` |
| `sso-okta-confidential` | Okta + confidential client | same |
| `sso-custom-oidc-public` | Custom OIDC + public | mock IdP `/custom-oidc/token` |
| `sso-custom-oidc-confidential` | Custom OIDC + confidential | same |

Per-test override (only when the test explicitly drives the sign-in surface and doesn't
want a token preloaded):

```java
@Test
@NoPreloadAuth
void clickingSignInWithGoogleCompletesLogin(UiSession ui) { ... }
```

Tests that only make sense under one backend gate themselves with
`AuthAssumptions.onlyWhenBackendIs("sso-google-confidential")`. They skip cleanly when the
suite is running under any other backend.

A daemon `TokenRefresher` keeps `AuthSession.current()` valid across long runs; tests
read the current token at `@BeforeEach`, so refresh is transparent.

## Parallelism

- Per-method parallel by default; classes serial. Configured in pom failsafe.
- Tests that mutate global state must be tagged:
  - `@ResourceLock("GLOBAL_SETTINGS")` — settings, themes, login config
  - `@ResourceLock("SEARCH_INDEX_APP")` — re-triggers the global reindex app
  - `@ResourceLock("APPS")` — install/uninstall apps
  - `@ResourceLock("ALERTS")` — global alert config
  - `@Execution(SAME_THREAD)` — inherently sequential UI flows (Tour, SSO renewal)
- Default: assume parallel-safe. `TestNamespace` keeps entity names unique.

## Java code rules (recap from project CLAUDE.md)

- Methods ≤ 15 lines, ≤ 3 nesting, ≤ 5 params, ≤ 10 cyclomatic.
- `final` on every parameter and local that doesn't change.
- No comments stating *what* — only *why*. Name the code so it reads.
- No magic strings in `equals`/`contains`/`switch` — define a constant or an enum.
- No deep `else if` chains — refactor to `switch`, `Map` dispatch, or named predicate.
- No empty catches, no `printStackTrace`, no `catch(Exception)` for control flow.
- `mvn spotless:apply` before every commit.

## Headed debugging

Knobs (all available as env var or `-D<name>=...` system property):

| Knob | Effect |
|---|---|
| `PW_HEADED=true` | Visible Chromium |
| `PW_SLOWMO=<ms>` | Inter-action delay; defaults to 250ms in headed, 0 in headless |
| `PW_VIDEO=true` | Records every test, saves to `target/playwright-videos/<class>-<test>-<ts>.webm` |

Trace zips for **failed** runs are saved to `target/playwright-traces/`. Replay any trace:
```
npx playwright show-trace target/playwright-traces/trace-<class>-<test>-<ts>.zip
```

Typical local debug recipe — slow it down enough to follow, capture video for review:
```
PW_HEADED=true PW_SLOWMO=500 PW_VIDEO=true mvn verify -P ui-it \
  -pl :openmetadata-integration-tests -Dit.test='SimpleReindexTriggerUIIT'
```

## When in doubt

- Read `REINDEX_TEST_PLAN.md` at the module root for the reindex scenario coverage map.
- Read `SimpleReindexTriggerUIIT` as the canonical reference test.
