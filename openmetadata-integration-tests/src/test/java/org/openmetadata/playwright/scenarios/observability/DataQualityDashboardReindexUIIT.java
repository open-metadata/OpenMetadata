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
import org.openmetadata.playwright.ui.pages.DataQualityDashboardPage;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.TestCases;

/**
 * Renders the home Data Quality dashboard, snapshots its widget text, fires a
 * recreate reindex against the seeded test cases (POST /v1/search/reindexEntities),
 * then re-renders and asserts the snapshot is identical.
 *
 * <p>Catches regressions where reindexing a testCase entity drops fields the
 * dashboard's aggregations rely on (status, severity, owner refs).
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "DQ_DASHBOARD", mode = ResourceAccessMode.READ_WRITE)
class DataQualityDashboardReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    TestCases.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void dashboardSurvivesRecreate(final UiSession ui, final TestNamespace ns) {
    final List<TestCase> seeded = seedTestCases(ns);
    // Pre-warm via the recreate path so the pre-snapshot reflects fully indexed state
    // — DQ aggregations lag the testCase index without it.
    reindex.recreateAndAwait("testCase", seeded);

    final DataQualityDashboardPage before = DataQualityDashboardPage.open(ui);
    final String snapshotBefore = before.widgetTextSnapshot();
    assertThat(snapshotBefore)
        .as("dashboard must render some widget text pre-reindex")
        .isNotBlank();
    before.rawPage().close();

    reindex.recreateAndAwait("testCase", seeded);

    final DataQualityDashboardPage after = DataQualityDashboardPage.open(ui);
    final String snapshotAfter = after.widgetTextSnapshot();
    assertThat(snapshotAfter)
        .as("dashboard widget text must be identical after recreate reindex of test cases")
        .isEqualTo(snapshotBefore);
  }

  private static List<TestCase> seedTestCases(final TestNamespace ns) {
    final Table table = ShortStackFactory.table(ns);
    final String shortId = ns.uniqueShortId();
    return List.of(
        TestCases.create()
            .name("tc_row_" + shortId)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "50")
            .description("UIIT seed")
            .execute(),
        TestCases.create()
            .name("tc_col_" + shortId)
            .forColumn(table, table.getColumns().get(0).getName())
            .testDefinition("columnValuesToBeNotNull")
            .description("UIIT seed")
            .execute());
  }
}
