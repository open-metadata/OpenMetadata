package org.openmetadata.playwright.ui.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import org.openmetadata.playwright.ui.UiSession;

/**
 * Page object for {@code /topic/<fqn>} — a single topic's details page.
 *
 * <p>Exposes the schema-fields table and the field-level copy/expand controls used by the
 * {@code Features/Topic.spec.ts} scenarios.
 */
public final class TopicPage extends PageObject {

  private static final String TOPIC_PATH_PREFIX = "/topic/";
  private static final String TESTID_ENTITY_NAME = "entity-header-name";
  private static final String TESTID_ENTITY_DISPLAY_NAME = "entity-header-display-name";
  private static final String TESTID_SCHEMA_FIELDS_TABLE = "topic-schema-fields-table";
  private static final String TESTID_COPY_FIELD_LINK = "copy-field-link-button";
  private static final String TESTID_EXPAND_ICON = "expand-icon";
  private static final String TESTID_CLOSE_BUTTON = "close-button";
  private static final String COLUMN_DETAIL_PANEL_SELECTOR = ".column-detail-panel";
  // EntityTabs.SCHEMA enum key — matches the data-testid on the primary tab regardless of
  // the visible label (Topic shows "Schema", Table shows "Columns", same testid).
  private static final String TESTID_SCHEMA_TAB = "schema";

  private TopicPage(final Page page, final UiSession session) {
    super(page, session);
  }

  public static TopicPage open(final UiSession ui, final String fullyQualifiedName) {
    final Page page = ui.newPage();
    page.navigate(ui.uiUrl(TOPIC_PATH_PREFIX + fullyQualifiedName));
    final TopicPage instance = new TopicPage(page, ui);
    instance.waitForLoaded();
    return instance;
  }

  public Locator entityNameDisplay() {
    return byTestId(TESTID_ENTITY_NAME).or(byTestId(TESTID_ENTITY_DISPLAY_NAME));
  }

  public Locator schemaTab() {
    return byTestId(TESTID_SCHEMA_TAB);
  }

  public Locator schemaFieldsTable() {
    return byTestId(TESTID_SCHEMA_FIELDS_TABLE);
  }

  public Locator copyFieldLinkButtons() {
    return byTestId(TESTID_COPY_FIELD_LINK);
  }

  public Locator expandIcons() {
    return byTestId(TESTID_EXPAND_ICON);
  }

  public Locator columnDetailPanel() {
    return page.locator(COLUMN_DETAIL_PANEL_SELECTOR);
  }

  public Locator closeButton() {
    return byTestId(TESTID_CLOSE_BUTTON);
  }

  @Override
  protected void waitForLoaded() {
    entityNameDisplay().first().waitFor();
  }
}
