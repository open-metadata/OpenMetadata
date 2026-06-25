package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.assertions.PlaywrightAssertions;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.WaitForSelectorState;
import java.time.Duration;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Drives the Data Quality flow on a Table's Profiler tab — create / edit / delete
 * test cases through the actual UI form, mirroring the user-flow assertions in
 * {@code openmetadata-ui/.../playwright/e2e/Features/DataQuality/DataQuality.spec.ts}
 * ("Table test case" scenario).
 *
 * <p>Locators kept close to the source TS spec so behavior parity is straightforward
 * to audit. Each user action awaits the API response the React component depends on
 * to keep snapshots race-free.
 */
public final class TableDataQualityPage extends PageObject {

  private static final Duration ACTION_TIMEOUT = Duration.ofSeconds(20);
  private static final String API_TEST_CASE_LIST = "/api/v1/dataQuality/testCases/search/list";
  private static final String API_TEST_CASE_CREATE = "/api/v1/dataQuality/testCases";
  private static final String API_TEST_CASE_UPDATE_REGEX = ".*/api/v1/dataQuality/testCases/.+";
  private static final String API_TEST_DEFINITION_REGEX =
      ".*/api/v1/dataQuality/testDefinitions/.+";

  private TableDataQualityPage(final Page page, final UiSession session) {
    super(page, session);
  }

