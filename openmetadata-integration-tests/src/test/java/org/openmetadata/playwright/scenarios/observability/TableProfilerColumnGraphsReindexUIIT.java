package org.openmetadata.playwright.scenarios.observability;

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
import org.openmetadata.playwright.ui.pages.TableProfilerPage;
import org.openmetadata.schema.api.data.CreateTableProfile;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Apps;

/**
 * Java port of {@code Profiler.spec.ts → Admin role profiler access} (the column-profile
 * graph slice). Asserts the four column-profile charts ({@code count}, {@code proportion},
 * {@code math}, {@code sum}) render before AND after a recreate reindex of the table.
 *
 * <p>The flow exists because reindexing the table doc rewrites the {@code tableProfile}
 * field — if the rebuild drops the per-column profile array, the charts disappear from
 * the UI but the API still returns 200 with empty data. This catches that.
 */
@ExtendWith({UiSessionExtension.class, TestNamespaceExtension.class})
@ResourceLock(value = "TABLE_PROFILER", mode = ResourceAccessMode.READ_WRITE)
class TableProfilerColumnGraphsReindexUIIT {

  private static ReindexEntitiesClient reindex;

  @BeforeAll
  static void setup() {
    reindex = new ReindexEntitiesClient(UiTestServer.get());
    Apps.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void columnProfileChartsSurviveRecreateReindex(final UiSession ui, final TestNamespace ns) {
    final OpenMetadataClient client = SdkClients.adminClient();
    final Table table = ShortStackFactory.table(ns);
    seedProfile(client, table);

    final Column targetColumn = table.getColumns().get(0);

    // --- Pre-reindex: assert all four graphs render. ---
    TableProfilerPage.open(ui, table.getFullyQualifiedName())
        .openColumnProfileTab()
        .selectColumn(targetColumn.getFullyQualifiedName(), targetColumn.getName())
        .assertChartsVisible();

    // --- Reindex inject ---
    reindex.recreateAndAwait("table", List.of(table));

    // --- Post-reindex: same flow, same assertions. ---
    TableProfilerPage.open(ui, table.getFullyQualifiedName())
        .openColumnProfileTab()
        .selectColumn(targetColumn.getFullyQualifiedName(), targetColumn.getName())
        .assertChartsVisible();
  }

  private static void seedProfile(final OpenMetadataClient client, final Table table) {
    final long now = System.currentTimeMillis();
    final TableProfile tableProfile =
        new TableProfile()
            .withTimestamp(now)
            .withColumnCount((double) table.getColumns().size())
            .withRowCount(100.0);
    final List<ColumnProfile> columnProfiles =
        table.getColumns().stream()
            .map(
                col ->
                    new ColumnProfile()
                        .withName(col.getName())
                        .withTimestamp(now)
                        .withUniqueCount(50.0)
                        .withUniqueProportion(0.5)
                        .withMin(1)
                        .withMax(100)
                        .withMean(50.0)
                        .withSum(5000.0))
            .toList();
    final CreateTableProfile profile =
        new CreateTableProfile().withTableProfile(tableProfile).withColumnProfile(columnProfiles);
    try {
      client.tables().updateTableProfile(table.getId(), profile);
    } catch (final Exception e) {
      throw new IllegalStateException("Failed to seed tableProfile", e);
    }
  }
}
