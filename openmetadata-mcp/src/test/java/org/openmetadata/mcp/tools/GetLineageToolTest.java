package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Predicate;
import org.junit.jupiter.api.Test;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.mcp.util.PageCursor;
import org.openmetadata.mcp.util.VectorPagingContract;
import org.openmetadata.schema.api.lineage.CompactLineage;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.TempLineageTable;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.lineage.CompactLineageSlimmer;
import org.openmetadata.service.lineage.CompactLineageSlimmer.EdgeOptions;

/**
 * Unit tests for {@link GetLineageTool} slimming. These exercise the pure transform against
 * hand-built {@link EntityLineage} fixtures (no DB/repository) and assert that the response is
 * table-level by default, that edge SQL is returned in full, and that an oversized graph is fitted
 * to a partial graph (never dropped to bare counts).
 */
class GetLineageToolTest {

  /** The old tool seam's default: SQL on, column lineage as asked. */
  private static CompactLineage slim(EntityLineage lineage, boolean includeColumnLineage) {
    return CompactLineageSlimmer.toSlim(lineage, new EdgeOptions(includeColumnLineage, true));
  }

  private static CompactLineage slim(EntityLineage lineage, EdgeOptions options) {
    return CompactLineageSlimmer.toSlim(lineage, options);
  }

  private static CompactLineage slim(
      EntityLineage lineage, EdgeOptions options, Predicate<EntityReference> pipelineVisible) {
    return CompactLineageSlimmer.toSlim(lineage, options, pipelineVisible);
  }

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

  private static EntityLineage edgeThroughPipeline(EntityReference pipeline) {
    EntityReference root = ref("orders", "db.public.orders");
    EntityReference upstream = ref("raw_orders", "db.raw.raw_orders");
    Edge edge =
        new Edge()
            .withFromEntity(upstream.getId())
            .withToEntity(root.getId())
            .withLineageDetails(details("select 1", null).withPipeline(pipeline));
    return new EntityLineage()
        .withEntity(root)
        .withNodes(List.of(upstream))
        .withUpstreamEdges(List.of(edge))
        .withDownstreamEdges(List.of());
  }

  private static EntityReference pipelineRef() {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType("pipeline")
        .withName("nightly_etl")
        .withFullyQualifiedName("airflow.nightly_etl")
        .withDescription("Loads orders every night");
  }

  /**
   * A pipeline is edge metadata, so the node filter never sees it, yet it is its own entity with its
   * own policy. A caller allowed on both endpoint tables must not learn which pipeline joins them.
   */
  @Test
  void deniedPipelineKeepsTheRelationshipButNotItsIdentity() {
    EntityLineage lineage = edgeThroughPipeline(pipelineRef());

    Map<String, Object> edge =
        firstUpstreamEdge(
            GetLineageTool.enforceSizeBudget(
                slim(lineage, new EdgeOptions(false, false), pipeline -> false)));

    assertEquals(
        "pipeline",
        edge.get("relationshipType"),
        "the caller still learns a pipeline connects these, but not which one");
    assertNull(edge.get("pipelineFQN"));
    assertNull(edge.get("pipelineDescription"));
  }

  @Test
  void visiblePipelineIsNamedInFull() {
    EntityLineage lineage = edgeThroughPipeline(pipelineRef());

    Map<String, Object> edge =
        firstUpstreamEdge(
            GetLineageTool.enforceSizeBudget(
                slim(lineage, new EdgeOptions(false, false), pipeline -> true)));

    assertEquals("pipeline:nightly_etl", edge.get("relationshipType"));
    assertEquals("airflow.nightly_etl", edge.get("pipelineFQN"));
    assertEquals("Loads orders every night", edge.get("pipelineDescription"));
  }

