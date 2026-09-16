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
 * Page object for the Tag detail page's Data Observability tab. Mirrors
 * {@code DataObservabilityGovernanceTab.spec.ts → "Tag detail page" describe block}.
 *
 * <p>The DQ widgets render under fixed CSS IDs (not testids):
 * {@code #test-case-result-pie-chart}, {@code #healthy-data-assets-pie-chart},
 * {@code #data-assets-coverage-pie-chart}.
 */
public final class TagDataObservabilityPage extends PageObject {

  private static final String TEST_CASE_STATUS_PIE = "test-case-result-pie-chart";
  private static final String ENTITY_HEALTH_PIE = "healthy-data-assets-pie-chart";
  private static final String COVERAGE_PIE = "data-assets-coverage-pie-chart";

  private TagDataObservabilityPage(final Page page, final UiSession session) {
    super(page, session);
  }

  /** Navigate to {@code /tag/<encoded-fqn>}. The TS spec uses singular "tag", not "tags". */
  public static TagDataObservabilityPage open(final UiSession ui, final String tagFqn) {
    final Page page = ui.newPage();
    final String encoded = URLEncoder.encode(tagFqn, StandardCharsets.UTF_8);
    page.navigate(ui.uiUrl("/tag/" + encoded));
    final TagDataObservabilityPage instance = new TagDataObservabilityPage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  /** Click the "Data Observability" tab and wait for the DQ dashboard report API. */
  public TagDataObservabilityPage openDataObservabilityTab() {
    page.waitForResponse(
        r -> r.url().contains("/api/v1/dataQuality/testSuites/dataQualityReport"),
        () ->
            page.getByRole(
                    AriaRole.TAB,
                    new Page.GetByRoleOptions()
                        .setName(Pattern.compile("data observability", Pattern.CASE_INSENSITIVE)))
                .click());
    return this;
  }

  /** Asserts all three pie chart widgets render. */
  public TagDataObservabilityPage assertWidgetsVisible() {
    final LocatorAssertions.IsVisibleOptions opts =
        new LocatorAssertions.IsVisibleOptions().setTimeout(15_000);
    PlaywrightAssertions.assertThat(page.locator("#" + TEST_CASE_STATUS_PIE)).isVisible(opts);
    PlaywrightAssertions.assertThat(page.locator("#" + ENTITY_HEALTH_PIE)).isVisible(opts);
    PlaywrightAssertions.assertThat(page.locator("#" + COVERAGE_PIE)).isVisible(opts);
    return this;
  }

  @Override
  protected void waitForLoaded() {
    page.getByRole(
            AriaRole.TAB,
            new Page.GetByRoleOptions()
                .setName(Pattern.compile("data observability", Pattern.CASE_INSENSITIVE)))
        .first()
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
  }
}
