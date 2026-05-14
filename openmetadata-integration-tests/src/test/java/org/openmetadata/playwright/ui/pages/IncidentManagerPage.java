package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.WaitForSelectorState;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Page object for {@code /incident-manager} — the central list of test-case
 * incidents. Reindex tests compare the row set before and after a
 * {@code reindexEntities} call on the underlying test cases.
 */
public final class IncidentManagerPage extends PageObject {

  private static final String PATH = "/incident-manager";
  private static final String TESTID_TABLE = "test-case-incident-manager-table";

  private IncidentManagerPage(final Page page, final UiSession session) {
    super(page, session);
  }

  public static IncidentManagerPage open(final UiSession ui) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl(PATH));
    final IncidentManagerPage instance = new IncidentManagerPage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  public Locator table() {
    return byTestId(TESTID_TABLE);
  }

  public long rowCount() {
    return table().locator("tbody tr").count();
  }

  /** Whitespace-normalized text of the incident table — used for snapshot diffs. */
  public String textSnapshot() {
    final String text = table().textContent();
    return text == null ? "" : text.replaceAll("\\s+", " ").trim();
  }

  @Override
  protected void waitForLoaded() {
    table().waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
    // Wait for either at least one row OR the "no incidents" empty-state to render —
    // otherwise a snapshot taken mid-load misses async-rendered placeholders and the
    // text differs between two runs of the same page.
    page.waitForFunction(
        "() => { const t = document.querySelector('[data-testid=\"test-case-incident-manager-table\"]');"
            + " if (!t) return false;"
            + " const rows = t.querySelectorAll('tbody tr').length;"
            + " const empty = t.querySelector('.ant-empty, [class*=\"empty\"]');"
            + " return rows > 0 || empty !== null; }");
  }
}
