package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
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

  /**
   * An edge with no column mappings may or may not carry the column; dropping it silently made an
   * unmapped consumer read as "nothing depends on this column". Only edges out of tables the column
   * actually reaches are counted - an unmapped edge elsewhere says nothing about this column.
   */
  @Test
  void countsUnmappedEdgesOutOfTablesTheColumnReaches() {
    EntityLineage lineage =
        lineage(
            List.of(STAGING, MART, UNRELATED, RAW, SOURCE),
            List.of(),
            List.of(
                edge(ORDERS, STAGING, mapping(STG_REF, ORDERS_ID)),
                edge(STAGING, MART),
                edge(ORDERS, UNRELATED),
                edge(ORDERS, RAW, mapping("db.raw.raw_orders.qty", "db.public.orders.quantity")),
                edge(RAW, SOURCE)));

    int unmapped = ColumnLineageScope.narrow(lineage, ORDERS_ID);

    assertEquals(2, unmapped, "STAGING->MART and ORDERS->UNRELATED; RAW is never reached");
  }

  /** The repository adds a node's edges again for every path that reaches it; count each once. */
  @Test
  void countsAnUnmappedEdgeOnceWhenTheRepositoryRepeatsIt() {
    Edge unmapped = edge(STAGING, MART);
    EntityLineage lineage =
        lineage(
            List.of(STAGING, MART),
            List.of(),
            List.of(edge(ORDERS, STAGING, mapping(STG_REF, ORDERS_ID)), unmapped, unmapped));

    assertEquals(1, ColumnLineageScope.narrow(lineage, ORDERS_ID));
  }

  /**
   * Not every entity read carries its columns - a container's live under dataModel, which the read
   * leaves out - so an entity with no child FQNs at all cannot disprove the column.
   */
  @Test
  void acceptsAColumnWhenTheEntityReadCarriesNoChildFqns() {
    Container container = new Container().withFullyQualifiedName("s3.bucket.orders");

    assertEquals(
        "s3.bucket.orders.id",
        ColumnLineageScope.requireColumnExists(container, "s3.bucket.orders.id"));
  }

  @Test
  void acceptsAColumnThatExistsOnTheEntityIncludingNestedOnes() {
    Table table = tableWithColumns();

    assertEquals(ORDERS_ID, ColumnLineageScope.requireColumnExists(table, ORDERS_ID));
    assertEquals(
        "db.public.orders.address.zip",
        ColumnLineageScope.requireColumnExists(table, "db.public.orders.address.zip"));
  }

  /** A typo used to pass the prefix check, match nothing, and come back as a complete empty graph. */
  @Test
  void rejectsAColumnTheEntityDoesNotHave() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            ColumnLineageScope.requireColumnExists(
                tableWithColumns(), "db.public.orders.custmer_id"));
  }

  private static Table tableWithColumns() {
    return new Table()
        .withFullyQualifiedName("db.public.orders")
        .withColumns(
            List.of(
                new Column().withName("id").withFullyQualifiedName(ORDERS_ID),
                new Column()
                    .withName("address")
                    .withFullyQualifiedName("db.public.orders.address")
                    .withChildren(
                        List.of(
                            new Column()
                                .withName("zip")
                                .withFullyQualifiedName("db.public.orders.address.zip")))));
  }

  @Test
  void acceptsAColumnOfTheRequestedEntity() {
    assertEquals(ORDERS_ID, ColumnLineageScope.requireColumnOf("db.public.orders", ORDERS_ID));
  }
}