  /** Navigates to the table page, opens the Profiler tab, then the Data Quality sub-tab. */
  public static TableDataQualityPage open(final UiSession ui, final String tableFqn) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl("/table/" + tableFqn));
    final TableDataQualityPage instance = new TableDataQualityPage(page, ui);
    instance.openDataQualityTab();
    return instance;
  }

  private void openDataQualityTab() {
    byTestId("profiler")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
    byTestId("profiler").click();
    page.waitForResponse(
        r -> r.url().contains(API_TEST_CASE_LIST),
        () ->
            page.getByRole(AriaRole.TAB, new Page.GetByRoleOptions().setName("Data Quality"))
                .click());
  }

  /**
   * Opens the Add Test Case form drawer (table-level test case). The TS spec calls this
   * via {@code profiler-add-table-test-btn} → menu radio "Test Case".
   */
  public TableDataQualityPage openCreateTestCaseDrawer() {
    byTestId("profiler-add-table-test-btn").click();
    page.getByRole(AriaRole.MENUITEMRADIO, new Page.GetByRoleOptions().setName("Test Case"))
        .click();
    byTestId("test-case-form-v1")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
    return this;
  }

  /** Switch the form drawer into Column Level mode and select the target column. */
  public TableDataQualityPage selectColumnLevel(final String columnName) {
    byTestId("select-table-card").getByText("Column Level").click();
    page.waitForResponse(
        r ->
            r.url().contains("/api/v1/dataQuality/testDefinitions")
                && r.url().contains("entityType=COLUMN"),
        () -> {
          page.locator("[id='root\\/column']").click();
          page.locator("[title='" + columnName + "']").click();
        });
    return this;
  }

  /**
   * Fill the column-level form for {@code columnValueLengthsToBeBetween} and submit.
   * Drawer detaches when create completes.
   */
  public TableDataQualityPage submitColumnValueLengthsToBeBetween(
      final String testCaseName, final String minLength, final String maxLength) {
    byTestId("test-case-name").fill(testCaseName);
    page.locator("[id='root\\/testType']").click();
    byTestId("columnValueLengthsToBeBetween").click();
    page.locator("#testCaseFormV1_params_minLength").fill(minLength);
    page.locator("#testCaseFormV1_params_maxLength").fill(maxLength);

    page.waitForResponse(
        r -> r.url().contains(API_TEST_CASE_CREATE) && r.request().method().equals("POST"),
        () -> byTestId("create-btn").click());
    byTestId("test-case-form-v1")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.DETACHED));
    return this;
  }

  /**
   * Fill the column-level form for {@code columnValuesToBeInSet} and submit. The form
   * exposes an "allowedValues" array param — entries added via the {@code +} button.
   */
  public TableDataQualityPage submitColumnValuesToBeInSet(
      final String testCaseName, final java.util.List<String> allowedValues) {
    byTestId("test-case-name").fill(testCaseName);
    page.locator("[id='root\\/testType']").click();
    byTestId("columnValuesToBeInSet").click();
    // Fill each allowed-value row. UI renders one row by default; click "+" for extras.
    for (int i = 0; i < allowedValues.size(); i++) {
      if (i > 0) {
        page.locator("[data-testid='add-allowed-value-button']").click();
      }
      page.locator("[data-testid='allowedValues-" + i + "']").fill(allowedValues.get(i));
    }
    page.waitForResponse(
        r -> r.url().contains(API_TEST_CASE_CREATE) && r.request().method().equals("POST"),
        () -> byTestId("create-btn").click());
    byTestId("test-case-form-v1")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.DETACHED));
    return this;
  }

  /**
   * Fills the minimal required fields and submits — name, test type
   * ({@code tableColumnNameToExist}), and the {@code columnName} parameter. Returns when
   * the drawer detaches, signaling the create flow is fully done.
   */
  public TableDataQualityPage submitTableColumnNameToExist(
      final String testCaseName, final String columnName) {
    byTestId("test-case-name").fill(testCaseName);
    page.locator("[id='root\\/testType']").click();
    byTestId("tableColumnNameToExist").click();
    page.locator("#testCaseFormV1_params_columnName").fill(columnName);

    page.waitForResponse(
        r -> r.url().contains(API_TEST_CASE_CREATE) && r.request().method().equals("POST"),
        () -> byTestId("create-btn").click());
    byTestId("test-case-form-v1")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.DETACHED));
    return this;
  }

  /** Asserts a row with {@code data-testid="<testCaseName>"} is in the list. */
  public TableDataQualityPage assertTestCaseVisible(final String testCaseName) {
    PlaywrightAssertions.assertThat(byTestId(testCaseName))
        .isVisible(
            new com.microsoft.playwright.assertions.LocatorAssertions.IsVisibleOptions()
                .setTimeout(ACTION_TIMEOUT.toMillis()));
    return this;
  }

  /** Asserts the test case row is no longer rendered (post-delete). */
  public TableDataQualityPage assertTestCaseGone(final String testCaseName) {
    PlaywrightAssertions.assertThat(byTestId(testCaseName))
        .not()
        .isVisible(
            new com.microsoft.playwright.assertions.LocatorAssertions.IsVisibleOptions()
                .setTimeout(ACTION_TIMEOUT.toMillis()));
    return this;
  }

  /**
   * Opens the action-dropdown for the named test case and clicks Edit. Waits for
   * the edit drawer title — works regardless of test type (table or column).
   */
  public TableDataQualityPage openEditDrawer(final String testCaseName) {
    byTestId("action-dropdown-" + testCaseName).click();
    page.waitForResponse(
        r -> r.url().matches(API_TEST_DEFINITION_REGEX),
        () -> byTestId("edit-" + testCaseName).click());
    byTestId("edit-test-case-drawer-title")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
    return this;
  }

  /** Update a single param field (id starts with {@code tableTestForm_params_}) and save. */
  public TableDataQualityPage updateParamAndSave(final String paramName, final String newValue) {
    final String selector = "#tableTestForm_params_" + paramName;
    page.locator(selector).clear();
    page.locator(selector).fill(newValue);
    page.waitForResponse(
        r ->
            r.url().matches(API_TEST_CASE_UPDATE_REGEX)
                && (r.request().method().equals("PUT") || r.request().method().equals("PATCH")),
        () -> byTestId("update-btn").click());
    byTestId("test-case-form-v1")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.DETACHED));
    return this;
  }

  /**
   * Read an array-shaped param at a given index from the OPEN edit drawer (caller
   * already invoked {@link #openEditDrawer}). Form field id pattern:
   * {@code #tableTestForm_params_<name>_<idx>_value}.
   */
  public String readArrayParamValue(final String paramName, final int index) {
    final String selector = "#tableTestForm_params_" + paramName + "_" + index + "_value";
    page.locator(selector)
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
    return page.locator(selector).inputValue();
  }

  /** Update an array-shaped param at a given index in the OPEN edit drawer and save. */
  public TableDataQualityPage updateArrayParamAndSave(
      final String paramName, final int index, final String newValue) {
    final String selector = "#tableTestForm_params_" + paramName + "_" + index + "_value";
    page.locator(selector).clear();
    page.locator(selector).fill(newValue);
    page.waitForResponse(
        r ->
            r.url().matches(API_TEST_CASE_UPDATE_REGEX)
                && (r.request().method().equals("PUT") || r.request().method().equals("PATCH")),
        () -> byTestId("update-btn").click());
    byTestId("test-case-form-v1")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.DETACHED));
    return this;
  }

  /** Click Cancel to close the OPEN edit drawer. */
  public TableDataQualityPage cancelEditDrawer() {
    page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Cancel")).click();
    byTestId("test-case-form-v1")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.DETACHED));
    return this;
  }

  /** Re-open the edit drawer, read a param input value, then close (Cancel). */
  public String readParam(final String testCaseName, final String paramName) {
    openEditDrawer(testCaseName);
    final String selector = "#tableTestForm_params_" + paramName;
    page.locator(selector)
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
    final String value = page.locator(selector).inputValue();
    page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Cancel")).click();
    byTestId("test-case-form-v1")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.DETACHED));
    return value;
  }

  /** Deletes the test case through the action menu + "DELETE" confirm dialog. */
  public TableDataQualityPage deleteTestCase(final String testCaseName) {
    byTestId("action-dropdown-" + testCaseName).click();
    byTestId("delete-" + testCaseName).click();
    page.locator("#deleteTextInput").fill("DELETE");
    page.waitForResponse(
        r ->
            r.url().contains("/api/v1/dataQuality/testCases/")
                && r.request().method().equals("DELETE"),
        () -> byTestId("confirm-button").click());
    return this;
  }
}
