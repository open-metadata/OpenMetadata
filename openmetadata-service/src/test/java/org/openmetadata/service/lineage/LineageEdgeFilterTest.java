package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.CompactLineage;
import org.openmetadata.schema.api.lineage.CompactLineageEdge;

class LineageEdgeFilterTest {

  private static final String ROOT = "snowflake_prod.analytics.core.orders";

  private static CompactLineageEdge edge(
      String fromFqn, String fromType, String toFqn, String toType) {
    return new CompactLineageEdge()
        .withFromFQN(fromFqn)
        .withFromType(fromType)
        .withToFQN(toFqn)
        .withToType(toType)
        .withColumnsLineage(null)
        .withTempLineageTables(null);
  }

  private static CompactLineage graph(
      List<CompactLineageEdge> upstream, List<CompactLineageEdge> downstream) {
    return new CompactLineage()
        .withRoot(ROOT)
        .withUpstream(upstream)
        .withDownstream(downstream)
        .withOversizedEdges(null);
  }

  private static final CompactLineageEdge TO_TABLE =
      edge(ROOT, "table", "snowflake_prod.analytics.mart.daily_orders", "table");
  private static final CompactLineageEdge TO_DASHBOARD =
      edge(ROOT, "table", "looker.orders_dashboard", "dashboard");
  private static final CompactLineageEdge TO_OTHER_SERVICE_TABLE =
      edge(ROOT, "table", "bigquery_prod.reporting.ext.orders_copy", "table");

  private static List<String> farFqns(CompactLineage slim) {
    return Stream.concat(
            slim.getUpstream().stream().map(CompactLineageEdge::getFromFQN),
            slim.getDownstream().stream().map(CompactLineageEdge::getToFQN))
        .toList();
  }

  @Test
  void noFilterKeepsEveryEdge() {
    LineageEdgeFilter.Filtered filtered =
        LineageEdgeFilter.NONE.apply(graph(List.of(), List.of(TO_TABLE, TO_DASHBOARD)));

    assertFalse(LineageEdgeFilter.NONE.isActive());
    assertEquals(2, filtered.slim().getDownstream().size());
    assertEquals(0, filtered.removedEdges());
  }

  /** "Tables only": an edge is judged by the asset it leads to, not the one it leaves. */
  @Test
  void entityTypesKeepOnlyEdgesLeadingToThoseTypes() {
    LineageEdgeFilter filter = LineageEdgeFilter.of(List.of("table"), List.of(), List.of());

    LineageEdgeFilter.Filtered filtered =
        filter.apply(graph(List.of(), List.of(TO_TABLE, TO_DASHBOARD, TO_OTHER_SERVICE_TABLE)));

    assertEquals(
        List.of(TO_TABLE.getToFQN(), TO_OTHER_SERVICE_TABLE.getToFQN()), farFqns(filtered.slim()));
    assertEquals(1, filtered.removedEdges());
  }

  /** "No dashboards", without having to name every other type. */
  @Test
  void excludedEntityTypesDropEdgesLeadingToThem() {
    LineageEdgeFilter filter = LineageEdgeFilter.of(List.of(), List.of("dashboard"), List.of());

    LineageEdgeFilter.Filtered filtered =
        filter.apply(graph(List.of(), List.of(TO_TABLE, TO_DASHBOARD)));

    assertEquals(List.of(TO_TABLE.getToFQN()), farFqns(filtered.slim()));
  }

  /** Upstream, the far end of an edge is its source. */
  @Test
  void anUpstreamEdgeIsJudgedByItsSource() {
    CompactLineageEdge fromTopic = edge("kafka_prod.orders_events", "topic", ROOT, "table");
    CompactLineageEdge fromTable = edge("snowflake_prod.raw.s.orders_raw", "table", ROOT, "table");
    LineageEdgeFilter filter = LineageEdgeFilter.of(List.of("topic"), List.of(), List.of());

    LineageEdgeFilter.Filtered filtered =
        filter.apply(graph(List.of(fromTopic, fromTable), List.of()));

    assertEquals(List.of("kafka_prod.orders_events"), farFqns(filtered.slim()));
  }

  @Test
  void servicesKeepOnlyEdgesLeadingIntoThoseServices() {
    LineageEdgeFilter filter =
        LineageEdgeFilter.of(List.of(), List.of(), List.of("snowflake_prod"));

    LineageEdgeFilter.Filtered filtered =
        filter.apply(graph(List.of(), List.of(TO_TABLE, TO_DASHBOARD, TO_OTHER_SERVICE_TABLE)));

    assertEquals(List.of(TO_TABLE.getToFQN()), farFqns(filtered.slim()));
    assertEquals(2, filtered.removedEdges());
  }

  /** A service whose name contains dots is quoted in the FQN; the caller names it plainly. */
  @Test
  void aQuotedServiceNameMatchesItsPlainName() {
    CompactLineageEdge toDotted =
        edge(ROOT, "table", "\"prod.snowflake\".analytics.mart.daily", "table");
    LineageEdgeFilter filter =
        LineageEdgeFilter.of(List.of(), List.of(), List.of("prod.snowflake"));

    LineageEdgeFilter.Filtered filtered =
        filter.apply(graph(List.of(), List.of(toDotted, TO_TABLE)));

    assertEquals(List.of(toDotted.getToFQN()), farFqns(filtered.slim()));
  }

  /** Entity types are camelCase identifiers an LLM may not case exactly. */
  @Test
  void entityTypesMatchRegardlessOfCase() {
    LineageEdgeFilter filter = LineageEdgeFilter.of(List.of("Dashboard"), List.of(), List.of());

    LineageEdgeFilter.Filtered filtered =
        filter.apply(graph(List.of(), List.of(TO_TABLE, TO_DASHBOARD)));

    assertEquals(List.of(TO_DASHBOARD.getToFQN()), farFqns(filtered.slim()));
  }
}
