package org.openmetadata.playwright.scenarios.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.search.ReindexEntitiesClient;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.it.util.UiTestServer;
import org.openmetadata.playwright.ui.UiSession;
import org.openmetadata.playwright.ui.UiSessionExtension;
import org.openmetadata.playwright.ui.pages.EntityDataObservabilityTabPage;
import org.openmetadata.playwright.ui.pages.EntityDataObservabilityTabPage.SubTab;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
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
  void dataQualityTabSnapshotSurvivesRecreateReindex(final UiSession ui, final TestNamespace ns) {
    final DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns);
    final Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
    final List<TestCase> cases = new ArrayList<>();
    cases.add(
        TestCases.create()
            .name(ns.prefix("rowCount100"))
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .execute());
    cases.add(
        TestCases.create()
            .name(ns.prefix("col1NotNull"))
            .forColumn(table, table.getColumns().get(0).getName())
            .testDefinition("columnValuesToBeNotNull")
            .execute());
    cases.add(
        TestCases.create()
            .name(ns.prefix("col2Unique"))
            .forColumn(table, table.getColumns().get(0).getName())
            .testDefinition("columnValuesToBeUnique")
            .execute());

    final EntityDataObservabilityTabPage before =
        EntityDataObservabilityTabPage.open(ui, table.getFullyQualifiedName(), SubTab.DATA_QUALITY);
    final String snapshotBefore = before.textSnapshot();
    assertThat(snapshotBefore).isNotBlank();
    before.rawPage().close();

    final List<EntityReference> refs = cases.stream().map(TestCase::getEntityReference).toList();
    reindex.recreateAndAwait(refs);

    final EntityDataObservabilityTabPage after =
        EntityDataObservabilityTabPage.open(ui, table.getFullyQualifiedName(), SubTab.DATA_QUALITY);
    assertThat(after.textSnapshot())
        .as(
            "Data Quality tab snapshot must equal pre-reindex on table %s",
            table.getFullyQualifiedName())
        .isEqualTo(snapshotBefore);
  }
}
