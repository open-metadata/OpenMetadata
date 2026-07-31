package org.openmetadata.playwright.scenarios.ui.smoke;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.playwright.ui.pages.TablePage;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;

/**
 * Smoke check for the new UI pattern: SDK setup, direct URL navigation, page object
 * assertion. Validates that a freshly-created table renders on its detail page with the
 * expected name and schema tab, no UI clicks for setup.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
class TableDetailsSmokeUIIT {

  @Test
  void newlyCreatedTableLandsOnItsDetailsPage(final UiSession ui, final TestNamespace ns) {
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    final TablePage tablePage = TablePage.open(ui, table.getFullyQualifiedName());

    assertThat(tablePage.entityNameDisplay()).containsText(table.getName());
    assertThat(tablePage.schemaTab()).isVisible();
  }
}
