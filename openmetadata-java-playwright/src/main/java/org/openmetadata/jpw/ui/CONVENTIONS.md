# UI test conventions

Read this before writing or porting any `*UIIT.java`. It exists so the suite stays
consistent as we migrate 258 specs.

## Layering — strict, top-only depends down

```
scenarios.ui.<domain>.*UIIT.java        — tests
        ↓
ui.pages.*Page.java                     — Page Objects (locators + actions)
        ↓
ui.{SessionBrowser,UiSession,UiSessionExtension,TraceRecorder}
ui.auth.{AuthStrategy,AdminJwtAuth,…}
        ↓
server.*, search.*                      — server lifecycle + SDK helpers
```

**Rule:** tests never reference `Locator`, `Page`, `BrowserContext`, or `addInitScript`.
Page Objects do. If a test touches Playwright primitives directly, it's a smell — promote
the interaction into the Page Object.

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

- Default = `AdminJwtAuth` injected by `UiSessionExtension`. Tests do nothing.
- Non-admin scenarios: implement a new `AuthStrategy` (e.g. `RoleJwtAuth`) and a small
  follow-up extension/annotation to swap it. Don't open a UI login flow.

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
PW_HEADED=true PW_SLOWMO=500 PW_VIDEO=true mvn verify -pl :openmetadata-java-playwright \
  -Dit.test=TopicUIIT
```

## When in doubt

- Read `MIGRATION_TRACKING.md` at the module root for the phased plan and the parallel-
  safety taxonomy.
- Read `SearchAfterReindexUIIT` as the canonical reference test.
