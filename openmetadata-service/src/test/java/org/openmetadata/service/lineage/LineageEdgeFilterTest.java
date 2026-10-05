package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.antlr.v4.runtime.misc.ParseCancellationException;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.util.FullyQualifiedName;

class LineageEdgeFilterTest {

  private static final EntityReference ROOT = node("table", "snowflake_prod.analytics.core.orders");
  private static final EntityReference TABLE =
      node("table", "snowflake_prod.analytics.mart.daily_orders");
  private static final EntityReference DASHBOARD = node("dashboard", "looker.orders_dashboard");
  private static final EntityReference OTHER_SERVICE_TABLE =
      node("table", "bigquery_prod.reporting.ext.orders_copy");

  /** An unterminated quote: the FQN grammar bails on it. */
  private static final String MALFORMED_FQN = "\"unterminated.quote";

  private static EntityReference node(String type, String fqn) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(type)
        .withFullyQualifiedName(fqn);
  }

  private static Edge edge(EntityReference from, EntityReference to) {
    return new Edge().withFromEntity(from.getId()).withToEntity(to.getId());
  }

  private static EntityLineage lineage(
      List<EntityReference> nodes, List<Edge> upstream, List<Edge> downstream) {
    return new EntityLineage()
        .withEntity(ROOT)
        .withNodes(new ArrayList<>(nodes))
        .withUpstreamEdges(new ArrayList<>(upstream))
        .withDownstreamEdges(new ArrayList<>(downstream));
  }

  private static EntityLineage downstream(EntityReference... targets) {
    List<EntityReference> nodes = List.of(targets);
    return lineage(nodes, List.of(), nodes.stream().map(target -> edge(ROOT, target)).toList());
  }

  /** The asset each kept edge leads to: the target downstream, the source upstream. */
  private static List<String> farFqns(EntityLineage lineage, List<EntityReference> nodes) {
    Map<UUID, String> fqnById =
        Stream.concat(Stream.of(ROOT), nodes.stream())
            .collect(
                Collectors.toMap(
                    EntityReference::getId,
                    EntityReference::getFullyQualifiedName,
                    (first, second) -> first));
    Function<UUID, String> fqn = fqnById::get;
    return Stream.concat(
            lineage.getUpstreamEdges().stream().map(Edge::getFromEntity).map(fqn),
            lineage.getDownstreamEdges().stream().map(Edge::getToEntity).map(fqn))
        .toList();
  }

  private static List<String> farFqns(EntityLineage lineage) {
    return farFqns(lineage, List.of(TABLE, DASHBOARD, OTHER_SERVICE_TABLE));
  }

  @Test
  void noFilterKeepsEveryEdgeAndNode() {
    EntityLineage graph = downstream(TABLE, DASHBOARD);

    int removed = LineageEdgeFilter.NONE.apply(graph);

    assertFalse(LineageEdgeFilter.NONE.isActive());
    assertEquals(0, removed);
    assertEquals(2, graph.getDownstreamEdges().size());
    assertEquals(List.of(TABLE, DASHBOARD), graph.getNodes());
  }

  /** "Tables only": an edge is judged by the asset it leads to, not the one it leaves. */
  @Test
  void entityTypesKeepOnlyEdgesLeadingToThoseTypes() {
    EntityLineage graph = downstream(TABLE, DASHBOARD, OTHER_SERVICE_TABLE);

    int removed = LineageEdgeFilter.of(List.of("table"), List.of(), List.of()).apply(graph);

    assertEquals(
        List.of(TABLE.getFullyQualifiedName(), OTHER_SERVICE_TABLE.getFullyQualifiedName()),
        farFqns(graph));
    assertEquals(1, removed);
  }

  /** "No dashboards", without having to name every other type. */
  @Test
  void excludedEntityTypesDropEdgesLeadingToThem() {
    EntityLineage graph = downstream(TABLE, DASHBOARD);

    LineageEdgeFilter.of(List.of(), List.of("dashboard"), List.of()).apply(graph);

    assertEquals(List.of(TABLE.getFullyQualifiedName()), farFqns(graph));
  }

  /** Upstream, the far end of an edge is its source. */
  @Test
  void anUpstreamEdgeIsJudgedByItsSource() {
    EntityReference topic = node("topic", "kafka_prod.orders_events");
    EntityReference rawTable = node("table", "snowflake_prod.raw.s.orders_raw");
    List<EntityReference> nodes = List.of(topic, rawTable);
    EntityLineage graph =
        lineage(nodes, List.of(edge(topic, ROOT), edge(rawTable, ROOT)), List.of());

    LineageEdgeFilter.of(List.of("topic"), List.of(), List.of()).apply(graph);

    assertEquals(List.of(topic.getFullyQualifiedName()), farFqns(graph, nodes));
  }

  @Test
  void servicesKeepOnlyEdgesLeadingIntoThoseServices() {
    EntityLineage graph = downstream(TABLE, DASHBOARD, OTHER_SERVICE_TABLE);

    int removed =
        LineageEdgeFilter.of(List.of(), List.of(), List.of("snowflake_prod")).apply(graph);

    assertEquals(List.of(TABLE.getFullyQualifiedName()), farFqns(graph));
    assertEquals(2, removed);
  }

  /** A service whose name contains dots is quoted in the FQN; the caller names it plainly. */
  @Test
  void aQuotedServiceNameMatchesItsPlainName() {
    EntityReference dotted = node("table", "\"prod.snowflake\".analytics.mart.daily");
    List<EntityReference> nodes = List.of(dotted, TABLE);
    EntityLineage graph = downstream(dotted, TABLE);

    LineageEdgeFilter.of(List.of(), List.of(), List.of("prod.snowflake")).apply(graph);

    assertEquals(List.of(dotted.getFullyQualifiedName()), farFqns(graph, nodes));
  }

  /** Entity types are camelCase ids, and service names are typed by hand; neither is cased. */
  @Test
  void entityTypesAndServicesMatchRegardlessOfCase() {
    EntityLineage byType = downstream(TABLE, DASHBOARD);
    EntityLineage byService = downstream(TABLE, DASHBOARD);

    LineageEdgeFilter.of(List.of("Dashboard"), List.of(), List.of()).apply(byType);
    LineageEdgeFilter.of(List.of(), List.of(), List.of("Snowflake_PROD")).apply(byService);

    assertEquals(List.of(DASHBOARD.getFullyQualifiedName()), farFqns(byType));
    assertEquals(List.of(TABLE.getFullyQualifiedName()), farFqns(byService));
  }

  /** REST binds {@code ?entityTypes=table,dashboard} as one value; MCP splits it. Both must agree. */
  @Test
  void valuesAreSplitOnCommasAndBlanksAreNoFilter() {
    LineageEdgeFilter split =
        LineageEdgeFilter.of(List.of("table, dashboard", " "), List.of(""), List.of(" , "));

    assertEquals(new LineageEdgeFilter(Set.of("table", "dashboard"), Set.of(), Set.of()), split);
    assertFalse(LineageEdgeFilter.of(List.of(""), List.of(" "), List.of(",")).isActive());
  }

  /** The constructor normalizes too, so building the record directly cannot skip it. */
  @Test
  void theConstructorNormalizesItsSets() {
    LineageEdgeFilter direct =
        new LineageEdgeFilter(Set.of("Table"), null, Set.of("Snowflake_Prod"));

    assertEquals(LineageEdgeFilter.of(List.of("table"), null, List.of("snowflake_prod")), direct);
    assertThrows(UnsupportedOperationException.class, () -> direct.entityTypes().add("chart"));
  }

  /** A one-segment FQN, like a metric's, has no service segment to match. */
  @Test
  void aSingleSegmentFqnNamesNoService() {
    EntityReference metric = node("metric", "revenue");
    EntityLineage graph = downstream(metric);

    int removed = LineageEdgeFilter.of(List.of(), List.of(), List.of("revenue")).apply(graph);

    assertEquals(1, removed);
    assertEquals(List.of(), graph.getDownstreamEdges());
  }

  /** The FQN is only parsed for a services filter, so a bad one cannot fail a type filter. */
  @Test
  void aMalformedFqnDoesNotFailAnEntityTypeFilter() {
    assertThrows(ParseCancellationException.class, () -> FullyQualifiedName.getRoot(MALFORMED_FQN));
    EntityReference malformed = node("table", MALFORMED_FQN);
    EntityLineage graph = downstream(malformed);

    int removed =
        assertDoesNotThrow(
            () -> LineageEdgeFilter.of(List.of("table"), List.of(), List.of()).apply(graph));

    assertEquals(0, removed);
  }

  /** An FQN that does not parse names no service, so it matches no services filter. */
  @Test
  void aMalformedFqnMatchesNoService() {
    EntityReference malformed = node("table", MALFORMED_FQN);
    EntityLineage graph = downstream(malformed, TABLE);

    int removed =
        assertDoesNotThrow(
            () ->
                LineageEdgeFilter.of(List.of(), List.of(), List.of("snowflake_prod")).apply(graph));

    assertEquals(1, removed);
    assertEquals(List.of(edge(ROOT, TABLE)), graph.getDownstreamEdges());
  }

  /**
   * Nodes no kept edge touches are dropped, so the permission filter's node ceiling is not spent on
   * them; the root always stays. A kept edge's near end stays even when its type is excluded: two
   * hops out, the edge into a table starts at the excluded dashboard.
   */
  @Test
  void nodesNoKeptEdgeTouchesAreRemoved() {
    EntityReference leafDashboard = node("dashboard", "looker.leaf");
    EntityReference viaDashboard = node("table", "snowflake_prod.analytics.mart.via_dashboard");
    EntityLineage graph =
        lineage(
            List.of(ROOT, DASHBOARD, leafDashboard, viaDashboard),
            List.of(),
            List.of(
                edge(ROOT, DASHBOARD), edge(ROOT, leafDashboard), edge(DASHBOARD, viaDashboard)));

    LineageEdgeFilter.of(List.of(), List.of("dashboard"), List.of()).apply(graph);

    assertEquals(List.of(edge(DASHBOARD, viaDashboard)), graph.getDownstreamEdges());
    assertEquals(List.of(ROOT, DASHBOARD, viaDashboard), graph.getNodes());
  }

  /** The repository re-adds a node's edges for every path that reaches it. */
  @Test
  void aRepeatedEdgeIsCountedOnce() {
    EntityLineage graph =
        lineage(
            List.of(TABLE, DASHBOARD),
            List.of(),
            List.of(edge(ROOT, TABLE), edge(ROOT, DASHBOARD), edge(ROOT, DASHBOARD)));

    int removed = LineageEdgeFilter.of(List.of(), List.of("dashboard"), List.of()).apply(graph);

    assertEquals(1, removed);
  }
}
