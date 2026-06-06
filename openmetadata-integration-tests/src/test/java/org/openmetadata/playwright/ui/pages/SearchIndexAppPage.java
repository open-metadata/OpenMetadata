package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Locator.WaitForOptions;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.assertions.PlaywrightAssertions;
import com.microsoft.playwright.options.WaitForSelectorState;
import java.time.Duration;
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
   */
  public void triggerAndWaitForStatus(final String label, final Duration timeout) {
    runNowButton().click();
    waitForLatestRunStatus(label, timeout);
  }

  public void waitForLatestRunStatus(final String label, final Duration timeout) {
    PlaywrightAssertions.assertThat(latestRunStatus())
        .containsText(
            label,
            new com.microsoft.playwright.assertions.LocatorAssertions.ContainsTextOptions()
                .setTimeout(timeout.toMillis()));
  }

  @Override
  protected void waitForLoaded() {
    runNowButton().waitFor(new WaitForOptions().setState(WaitForSelectorState.VISIBLE));
  }
}