  /**
   * Temp-table hops are names parsed out of the transformation rather than catalog entities, so
   * there is no policy to check them against; they travel with the SQL they came from.
   */
  @Test
  void tempLineageTablesTravelWithTheSql() {
    EntityLineage lineage = singleUpstreamEdge("select 1", null);

    Map<String, Object> withoutSql =
        firstUpstreamEdge(
            GetLineageTool.enforceSizeBudget(slim(lineage, new EdgeOptions(false, false))));
    assertFalse(
        withoutSql.containsKey("tempLineageTables"),
        "SQL-derived table names must not ride the default response");

    Map<String, Object> withSql =
        firstUpstreamEdge(
            GetLineageTool.enforceSizeBudget(slim(lineage, new EdgeOptions(false, true))));
    assertTrue(withSql.containsKey("tempLineageTables"));
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> firstUpstreamEdge(Map<String, Object> response) {
    List<Map<String, Object>> upstream = (List<Map<String, Object>>) response.get("upstream");
    return upstream.getFirst();
  }

  @Test
  void slimsToTableLevelByDefault() {
    EntityLineage lineage = singleUpstreamEdge("SELECT 1", List.of());
    Map<String, Object> response = GetLineageTool.enforceSizeBudget(slim(lineage, false));

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
        GetLineageTool.enforceSizeBudget(slim(singleUpstreamEdge(longSql, List.of()), false));
    Map<String, Object> edge = firstUpstreamEdge(response);

    assertEquals(
        longSql, edge.get("sqlQuery"), "edge SQL must be returned in full, never truncated");
    assertNull(edge.get("sqlTruncated"), "full SQL carries no truncation flag");
  }

  @Test
  void keepsShortSqlWithoutTruncationFlag() {
    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(slim(singleUpstreamEdge("SELECT 1", List.of()), false));
    Map<String, Object> edge = firstUpstreamEdge(response);

    assertEquals("SELECT 1", edge.get("sqlQuery"));
    assertNull(edge.get("sqlTruncated"), "short SQL must not carry a truncation flag");
  }

  @Test
  void omitsSqlByDefaultButFlagsThatItExists() {
    String sql = "SELECT a, b FROM upstream_table";
    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(
            slim(singleUpstreamEdge(sql, List.of()), new EdgeOptions(false, false)));
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
            slim(singleUpstreamEdge(sql, List.of()), new EdgeOptions(false, true)));
    Map<String, Object> edge = firstUpstreamEdge(response);

    assertEquals(sql, edge.get("sqlQuery"), "opting in must return the SQL in full");
    assertEquals(Boolean.TRUE, edge.get("hasSql"));
  }

