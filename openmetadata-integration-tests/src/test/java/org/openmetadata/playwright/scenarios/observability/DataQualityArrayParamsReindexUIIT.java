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

/**
 * Java port of {@code DataQuality.spec.ts → "TestCase with Array params value"}.
 * Verifies an array-shaped parameter ({@code allowedValues} for
 * {@code columnValuesToBeInSet}) round-trips through the edit form and survives
 * reindex.
 *
 * <p>Flow:
 *
 * <ol>
 *   <li>Seed table + column-level testCase via SDK with
 *       {@code allowedValues=["gmail","yahoo","collate"]}.
 *   <li>UI: open DQ tab → open edit drawer → assert all 3 array values render in
 *       {@code #tableTestForm_params_allowedValues_*_value}.
 *   <li>UI: change index 0 to "test" → save.
 *   <li><b>Reindex inject:</b> recreate testCase.
 *   <li>UI: re-open edit → assert array[0] equals "test", others unchanged.
 * </ol>
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "DQ_TABLE_CRUD", mode = ResourceAccessMode.READ_WRITE)
class DataQualityArrayParamsReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    TestCases.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void arrayParamsSurviveReindex(final UiSession ui, final TestNamespace ns) {
    final Table table = ShortStackFactory.table(ns);
    final String column = table.getColumns().get(0).getName();
    final String testCaseName = "tc_arr_" + UUID.randomUUID().toString().substring(0, 8);

    final TestCase testCase =
        TestCases.create()
            .name(testCaseName)
            .forColumn(table, column)
            .testDefinition("columnValuesToBeInSet")
            .parameter("allowedValues", "[\"gmail\",\"yahoo\",\"collate\"]")
            .description("array params seed")
            .execute();

    final TableDataQualityPage dq = TableDataQualityPage.open(ui, table.getFullyQualifiedName());

    // --- Pre-edit assertion: all 3 array values render. ---
    dq.openEditDrawer(testCaseName);
    Assertions.assertThat(dq.readArrayParamValue("allowedValues", 0)).isEqualTo("gmail");
    Assertions.assertThat(dq.readArrayParamValue("allowedValues", 1)).isEqualTo("yahoo");
    Assertions.assertThat(dq.readArrayParamValue("allowedValues", 2)).isEqualTo("collate");
    dq.cancelEditDrawer();

    // --- EDIT array[0] → save. ---
    dq.openEditDrawer(testCaseName).updateArrayParamAndSave("allowedValues", 0, "test");

    // --- Reindex inject ---
    reindex.recreateAndAwait("testCase", List.of(testCase));

    // --- POST: reload, re-open, assert the edit persisted. ---
    final TableDataQualityPage afterReindex =
        TableDataQualityPage.open(ui, table.getFullyQualifiedName());
    afterReindex.openEditDrawer(testCaseName);
    Assertions.assertThat(afterReindex.readArrayParamValue("allowedValues", 0))
        .as("array[0] must equal UI-edited value after reindex")
        .isEqualTo("test");
    Assertions.assertThat(afterReindex.readArrayParamValue("allowedValues", 1))
        .as("array[1] preserved")
        .isEqualTo("yahoo");
    Assertions.assertThat(afterReindex.readArrayParamValue("allowedValues", 2))
        .as("array[2] preserved")
        .isEqualTo("collate");
    afterReindex.cancelEditDrawer();
  }
}
