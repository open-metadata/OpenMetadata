package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import org.openmetadata.playwright.ui.UiSession;

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
  // The primary tab on every entity page carries data-testid="schema" (the EntityTabs.SCHEMA
  // enum key). Visible label varies — Tables show "Columns", Topics show "Schema" — so a
  // role+text match would only work for some types; testid is stable across all of them.
  private static final String TESTID_SCHEMA_TAB = "schema";
  // EntityTabs.TABLE_QUERIES → 'table_queries'. Visible label is 'Queries'.
  private static final String TESTID_TABLE_QUERIES_TAB = "table_queries";
  // Each query rendered on the Queries tab is wrapped in a Col with this testid.
  // Empty state (no linked queries) renders an 'add-query-btn' instead — so the
  // presence of at least one query-card is the clean affirmative signal.
  private static final String TESTID_QUERY_CARD = "query-card";

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
    return byTestId(TESTID_SCHEMA_TAB);
  }

  /** Click the Queries tab and return this page object for chaining. */
  public TablePage openQueriesTab() {
    byTestId(TESTID_TABLE_QUERIES_TAB).click();
    return this;
  }

  /**
   * All query cards currently rendered on the Queries tab. Use
   * {@code .first().isVisible()} to assert that at least one linked query renders —
   * the regression signal we care about is presence, not exact count.
   */
  public Locator queryCards() {
    return byTestId(TESTID_QUERY_CARD);
  }

  @Override
  protected void waitForLoaded() {
    entityNameDisplay().first().waitFor();
  }
}
