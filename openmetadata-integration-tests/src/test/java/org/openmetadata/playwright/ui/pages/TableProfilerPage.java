package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.microsoft.playwright.assertions.PlaywrightAssertions;
import com.microsoft.playwright.options.AriaRole;
import com.microsoft.playwright.options.WaitForSelectorState;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Drives the Table → Profiler → Column Profile flow that
 * {@code openmetadata-ui/.../playwright/e2e/Features/DataQuality/Profiler.spec.ts}
 * exercises:
 *
 * <ol>
 *   <li>Open the table page, click Profiler tab — wait for {@code /tableProfile/latest}.
 *   <li>Click "Column Profile" tab — wait for {@code /columns} list.
 *   <li>Click a column row — wait for {@code /columnProfile?...}, then assert the four
 *       charts ({@code count_graph}, {@code proportion_graph}, {@code math_graph},
 *       {@code sum_graph}) are visible.
 * </ol>
 */
public final class TableProfilerPage extends PageObject {

  private static final String API_TABLE_PROFILE_LATEST = "/tableProfile/latest";
  private static final String API_COLUMNS_LIST_REGEX = ".*/api/v1/tables/name/.+/columns.*";
  private static final String API_COLUMN_PROFILE = "/columnProfile";

  private TableProfilerPage(final Page page, final UiSession session) {
    super(page, session);
  }

  public static TableProfilerPage open(final UiSession ui, final String tableFqn) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl("/table/" + tableFqn));
    final TableProfilerPage instance = new TableProfilerPage(page, ui);
    instance.openProfilerTab();
    return instance;
  }

  private void openProfilerTab() {
    byTestId("profiler")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
    page.waitForResponse(
        r -> r.url().contains(API_TABLE_PROFILE_LATEST) && r.status() == 200,
        () -> byTestId("profiler").click());
  }

  /** Switches to the Column Profile sub-tab and waits for the columns API to settle. */
  public TableProfilerPage openColumnProfileTab() {
    page.waitForResponse(
        r -> r.url().matches(API_COLUMNS_LIST_REGEX),
        () ->
            page.getByRole(AriaRole.TAB, new Page.GetByRoleOptions().setName("Column Profile"))
                .click());
    return this;
  }

  /**
   * Click a column row by its name; waits for the column profile API. The row uses
   * {@code data-row-key="<columnFqn>"} and contains a clickable text with the column name.
   */
  public TableProfilerPage selectColumn(final String columnFqn, final String columnName) {
    page.waitForResponse(
        r -> r.url().contains(API_COLUMN_PROFILE) && r.status() == 200,
        () -> page.locator("[data-row-key='" + columnFqn + "']").getByText(columnName).click());
    return this;
  }

  /**
   * Open the profiler settings modal via the gear button. Settings access lives on the
   * Data Quality sub-tab, so we navigate there first.
   */
  public TableProfilerPage openSettingsModal() {
    page.getByRole(AriaRole.TAB, new Page.GetByRoleOptions().setName("Data Quality")).click();
    byTestId("profiler-setting-btn").click();
    byTestId("profiler-settings-modal")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
    return this;
  }

  /** Set the profile sample (slider input) — the value is a percentage. */
  public TableProfilerPage setProfileSample(final String pct) {
    byTestId("slider-input").clear();
    byTestId("slider-input").fill(pct);
    return this;
  }

  /** Set the sampleDataCount input. */
  public TableProfilerPage setSampleDataCount(final String count) {
    byTestId("sample-data-count-input").clear();
    byTestId("sample-data-count-input").fill(count);
    return this;
  }

  /** Add an exclude-column entry by typing the column name + Enter. */
  public TableProfilerPage addExcludeColumn(final String columnName) {
    byTestId("exclude-column-select").click();
    page.keyboard().type(columnName);
    page.keyboard().press("Enter");
    return this;
  }

  /** Save settings — awaits the {@code /tableProfilerConfig} PUT response. */
  public TableProfilerPage saveSettings() {
    page.waitForResponse(
        r -> r.url().contains("/tableProfilerConfig") && r.request().method().equals("PUT"),
        () -> page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Save")).click());
    byTestId("profiler-settings-modal")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.DETACHED));
    return this;
  }

  /**
   * Read the slider input value (profile sample %) from the OPEN settings modal,
   * stripping the trailing {@code %} the UI appends on display.
   */
  public String readProfileSample() {
    final String raw = byTestId("slider-input").inputValue();
    return raw == null ? null : raw.replace("%", "").trim();
  }

  /** Read the sample-data-count input value from the OPEN settings modal. */
  public String readSampleDataCount() {
    return byTestId("sample-data-count-input").inputValue();
  }

  /** Close the settings modal via Cancel. */
  public TableProfilerPage cancelSettings() {
    page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Cancel")).click();
    byTestId("profiler-settings-modal")
        .waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.DETACHED));
    return this;
  }

  /** Asserts all four column-profile chart widgets are rendered. */
  public TableProfilerPage assertChartsVisible() {
    final LocatorAssertions.IsVisibleOptions opts =
        new LocatorAssertions.IsVisibleOptions().setTimeout(30_000);
    PlaywrightAssertions.assertThat(page.locator("#count_graph")).isVisible(opts);
    PlaywrightAssertions.assertThat(page.locator("#proportion_graph")).isVisible(opts);
    PlaywrightAssertions.assertThat(page.locator("#math_graph")).isVisible(opts);
    PlaywrightAssertions.assertThat(page.locator("#sum_graph")).isVisible(opts);
    return this;
  }
}
