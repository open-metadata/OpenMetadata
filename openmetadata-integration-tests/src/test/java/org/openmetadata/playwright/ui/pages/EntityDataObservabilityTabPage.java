package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.WaitForSelectorState;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Page object for the entity (Table) Data Observability area at
 * {@code /table/<fqn>/profiler/<subTab>}. Sub-tabs match {@code ProfilerTabPath}:
 * {@code overview}, {@code table-profile}, {@code column-profile}, {@code data-quality},
 * {@code incidents}.
 */
public final class EntityDataObservabilityTabPage extends PageObject {

  private static final String TESTID_PROFILER_CONTAINER = "table-profiler-container";

  private EntityDataObservabilityTabPage(final Page page, final UiSession session) {
    super(page, session);
  }

  public static EntityDataObservabilityTabPage open(
      final UiSession ui, final String tableFqn, final SubTab subTab) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl("/table/" + tableFqn + "/profiler/" + subTab.path));
    final EntityDataObservabilityTabPage instance = new EntityDataObservabilityTabPage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  public Locator container() {
    return byTestId(TESTID_PROFILER_CONTAINER);
  }

  /** Whitespace-normalized text of the entire profiler container — used for snapshot diffs. */
  public String textSnapshot() {
    if (container().count() == 0) {
      return "";
    }
    final String text = container().textContent();
    return text == null ? "" : text.replaceAll("\\s+", " ").trim();
  }

  @Override
  protected void waitForLoaded() {
    container().waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
    // Wait for async sub-tab content to settle: either rows have rendered or the
    // empty-state placeholder is up. Without this, snapshots taken mid-load on the
    // INCIDENTS / DATA_QUALITY sub-tabs catch a header-only state.
    page.waitForFunction(
        "() => { const c = document.querySelector('[data-testid=\"table-profiler-container\"]');"
            + " if (!c) return false;"
            + " const rows = c.querySelectorAll('tbody tr').length;"
            + " const empty = c.querySelector('.ant-empty, [class*=\"empty\"]');"
            + " const cards = c.querySelectorAll('[class*=\"card\"], [class*=\"chart\"]').length;"
            + " return rows > 0 || empty !== null || cards > 2; }");
  }

  public enum SubTab {
    OVERVIEW("overview"),
    TABLE_PROFILE("table-profile"),
    COLUMN_PROFILE("column-profile"),
    DATA_QUALITY("data-quality"),
    INCIDENTS("incidents");

    final String path;

    SubTab(final String path) {
      this.path = path;
    }
  }
}
