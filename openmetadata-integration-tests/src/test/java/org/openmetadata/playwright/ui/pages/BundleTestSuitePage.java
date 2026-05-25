package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.assertions.PlaywrightAssertions;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.WaitForSelectorState;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Page object for the bundle (logical) test suite create flow + the suite detail
 * page's "Add Test Case" modal. Mirrors
 * {@code openmetadata-ui/.../playwright/e2e/Pages/TestSuiteDetailsPage.spec.ts}.
 */
public final class BundleTestSuitePage extends PageObject {

  private static final String BUNDLE_LIST_PATH = "/data-quality/test-suites/bundle-suites";
  private static final String API_LIST = "/api/v1/dataQuality/testCases/search/list";
  private static final String API_TEST_SUITES_CREATE = "/api/v1/dataQuality/testSuites";

  private BundleTestSuitePage(final Page page, final UiSession session) {
    super(page, session);
  }

  /** Open the bundle-suites listing and click "Add Test Suite". */
  public static BundleTestSuitePage openCreateForm(final UiSession ui) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl(BUNDLE_LIST_PATH));
    final BundleTestSuitePage instance = new BundleTestSuitePage(page, ui);
    page.waitForResponse(
        r -> r.url().contains(API_LIST), () -> instance.byTestId("add-test-suite-btn").click());
    return instance;
  }

  /**
   * Fill name + description, search for the test case to attach, click its row, submit.
   * Returns when the testSuites POST completes.
   */
  public BundleTestSuitePage fillNameDescriptionAndAttach(
      final String suiteName, final String description, final String testCaseName) {
    page.locator("[data-testid='test-suite-name']").fill(suiteName);
    page.locator("[data-testid='editor'] [contenteditable='true']").first().fill(description);

    // The selection card and its searchbar render after the create form opens; allow
    // a generous wait. The actual render path varies by build — fall back to a
    // page-wide searchbar locator if the scoped one isn't present.
    page.waitForLoadState();
    final Locator scopedSearchbar =
        page.locator("[data-testid='test-case-selection-card'] [data-testid='searchbar']");
    final Locator pageSearchbar = page.locator("[data-testid='searchbar']").last();
    Locator searchbar;
    try {
      scopedSearchbar.waitFor(
          new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE).setTimeout(30_000));
      searchbar = scopedSearchbar;
    } catch (final RuntimeException e) {
      pageSearchbar.waitFor(
          new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE).setTimeout(15_000));
      searchbar = pageSearchbar;
    }
    searchbar.fill(testCaseName);
    page.waitForResponse(r -> r.url().contains(API_LIST), () -> {});
    page.locator("[data-testid='" + testCaseName + "']").first().click();
    page.waitForResponse(
        r -> r.url().contains(API_TEST_SUITES_CREATE) && r.request().method().equals("POST"),
        () -> byTestId("submit-button").click());
    return this;
  }

  /** Navigate to {@code /test-suites/<encoded-name>}. */
  public BundleTestSuitePage openDetail(final String suiteName) {
    final Page newPage = page.context().newPage();
    final String url =
        session.uiUrl("/test-suites/" + URLEncoder.encode(suiteName, StandardCharsets.UTF_8));
    newPage.waitForResponse(r -> r.url().contains(API_LIST), () -> newPage.navigate(url));
    return new BundleTestSuitePage(newPage, session);
  }

  /** Click the Add Test Case button on the detail page; wait for modal list response. */
  public BundleTestSuitePage openAddTestCaseModal() {
    page.waitForResponse(
        r -> r.url().contains(API_LIST), () -> byTestId("add-test-case-btn").click());
    return this;
  }

  /** Asserts the 4 filter dropdowns render in the Add Test Case modal. */
  public BundleTestSuitePage assertModalFilterDropdownsVisible() {
    final LocatorAssertions.IsVisibleOptions opts =
        new LocatorAssertions.IsVisibleOptions().setTimeout(15_000);
    PlaywrightAssertions.assertThat(byTestId("search-dropdown-Status")).isVisible(opts);
    PlaywrightAssertions.assertThat(byTestId("search-dropdown-Test Type")).isVisible(opts);
    PlaywrightAssertions.assertThat(byTestId("search-dropdown-Table")).isVisible(opts);
    PlaywrightAssertions.assertThat(byTestId("search-dropdown-Column")).isVisible(opts);
    return this;
  }

  /** Toggle select-all on, assert first row checked, toggle off, assert unchecked. */
  public BundleTestSuitePage exerciseSelectAllToggle() {
    final Locator dialog =
        page.getByRole(AriaRole.DIALOG, new Page.GetByRoleOptions().setName("Add Test Cases"));
    final Locator selectAll = dialog.getByTestId("select-all-test-cases");
    final Locator firstCheckbox = dialog.locator("[data-testid^='checkbox-']").first();

    selectAll.click();
    PlaywrightAssertions.assertThat(firstCheckbox).isChecked();
    selectAll.click();
    PlaywrightAssertions.assertThat(firstCheckbox).not().isChecked();
    return this;
  }

  /** Cancel the Add Test Case modal and assert it's no longer rendered. */
  public BundleTestSuitePage cancelAddModal() {
    page.getByRole(AriaRole.DIALOG).getByTestId("cancel").click();
    PlaywrightAssertions.assertThat(page.getByRole(AriaRole.DIALOG)).not().isVisible();
    return this;
  }

  /**
   * From the Add Test Case modal: search for a test case, click its row, click submit
   * — awaits the {@code /logicalTestCases/bulk} POST that links the test case to the suite.
   */
  public BundleTestSuitePage addTestCaseFromModal(final String testCaseName) {
    page.locator("[data-testid='test-case-selection-card'] [data-testid='searchbar']")
        .fill(testCaseName);
    page.waitForResponse(r -> r.url().contains(API_LIST), () -> {});
    page.locator("[data-testid='test-case-selection-card'] [data-testid='" + testCaseName + "']")
        .click();
    page.waitForResponse(
        r -> r.url().contains("/api/v1/dataQuality/testCases/logicalTestCases/bulk"),
        () -> byTestId("submit").click());
    return this;
  }

  /**
   * Delete the suite via manage-button → delete-button → hard-delete option →
   * "DELETE" confirm input → confirm-button. Awaits the DELETE response.
   */
  public BundleTestSuitePage hardDeleteSuite() {
    byTestId("manage-button").click();
    byTestId("delete-button").click();
    byTestId("hard-delete-option").click();
    page.locator("[data-testid='confirmation-text-input']").fill("DELETE");
    page.waitForResponse(
        r ->
            r.url().contains("/api/v1/dataQuality/testSuites/")
                && r.url().contains("hardDelete=true"),
        () -> byTestId("confirm-button").click());
    return this;
  }

  @Override
  protected void waitForLoaded() {
    byTestId("add-test-suite-btn")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
  }
}
