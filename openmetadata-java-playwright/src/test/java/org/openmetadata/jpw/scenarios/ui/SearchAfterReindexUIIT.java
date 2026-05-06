package org.openmetadata.jpw.scenarios.ui;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Page;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.jpw.search.ReindexHelpers;
import org.openmetadata.jpw.server.ServerHandle;
import org.openmetadata.jpw.ui.PlaywrightFixture;
import org.openmetadata.jpw.util.UiTestServer;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.sdk.fluent.Apps;

/**
 * End-to-end UI scenario: seed a table via the SDK, trigger a reindex, then drive Explore
 * in a real browser and assert the seeded table appears in search results.
 *
 * <p>Mode-agnostic — {@link UiTestServer} picks containerized (default) or external (when
 * {@code OM_URL} + {@code OM_ADMIN_TOKEN} are set) and the test doesn't care which.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
class SearchAfterReindexUIIT {

  private static ServerHandle server;

  @BeforeAll
  static void setup() {
    server = UiTestServer.get();
    SdkClients.useFluentApis(server.sdk());
    Apps.setDefaultClient(server.sdk());
  }

  @Test
  void seededTableAppearsInExploreSearchAfterReindex(final TestNamespace ns) {
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    ReindexHelpers.triggerSearchIndexAndWait(server);

    try (PlaywrightFixture pw = PlaywrightFixture.launch(server)) {
      final Page page = pw.newPage();
      page.navigate(server.baseUrl().resolve("/explore/tables").toString());
      page.getByPlaceholder("Search").first().fill(table.getName());
      page.keyboard().press("Enter");

      assertThat(page.getByText(table.getName()).first()).isVisible();
    }
  }
}
