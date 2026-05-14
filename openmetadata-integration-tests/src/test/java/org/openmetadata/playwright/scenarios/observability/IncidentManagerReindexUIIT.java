package org.openmetadata.playwright.scenarios.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.search.ReindexEntitiesClient;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.it.util.UiTestServer;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.playwright.ui.pages.IncidentManagerPage;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.TestCases;

/**
 * Incident Manager list pre/post {@code reindexEntities(recreate=true)} of the
 * underlying test cases. Snapshot the row contents; assert equality after the
 * reindex so failures that drop incident severity / status / owner refs surface.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "INCIDENT_MANAGER", mode = ResourceAccessMode.READ_WRITE)
class IncidentManagerReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    TestCases.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void incidentTableSurvivesRecreate(final UiSession ui, final TestNamespace ns) {
    final List<TestCase> cases = seedTestCases(ns);
    reindex.recreateAndAwait("testCase", cases);

    final IncidentManagerPage before = IncidentManagerPage.open(ui);
    final long rowsBefore = before.rowCount();
    final String snapshotBefore = before.textSnapshot();
    before.rawPage().close();

    reindex.recreateAndAwait("testCase", cases);

    final IncidentManagerPage after = IncidentManagerPage.open(ui);
    assertThat(after.rowCount())
        .as("incident row count must equal pre-reindex")
        .isEqualTo(rowsBefore);
    assertThat(after.textSnapshot())
        .as("incident table snapshot must equal pre-reindex")
        .isEqualTo(snapshotBefore);
  }

  private static List<TestCase> seedTestCases(final TestNamespace ns) {
    final Table table = ShortStackFactory.table(ns);
    final String shortId = ns.uniqueShortId();
    return List.of(
        TestCases.create()
            .name("inc_row_" + shortId)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "1")
            .description("incident seed")
            .execute(),
        TestCases.create()
            .name("inc_nn_" + shortId)
            .forColumn(table, table.getColumns().get(0).getName())
            .testDefinition("columnValuesToBeNotNull")
            .description("incident seed")
            .execute());
  }
}
