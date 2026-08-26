package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.TempLineageTable;

/**
 * Unit tests for {@link GetLineageTool} slimming. These exercise the pure transform against
 * hand-built {@link EntityLineage} fixtures (no DB/repository) and assert that the response is
 * table-level by default, that edge SQL is returned in full, and that an oversized graph is fitted
 * to a partial graph (never dropped to bare counts).
 */
class GetLineageToolTest {

  private static EntityReference ref(String name, String fqn) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType("table")
        .withName(name)
        .withFullyQualifiedName(fqn)
        .withDisplayName(name + " Display")
        .withDescription("A long markdown description that should never reach the LLM payload.");
  }

  private static LineageDetails details(String sql, List<ColumnLineage> columns) {
    return new LineageDetails()
        .withSqlQuery(sql)
        .withColumnsLineage(columns)
        .withSource(LineageDetails.Source.QUERY_LINEAGE)
        .withTempLineageTables(
            List.of(new TempLineageTable().withFromEntity("src").withToEntity("staging")))
        .withUpdatedAt(123L)
        .withUpdatedBy("bob")
        .withAssetEdges(2);
  }

  private static EntityLineage singleUpstreamEdge(String sql, List<ColumnLineage> columns) {
    EntityReference root = ref("orders", "db.public.orders");
    EntityReference upstream = ref("raw_orders", "db.raw.raw_orders");
    Edge edge =
        new Edge()
            .withFromEntity(upstream.getId())
            .withToEntity(root.getId())
            .withLineageDetails(details(sql, columns));
    return new EntityLineage()
        .withEntity(root)
        .withNodes(List.of(upstream))
        .withUpstreamEdges(List.of(edge))
        .withDownstreamEdges(List.of());
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> firstUpstreamEdge(Map<String, Object> response) {
    List<Map<String, Object>> upstream = (List<Map<String, Object>>) response.get("upstream");
    return upstream.getFirst();
  }

  @Test
  void slimsToTableLevelByDefault() {
    EntityLineage lineage = singleUpstreamEdge("SELECT 1", List.of());
    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(GetLineageTool.toSlim(lineage, false));

    assertEquals("db.public.orders", response.get("root"));
    assertFalse(response.containsKey("nodes"), "standalone nodes array must be folded into edges");

    Map<String, Object> edge = firstUpstreamEdge(response);
    assertEquals("db.raw.raw_orders", edge.get("fromFQN"));
    assertEquals("db.public.orders", edge.get("toFQN"));
    assertEquals("raw_orders Display", edge.get("fromName"));
    assertEquals("sql", edge.get("relationshipType"));
    assertEquals("QueryLineage", edge.get("source"));
    assertTrue(edge.containsKey("tempLineageTables"), "temp-table path must be preserved");
    assertFalse(edge.containsKey("columnsLineage"), "column lineage must be off by default");
  }

  @Test
  void returnsLongSqlInFull() {
    String longSql = "SELECT ".repeat(200);
    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(
            GetLineageTool.toSlim(singleUpstreamEdge(longSql, List.of()), false));
    Map<String, Object> edge = firstUpstreamEdge(response);

    assertEquals(
        longSql, edge.get("sqlQuery"), "edge SQL must be returned in full, never truncated");
    assertNull(edge.get("sqlTruncated"), "full SQL carries no truncation flag");
  }

  @Test
  void keepsShortSqlWithoutTruncationFlag() {
    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(
            GetLineageTool.toSlim(singleUpstreamEdge("SELECT 1", List.of()), false));
    Map<String, Object> edge = firstUpstreamEdge(response);

    assertEquals("SELECT 1", edge.get("sqlQuery"));
    assertNull(edge.get("sqlTruncated"), "short SQL must not carry a truncation flag");
  }

  @Test
  void omitsSqlByDefaultButFlagsThatItExists() {
    String sql = "SELECT a, b FROM upstream_table";
    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(
            GetLineageTool.toSlim(
                singleUpstreamEdge(sql, List.of()), new GetLineageTool.EdgeOptions(false, false)));
    Map<String, Object> edge = firstUpstreamEdge(response);

    assertNull(edge.get("sqlQuery"), "SQL must be omitted unless includeSql is set");
    assertEquals(
        Boolean.TRUE,
        edge.get("hasSql"),
        "an edge whose SQL was withheld must say so, or the caller cannot know to ask for it");
  }

  @Test
  void returnsSqlWhenExplicitlyRequested() {
    String sql = "SELECT a, b FROM upstream_table";
    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(
            GetLineageTool.toSlim(
                singleUpstreamEdge(sql, List.of()), new GetLineageTool.EdgeOptions(false, true)));
    Map<String, Object> edge = firstUpstreamEdge(response);

    assertEquals(sql, edge.get("sqlQuery"), "opting in must return the SQL in full");
    assertEquals(Boolean.TRUE, edge.get("hasSql"));
  }

  @Test
  void edgeWithoutSqlCarriesNoHasSqlFlag() {
    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(
            GetLineageTool.toSlim(
                singleUpstreamEdge(null, List.of()), new GetLineageTool.EdgeOptions(false, false)));
    Map<String, Object> edge = firstUpstreamEdge(response);

    assertNull(edge.get("sqlQuery"));
    assertNull(edge.get("hasSql"), "absent SQL must not be advertised as withheld");
  }

  @Test
  void withholdingSqlIsWhereTheSavingComesFrom() {
    // A live 18-edge graph measured 33,038 tokens, 93.8% of it sqlQuery. Guard the property that
    // makes that saving real: the default response must be a small fraction of the opted-in one.
    String sql = "SELECT col FROM t WHERE x = 1 -- padding padding padding\n".repeat(40);
    int withSql =
        McpResponseTrim.serializedLength(
            GetLineageTool.enforceSizeBudget(
                GetLineageTool.toSlim(
                    singleUpstreamEdge(sql, List.of()),
                    new GetLineageTool.EdgeOptions(false, true))));
    int withoutSql =
        McpResponseTrim.serializedLength(
            GetLineageTool.enforceSizeBudget(
                GetLineageTool.toSlim(
                    singleUpstreamEdge(sql, List.of()),
                    new GetLineageTool.EdgeOptions(false, false))));

    assertTrue(
        withoutSql * 5 < withSql,
        "default response must be under a fifth of the SQL-bearing one, got "
            + withoutSql
            + " vs "
            + withSql);
  }

  @Test
  void depthZeroIsHonouredNotClampedToOne() {
    assertEquals(
        0,
        GetLineageTool.clampDepthForTest(0),
        "downstreamDepth=0 means 'omit this direction'; clamping it to 1 returns edges the caller "
            + "explicitly asked to skip");
    assertEquals(1, GetLineageTool.clampDepthForTest(1));
    assertEquals(10, GetLineageTool.clampDepthForTest(99), "depth stays capped at MAX_DEPTH");
    assertEquals(0, GetLineageTool.clampDepthForTest(-5), "a negative depth means none, not all");
  }

  @Test
  void includesColumnLineageWhenRequested() {
    ColumnLineage column =
        new ColumnLineage()
            .withFromColumns(List.of("db.raw.raw_orders.id"))
            .withToColumn("db.public.orders.id");
    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(
            GetLineageTool.toSlim(singleUpstreamEdge("SELECT 1", List.of(column)), true));
    Map<String, Object> edge = firstUpstreamEdge(response);

    assertTrue(edge.containsKey("columnsLineage"), "column lineage must appear when opted in");
  }

  @Test
  void omitsEmptyColumnLineageEvenWhenOptedIn() {
    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(
            GetLineageTool.toSlim(singleUpstreamEdge("SELECT 1", List.of()), true));
    Map<String, Object> edge = firstUpstreamEdge(response);

    assertFalse(
        edge.containsKey("columnsLineage"),
        "empty column lineage must be omitted to avoid per-edge noise");
  }

  @Test
  void defaultSlimResponseIsAFractionOfRawPayload() {
    String fatSql = "SELECT col_a, col_b, col_c FROM upstream JOIN other USING (id) ".repeat(40);
    EntityReference root = ref("orders", "db.public.orders");
    List<Edge> edges = new java.util.ArrayList<>();
    List<EntityReference> nodes = new java.util.ArrayList<>();
    for (int i = 0; i < 20; i++) {
      EntityReference upstream = ref("raw_orders_" + i, "db.raw.raw_orders_" + i);
      nodes.add(upstream);
      edges.add(
          new Edge()
              .withFromEntity(upstream.getId())
              .withToEntity(root.getId())
              .withLineageDetails(details(fatSql, buildHeavyColumns())));
    }
    EntityLineage lineage =
        new EntityLineage()
            .withEntity(root)
            .withNodes(nodes)
            .withUpstreamEdges(edges)
            .withDownstreamEdges(List.of());

    int rawSize = org.openmetadata.schema.utils.JsonUtils.pojoToJson(lineage).length();
    int slimSize =
        org.openmetadata.schema.utils.JsonUtils.pojoToJson(
                GetLineageTool.enforceSizeBudget(GetLineageTool.toSlim(lineage, false)))
            .length();

    assertTrue(
        slimSize < rawSize * 0.25,
        "default slim payload ("
            + slimSize
            + ") should still be a fraction of raw ("
            + rawSize
            + ") after dropping column lineage and node detail, even though edge SQL is now full");
  }

  @Test
  void collapsesDuplicateEdges() {
    EntityReference root = ref("orders", "db.public.orders");
    EntityReference upstream = ref("raw_orders", "db.raw.raw_orders");
    Edge edge =
        new Edge()
            .withFromEntity(upstream.getId())
            .withToEntity(root.getId())
            .withLineageDetails(details("SELECT 1", List.of()));
    EntityLineage lineage =
        new EntityLineage()
            .withEntity(root)
            .withNodes(List.of(upstream))
            .withUpstreamEdges(List.of(edge, edge, edge))
            .withDownstreamEdges(List.of());

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> upstreamEdges =
        (List<Map<String, Object>>)
            GetLineageTool.enforceSizeBudget(GetLineageTool.toSlim(lineage, false)).get("upstream");

    assertEquals(1, upstreamEdges.size(), "identical edges must be collapsed to one");
  }

  @Test
  void oversizedGraphReturnsPartialDataNotJustCounts() {
    List<ColumnLineage> heavyColumns = buildHeavyColumns();
    EntityReference root = ref("orders", "db.public.orders");
    List<Edge> edges = new java.util.ArrayList<>();
    List<EntityReference> nodes = new java.util.ArrayList<>();
    for (int i = 0; i < 40; i++) {
      EntityReference upstream =
          ref("raw_orders_" + i, "db.raw.raw_orders_with_a_long_qualified_name_" + i);
      nodes.add(upstream);
      edges.add(
          new Edge()
              .withFromEntity(upstream.getId())
              .withToEntity(root.getId())
              .withLineageDetails(details("SELECT 1", heavyColumns)));
    }
    EntityLineage lineage =
        new EntityLineage()
            .withEntity(root)
            .withNodes(nodes)
            .withUpstreamEdges(edges)
            .withDownstreamEdges(List.of());

    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(GetLineageTool.toSlim(lineage, true));

    assertTrue(
        response.containsKey("upstream"), "oversized response must still carry partial edge data");
    assertEquals(
        Boolean.TRUE, response.get("truncated"), "oversized response must be machine-flagged");
    assertEquals(40, response.get("upstreamTotal"));
    int upstreamReturned = (int) response.get("upstreamReturned");
    assertTrue(
        upstreamReturned > 0 && upstreamReturned < 40,
        "a fitted graph returns some but not all upstream edges, got " + upstreamReturned);
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> upstreamEdges = (List<Map<String, Object>>) response.get("upstream");
    assertEquals(
        upstreamReturned, upstreamEdges.size(), "marker must match the returned edge count");
    assertTrue(
        org.openmetadata.schema.utils.JsonUtils.pojoToJson(response).length()
            < McpResponseTrim.MAX_RESPONSE_CHARS,
        "fitted response must be under the dispatch cap");
  }

  @Test
  void fittedGraphKeepsBothDirectionsRepresented() {
    List<ColumnLineage> heavyColumns = buildHeavyColumns();
    EntityReference root = ref("orders", "db.public.orders");
    List<Edge> upstream = new java.util.ArrayList<>();
    List<Edge> downstream = new java.util.ArrayList<>();
    List<EntityReference> nodes = new java.util.ArrayList<>();
    for (int i = 0; i < 40; i++) {
      EntityReference up = ref("up_" + i, "db.raw.up_with_a_long_qualified_name_" + i);
      EntityReference down = ref("down_" + i, "db.mart.down_with_a_long_qualified_name_" + i);
      nodes.add(up);
      nodes.add(down);
      upstream.add(
          new Edge()
              .withFromEntity(up.getId())
              .withToEntity(root.getId())
              .withLineageDetails(details("SELECT 1", heavyColumns)));
      downstream.add(
          new Edge()
              .withFromEntity(root.getId())
              .withToEntity(down.getId())
              .withLineageDetails(details("SELECT 2", heavyColumns)));
    }
    EntityLineage lineage =
        new EntityLineage()
            .withEntity(root)
            .withNodes(nodes)
            .withUpstreamEdges(upstream)
            .withDownstreamEdges(downstream);

    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(GetLineageTool.toSlim(lineage, true));

    assertTrue((int) response.get("upstreamReturned") > 0, "upstream must stay represented");
    assertTrue((int) response.get("downstreamReturned") > 0, "downstream must stay represented");
    assertTrue(
        org.openmetadata.schema.utils.JsonUtils.pojoToJson(response).length()
            < McpResponseTrim.MAX_RESPONSE_CHARS,
        "fitted response must be under the dispatch cap");
  }

  private static List<ColumnLineage> buildHeavyColumns() {
    List<ColumnLineage> columns = new java.util.ArrayList<>();
    for (int i = 0; i < 60; i++) {
      columns.add(
          new ColumnLineage()
              .withFromColumns(
                  List.of(
                      "db.raw.raw_orders.column_with_a_fairly_long_qualified_name_" + i,
                      "db.raw.raw_orders.another_long_qualified_column_name_" + i))
              .withToColumn("db.public.orders.derived_column_with_a_long_name_" + i));
    }
    return columns;
  }

  @Test
  void lineageAlwaysStatesWhetherTheGraphIsComplete() {
    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(
            GetLineageTool.toSlim(singleUpstreamEdge("SELECT 1", List.of()), false));

    assertEquals(
        Boolean.FALSE,
        response.get("edgesTruncated"),
        "a complete graph must say so - silence is what forced a caller to probe with extra calls");
    assertEquals(1, response.get("totalEdges"));
    assertEquals(1, response.get("returnedEdges"));
  }
}
