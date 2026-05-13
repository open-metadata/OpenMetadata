package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.WaitForSelectorState;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Page object for {@code /data-quality} — the home Data Quality dashboard with three
 * pie chart widgets (test case status, entity health, data assets coverage).
 *
 * <p>Used by reindex tests to assert dashboard widgets render with the same shape
 * before and after a {@code reindexEntities} call.
 */
public final class DataQualityDashboardPage extends PageObject {

  private static final String PATH = "/data-quality";
  private static final String TESTID_CONTAINER = "dq-dashboard-container";
  private static final String TESTID_TEST_CASE_STATUS_PIE = "test-case-result-pie-chart-widget";
  private static final String TESTID_HEALTH_PIE = "healthy-data-assets-pie-chart-widget";
  private static final String TESTID_COVERAGE_PIE = "data-assets-coverage-pie-chart-widget";

  private DataQualityDashboardPage(final Page page, final UiSession session) {
    super(page, session);
  }

  public static DataQualityDashboardPage open(final UiSession ui) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl(PATH));
    final DataQualityDashboardPage instance = new DataQualityDashboardPage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  public Locator container() {
    return byTestId(TESTID_CONTAINER);
  }

  public Locator testCaseStatusPie() {
    return byTestId(TESTID_TEST_CASE_STATUS_PIE);
  }

  public Locator entityHealthPie() {
    return byTestId(TESTID_HEALTH_PIE);
  }

  public Locator coveragePie() {
    return byTestId(TESTID_COVERAGE_PIE);
  }

  /**
   * A trimmed text snapshot of the three pie widgets — used for pre/post reindex
   * comparison. The visual chart is anti-aliased SVG so we compare the surrounding
   * labels rather than pixels.
   */
  public String widgetTextSnapshot() {
    return String.join(
        " | ",
        textOrEmpty(testCaseStatusPie()),
        textOrEmpty(entityHealthPie()),
        textOrEmpty(coveragePie()));
  }

  private static String textOrEmpty(final Locator l) {
    if (l.count() == 0) {
      return "";
    }
    final String text = l.textContent();
    return text == null ? "" : text.replaceAll("\\s+", " ").trim();
  }

  @Override
  protected void waitForLoaded() {
    container().waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
  }
}
