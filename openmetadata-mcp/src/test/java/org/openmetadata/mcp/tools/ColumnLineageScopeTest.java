package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;

class ColumnLineageScopeTest {

  private static final String ORDERS_ID = "db.public.orders.id";
  private static final String STG_REF = "db.public.stg_orders.order_ref";

  private static final EntityReference ORDERS = table("db.public.orders");
  private static final EntityReference STAGING = table("db.public.stg_orders");
  private static final EntityReference MART = table("db.public.mart_orders");
  private static final EntityReference UNRELATED = table("db.public.inventory");
  private static final EntityReference RAW = table("db.raw.raw_orders");
  private static final EntityReference SOURCE = table("db.raw.src_orders");

  private static EntityReference table(String fqn) {
    return new EntityReference().withId(UUID.randomUUID()).withType("table").withName(fqn);
  }

  private static ColumnLineage mapping(String toColumn, String... fromColumns) {
    return new ColumnLineage().withFromColumns(List.of(fromColumns)).withToColumn(toColumn);
  }

  private static Edge edge(EntityReference from, EntityReference to, ColumnLineage... mappings) {
    return new Edge()
        .withFromEntity(from.getId())
        .withToEntity(to.getId())
        .withLineageDetails(
            new LineageDetails().withColumnsLineage(new ArrayList<>(List.of(mappings))));
  }

  private static EntityLineage lineage(
      List<EntityReference> nodes, List<Edge> upstream, List<Edge> downstream) {
    return new EntityLineage()
        .withEntity(ORDERS)
        .withNodes(new ArrayList<>(nodes))
        .withUpstreamEdges(new ArrayList<>(upstream))
        .withDownstreamEdges(new ArrayList<>(downstream));
  }

  private static List<String> toColumns(List<Edge> edges) {
    return edges.stream()
        .flatMap(edge -> edge.getLineageDetails().getColumnsLineage().stream())
        .map(ColumnLineage::getToColumn)
        .toList();
  }

  /** The customer's failing case: a consumer that renames the column is still found. */
  @Test
  void followsTheColumnThroughDownstreamRenames() {
    EntityLineage lineage =
        lineage(
            List.of(STAGING, MART),
            List.of(),
            List.of(
                edge(ORDERS, STAGING, mapping("db.public.stg_orders.order_ref", ORDERS_ID)),
                edge(STAGING, MART, mapping("db.public.mart_orders.ref", STG_REF))));

    ColumnLineageScope.narrow(lineage, ORDERS_ID);

    assertEquals(
        List.of("db.public.stg_orders.order_ref", "db.public.mart_orders.ref"),
        toColumns(lineage.getDownstreamEdges()));
  }

  /**
   * The repository emits edges depth-first with no ORDER BY, so a later hop can be listed before
   * the hop that reaches it. The walk must not depend on that order.
   */
  @Test
  void findsHopsListedBeforeTheHopThatReachesThem() {
    EntityLineage lineage =
        lineage(
            List.of(STAGING, MART),
            List.of(),
            List.of(
                edge(STAGING, MART, mapping("db.public.mart_orders.ref", STG_REF)),
                edge(ORDERS, STAGING, mapping("db.public.stg_orders.order_ref", ORDERS_ID))));

    ColumnLineageScope.narrow(lineage, ORDERS_ID);

    assertEquals(2, lineage.getDownstreamEdges().size());
  }

  @Test
  void dropsTablesThatDoNotCarryTheColumn() {
    EntityLineage lineage =
        lineage(
            List.of(STAGING, UNRELATED),
            List.of(),
            List.of(
                edge(ORDERS, STAGING, mapping("db.public.stg_orders.order_ref", ORDERS_ID)),
                edge(
                    ORDERS,
                    UNRELATED,
                    mapping("db.public.inventory.qty", "db.public.orders.quantity"))));

    ColumnLineageScope.narrow(lineage, ORDERS_ID);

    assertEquals(List.of(STAGING), lineage.getNodes());
    assertEquals(1, lineage.getDownstreamEdges().size());
  }

  @Test
  void dropsTableLevelEdgesThatHaveNoColumnMappings() {
    EntityLineage lineage =
        lineage(List.of(UNRELATED), List.of(), List.of(edge(ORDERS, UNRELATED)));

    ColumnLineageScope.narrow(lineage, ORDERS_ID);

    assertEquals(List.of(), lineage.getNodes());
    assertEquals(List.of(), lineage.getDownstreamEdges());
  }

  /** Other mappings on a kept edge are what made each edge big; only the column's own stay. */
  @Test
  void keepsOnlyTheColumnsMappingsOnAKeptEdge() {
    EntityLineage lineage =
        lineage(
            List.of(STAGING),
            List.of(),
            List.of(
                edge(
                    ORDERS,
                    STAGING,
                    mapping("db.public.stg_orders.order_ref", ORDERS_ID),
                    mapping("db.public.stg_orders.amount", "db.public.orders.amount"))));

    ColumnLineageScope.narrow(lineage, ORDERS_ID);

    assertEquals(
        List.of("db.public.stg_orders.order_ref"), toColumns(lineage.getDownstreamEdges()));
  }

  @Test
  void walksUpstreamToEverySourceColumn() {
    EntityLineage lineage =
        lineage(
            List.of(RAW, SOURCE),
            List.of(
                edge(
                    RAW,
                    ORDERS,
                    mapping(ORDERS_ID, "db.raw.raw_orders.id"),
                    mapping("db.public.orders.amount", "db.raw.raw_orders.amount")),
                edge(SOURCE, RAW, mapping("db.raw.raw_orders.id", "db.raw.src_orders.order_id"))),
            List.of());

    ColumnLineageScope.narrow(lineage, ORDERS_ID);

    assertEquals(List.of(ORDERS_ID, "db.raw.raw_orders.id"), toColumns(lineage.getUpstreamEdges()));
    assertEquals(List.of(RAW, SOURCE), lineage.getNodes());
  }

  @Test
  void rejectsAColumnThatBelongsToAnotherEntity() {
    assertThrows(
        IllegalArgumentException.class,
        () -> ColumnLineageScope.requireColumnOf("db.public.orders", "db.public.orders_v2.id"));
  }

  @Test
  void acceptsAColumnOfTheRequestedEntity() {
    assertEquals(ORDERS_ID, ColumnLineageScope.requireColumnOf("db.public.orders", ORDERS_ID));
  }
}
