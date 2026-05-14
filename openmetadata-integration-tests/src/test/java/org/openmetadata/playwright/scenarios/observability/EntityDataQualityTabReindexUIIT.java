package org.openmetadata.playwright.scenarios.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
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
import org.openmetadata.playwright.ui.pages.EntityDataObservabilityTabPage;
import org.openmetadata.playwright.ui.pages.EntityDataObservabilityTabPage.SubTab;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.TestCases;

/**
 * Table → Profiler → Data Quality tab. Seeds three test cases on the table,
 * snapshots the tab, then reindexEntities on every test case (recreate=true),
 * re-renders, asserts equality. Catches drops in testCase → entityLink resolution
 * after recreate.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "ENTITY_DQ_TAB", mode = ResourceAccessMode.READ_WRITE)
class EntityDataQualityTabReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    TestCases.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void dqTabSurvivesRecreate(final UiSession ui, final TestNamespace ns) {
    final Table table = ShortStackFactory.table(ns);
    final String column = table.getColumns().get(0).getName();
    final String shortId = ns.uniqueShortId();
    final List<TestCase> cases = new ArrayList<>();
    cases.add(
        TestCases.create()
            .name("tc_row_" + shortId)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .execute());
    cases.add(
        TestCases.create()
            .name("tc_nn_" + shortId)
            .forColumn(table, column)
            .testDefinition("columnValuesToBeNotNull")
            .execute());
    cases.add(
        TestCases.create()
            .name("tc_uniq_" + shortId)
            .forColumn(table, column)
            .testDefinition("columnValuesToBeUnique")
            .execute());

    // Pre-warm via the same recreate path so the pre-snapshot reflects fully indexed
    // state. Reindex testCase + table because the DQ tab's "Test Cases" counter is
    // denormalized into the table doc.
    //
    // Known limitation: when this test runs back-to-back with other observability
    // UIITs in the same containerized OM, the DQ-tab counter occasionally still
    // shows 0 in the pre-snapshot — the implicit executable testSuite (created by
    // .forTable(table) under the hood) carries its own denormalized testCase array
    // that recreateEntities on testCase + table doesn't refresh. Reindexing the
    // testSuite would close that gap; tracked as TODO when we wire testSuite
    // reference resolution into the test.
    reindex.recreateAndAwait("testCase", cases);
    reindex.recreateAndAwait("table", List.of(table));

    final EntityDataObservabilityTabPage before =
        EntityDataObservabilityTabPage.open(ui, table.getFullyQualifiedName(), SubTab.DATA_QUALITY);
    final String snapshotBefore = before.textSnapshot();
    assertThat(snapshotBefore).isNotBlank();
    before.rawPage().close();

    reindex.recreateAndAwait("testCase", cases);

    final EntityDataObservabilityTabPage after =
        EntityDataObservabilityTabPage.open(ui, table.getFullyQualifiedName(), SubTab.DATA_QUALITY);
    assertThat(after.textSnapshot())
        .as(
            "Data Quality tab snapshot must equal pre-reindex on table %s",
            table.getFullyQualifiedName())
        .isEqualTo(snapshotBefore);
  }
}
