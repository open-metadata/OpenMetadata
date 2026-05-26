package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.assertions.PlaywrightAssertions;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.WaitForSelectorState;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Page object covering the Data Observability tab on Tag, GlossaryTerm and Domain
 * detail pages. Same flow shape across all three; entity-specific URL prefix is
 * supplied at open time.
 */
public final class GovernanceDataObservabilityPage extends PageObject {

  public static final String TEST_CASE_STATUS_PIE_ID = "test-case-result-pie-chart";
  public static final String ENTITY_HEALTH_PIE_ID = "healthy-data-assets-pie-chart";
  public static final String DATA_ASSETS_COVERAGE_PIE_ID = "data-assets-coverage-pie-chart";
  private static final Pattern DATA_OBSERVABILITY =
      Pattern.compile("data observability", Pattern.CASE_INSENSITIVE);
  private static final Pattern OVERVIEW = Pattern.compile("^overview$", Pattern.CASE_INSENSITIVE);

  private GovernanceDataObservabilityPage(final Page page, final UiSession session) {
    super(page, session);
  }

  public static GovernanceDataObservabilityPage openTag(final UiSession ui, final String fqn) {
    return open(ui, "/tag/" + URLEncoder.encode(fqn, StandardCharsets.UTF_8));
  }

  public static GovernanceDataObservabilityPage openGlossaryTerm(
      final UiSession ui, final String fqn) {
    return open(ui, "/glossary/" + URLEncoder.encode(fqn, StandardCharsets.UTF_8));
  }

  public static GovernanceDataObservabilityPage openDomain(final UiSession ui, final String fqn) {
    return open(ui, "/domain/" + URLEncoder.encode(fqn, StandardCharsets.UTF_8));
  }

  /**
   * Domain Data Observability tab is reached via URL navigation, not a tab click —
   * the TS spec uses {@code /domain/<fqn>/data_observability}. Returns a page already
   * on the DO tab so callers can call {@link #assertWidgetsVisible} / filter checks
   * directly.
   */
  public static GovernanceDataObservabilityPage openDomainDataObservabilityDirect(
      final UiSession ui, final String fqn) {
    final Page page = ui.newPage();
    final String url =
        ui.uiUrl(
            "/domain/" + URLEncoder.encode(fqn, StandardCharsets.UTF_8) + "/data_observability");
    page.waitForResponse(
        r -> r.url().contains("/api/v1/dataQuality/testSuites/dataQualityReport"),
        () -> page.navigate(url));
    return new GovernanceDataObservabilityPage(page, ui);
  }

  private static GovernanceDataObservabilityPage open(final UiSession ui, final String path) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl(path));
    final GovernanceDataObservabilityPage instance = new GovernanceDataObservabilityPage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  /** Click the Data Observability tab and await the DQ dashboard report API. */
  public GovernanceDataObservabilityPage openDataObservabilityTab() {
    page.waitForResponse(
        r -> r.url().contains("/api/v1/dataQuality/testSuites/dataQualityReport"),
        () -> dataObservabilityTab().click());
    return this;
  }

  public Locator dataObservabilityTab() {
    return page.getByRole(AriaRole.TAB, new Page.GetByRoleOptions().setName(DATA_OBSERVABILITY));
  }

  public Locator overviewTab() {
    return page.getByRole(AriaRole.TAB, new Page.GetByRoleOptions().setName(OVERVIEW));
  }

  /** Asserts all three pie chart widgets render. */
  public GovernanceDataObservabilityPage assertWidgetsVisible() {
    final LocatorAssertions.IsVisibleOptions opts =
        new LocatorAssertions.IsVisibleOptions().setTimeout(15_000);
    PlaywrightAssertions.assertThat(page.locator("#" + TEST_CASE_STATUS_PIE_ID)).isVisible(opts);
    PlaywrightAssertions.assertThat(page.locator("#" + ENTITY_HEALTH_PIE_ID)).isVisible(opts);
    PlaywrightAssertions.assertThat(page.locator("#" + DATA_ASSETS_COVERAGE_PIE_ID))
        .isVisible(opts);
    return this;
  }

  /**
   * Assert a filter chip ({@code search-dropdown-<name>}) is hidden — the pre-applied
   * entity filter should not be visible on its own detail page.
   */
  public GovernanceDataObservabilityPage assertFilterChipHidden(final String chipName) {
    PlaywrightAssertions.assertThat(byTestId("search-dropdown-" + chipName)).not().isVisible();
    return this;
  }

  public GovernanceDataObservabilityPage assertFilterChipVisible(final String chipName) {
    PlaywrightAssertions.assertThat(byTestId("search-dropdown-" + chipName)).isVisible();
    return this;
  }

  /** Click Overview tab and assert the DQ dashboard widgets are no longer rendered. */
  public GovernanceDataObservabilityPage switchToOverviewAndAssertHidden() {
    overviewTab().click();
    PlaywrightAssertions.assertThat(page.locator("#" + TEST_CASE_STATUS_PIE_ID)).not().isVisible();
    return this;
  }

  /**
   * Open the entity's version history (via {@code version-button}) and assert the
   * Data Observability tab is not present.
   */
  public GovernanceDataObservabilityPage openVersionHistoryAssertTabAbsent() {
    byTestId("version-button").click();
    page.waitForLoadState();
    PlaywrightAssertions.assertThat(dataObservabilityTab()).not().isVisible();
    return this;
  }

  @Override
  protected void waitForLoaded() {
    dataObservabilityTab()
        .first()
        .waitFor(
            new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE).setTimeout(20_000));
  }
}
