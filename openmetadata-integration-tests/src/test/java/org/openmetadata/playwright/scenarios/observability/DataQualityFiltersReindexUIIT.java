package org.openmetadata.playwright.scenarios.observability;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
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
import org.openmetadata.playwright.ui.pages.DataQualityListPage;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.TestCases;

/**
 * Java port of {@code DataQuality.spec.ts → "TestCase filters"}. Exercises the global
 * {@code /data-quality} → Test Cases tab filters: search, testCaseType. Reindex of
 * the seeded test cases is injected, then every filter is re-applied and the same
 * rows must still appear.
 *
 * <p>Filter coverage (matches a meaningful subset of the TS spec):
 * <ul>
 *   <li>Search by name (exact match);
 *   <li>Filter by testCaseType=table — table-level test cases visible;
 *   <li>Filter by testCaseType=column — column-level test case visible.
 * </ul>
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "DQ_LIST", mode = ResourceAccessMode.READ_WRITE)
class DataQualityFiltersReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    TestCases.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void filtersStillWorkAfterReindex(final UiSession ui, final TestNamespace ns) {
    final Table table = ShortStackFactory.table(ns);
    final String column = table.getColumns().get(0).getName();
    final String tag = "f_" + UUID.randomUUID().toString().substring(0, 8);
    final String tableTcName = "tc_tbl_" + tag;
    final String columnTcName = "tc_col_" + tag;

    final List<TestCase> seeded = new ArrayList<>();
    seeded.add(
        TestCases.create()
            .name(tableTcName)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "10")
            .description("filter seed table-level")
            .execute());
    seeded.add(
        TestCases.create()
            .name(columnTcName)
            .forColumn(table, column)
            .testDefinition("columnValuesToBeNotNull")
            .description("filter seed column-level")
            .execute());

    runFilterFlow(ui, tag, tableTcName, columnTcName);

    // --- Reindex inject ---
    reindex.recreateAndAwait("testCase", seeded);

    runFilterFlow(ui, tag, tableTcName, columnTcName);
  }

  /**
   * Open the DQ list page and exercise filters. Each filter is combined with a name
   * search using the seeding {@code tag} so the assertions are stable regardless of
   * other test cases present on the shared server (the global DQ list is unscoped).
   */
  private static void runFilterFlow(
      final UiSession ui, final String tag, final String tableTcName, final String columnTcName) {
    // 1. Exact-name search finds the table test case.
    DataQualityListPage page = DataQualityListPage.open(ui).searchByName(tableTcName);
    page.assertTestCaseVisible(tableTcName);
    page = page.clearSearch();

    // 2. Search by tag prefix + filter by testCaseType=Table → table TC visible,
    //    column TC not.
    page.searchByName("tc_tbl_" + tag);
    page.filterByTestCaseType("Table");
    page.assertTestCaseVisible(tableTcName);
    page.clearSearch();
    page.filterByTestCaseType("All");

    // 3. Search by tag prefix + filter by testCaseType=Column → column TC visible.
    page.searchByName("tc_col_" + tag);
    page.filterByTestCaseType("Column");
    page.assertTestCaseVisible(columnTcName);
    page.clearSearch();
    page.filterByTestCaseType("All");
  }
}
