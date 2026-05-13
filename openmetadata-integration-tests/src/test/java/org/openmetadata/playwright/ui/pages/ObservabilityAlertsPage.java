package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.WaitForSelectorState;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Page object for {@code /observability/alerts} — list of observability event
 * subscriptions. Reindex tests assert the alert rows and names survive a
 * {@code reindexEntities} call on the alert entities.
 */
public final class ObservabilityAlertsPage extends PageObject {

  private static final String PATH = "/observability/alerts";
  private static final String TESTID_TABLE = "alert-table";
  private static final String TESTID_ALERT_NAME = "alert-name";

  private ObservabilityAlertsPage(final Page page, final UiSession session) {
    super(page, session);
  }

  public static ObservabilityAlertsPage open(final UiSession ui) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl(PATH));
    final ObservabilityAlertsPage instance = new ObservabilityAlertsPage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  public Locator table() {
    return byTestId(TESTID_TABLE);
  }

  public Locator alertNameCells() {
    return page.getByTestId(TESTID_ALERT_NAME);
  }

  public long alertCount() {
    return alertNameCells().count();
  }

  public String textSnapshot() {
    final String text = table().textContent();
    return text == null ? "" : text.replaceAll("\\s+", " ").trim();
  }

  @Override
  protected void waitForLoaded() {
    table().waitFor(new Locator.WaitForOptions().setState(WaitForSelectorState.VISIBLE));
  }
}
