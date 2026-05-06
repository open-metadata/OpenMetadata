package org.openmetadata.jpw.scenarios.ui;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.jpw.search.ReindexHelpers;
import org.openmetadata.jpw.ui.UiSession;
import org.openmetadata.jpw.ui.UiSessionExtension;
import org.openmetadata.jpw.ui.pages.ExplorePage;
import org.openmetadata.jpw.util.UiTestServer;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.sdk.fluent.Apps;

/**
 * Reference port for the new UI pattern: Chromium reused via {@code SessionBrowser},
 * per-test isolation via {@code UiSessionExtension}, page interaction via {@code ExplorePage}.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
class SearchAfterReindexUIIT {

  @BeforeAll
  static void setup() {
    SdkClients.useFluentApis(UiTestServer.get().sdk());
    Apps.setDefaultClient(UiTestServer.get().sdk());
  }

  @Test
  void seededTableAppearsInExploreSearchAfterReindex(
      final UiSession ui, final TestNamespace ns) {
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    ReindexHelpers.triggerSearchIndexAndWait(ui.server());

    final ExplorePage explore = ExplorePage.open(ui, ExplorePage.Tab.TABLES).search(table.getName());

    assertThat(explore.firstResultByName(table.getName())).isVisible();
  }
}
