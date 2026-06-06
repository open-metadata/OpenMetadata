package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.assertions.PlaywrightAssertions;
import com.microsoft.playwright.options.WaitForSelectorState;
import java.util.regex.Pattern;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Page object for the global Data Quality Dashboard at {@code /data-quality/dashboard}.
 * Mirrors the surfaces exercised in
 * {@code DataQuality/DataQualityDashboard.spec.ts}: dimension status cards and the
 * three pie chart widgets.
 */
public final class DataQualityDashboardPage extends PageObject {

  public static final String TEST_CASE_STATUS_PIE_ID = "test-case-result-pie-chart";
  public static final String ENTITY_HEALTH_PIE_ID = "healthy-data-assets-pie-chart";
  public static final String DATA_ASSETS_COVERAGE_PIE_ID = "data-assets-coverage-pie-chart";

  private DataQualityDashboardPage(final Page page, final UiSession session) {
    super(page, session);
  }

  public static DataQualityDashboardPage open(final UiSession ui) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl("/data-quality/dashboard"));
    final DataQualityDashboardPage instance = new DataQualityDashboardPage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  /**
   * Click a dimension card by its visible text and await navigation. Returns true if
   * the card was found and clicked; false if no such card exists in the current
   * dashboard (the TS spec also conditionally skips missing dimensions).
   */
  public boolean tryClickDimensionCard(final String displayText, final String urlValue) {
    final Locator card =
        page.locator("[data-testid='status-data-widget']")
            .filter(new Locator.FilterOptions().setHasText(displayText))
            .first();
    if (card.count() == 0) {
      return false;
    }
    // Only genuine absence (count == 0) is a skip. A click/navigation failure on a card
    // that IS present is a real regression and must surface, not be swallowed as "absent".
    card.click(new Locator.ClickOptions().setTimeout(5_000));
    page.waitForURL(
        Pattern.compile("/data-quality/test-cases.*dataQualityDimension=" + urlValue),
        new Page.WaitForURLOptions().setTimeout(20_000));
    return true;
  }

  /**
   * Click the first available pie chart segment and assert the URL navigates to
   * {@code /data-quality/test-cases} carrying ANY {@code testCaseStatus=} param.
   * Recharts only renders segments for non-zero data and the rendering order isn't
   * stable across data shapes, so this method asserts the navigation contract
   * rather than a specific segment-to-status mapping.
   */
  public DataQualityDashboardPage clickPieChartSegmentExpectsStatusNav(final String chartId) {
    final Locator segment =
        page.locator("#" + chartId + " .custom-pie-chart-clickable path").first();
    PlaywrightAssertions.assertThat(segment)
        .isVisible(new LocatorAssertions.IsVisibleOptions().setTimeout(15_000));
    segment.evaluate("el => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))");
    page.waitForURL(
        Pattern.compile("/data-quality/test-cases.*testCaseStatus="),
        new Page.WaitForURLOptions().setTimeout(20_000));
    return this;
  }

  /** Click a Data Assets Coverage segment by index, awaiting the given URL pattern. */
  public DataQualityDashboardPage clickCoverageSegmentExpectingUrl(
      final int segmentIndex, final Pattern urlPattern) {
    final Locator segment =
        page.locator("#" + DATA_ASSETS_COVERAGE_PIE_ID + " .custom-pie-chart-clickable path")
            .nth(segmentIndex);
    PlaywrightAssertions.assertThat(segment)
        .isVisible(new LocatorAssertions.IsVisibleOptions().setTimeout(15_000));
    segment.evaluate("el => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))");
    page.waitForURL(urlPattern, new Page.WaitForURLOptions().setTimeout(20_000));
    return this;
  }

  @Override
  protected void waitForLoaded() {
    page.locator("#" + TEST_CASE_STATUS_PIE_ID)
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
  }
}
