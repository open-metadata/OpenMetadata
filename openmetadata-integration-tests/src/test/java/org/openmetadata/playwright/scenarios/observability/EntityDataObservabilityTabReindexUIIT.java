package org.openmetadata.playwright.scenarios.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
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
import org.openmetadata.sdk.fluent.Apps;
import org.openmetadata.sdk.fluent.TestCases;

/**
 * For each Profiler sub-tab on a Table page (overview, table-profile, column-profile,
 * data-quality, incidents): render → snapshot → reindex the table → re-render →
 * assert snapshot equality. The recreate path deletes then re-inserts the table
 * doc, so any drop of profiler / freshness / test-case nesting shows up here.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "ENTITY_OBSERVABILITY_TAB", mode = ResourceAccessMode.READ_WRITE)
class EntityDataObservabilityTabReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    TestCases.setDefaultClient(SdkClients.adminClient());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @ParameterizedTest
  @EnumSource(SubTab.class)
  void subTabSurvivesRecreate(final SubTab subTab, final UiSession ui, final TestNamespace ns) {
    final Table table = seedTable(ns);

    final EntityDataObservabilityTabPage before =
        EntityDataObservabilityTabPage.open(ui, table.getFullyQualifiedName(), subTab);
    final String snapshotBefore = before.textSnapshot();
    assertThat(snapshotBefore).isNotBlank();
    before.rawPage().close();

    reindex.recreateAndAwait("table", List.of(table));

    final EntityDataObservabilityTabPage after =
        EntityDataObservabilityTabPage.open(ui, table.getFullyQualifiedName(), subTab);
    assertThat(after.textSnapshot())
        .as(
            "Profiler %s sub-tab snapshot must equal pre-reindex for table %s",
            subTab, table.getFullyQualifiedName())
        .isEqualTo(snapshotBefore);
  }

  private static Table seedTable(final TestNamespace ns) {
    final Table table = ShortStackFactory.table(ns);
    TestCases.create()
        .name("tc_" + ns.uniqueShortId())
        .forTable(table)
        .testDefinition("tableRowCountToEqual")
        .parameter("value", "10")
        .description("Observability tab seed")
        .execute();
    return table;
  }
}
