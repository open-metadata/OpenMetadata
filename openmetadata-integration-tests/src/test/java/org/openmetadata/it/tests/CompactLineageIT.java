package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.lineage.CompactLineage;
import org.openmetadata.schema.api.lineage.CompactLineageEdge;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * The compact lineage endpoint: one page of an entity's lineage, optionally narrowed to one column,
 * paged by edge offset. It shares its implementation with the MCP {@code get_entity_lineage} tool,
 * whose ITs cover the per-node authorization; these cover the REST contract.
 */
@Execution(ExecutionMode.CONCURRENT)
public class CompactLineageIT {

  @Test
  void aColumnIsFollowedAcrossARenameAndOtherConsumersAreLeftOut() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("CompactLineageIT");
    Table root = createTable(client, namespace, "compact_col_root");
    Table renamed = createTable(client, namespace, "compact_col_mid");
    Table consumer = createTable(client, namespace, "compact_col_end");
    Table unrelated = createTable(client, namespace, "compact_col_other");
    addColumnLineage(client, root, "id", renamed, "name");
    addColumnLineage(client, renamed, "name", consumer, "id");
    addColumnLineage(client, root, "name", unrelated, "name");

    CompactLineage page =
        compactLineage(
            client,
            root,
            Map.of("column", columnFqn(root, "id"), "upstreamDepth", "0", "downstreamDepth", "3"));

