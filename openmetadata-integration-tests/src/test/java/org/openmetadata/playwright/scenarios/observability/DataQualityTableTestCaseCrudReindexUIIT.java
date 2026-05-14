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
 * Java port of {@code DataQuality.spec.ts → "Table test case"} with
 * {@code POST /v1/search/reindexEntities?recreate=true} injected after each
 * UI-driven mutation. Catches reindex-time regressions on the doc shape that the
 * Data Quality tab depends on.
 *
 * <p>Flow (all via real UI clicks except where noted):
 *
 * <ol>
 *   <li>API seed: short-named table.
 *   <li>UI: open Profiler → Data Quality → "+ Add Test" → form drawer →
 *       fill name + select {@code tableColumnNameToExist} + columnName → submit.
 *   <li>Assert the row renders with {@code data-testid=<testCaseName>}.
 *   <li><b>Reindex inject #1:</b> recreate the testCase via SDK.
 *   <li>Re-open the DQ tab; assert the row is still visible (reindex preserved
 *       searchability).
 *   <li>UI: open Edit drawer → change {@code columnName} → save.
 *   <li><b>Reindex inject #2:</b> recreate the testCase again.
 *   <li>Re-open Edit drawer; assert the new {@code columnName} value persisted.
 *   <li>UI: delete the testCase via the DELETE-confirm dialog; assert it's gone.
 * </ol>
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "DQ_TABLE_CRUD", mode = ResourceAccessMode.READ_WRITE)
class DataQualityTableTestCaseCrudReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    TestCases.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void crudFlowSurvivesReindexBetweenMutations(final UiSession ui, final TestNamespace ns) {
    final Table table = ShortStackFactory.table(ns);
    final String testCaseName = "tc_" + UUID.randomUUID().toString().substring(0, 8);
    final String initialColumn = "id";
    final String updatedColumn = "v";

    // --- CREATE via UI ---
    final TableDataQualityPage dqPage =
        TableDataQualityPage.open(ui, table.getFullyQualifiedName())
            .openCreateTestCaseDrawer()
            .submitTableColumnNameToExist(testCaseName, initialColumn)
            .assertTestCaseVisible(testCaseName);

    // --- REINDEX #1 (post-create) ---
    final TestCase createdCase = fetchTestCase(testCaseName, table.getFullyQualifiedName());
    reindex.recreateAndAwait("testCase", List.of(createdCase));

    // Reload via fresh page to confirm the test case is still listed post-reindex.
    TableDataQualityPage.open(ui, table.getFullyQualifiedName())
        .assertTestCaseVisible(testCaseName);

    // --- EDIT via UI ---
    dqPage.openEditDrawer(testCaseName).updateParamAndSave("columnName", updatedColumn);

    // --- REINDEX #2 (post-edit) ---
    reindex.recreateAndAwait("testCase", List.of(createdCase));

    // Reload and assert the edited value persisted through the reindex.
    final String columnAfter =
        TableDataQualityPage.open(ui, table.getFullyQualifiedName())
            .readParam(testCaseName, "columnName");
    Assertions.assertThat(columnAfter)
        .as("columnName param must equal the UI-edited value after recreate reindex")
        .isEqualTo(updatedColumn);

    // --- DELETE via UI ---
    TableDataQualityPage.open(ui, table.getFullyQualifiedName())
        .deleteTestCase(testCaseName)
        .assertTestCaseGone(testCaseName);
  }

  private static TestCase fetchTestCase(final String name, final String tableFqn) {
    // Look up by entityLink — works regardless of how the implicit test-suite FQN is
    // assembled (which differs across the CLI / UI create paths).
    final String entityLink = "<#E::table::" + tableFqn + ">";
    return SdkClients.adminClient()
        .testCases()
        .list(new ListParams().setLimit(100).addQueryParam("entityLink", entityLink))
        .getData()
        .stream()
        .filter(tc -> name.equals(tc.getName()))
        .findFirst()
        .orElseThrow(
            () ->
                new IllegalStateException(
                    "Created test case '" + name + "' not found under " + tableFqn));
  }
}
