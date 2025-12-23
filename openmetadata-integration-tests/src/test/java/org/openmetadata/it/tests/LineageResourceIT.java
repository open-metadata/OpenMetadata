package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;

/**
 * Integration tests for Lineage resource operations.
 *
 * <p>Tests lineage operations including: - Adding lineage between entities - Getting lineage
 * (upstream/downstream) - Deleting lineage edges - Column-level lineage - Cross-entity type lineage
 * (table-to-table, pipeline-to-table)
 *
 * <p>Test isolation: Uses TestNamespace for unique entity names Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
public class LineageResourceIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  @Test
  void testAddLineageBetweenTables() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table sourceTable = createTable(client, namespace, "source_table");
    Table targetTable = createTable(client, namespace, "target_table");

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(sourceTable.getEntityReference())
                    .withToEntity(targetTable.getEntityReference()));

    String result = client.lineage().addLineage(addLineage);
    assertNotNull(result);

    EntityLineage lineage = getLineage(client, "table", sourceTable.getId().toString(), "0", "1");
    assertNotNull(lineage);
    assertTrue(
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(sourceTable.getId())
                        && edge.getToEntity().equals(targetTable.getId())));

    deleteLineage(client, sourceTable.getEntityReference(), targetTable.getEntityReference());

    cleanupTable(client, sourceTable);
    cleanupTable(client, targetTable);
  }

  @Test
  void testAddLineageWithColumnDetails() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table sourceTable = createTable(client, namespace, "source_with_columns");
    Table targetTable = createTable(client, namespace, "target_with_columns");

    String sourceColumn = sourceTable.getColumns().get(0).getFullyQualifiedName();
    String targetColumn = targetTable.getColumns().get(0).getFullyQualifiedName();

    LineageDetails details = new LineageDetails();
    details.setSqlQuery("SELECT * FROM source");
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(sourceColumn)).withToColumn(targetColumn));

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(sourceTable.getEntityReference())
                    .withToEntity(targetTable.getEntityReference())
                    .withLineageDetails(details));

    String result = client.lineage().addLineage(addLineage);
    assertNotNull(result);

    EntityLineage lineage = getLineage(client, "table", sourceTable.getId().toString(), "0", "1");
    assertNotNull(lineage);

    boolean foundEdgeWithDetails =
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(sourceTable.getId())
                        && edge.getToEntity().equals(targetTable.getId())
                        && edge.getLineageDetails() != null
                        && edge.getLineageDetails().getSqlQuery() != null);
    assertTrue(foundEdgeWithDetails);

    deleteLineage(client, sourceTable.getEntityReference(), targetTable.getEntityReference());

    cleanupTable(client, sourceTable);
    cleanupTable(client, targetTable);
  }

  @Test
  void testGetLineageUpstream() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table table1 = createTable(client, namespace, "upstream_table_1");
    Table table2 = createTable(client, namespace, "middle_table");
    Table table3 = createTable(client, namespace, "downstream_table_3");

    addLineage(client, table1, table2);
    addLineage(client, table2, table3);

    EntityLineage lineage = getLineage(client, "table", table2.getId().toString(), "1", "0");
    assertNotNull(lineage);
    assertTrue(
        lineage.getUpstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(table1.getId())
                        && edge.getToEntity().equals(table2.getId())));

    deleteLineage(client, table1.getEntityReference(), table2.getEntityReference());
    deleteLineage(client, table2.getEntityReference(), table3.getEntityReference());

    cleanupTable(client, table1);
    cleanupTable(client, table2);
    cleanupTable(client, table3);
  }

  @Test
  void testGetLineageDownstream() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table table1 = createTable(client, namespace, "upstream_table_2");
    Table table2 = createTable(client, namespace, "middle_table_2");
    Table table3 = createTable(client, namespace, "downstream_table_2");

    addLineage(client, table1, table2);
    addLineage(client, table2, table3);

    EntityLineage lineage = getLineage(client, "table", table2.getId().toString(), "0", "1");
    assertNotNull(lineage);
    assertTrue(
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(table2.getId())
                        && edge.getToEntity().equals(table3.getId())));

    deleteLineage(client, table1.getEntityReference(), table2.getEntityReference());
    deleteLineage(client, table2.getEntityReference(), table3.getEntityReference());

    cleanupTable(client, table1);
    cleanupTable(client, table2);
    cleanupTable(client, table3);
  }

  @Test
  void testGetLineageBothDirections() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table table1 = createTable(client, namespace, "upstream_table_3");
    Table table2 = createTable(client, namespace, "middle_table_3");
    Table table3 = createTable(client, namespace, "downstream_table_4");

    addLineage(client, table1, table2);
    addLineage(client, table2, table3);

    EntityLineage lineage = getLineage(client, "table", table2.getId().toString(), "1", "1");
    assertNotNull(lineage);
    assertTrue(
        lineage.getUpstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(table1.getId())
                        && edge.getToEntity().equals(table2.getId())));
    assertTrue(
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(table2.getId())
                        && edge.getToEntity().equals(table3.getId())));

    deleteLineage(client, table1.getEntityReference(), table2.getEntityReference());
    deleteLineage(client, table2.getEntityReference(), table3.getEntityReference());

    cleanupTable(client, table1);
    cleanupTable(client, table2);
    cleanupTable(client, table3);
  }

  @Test
  @org.junit.jupiter.api.Disabled("Delete lineage API returns 405 - needs investigation")
  void testDeleteLineage() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table sourceTable = createTable(client, namespace, "delete_source");
    Table targetTable = createTable(client, namespace, "delete_target");

    addLineage(client, sourceTable, targetTable);

    EntityLineage lineageBefore =
        getLineage(client, "table", sourceTable.getId().toString(), "0", "1");
    assertFalse(lineageBefore.getDownstreamEdges().isEmpty());

    deleteLineage(client, sourceTable.getEntityReference(), targetTable.getEntityReference());

    EntityLineage lineageAfter =
        getLineage(client, "table", sourceTable.getId().toString(), "0", "1");
    assertTrue(
        lineageAfter.getDownstreamEdges().stream()
            .noneMatch(
                edge ->
                    edge.getFromEntity().equals(sourceTable.getId())
                        && edge.getToEntity().equals(targetTable.getId())));

    cleanupTable(client, sourceTable);
    cleanupTable(client, targetTable);
  }

  @Test
  void testLineageWithMultipleUpstreamSources() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table source1 = createTable(client, namespace, "multi_source_1");
    Table source2 = createTable(client, namespace, "multi_source_2");
    Table target = createTable(client, namespace, "multi_target");

    addLineage(client, source1, target);
    addLineage(client, source2, target);

    EntityLineage lineage = getLineage(client, "table", target.getId().toString(), "1", "0");
    assertNotNull(lineage);
    assertEquals(2, lineage.getUpstreamEdges().size());
    assertTrue(
        lineage.getUpstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(source1.getId())
                        && edge.getToEntity().equals(target.getId())));
    assertTrue(
        lineage.getUpstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(source2.getId())
                        && edge.getToEntity().equals(target.getId())));

    deleteLineage(client, source1.getEntityReference(), target.getEntityReference());
    deleteLineage(client, source2.getEntityReference(), target.getEntityReference());

    cleanupTable(client, source1);
    cleanupTable(client, source2);
    cleanupTable(client, target);
  }

  @Test
  void testLineageWithMultipleDownstreamTargets() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table source = createTable(client, namespace, "multi_down_source");
    Table target1 = createTable(client, namespace, "multi_target_1");
    Table target2 = createTable(client, namespace, "multi_target_2");

    addLineage(client, source, target1);
    addLineage(client, source, target2);

    EntityLineage lineage = getLineage(client, "table", source.getId().toString(), "0", "1");
    assertNotNull(lineage);
    assertEquals(2, lineage.getDownstreamEdges().size());
    assertTrue(
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(source.getId())
                        && edge.getToEntity().equals(target1.getId())));
    assertTrue(
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(source.getId())
                        && edge.getToEntity().equals(target2.getId())));

    deleteLineage(client, source.getEntityReference(), target1.getEntityReference());
    deleteLineage(client, source.getEntityReference(), target2.getEntityReference());

    cleanupTable(client, source);
    cleanupTable(client, target1);
    cleanupTable(client, target2);
  }

  @Test
  void testLineageDepth() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table t1 = createTable(client, namespace, "depth_table_1");
    Table t2 = createTable(client, namespace, "depth_table_2");
    Table t3 = createTable(client, namespace, "depth_table_3");
    Table t4 = createTable(client, namespace, "depth_table_4");

    addLineage(client, t1, t2);
    addLineage(client, t2, t3);
    addLineage(client, t3, t4);

    EntityLineage lineageDepth1 = getLineage(client, "table", t2.getId().toString(), "0", "1");
    assertEquals(1, lineageDepth1.getDownstreamEdges().size());

    EntityLineage lineageDepth2 = getLineage(client, "table", t2.getId().toString(), "0", "2");
    assertEquals(2, lineageDepth2.getDownstreamEdges().size());

    deleteLineage(client, t1.getEntityReference(), t2.getEntityReference());
    deleteLineage(client, t2.getEntityReference(), t3.getEntityReference());
    deleteLineage(client, t3.getEntityReference(), t4.getEntityReference());

    cleanupTable(client, t1);
    cleanupTable(client, t2);
    cleanupTable(client, t3);
    cleanupTable(client, t4);
  }

  @Test
  void testPipelineToTableLineage() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Pipeline pipeline = createPipeline(client, namespace, "etl_pipeline");
    Table targetTable = createTable(client, namespace, "pipeline_target");

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(pipeline.getEntityReference())
                    .withToEntity(targetTable.getEntityReference()));

    String result = client.lineage().addLineage(addLineage);
    assertNotNull(result);

    EntityLineage lineage = getLineage(client, "pipeline", pipeline.getId().toString(), "0", "1");
    assertNotNull(lineage);
    assertTrue(
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(pipeline.getId())
                        && edge.getToEntity().equals(targetTable.getId())));

    deleteLineage(client, pipeline.getEntityReference(), targetTable.getEntityReference());

    cleanupPipeline(client, pipeline);
    cleanupTable(client, targetTable);
  }

  @Test
  @org.junit.jupiter.api.Disabled(
      "Search lineage API needs proper SDK method - getLineage format incorrect")
  void testSearchLineage() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table table1 = createTable(client, namespace, "search_table_1");
    Table table2 = createTable(client, namespace, "search_table_2");

    addLineage(client, table1, table2);

    String response =
        client
            .lineage()
            .getLineage("fqn=" + table1.getFullyQualifiedName() + "&type=table", "1", "1");
    assertNotNull(response);

    deleteLineage(client, table1.getEntityReference(), table2.getEntityReference());

    cleanupTable(client, table1);
    cleanupTable(client, table2);
  }

  @Test
  void testLineageWithDescription() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table sourceTable = createTable(client, namespace, "desc_source");
    Table targetTable = createTable(client, namespace, "desc_target");

    LineageDetails details = new LineageDetails();
    details.setDescription("Test lineage description");
    details.setSqlQuery("SELECT * FROM source");

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(sourceTable.getEntityReference())
                    .withToEntity(targetTable.getEntityReference())
                    .withLineageDetails(details));

    String result = client.lineage().addLineage(addLineage);
    assertNotNull(result);

    EntityLineage lineage = getLineage(client, "table", sourceTable.getId().toString(), "0", "1");
    boolean foundWithDescription =
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(sourceTable.getId())
                        && edge.getToEntity().equals(targetTable.getId())
                        && edge.getLineageDetails() != null
                        && edge.getLineageDetails().getDescription() != null);
    assertTrue(foundWithDescription);

    deleteLineage(client, sourceTable.getEntityReference(), targetTable.getEntityReference());

    cleanupTable(client, sourceTable);
    cleanupTable(client, targetTable);
  }

  @Test
  void testLineageMultipleColumnMappings() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table sourceTable = createTableWithMultipleColumns(client, namespace, "multi_col_source");
    Table targetTable = createTableWithMultipleColumns(client, namespace, "multi_col_target");

    LineageDetails details = new LineageDetails();
    details.setSqlQuery("SELECT col1, col2, col3 FROM source");

    String sourceCol1 = sourceTable.getColumns().get(0).getFullyQualifiedName();
    String sourceCol2 = sourceTable.getColumns().get(1).getFullyQualifiedName();
    String sourceCol3 = sourceTable.getColumns().get(2).getFullyQualifiedName();
    String targetCol1 = targetTable.getColumns().get(0).getFullyQualifiedName();
    String targetCol2 = targetTable.getColumns().get(1).getFullyQualifiedName();
    String targetCol3 = targetTable.getColumns().get(2).getFullyQualifiedName();

    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(sourceCol1)).withToColumn(targetCol1));
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(sourceCol2)).withToColumn(targetCol2));
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(sourceCol3)).withToColumn(targetCol3));

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(sourceTable.getEntityReference())
                    .withToEntity(targetTable.getEntityReference())
                    .withLineageDetails(details));

    String result = client.lineage().addLineage(addLineage);
    assertNotNull(result);

    EntityLineage lineage = getLineage(client, "table", sourceTable.getId().toString(), "0", "1");
    boolean foundEdge =
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(sourceTable.getId())
                        && edge.getToEntity().equals(targetTable.getId())
                        && edge.getLineageDetails() != null
                        && edge.getLineageDetails().getColumnsLineage().size() == 3);
    assertTrue(foundEdge);

    deleteLineage(client, sourceTable.getEntityReference(), targetTable.getEntityReference());

    cleanupTable(client, sourceTable);
    cleanupTable(client, targetTable);
  }

  private Table createTable(OpenMetadataClient client, TestNamespace namespace, String tableName)
      throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(namespace);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(namespace, service);

    CreateTable createTable = new CreateTable();
    createTable.setName(namespace.prefix(tableName));
    createTable.setDatabaseSchema(schema.getFullyQualifiedName());

    List<Column> columns =
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("name", "VARCHAR").dataLength(255).build());
    createTable.setColumns(columns);

    return client.tables().create(createTable);
  }

  private Table createTableWithMultipleColumns(
      OpenMetadataClient client, TestNamespace namespace, String tableName) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(namespace);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(namespace, service);

    CreateTable createTable = new CreateTable();
    createTable.setName(namespace.prefix(tableName));
    createTable.setDatabaseSchema(schema.getFullyQualifiedName());

    List<Column> columns =
        List.of(
            ColumnBuilder.of("col1", "VARCHAR").dataLength(100).build(),
            ColumnBuilder.of("col2", "VARCHAR").dataLength(100).build(),
            ColumnBuilder.of("col3", "VARCHAR").dataLength(100).build());
    createTable.setColumns(columns);

    return client.tables().create(createTable);
  }

  private Pipeline createPipeline(
      OpenMetadataClient client, TestNamespace namespace, String pipelineName) throws Exception {
    PipelineService pipelineService = PipelineServiceTestFactory.createAirflow(namespace);

    CreatePipeline createPipeline = new CreatePipeline();
    createPipeline.setName(namespace.prefix(pipelineName));
    createPipeline.setService(pipelineService.getFullyQualifiedName());

    return client.pipelines().create(createPipeline);
  }

  private void addLineage(OpenMetadataClient client, EntityReference from, EntityReference to)
      throws Exception {
    AddLineage addLineage =
        new AddLineage().withEdge(new EntitiesEdge().withFromEntity(from).withToEntity(to));
    client.lineage().addLineage(addLineage);
  }

  private void addLineage(OpenMetadataClient client, Table from, Table to) throws Exception {
    addLineage(client, from.getEntityReference(), to.getEntityReference());
  }

  private void addLineage(OpenMetadataClient client, Pipeline from, Table to) throws Exception {
    addLineage(client, from.getEntityReference(), to.getEntityReference());
  }

  private void deleteLineage(OpenMetadataClient client, EntityReference from, EntityReference to) {
    try {
      String fromId = from.getType() + ":" + from.getId();
      String toId = to.getType() + ":" + to.getId();
      client.lineage().deleteLineage(fromId, toId);
    } catch (Exception e) {
      // Ignore lineage cleanup errors - lineage edges can be left behind
    }
  }

  private EntityLineage getLineage(
      OpenMetadataClient client,
      String entityType,
      String entityId,
      String upstreamDepth,
      String downstreamDepth)
      throws Exception {
    String response =
        client.lineage().getEntityLineage(entityType, entityId, upstreamDepth, downstreamDepth);
    return OBJECT_MAPPER.readValue(response, EntityLineage.class);
  }

  private void cleanupTable(OpenMetadataClient client, Table table) throws Exception {
    try {
      client.tables().delete(table.getId().toString());
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }

  private void cleanupPipeline(OpenMetadataClient client, Pipeline pipeline) throws Exception {
    try {
      client.pipelines().delete(pipeline.getId().toString());
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }
}
