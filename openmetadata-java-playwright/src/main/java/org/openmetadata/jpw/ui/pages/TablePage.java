package org.openmetadata.jpw.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.AriaRole;
import org.openmetadata.jpw.ui.UiSession;

/**
 * Page object for {@code /table/<fqn>} — a single table's details page.
 *
 * <p>Open with {@link #open(UiSession, String)} and read or interact via the methods below.
 * Navigation goes directly to the table URL — no exploring/searching required.
 */
public final class TablePage extends PageObject {

  private static final String TABLE_PATH_PREFIX = "/table/";
  // The display-name testid only renders when an explicit displayName is set; the plain
  // name testid is always present. We accept either so the locator is robust across both.
  private static final String TESTID_ENTITY_NAME = "entity-header-name";
  private static final String TESTID_ENTITY_DISPLAY_NAME = "entity-header-display-name";
  private static final String SCHEMA_TAB_NAME = "Schema";

  private TablePage(final Page page, final UiSession session) {
    super(page, session);
  }

  public static TablePage open(final UiSession ui, final String fullyQualifiedName) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl(TABLE_PATH_PREFIX + fullyQualifiedName));
    final TablePage instance = new TablePage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  public Locator entityNameDisplay() {
    return byTestId(TESTID_ENTITY_NAME).or(byTestId(TESTID_ENTITY_DISPLAY_NAME));
  }

  public Locator schemaTab() {
    return page.getByRole(AriaRole.TAB).filter(new Locator.FilterOptions().setHasText(SCHEMA_TAB_NAME));
  }

  @Override
  protected void waitForLoaded() {
    entityNameDisplay().first().waitFor();
  }
}
