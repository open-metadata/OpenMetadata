package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.assertions.PlaywrightAssertions;
import com.microsoft.playwright.options.WaitForSelectorState;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Page object for the global Data Quality page at {@code /data-quality} → Test Cases tab.
 * Mirrors the filter exercises in {@code DataQuality.spec.ts → "TestCase filters"}.
 */
public final class DataQualityListPage extends PageObject {

  private static final String API_LIST = "/api/v1/dataQuality/testCases/search/list";
  private static final String API_LIST_SUITES = "/api/v1/dataQuality/testSuites/search/list";
  private static final String TESTID_TEST_SUITES_TAB = "test-suites";
  private static final String TESTID_TEST_SUITE_CONTAINER = "test-suite-container";

  private DataQualityListPage(final Page page, final UiSession session) {
    super(page, session);
  }

  /** Open {@code /data-quality} and click the Test Cases tab; await the list API. */
  public static DataQualityListPage open(final UiSession ui) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl("/data-quality"));
    final DataQualityListPage instance = new DataQualityListPage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  private void waitForListApi() {
    page.waitForResponse(r -> r.url().contains(API_LIST), () -> {});
  }

  /** Search the test case list by exact text using the search bar. */
  public DataQualityListPage searchByName(final String testCaseName) {
    page.waitForResponse(
        r -> r.url().contains(API_LIST) && r.url().contains(testCaseName),
        () ->
            page.locator("[data-testid='test-case-container'] [data-testid='searchbar']")
                .fill(testCaseName));
    return this;
  }

  /** Clear the search bar. */
  public DataQualityListPage clearSearch() {
    page.waitForResponse(
        r -> r.url().contains(API_LIST),
        () -> page.locator(".ant-input-clear-icon").first().click());
    return this;
  }

  /**
   * Add a filter chip via the {@code advanced-filter} popover. {@code chipValue} matches
   * the {@code value=} attribute on the option (e.g., {@code tier}, {@code serviceName}).
   */
  public DataQualityListPage enableAdvancedFilter(final String chipValue) {
    byTestId("advanced-filter").click();
    page.locator("[value='" + chipValue + "']").click();
    return this;
  }

  /** Apply the tags filter for a given tag FQN; awaits the filtered list response. */
  public DataQualityListPage filterByTag(final String tagFqn) {
    page.locator("[data-testid='tags-select-filter']")
        .locator("div")
        .filter(new Locator.FilterOptions().setHasText("Tags"))
        .click();
    page.locator("#tags").fill(tagFqn);
    page.waitForResponse(
        r -> r.url().contains(API_LIST) && r.url().contains("tags=" + tagFqn),
        () ->
            page.locator(
                    ".ant-select-dropdown:not(.ant-select-dropdown-hidden) [data-testid='"
                        + tagFqn
                        + "']")
                .first()
                .click());
    return this;
  }

  /** Apply the testCaseType filter (label-cased: "Column", "Table", "All"). */
  public DataQualityListPage filterByTestCaseType(final String label) {
    final String urlFragment = "testCaseType=" + label.toLowerCase();
    byTestId("test-case-type-select-filter").click();
    page.waitForResponse(
        r -> r.url().contains(API_LIST) && r.url().contains(urlFragment),
        () ->
            page.locator(
                    ".ant-select-dropdown:not(.ant-select-dropdown-hidden) [title='" + label + "']")
                .first()
                .click());
    return this;
  }

  /** Asserts a row with {@code data-testid="<testCaseName>"} is rendered. */
  public DataQualityListPage assertTestCaseVisible(final String testCaseName) {
    PlaywrightAssertions.assertThat(byTestId(testCaseName))
        .isVisible(new LocatorAssertions.IsVisibleOptions().setTimeout(20_000));
    return this;
  }

  /**
   * Click the Test Suites tab. The component defaults its sub-toggle to {@code TABLE_SUITES}
   * (where basic suites auto-created by {@code TestCaseBuilder.forTable} live), so we don't
   * have to click the radio explicitly — that would be a no-op and would block the
   * {@code waitForResponse} below.
   */
  public DataQualityListPage openTestSuitesTab() {
    page.waitForResponse(
        r -> r.url().contains(API_LIST_SUITES), () -> byTestId(TESTID_TEST_SUITES_TAB).click());
    byTestId(TESTID_TEST_SUITE_CONTAINER)
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
    return this;
  }

  /**
   * Filter the test-suites list via its searchbar; awaits the filtered list response.
   * For basic suites prefer the parent table's leaf name (e.g. {@code t_<shortId>}) over
   * the suite's own dotted {@code name} — the search API tokenizes on dots and the dotted
   * form filters poorly.
   */
  public DataQualityListPage searchTestSuiteByName(final String searchTerm) {
    page.waitForResponse(
        r -> r.url().contains(API_LIST_SUITES) && r.url().contains(searchTerm),
        () ->
            page.locator(
                    "[data-testid='" + TESTID_TEST_SUITE_CONTAINER + "'] [data-testid='searchbar']")
                .fill(searchTerm));
    return this;
  }

  /**
   * Asserts a test-suite row whose link text contains {@code visibleText} is rendered.
   * For basic suites the link text is {@code record.basicEntityReference.fullyQualifiedName}
   * (the parent table's FQN) — that's what the user sees and is what we match on, rather
   * than the dotted {@code data-testid={record.name}} which is brittle.
   */
  public DataQualityListPage assertTestSuiteVisible(final String visibleText) {
    PlaywrightAssertions.assertThat(
            byTestId(TESTID_TEST_SUITE_CONTAINER).getByText(visibleText).first())
        .isVisible(new LocatorAssertions.IsVisibleOptions().setTimeout(20_000));
    return this;
  }

  /** Asserts a row with {@code data-testid="<testCaseName>"} is NOT rendered. */
  public DataQualityListPage assertTestCaseGone(final String testCaseName) {
    PlaywrightAssertions.assertThat(byTestId(testCaseName))
        .not()
        .isVisible(new LocatorAssertions.IsVisibleOptions().setTimeout(20_000));
    return this;
  }

  // ---- Pagination ----

  public Locator paginationContainer() {
    return byTestId("pagination");
  }

  public Locator previousButton() {
    return byTestId("previous");
  }

  public Locator nextButton() {
    return byTestId("next");
  }

  public Locator pageIndicator() {
    return byTestId("page-indicator");
  }

  /** Click next; await the next-page list response. */
  public DataQualityListPage clickNext() {
    page.waitForResponse(r -> r.url().contains(API_LIST), () -> nextButton().click());
    return this;
  }

  /** Click previous; await the prev-page list response. */
  public DataQualityListPage clickPrevious() {
    page.waitForResponse(r -> r.url().contains(API_LIST), () -> previousButton().click());
    return this;
  }

  /** Open the page-size dropdown and assert the standard 3 options render. */
  public DataQualityListPage assertPageSizeOptionsCount(final int expected) {
    openMenu(byTestId("page-size-selection-dropdown"), page.locator(".ant-dropdown-menu"));
    PlaywrightAssertions.assertThat(page.locator(".ant-dropdown-menu-item")).hasCount(expected);
    return this;
  }

  @Override
  protected void waitForLoaded() {
    byTestId("test-cases")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
    page.waitForResponse(r -> r.url().contains(API_LIST), () -> byTestId("test-cases").click());
  }
}
