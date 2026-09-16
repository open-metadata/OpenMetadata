package org.openmetadata.playwright.scenarios.observability;

import java.util.List;
import java.util.UUID;
import org.assertj.core.api.Assertions;
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
import org.openmetadata.playwright.ui.pages.TableDataQualityPage;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.TestCases;
import org.openmetadata.sdk.models.ListParams;

/**
 * Java port of {@code DataQuality.spec.ts → "Column test case"}. Column-level CRUD
 * with reindex injected after each UI mutation.
 *
 * <p>Flow (mirrors the TS spec):
 *
 * <ol>
 *   <li>Open Profiler → Data Quality → "+ Add Test" → form drawer.
 *   <li>Click "Column Level" card; pick a column; wait for column-scoped testDefinitions API.
 *   <li>Fill name + select {@code columnValueLengthsToBeBetween} + min/max params; submit.
 *   <li>Assert row visible.
 *   <li><b>Reindex #1:</b> recreate the testCase. Reload, still visible.
 *   <li>Open Edit drawer; change minLength; save.
 *   <li><b>Reindex #2:</b> recreate. Reload, re-open edit, assert minLength persisted.
 *   <li>Delete via action menu + DELETE-confirm; assert row gone.
 * </ol>
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "DQ_TABLE_CRUD", mode = ResourceAccessMode.READ_WRITE)
class DataQualityColumnTestCaseCrudReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    TestCases.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void columnTestCaseCrudSurvivesReindex(final UiSession ui, final TestNamespace ns) {
    final Table table = ShortStackFactory.table(ns);
    final String column = table.getColumns().get(0).getName();
    final String testCaseName = "tc_col_" + UUID.randomUUID().toString().substring(0, 8);
    final String initialMin = "3";
    final String initialMax = "6";
    final String updatedMin = "4";

    // --- CREATE ---
    final TableDataQualityPage dq =
        TableDataQualityPage.open(ui, table.getFullyQualifiedName())
            .openCreateTestCaseDrawer()
            .selectColumnLevel(column)
            .submitColumnValueLengthsToBeBetween(testCaseName, initialMin, initialMax)
            .assertTestCaseVisible(testCaseName);

    // --- REINDEX #1 ---
    final TestCase tc = fetchTestCase(testCaseName, table.getFullyQualifiedName());
    reindex.recreateAndAwait("testCase", List.of(tc));

    TableDataQualityPage.open(ui, table.getFullyQualifiedName())
        .assertTestCaseVisible(testCaseName);

    // --- EDIT ---
    dq.openEditDrawer(testCaseName).updateParamAndSave("minLength", updatedMin);

    // --- REINDEX #2 ---
    reindex.recreateAndAwait("testCase", List.of(tc));

    // Reload, re-open edit, assert minLength persisted.
    final String minAfter =
        TableDataQualityPage.open(ui, table.getFullyQualifiedName())
            .readParam(testCaseName, "minLength");
    Assertions.assertThat(minAfter)
        .as("minLength must equal UI-edited value after recreate reindex")
        .isEqualTo(updatedMin);

    // --- DELETE ---
    TableDataQualityPage.open(ui, table.getFullyQualifiedName())
        .deleteTestCase(testCaseName)
        .assertTestCaseGone(testCaseName);
  }

  private static TestCase fetchTestCase(final String name, final String tableFqn) {
    // Column-level test cases have entityLink with columns:: segment, so a table-only
    // entityLink filter misses them. Filter by entityLink prefix in-memory instead.
    final String tablePrefix = "<#E::table::" + tableFqn;
    return SdkClients.adminClient()
        .testCases()
        .list(new ListParams().setLimit(500))
        .getData()
        .stream()
        .filter(t -> name.equals(t.getName()))
        .filter(t -> t.getEntityLink() != null && t.getEntityLink().startsWith(tablePrefix))
        .findFirst()
        .orElseThrow(
            () ->
                new IllegalStateException("Test case '" + name + "' not found under " + tableFqn));
  }
}
