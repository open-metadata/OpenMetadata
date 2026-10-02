package org.openmetadata.service.lineage;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.lineage.CompactLineage;
import org.openmetadata.schema.api.lineage.CompactLineageEdge;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.TempLineageTable;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.lineage.CompactLineageSlimmer.EdgeOptions;

class CompactLineageSlimmerTest {

  private static final EntityReference ROOT = table("orders", "db.public.orders");
  private static final EntityReference UPSTREAM = table("raw_orders", "db.raw.raw_orders");
  private static final ColumnLineage MAPPING =
      new ColumnLineage()
          .withFromColumns(List.of("db.raw.raw_orders.id"))
          .withToColumn("db.public.orders.id");

  private static EntityReference table(String name, String fqn) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType("table")
        .withName(name)
        .withFullyQualifiedName(fqn)
        .withDisplayName(name + " Display")
        .withDescription("A node description that must not reach the slim graph.");
  }

  private static EntityLineage lineage(LineageDetails details, int copies) {
    Edge edge =
        new Edge()
            .withFromEntity(UPSTREAM.getId())
            .withToEntity(ROOT.getId())
            .withLineageDetails(details);
    return new EntityLineage()
        .withEntity(ROOT)
        .withNodes(List.of(UPSTREAM))
        .withUpstreamEdges(Collections.nCopies(copies, edge))
        .withDownstreamEdges(List.of());
  }

  private static LineageDetails details(List<ColumnLineage> columns, EntityReference pipeline) {
    return new LineageDetails()
        .withSqlQuery("SELECT id FROM raw_orders")
        .withColumnsLineage(columns)
        .withPipeline(pipeline)
        .withSource(LineageDetails.Source.QUERY_LINEAGE)
        .withTempLineageTables(
            List.of(new TempLineageTable().withFromEntity("src").withToEntity("staging")))
        .withUpdatedAt(123L)
        .withUpdatedBy("bob");
  }

  private static CompactLineageEdge onlyUpstreamEdge(CompactLineage slim) {
    assertEquals(1, slim.getUpstream().size());
    return slim.getUpstream().getFirst();
  }

  @Test
  void slimsToIdentityAndRelationshipByDefault() {
    CompactLineage slim =
        CompactLineageSlimmer.toSlim(
            lineage(details(List.of(MAPPING), null), 1), new EdgeOptions(false, false));

    CompactLineageEdge edge = onlyUpstreamEdge(slim);
    assertEquals("db.public.orders", slim.getRoot());
    assertEquals("db.raw.raw_orders", edge.getFromFQN());
    assertEquals("raw_orders Display", edge.getFromName());
    assertEquals("sql", edge.getRelationshipType());
    assertEquals(Boolean.TRUE, edge.getHasSql(), "SQL exists, so the caller is told it can ask");
    assertNull(edge.getSqlQuery());
    assertNull(edge.getColumnsLineage());
    assertNull(
        edge.getTempLineageTables(), "temp tables are lifted from the SQL, so they go with it");
  }

  /** Generated lists default to [], which would put an empty array on every edge. */
  @Test
  void anAbsentListIsLeftOutOfTheJsonNotSerializedEmpty() {
    String json =
        JsonUtils.pojoToJson(
            CompactLineageSlimmer.toSlim(
                lineage(details(List.of(), null), 1), new EdgeOptions(true, false)));

    assertEquals(-1, json.indexOf("columnsLineage"), json);
    assertEquals(-1, json.indexOf("tempLineageTables"), json);
    assertEquals(-1, json.indexOf("oversizedEdges"), json);
  }

  @Test
  void carriesColumnLineageAndSqlWhenAsked() {
    CompactLineageEdge edge =
        onlyUpstreamEdge(
            CompactLineageSlimmer.toSlim(
                lineage(details(List.of(MAPPING), null), 1), new EdgeOptions(true, true)));

    assertEquals(List.of(MAPPING), edge.getColumnsLineage());
    assertEquals("SELECT id FROM raw_orders", edge.getSqlQuery());
    assertEquals(1, edge.getTempLineageTables().size());
  }

  /**
   * A pipeline is its own entity with its own policy. A caller allowed on both tables still learns
   * a pipeline joins them, but not which one.
   */
  @Test
  void aDeniedPipelineKeepsTheRelationshipButNotItsIdentity() {
    EntityReference pipeline =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("pipeline")
            .withName("nightly_etl")
            .withFullyQualifiedName("airflow.nightly_etl")
            .withDescription("Loads orders every night");

    CompactLineageEdge denied =
        onlyUpstreamEdge(
            CompactLineageSlimmer.toSlim(
                lineage(details(null, pipeline), 1), new EdgeOptions(false, false), p -> false));
    CompactLineageEdge allowed =
        onlyUpstreamEdge(
            CompactLineageSlimmer.toSlim(
                lineage(details(null, pipeline), 1), new EdgeOptions(false, false), p -> true));

    assertEquals("pipeline", denied.getRelationshipType());
    assertNull(denied.getPipelineFQN());
    assertNull(denied.getPipelineDescription());
    assertEquals("pipeline:nightly_etl", allowed.getRelationshipType());
    assertEquals("airflow.nightly_etl", allowed.getPipelineFQN());
  }

  /** The repository re-adds a node's edges for every path that reaches it. */
  @Test
  void collapsesEdgesTheRepositoryRepeated() {
    CompactLineage slim =
        CompactLineageSlimmer.toSlim(
            lineage(details(null, null), 3), new EdgeOptions(false, false));

    assertEquals(1, slim.getUpstream().size());
  }
}
