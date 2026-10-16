package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Locator.WaitForOptions;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.assertions.PlaywrightAssertions;
import com.microsoft.playwright.options.WaitForSelectorState;
import java.time.Duration;
import java.util.regex.Pattern;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Page object for {@code /settings/apps/SearchIndexingApplication} — the Search Indexing
 * Application's detail page where reindex is triggered and run history is observed.
 *
 * <p>Status updates are pushed by the server over WebSocket
 * ({@code SEARCH_INDEX_JOB_BROADCAST_CHANNEL}); the runs-history table row updates in
 * place. Tests just observe the DOM via {@link #waitForLatestRunStatus(String, Duration)}
 * — Playwright's auto-waiting handles the WS-driven re-render naturally.
 */
public final class SearchIndexAppPage extends PageObject {

  private static final String APP_PATH = "/settings/apps/SearchIndexingApplication";
  private static final String TESTID_RUNS_HISTORY = "app-run-history-table";
  private static final String TESTID_RUN_NOW = "run-now-button";
  private static final String TESTID_PIPELINE_STATUS = "pipeline-status";
  private static final String TESTID_DEPLOY = "deploy-button";
  // An accepted trigger registers its run record within seconds; this only bounds the failure
  // (e.g. the trigger was rejected because another run still holds the app's execution lock).
  private static final Duration RUN_REGISTER_TIMEOUT = Duration.ofMinutes(2);
  // Badge label is upperFirst(AppRunRecord.status); these are the statuses a run cannot leave.
  // Mirrors ReindexHelpers' TERMINAL_STATUSES.
  private static final Pattern TERMINAL_STATUS_TEXT =
      Pattern.compile("Success|Completed|Failed|Stopped|ActiveError");
  // The badge is already terminal when this is used — it only absorbs a re-render.
  private static final Duration TERMINAL_ASSERT_TIMEOUT = Duration.ofSeconds(10);

  private SearchIndexAppPage(final Page page, final UiSession session) {
    super(page, session);
  }

  public static SearchIndexAppPage open(final UiSession ui) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl(APP_PATH));
    final SearchIndexAppPage instance = new SearchIndexAppPage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  public Locator runNowButton() {
    return byTestId(TESTID_RUN_NOW);
  }

  public Locator deployButton() {
    return byTestId(TESTID_DEPLOY);
  }

  public Locator runsHistoryTable() {
    return byTestId(TESTID_RUNS_HISTORY);
  }

  /** Status badge of the most recent run (top row in the runs history table). */
  public Locator latestRunStatus() {
    return runsHistoryTable().getByTestId(TESTID_PIPELINE_STATUS).first();
  }

  /**
   * Triggers a run via the {@code Run Now} button and blocks until the status badge
   * reads the given label. Use {@code "Success"} for the happy-path assertion.
   *
   * <p>The runs-history top row still shows the <em>previous</em> run's status at click time,
   * so a bare contains-text wait can match a stale {@code Success} instantly and never observe
   * the run just triggered. Guard the wait: confirm via the API that a run registered after the
   * click, then reload so the table is rendering that fresh run before asserting on its badge.
   */
  public void triggerAndWaitForStatus(final String label, final Duration timeout) {
    final long clickedAtMillis = System.currentTimeMillis();
    runNowButton().click();
    ReindexHelpers.waitForRunStartedSince(
        session.server(), ReindexHelpers.SEARCH_INDEX_APP, clickedAtMillis, RUN_REGISTER_TIMEOUT);
    page.reload();
    waitForLoaded();
    waitForLatestRunStatus(label, timeout);
  }

  /**
   * Waits for the latest run to reach a terminal status, then asserts it is {@code label}.
   *
   * <p>Two steps on purpose. Asserting {@code label} directly would keep re-polling a badge that
   * already reads a terminal {@code Failed} for the whole timeout — one failed reindex then burns
   * the full {@code reindexTimeoutMin} (60 min in external mode) before reporting, which is enough
   * to blow the job's own timeout and take the suites queued behind it down with it. Waiting for
   * <em>any</em> terminal status first reports the same assertion failure in seconds.
   */
  public void waitForLatestRunStatus(final String label, final Duration timeout) {
    PlaywrightAssertions.assertThat(latestRunStatus())
        .containsText(
            TERMINAL_STATUS_TEXT,
            new com.microsoft.playwright.assertions.LocatorAssertions.ContainsTextOptions()
                .setTimeout(timeout.toMillis()));
    PlaywrightAssertions.assertThat(latestRunStatus())
        .containsText(
            label,
            new com.microsoft.playwright.assertions.LocatorAssertions.ContainsTextOptions()
                .setTimeout(TERMINAL_ASSERT_TIMEOUT.toMillis()));
  }

  @Override
  protected void waitForLoaded() {
    runNowButton().waitFor(new WaitForOptions().setState(WaitForSelectorState.VISIBLE));
  }
}