    assertEquals(
        List.of(renamed.getFullyQualifiedName(), consumer.getFullyQualifiedName()), toFqns(page));
    assertEquals(
        List.of(columnFqn(renamed, "name"), columnFqn(consumer, "id")),
        page.getDownstream().stream()
            .flatMap(edge -> edge.getColumnsLineage().stream())
            .map(ColumnLineage::getToColumn)
            .toList(),
        "a column-scoped page carries only that column's mappings");
    assertEquals(0, page.getColumnUnmappedEdges());
  }

  @Test
  void fromAndLimitPageThroughEveryEdgeOnce() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("CompactLineageIT");
    Table root = createTable(client, namespace, "compact_page_root");
    List<String> expected = new ArrayList<>();
    for (int i = 0; i < 5; i++) {
      Table consumer = createTable(client, namespace, "compact_page_" + i);
      addColumnLineage(client, root, "id", consumer, "id");
      expected.add(consumer.getFullyQualifiedName());
    }

    List<String> seen = new ArrayList<>();
    Integer from = 0;
    int pages = 0;
    while (from != null && pages < 10) {
      CompactLineage page =
          compactLineage(
              client,
              root,
              Map.of(
                  "upstreamDepth", "0", "downstreamDepth", "1", "limit", "2", "from", "" + from));
      seen.addAll(toFqns(page));
      from = page.getNextFrom();
      pages++;
    }

    assertEquals(3, pages, "five edges at two per page");
    assertEquals(new HashSet<>(expected), new HashSet<>(seen));
    assertEquals(5, seen.size(), "no edge is returned twice");
  }

  /** A mistyped column used to come back as a complete, empty graph. */
  @Test
  void aColumnTheTableDoesNotHaveIsABadRequest() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Table root = createTable(client, new TestNamespace("CompactLineageIT"), "compact_typo_root");

    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class,
            () -> compactLineage(client, root, Map.of("column", columnFqn(root, "custmer_id"))));

    assertEquals(400, error.getStatusCode());
  }

  @Test
  void aDepthBeyondTenIsABadRequest() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Table root = createTable(client, new TestNamespace("CompactLineageIT"), "compact_depth_root");

    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class,
            () -> compactLineage(client, root, Map.of("downstreamDepth", "11")));

    assertEquals(400, error.getStatusCode());
  }

  /** A mistyped entity type used to filter the graph down to nothing without saying why. */
  @Test
  void anUnknownEntityTypeIsABadRequest() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Table root =
        createTable(client, new TestNamespace("CompactLineageIT"), "compact_unknown_type_root");

    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class,
            () -> compactLineage(client, root, Map.of("entityTypes", "tables")));

    assertEquals(400, error.getStatusCode());
  }

  @Test
  void aCompleteGraphSaysItIsComplete() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("CompactLineageIT");
    Table root = createTable(client, namespace, "compact_whole_root");
    Table consumer = createTable(client, namespace, "compact_whole_end");
    addColumnLineage(client, root, "id", consumer, "id");

    CompactLineage page = compactLineage(client, root, Map.of("upstreamDepth", "0"));

    assertEquals(1, page.getTotalEdges());
    assertFalse(page.getHasMore());
    assertFalse(page.getEdgesTruncated());
  }

  /** "Tables only" or "no dashboards": an edge is judged by the asset it leads to. */
  @Test
  void edgeFiltersKeepOnlyEdgesLeadingToTheWantedAssets() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("CompactLineageIT");
    Table root = createTable(client, namespace, "compact_filter_root");
    Table consumer = createTable(client, namespace, "compact_filter_table");
    Dashboard dashboard = createDashboard(client, namespace, "compact_filter_dashboard");
    addColumnLineage(client, root, "id", consumer, "id");
    addLineage(client, root.getEntityReference(), dashboard.getEntityReference());

    CompactLineage tablesOnly =
        compactLineage(client, root, Map.of("upstreamDepth", "0", "entityTypes", "table"));
    CompactLineage noDashboards =
        compactLineage(
            client, root, Map.of("upstreamDepth", "0", "excludeEntityTypes", "dashboard"));
    CompactLineage dashboardService =
        compactLineage(
            client,
            root,
            Map.of("upstreamDepth", "0", "services", dashboard.getService().getName()));

    assertEquals(List.of(consumer.getFullyQualifiedName()), toFqns(tablesOnly));
    assertEquals(1, tablesOnly.getFilteredEdges(), "the dashboard edge is counted, not hidden");
    assertEquals(List.of(consumer.getFullyQualifiedName()), toFqns(noDashboards));
    assertEquals(List.of(dashboard.getFullyQualifiedName()), toFqns(dashboardService));
  }

  /**
   * Dropping the edge into an excluded asset must not cut off what lies past it for a non-admin:
   * the permission filter keeps only what is still connected to the root, and admins skip it.
   */
  @Test
  void aNonAdminGetsTheSameFilteredGraphAsAnAdminPastOneHop() throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("CompactLineageIT");
    Table root = createTable(admin, namespace, "compact_hop_root");
    Dashboard dashboard = createDashboard(admin, namespace, "compact_hop_dashboard");
    Table beyond = createTable(admin, namespace, "compact_hop_beyond");
    addLineage(admin, root.getEntityReference(), dashboard.getEntityReference());
    addLineage(admin, dashboard.getEntityReference(), beyond.getEntityReference());
    Map<String, String> query =
        Map.of("upstreamDepth", "0", "downstreamDepth", "2", "excludeEntityTypes", "dashboard");

    CompactLineage asAdmin = compactLineage(admin, root, query);
    UserTestFactory.getDataConsumer(namespace);
    CompactLineage asConsumer = compactLineage(SdkClients.dataConsumerClient(), root, query);

    assertEquals(List.of(beyond.getFullyQualifiedName()), toFqns(asAdmin));
    assertEquals(toFqns(asAdmin), toFqns(asConsumer));
    assertEquals(0, asConsumer.getHiddenNodes(), "nothing here is hidden by a permission");
    assertEquals(asAdmin.getFilteredEdges(), asConsumer.getFilteredEdges());
  }

  private static CompactLineage compactLineage(
      OpenMetadataClient client, Table table, Map<String, String> query) {
    RequestOptions.Builder options = RequestOptions.builder();
    query.forEach(options::queryParam);
    return client
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/lineage/table/name/" + encode(table.getFullyQualifiedName()) + "/compact",
            null,
            CompactLineage.class,
            options.build());
  }

  private static List<String> toFqns(CompactLineage page) {
    return Stream.concat(page.getUpstream().stream(), page.getDownstream().stream())
        .map(CompactLineageEdge::getToFQN)
        .toList();
  }

  private static Table createTable(
      OpenMetadataClient client, TestNamespace namespace, String tableName) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(namespace);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(namespace, service);
    return client
        .tables()
        .create(
            new CreateTable()
                .withName(namespace.prefix(tableName))
                .withDatabaseSchema(schema.getFullyQualifiedName())
                .withColumns(
                    List.of(
                        ColumnBuilder.of("id", "BIGINT").build(),
                        ColumnBuilder.of("name", "VARCHAR").dataLength(255).build())));
  }

  private static void addColumnLineage(
      OpenMetadataClient client, Table from, String fromColumn, Table to, String toColumn) {
    LineageDetails details =
        new LineageDetails()
            .withColumnsLineage(
                List.of(
                    new ColumnLineage()
                        .withFromColumns(List.of(columnFqn(from, fromColumn)))
                        .withToColumn(columnFqn(to, toColumn))));
    client
        .lineage()
        .addLineage(
            new AddLineage()
                .withEdge(
                    new EntitiesEdge()
                        .withFromEntity(from.getEntityReference())
                        .withToEntity(to.getEntityReference())
                        .withLineageDetails(details)));
  }

  private static Dashboard createDashboard(
      OpenMetadataClient client, TestNamespace namespace, String name) {
    DashboardService service = DashboardServiceTestFactory.createLooker(namespace);
    return client
        .dashboards()
        .create(
            new CreateDashboard()
                .withName(namespace.prefix(name))
                .withService(service.getFullyQualifiedName()));
  }

  private static void addLineage(
      OpenMetadataClient client, EntityReference from, EntityReference to) {
    client
        .lineage()
        .addLineage(
            new AddLineage().withEdge(new EntitiesEdge().withFromEntity(from).withToEntity(to)));
  }

  private static String columnFqn(Table table, String column) {
    return table.getFullyQualifiedName() + "." + column;
  }

  private static String encode(String segment) {
    return URLEncoder.encode(segment, StandardCharsets.UTF_8).replace("+", "%20");
  }
}