  @Test
  void edgeWithoutSqlCarriesNoHasSqlFlag() {
    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(
            slim(singleUpstreamEdge(null, List.of()), new EdgeOptions(false, false)));
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
                slim(singleUpstreamEdge(sql, List.of()), new EdgeOptions(false, true))));
    int withoutSql =
        McpResponseTrim.serializedLength(
            GetLineageTool.enforceSizeBudget(
                slim(singleUpstreamEdge(sql, List.of()), new EdgeOptions(false, false))));

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
            slim(singleUpstreamEdge("SELECT 1", List.of(column)), true));
    Map<String, Object> edge = firstUpstreamEdge(response);

    assertTrue(edge.containsKey("columnsLineage"), "column lineage must appear when opted in");
  }

  @Test
  void omitsEmptyColumnLineageEvenWhenOptedIn() {
    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(slim(singleUpstreamEdge("SELECT 1", List.of()), true));
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
                GetLineageTool.enforceSizeBudget(slim(lineage, false)))
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
            GetLineageTool.enforceSizeBudget(slim(lineage, false)).get("upstream");

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

    Map<String, Object> response = GetLineageTool.enforceSizeBudget(slim(lineage, true));

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

    Map<String, Object> response = GetLineageTool.enforceSizeBudget(slim(lineage, true));

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

  private static EntityLineage heavyGraph(int perDirection) {
    List<ColumnLineage> heavyColumns = buildHeavyColumns();
    EntityReference root = ref("orders", "db.public.orders");
    List<Edge> upstream = new ArrayList<>();
    List<Edge> downstream = new ArrayList<>();
    List<EntityReference> nodes = new ArrayList<>();
    for (int i = 0; i < perDirection; i++) {
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
    return new EntityLineage()
        .withEntity(root)
        .withNodes(nodes)
        .withUpstreamEdges(upstream)
        .withDownstreamEdges(downstream);
  }

  @SuppressWarnings("unchecked")
  private static List<String> edgeKeys(Map<String, Object> response) {
    List<String> keys = new ArrayList<>();
    for (String direction : List.of("upstream", "downstream")) {
      for (Map<String, Object> edge :
          (List<Map<String, Object>>) response.getOrDefault(direction, List.of())) {
        keys.add(direction + ":" + edge.get("fromFQN") + "->" + edge.get("toFQN"));
      }
    }
    return keys;
  }

  private static int nextOffset(Map<String, Object> response) {
    return PageCursor.decode((String) response.get(McpResponseTrim.NEXT_CURSOR_KEY))
        .orElseThrow()
        .offset();
  }

  /** The customer's ask: when a graph is clipped, the rest must be reachable, not just counted. */
  @Test
  void pagingThroughAClippedGraphReturnsEveryEdgeExactlyOnce() {
    CompactLineage slim = slim(heavyGraph(40), true);
    List<String> seen = new ArrayList<>();
    int pages = 0;
    int from = 0;
    boolean hasMore = true;
    while (hasMore) {
      Map<String, Object> page = GetLineageTool.enforceSizeBudget(slim, from);
      assertTrue(
          JsonUtils.pojoToJson(page).length() < McpResponseTrim.MAX_RESPONSE_CHARS,
          "every page must be under the dispatch cap");
      seen.addAll(edgeKeys(page));
      hasMore = Boolean.TRUE.equals(page.get(McpResponseTrim.HAS_MORE_KEY));
      from = hasMore ? nextOffset(page) : from;
      pages++;
    }
    assertTrue(pages > 1, "a graph over the cap must take more than one page");
    assertEquals(80, seen.size(), "no edge may be skipped or repeated across pages");
    assertEquals(80, new HashSet<>(seen).size(), "no edge may be repeated");
  }

  @Test
  void aCompleteGraphHasNoNextCursor() {
    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(slim(singleUpstreamEdge("SELECT 1", List.of()), false), 0);

    assertNull(response.get(McpResponseTrim.NEXT_CURSOR_KEY));
    assertNull(response.get(McpResponseTrim.HAS_MORE_KEY));
  }

  @Test
  void anOffsetPastTheEndReturnsNoEdgesAndNoCursor() {
    Map<String, Object> response = GetLineageTool.enforceSizeBudget(slim(heavyGraph(3), true), 500);

    assertEquals(0, response.get("returnedEdges"));
    assertEquals(6, response.get("totalEdges"));
    assertNull(response.get(McpResponseTrim.NEXT_CURSOR_KEY));
  }

  /**
   * The repository returns edges depth-first with no ORDER BY. A page boundary is only meaningful if
   * the same graph orders the same way every call, and the first page should hold the nearest hops.
   */
  @Test
  void edgesComeNearestHopFirstWhateverOrderTheRepositoryUsed() {
    EntityReference root = ref("orders", "db.public.orders");
    EntityReference stage = ref("stage", "db.mart.b_stage");
    EntityReference report = ref("report", "db.mart.c_report");
    EntityReference audit = ref("audit", "db.mart.a_audit");
    Edge secondHop = new Edge().withFromEntity(stage.getId()).withToEntity(report.getId());
    Edge toStage = new Edge().withFromEntity(root.getId()).withToEntity(stage.getId());
    Edge toAudit = new Edge().withFromEntity(root.getId()).withToEntity(audit.getId());
    EntityLineage lineage =
        new EntityLineage()
            .withEntity(root)
            .withNodes(List.of(stage, report, audit))
            .withUpstreamEdges(List.of())
            .withDownstreamEdges(List.of(secondHop, toStage, toAudit));

    Map<String, Object> response = GetLineageTool.enforceSizeBudget(slim(lineage, false), 0);

    assertEquals(
        List.of(
            "downstream:db.public.orders->db.mart.a_audit",
            "downstream:db.public.orders->db.mart.b_stage",
            "downstream:db.mart.b_stage->db.mart.c_report"),
        edgeKeys(response));
  }

  @Test
  void aMissingOrUnreadableCursorStartsAtTheFirstEdge() {
    assertEquals(0, VectorPagingContract.cursorOffsetOrDefault(Map.of(), 0));
    assertEquals(
        0, VectorPagingContract.cursorOffsetOrDefault(Map.of("cursor", "not-a-cursor"), 0));
    assertEquals(
        144,
        VectorPagingContract.cursorOffsetOrDefault(
            Map.of("cursor", PageCursor.encodeOffset(144)), 0));
  }

  /**
   * The "whole page fits" check has to leave the same room for markers as the oversized-edge check:
   * a page at 99K plus totals, notes and hiddenNodes crosses the cap, and the dispatch floor then
   * swaps it for a stub with no cursor.
   */
  @Test
  void aPageWithinTheMarkerHeadroomOfTheCapIsClipped() {
    EntityReference root = ref("orders", "db.public.orders");
    EntityReference first = ref("first", "db.mart.a_first");
    EntityReference second = ref("second", "db.mart.b_second");
    String nearHalfCap = "SELECT " + "x".repeat(McpResponseTrim.MAX_RESPONSE_CHARS / 2 - 1_000);
    EntityLineage lineage =
        new EntityLineage()
            .withEntity(root)
            .withNodes(List.of(first, second))
            .withUpstreamEdges(List.of())
            .withDownstreamEdges(
                List.of(
                    edgeWithSql(root, first, nearHalfCap), edgeWithSql(root, second, nearHalfCap)));

    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(slim(lineage, new EdgeOptions(false, true)), 0);

    assertEquals(
        1, response.get("returnedEdges"), "two edges this close to the cap need two pages");
    assertEquals(Boolean.TRUE, response.get(McpResponseTrim.HAS_MORE_KEY));
  }

  /** Skipped edges were not returned, so the graph is incomplete even when nothing follows them. */
  @Test
  void skippingAnOversizedLastEdgeStillMarksTheGraphIncomplete() {
    EntityReference root = ref("orders", "db.public.orders");
    EntityReference huge = ref("huge", "db.mart.b_huge");
    String hugeSql = "SELECT " + "x".repeat(McpResponseTrim.MAX_RESPONSE_CHARS + 10_000);
    EntityLineage lineage =
        new EntityLineage()
            .withEntity(root)
            .withNodes(List.of(huge))
            .withUpstreamEdges(List.of())
            .withDownstreamEdges(List.of(edgeWithSql(root, huge, hugeSql)));

    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(slim(lineage, new EdgeOptions(false, true)), 0);

    assertEquals(0, response.get("returnedEdges"));
    assertEquals(Boolean.TRUE, response.get("edgesTruncated"));
    assertNull(response.get(McpResponseTrim.NEXT_CURSOR_KEY), "nothing is left to page to");
  }

  /** Naming every skipped edge is itself unbounded; past a few names, a count says the rest. */
  @Test
  void onlyTheFirstFewOversizedEdgesAreNamed() {
    EntityReference root = ref("orders", "db.public.orders");
    String hugeSql = "SELECT " + "x".repeat(McpResponseTrim.MAX_RESPONSE_CHARS + 10_000);
    List<EntityReference> nodes = new ArrayList<>();
    List<Edge> edges = new ArrayList<>();
    for (int i = 0; i < 12; i++) {
      EntityReference huge = ref("huge_" + i, "db.mart.huge_" + i);
      nodes.add(huge);
      edges.add(edgeWithSql(root, huge, hugeSql));
    }
    EntityLineage lineage =
        new EntityLineage()
            .withEntity(root)
            .withNodes(nodes)
            .withUpstreamEdges(List.of())
            .withDownstreamEdges(edges);

    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(slim(lineage, new EdgeOptions(false, true)), 0);

    assertEquals(10, listOf(response.get("oversizedEdges")).size());
    assertTrue(((String) response.get(McpResponseTrim.MESSAGE_KEY)).contains("12 edge(s)"));
    assertTrue(JsonUtils.pojoToJson(response).length() < McpResponseTrim.MAX_RESPONSE_CHARS);
  }

  /**
   * An edge bigger than the whole response cap cannot be returned, and returning it anyway made the
   * dispatch floor replace the page with a stub that carries no cursor - stranding every later edge.
   * It is skipped and named instead, and paging carries on past it.
   */
  @Test
  void anEdgeTooLargeForAnyResponseIsSkippedAndPagingContinues() {
    EntityReference root = ref("orders", "db.public.orders");
    EntityReference small = ref("small", "db.mart.a_small");
    EntityReference huge = ref("huge", "db.mart.b_huge");
    EntityReference after = ref("after", "db.mart.c_after");
    String hugeSql = "SELECT " + "x".repeat(McpResponseTrim.MAX_RESPONSE_CHARS + 10_000);
    EntityLineage lineage =
        new EntityLineage()
            .withEntity(root)
            .withNodes(List.of(small, huge, after))
            .withUpstreamEdges(List.of())
            .withDownstreamEdges(
                List.of(
                    edgeWithSql(root, small, "SELECT 1"),
                    edgeWithSql(root, huge, hugeSql),
                    edgeWithSql(root, after, "SELECT 2")));
    CompactLineage slim = slim(lineage, new EdgeOptions(false, true));

    List<String> seen = new ArrayList<>();
    List<Object> oversized = new ArrayList<>();
    Map<String, Object> page = GetLineageTool.enforceSizeBudget(slim, 0);
    int pages = 1;
    seen.addAll(edgeKeys(page));
    oversized.addAll(listOf(page.get("oversizedEdges")));
    while (Boolean.TRUE.equals(page.get(McpResponseTrim.HAS_MORE_KEY)) && pages < 10) {
      assertTrue(JsonUtils.pojoToJson(page).length() < McpResponseTrim.MAX_RESPONSE_CHARS);
      page = GetLineageTool.enforceSizeBudget(slim, nextOffset(page));
      seen.addAll(edgeKeys(page));
      oversized.addAll(listOf(page.get("oversizedEdges")));
      pages++;
    }

    assertEquals(
        List.of(
            "downstream:db.public.orders->db.mart.a_small",
            "downstream:db.public.orders->db.mart.c_after"),
        seen,
        "the edges either side of the oversized one are both reachable");
    assertEquals(List.of("db.public.orders -> db.mart.b_huge"), oversized);
    assertTrue(JsonUtils.pojoToJson(page).length() < McpResponseTrim.MAX_RESPONSE_CHARS);
  }

  private static Edge edgeWithSql(EntityReference from, EntityReference to, String sql) {
    return new Edge()
        .withFromEntity(from.getId())
        .withToEntity(to.getId())
        .withLineageDetails(new LineageDetails().withSqlQuery(sql));
  }

  private static List<?> listOf(Object value) {
    return value instanceof List<?> list ? list : List.of();
  }

  @Test
  void theClipMessageCountsFromTheFirstEdgeActuallyReturned() {
    Map<String, Object> response = GetLineageTool.enforceSizeBudget(slim(heavyGraph(40), true), -5);

    assertTrue(
        ((String) response.get(McpResponseTrim.MESSAGE_KEY)).contains("edges 1-"),
        "a negative offset starts at edge 1, and the message must say so");
  }

  @Test
  void lineageAlwaysStatesWhetherTheGraphIsComplete() {
    Map<String, Object> response =
        GetLineageTool.enforceSizeBudget(slim(singleUpstreamEdge("SELECT 1", List.of()), false));

    assertEquals(
        Boolean.FALSE,
        response.get("edgesTruncated"),
        "a complete graph must say so - silence is what forced a caller to probe with extra calls");
    assertEquals(1, response.get("totalEdges"));
    assertEquals(1, response.get("returnedEdges"));
  }
}
