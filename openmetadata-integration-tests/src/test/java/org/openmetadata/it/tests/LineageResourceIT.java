package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.ContainerServiceTestFactory;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.MlModelServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.MlFeatureDataType;
import org.openmetadata.schema.type.SchemaType;
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

  @Test
  void testLineageWithMultipleColumnLineages() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table table1 = createTableWithMultipleColumns(client, namespace, "lineage_col_src");
    Table table2 = createTableWithMultipleColumns(client, namespace, "lineage_col_tgt");

    String t1c1FQN = table1.getColumns().get(0).getFullyQualifiedName();
    String t1c2FQN = table1.getColumns().get(1).getFullyQualifiedName();
    String t1c3FQN = table1.getColumns().get(2).getFullyQualifiedName();
    String t2c1FQN = table2.getColumns().get(0).getFullyQualifiedName();
    String t2c2FQN = table2.getColumns().get(1).getFullyQualifiedName();
    String t2c3FQN = table2.getColumns().get(2).getFullyQualifiedName();

    LineageDetails details = new LineageDetails();
    details.setSqlQuery("SELECT col1, col2, col3 FROM table1");

    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(t1c1FQN)).withToColumn(t2c1FQN));
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(t1c2FQN)).withToColumn(t2c2FQN));
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(t1c3FQN)).withToColumn(t2c3FQN));

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(table1.getEntityReference())
                    .withToEntity(table2.getEntityReference())
                    .withLineageDetails(details));

    String result = client.lineage().addLineage(addLineage);
    assertNotNull(result);

    EntityLineage lineage = getLineage(client, "table", table1.getId().toString(), "0", "1");
    boolean foundEdge =
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(table1.getId())
                        && edge.getToEntity().equals(table2.getId())
                        && edge.getLineageDetails() != null
                        && edge.getLineageDetails().getColumnsLineage().size() == 3);
    assertTrue(foundEdge);

    deleteLineage(client, table1.getEntityReference(), table2.getEntityReference());
    cleanupTable(client, table1);
    cleanupTable(client, table2);
  }

  @Test
  void testLineageWithMultipleFromColumns() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table sourceTable = createTableWithMultipleColumns(client, namespace, "multi_from_source");
    Table targetTable = createTableWithMultipleColumns(client, namespace, "multi_from_target");

    String t1c1FQN = sourceTable.getColumns().get(0).getFullyQualifiedName();
    String t1c2FQN = sourceTable.getColumns().get(1).getFullyQualifiedName();
    String t2c1FQN = targetTable.getColumns().get(0).getFullyQualifiedName();

    LineageDetails details = new LineageDetails();
    details.setSqlQuery("SELECT col1 + col2 FROM source");
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(t1c1FQN, t1c2FQN)).withToColumn(t2c1FQN));

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
                        && edge.getLineageDetails().getColumnsLineage().size() == 1
                        && edge.getLineageDetails()
                                .getColumnsLineage()
                                .get(0)
                                .getFromColumns()
                                .size()
                            == 2);
    assertTrue(foundEdge);

    deleteLineage(client, sourceTable.getEntityReference(), targetTable.getEntityReference());
    cleanupTable(client, sourceTable);
    cleanupTable(client, targetTable);
  }

  @Test
  void testLineageByFQN() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table table1 = createTable(client, namespace, "fqn_lineage_table1");
    Table table2 = createTable(client, namespace, "fqn_lineage_table2");

    addLineage(client, table1, table2);

    String response =
        client.lineage().getLineageByName("table", table1.getFullyQualifiedName(), "0", "1");
    EntityLineage lineage = OBJECT_MAPPER.readValue(response, EntityLineage.class);

    assertNotNull(lineage);
    assertTrue(
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(table1.getId())
                        && edge.getToEntity().equals(table2.getId())));

    deleteLineage(client, table1.getEntityReference(), table2.getEntityReference());
    cleanupTable(client, table1);
    cleanupTable(client, table2);
  }

  @Test
  void testLineageGraphWithMultipleDepths() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table t0 = createTable(client, namespace, "graph_table_0");
    Table t1 = createTable(client, namespace, "graph_table_1");
    Table t2 = createTable(client, namespace, "graph_table_2");
    Table t3 = createTable(client, namespace, "graph_table_3");
    Table t4 = createTable(client, namespace, "graph_table_4");

    addLineage(client, t0, t1);
    addLineage(client, t1, t2);
    addLineage(client, t2, t3);
    addLineage(client, t3, t4);

    EntityLineage lineageDepth0 = getLineage(client, "table", t2.getId().toString(), "0", "0");
    assertEquals(0, lineageDepth0.getUpstreamEdges().size());
    assertEquals(0, lineageDepth0.getDownstreamEdges().size());

    EntityLineage lineageDepth1 = getLineage(client, "table", t2.getId().toString(), "1", "1");
    assertEquals(1, lineageDepth1.getUpstreamEdges().size());
    assertEquals(1, lineageDepth1.getDownstreamEdges().size());

    EntityLineage lineageDepth2 = getLineage(client, "table", t2.getId().toString(), "2", "2");
    assertEquals(2, lineageDepth2.getUpstreamEdges().size());
    assertEquals(2, lineageDepth2.getDownstreamEdges().size());

    EntityLineage lineageDepth3 = getLineage(client, "table", t2.getId().toString(), "3", "3");
    assertEquals(2, lineageDepth3.getUpstreamEdges().size());
    assertEquals(2, lineageDepth3.getDownstreamEdges().size());

    deleteLineage(client, t0.getEntityReference(), t1.getEntityReference());
    deleteLineage(client, t1.getEntityReference(), t2.getEntityReference());
    deleteLineage(client, t2.getEntityReference(), t3.getEntityReference());
    deleteLineage(client, t3.getEntityReference(), t4.getEntityReference());

    cleanupTable(client, t0);
    cleanupTable(client, t1);
    cleanupTable(client, t2);
    cleanupTable(client, t3);
    cleanupTable(client, t4);
  }

  @Test
  void testCrossEntityLineage_TopicToTable() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Topic topic = createTopic(client, namespace, "source_topic");
    Table table = createTableWithMultipleColumns(client, namespace, "target_table");

    String f1FQN = topic.getMessageSchema().getSchemaFields().get(0).getFullyQualifiedName();
    String t1c1FQN = table.getColumns().get(0).getFullyQualifiedName();

    LineageDetails details = new LineageDetails();
    details.setSqlQuery("INSERT INTO table SELECT * FROM topic");
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(f1FQN)).withToColumn(t1c1FQN));

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(topic.getEntityReference())
                    .withToEntity(table.getEntityReference())
                    .withLineageDetails(details));

    String result = client.lineage().addLineage(addLineage);
    assertNotNull(result);

    EntityLineage lineage = getLineage(client, "topic", topic.getId().toString(), "0", "1");
    assertTrue(
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(topic.getId())
                        && edge.getToEntity().equals(table.getId())));

    deleteLineage(client, topic.getEntityReference(), table.getEntityReference());
    cleanupTopic(client, topic);
    cleanupTable(client, table);
  }

  @Test
  void testCrossEntityLineage_TableToDashboardDataModel() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table table = createTableWithMultipleColumns(client, namespace, "data_model_source");
    DashboardDataModel dataModel = createDashboardDataModel(client, namespace, "target_data_model");

    String t1c1FQN = table.getColumns().get(0).getFullyQualifiedName();
    String d1c1FQN = dataModel.getColumns().get(0).getFullyQualifiedName();

    LineageDetails details = new LineageDetails();
    details.setSqlQuery("SELECT * FROM table");
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(t1c1FQN)).withToColumn(d1c1FQN));

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(table.getEntityReference())
                    .withToEntity(dataModel.getEntityReference())
                    .withLineageDetails(details));

    String result = client.lineage().addLineage(addLineage);
    assertNotNull(result);

    EntityLineage lineage = getLineage(client, "table", table.getId().toString(), "0", "1");
    assertTrue(
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(table.getId())
                        && edge.getToEntity().equals(dataModel.getId())));

    deleteLineage(client, table.getEntityReference(), dataModel.getEntityReference());
    cleanupTable(client, table);
    cleanupDashboardDataModel(client, dataModel);
  }

  @Test
  void testCrossEntityLineage_ContainerToTable() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Container container = createContainer(client, namespace, "source_container");
    Table table = createTableWithMultipleColumns(client, namespace, "container_target");

    String c1FQN = container.getDataModel().getColumns().get(0).getFullyQualifiedName();
    String t1FQN = table.getColumns().get(0).getFullyQualifiedName();

    LineageDetails details = new LineageDetails();
    details.setSqlQuery("SELECT * FROM container");
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(c1FQN)).withToColumn(t1FQN));

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(container.getEntityReference())
                    .withToEntity(table.getEntityReference())
                    .withLineageDetails(details));

    String result = client.lineage().addLineage(addLineage);
    assertNotNull(result);

    EntityLineage lineage = getLineage(client, "container", container.getId().toString(), "0", "1");
    assertTrue(
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(container.getId())
                        && edge.getToEntity().equals(table.getId())));

    deleteLineage(client, container.getEntityReference(), table.getEntityReference());
    cleanupContainer(client, container);
    cleanupTable(client, table);
  }

  @Test
  void testCrossEntityLineage_TableToMlModel() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table table = createTableWithMultipleColumns(client, namespace, "ml_source_table");
    MlModel mlModel = createMlModel(client, namespace, "target_ml_model");

    String t1c1FQN = table.getColumns().get(0).getFullyQualifiedName();
    String m1f1FQN = mlModel.getMlFeatures().get(0).getFullyQualifiedName();

    LineageDetails details = new LineageDetails();
    details.setSqlQuery("SELECT features FROM table");
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(t1c1FQN)).withToColumn(m1f1FQN));

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(table.getEntityReference())
                    .withToEntity(mlModel.getEntityReference())
                    .withLineageDetails(details));

    String result = client.lineage().addLineage(addLineage);
    assertNotNull(result);

    EntityLineage lineage = getLineage(client, "table", table.getId().toString(), "0", "1");
    assertTrue(
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(table.getId())
                        && edge.getToEntity().equals(mlModel.getId())));

    deleteLineage(client, table.getEntityReference(), mlModel.getEntityReference());
    cleanupTable(client, table);
    cleanupMlModel(client, mlModel);
  }

  @Test
  void testCrossEntityLineage_TableToDashboard() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table table = createTableWithMultipleColumns(client, namespace, "dashboard_source");
    Dashboard dashboard = createDashboard(client, namespace, "target_dashboard");

    LineageDetails details = new LineageDetails();
    details.setSqlQuery("SELECT * FROM table FOR DASHBOARD");

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(table.getEntityReference())
                    .withToEntity(dashboard.getEntityReference())
                    .withLineageDetails(details));

    String result = client.lineage().addLineage(addLineage);
    assertNotNull(result);

    EntityLineage lineage = getLineage(client, "table", table.getId().toString(), "0", "1");
    assertTrue(
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(table.getId())
                        && edge.getToEntity().equals(dashboard.getId())));

    deleteLineage(client, table.getEntityReference(), dashboard.getEntityReference());
    cleanupTable(client, table);
    cleanupDashboard(client, dashboard);
  }

  @Test
  @Disabled("Elasticsearch version conflict during update_by_query - needs investigation")
  void testLineageWithInvalidColumns() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table table1 = createTableWithMultipleColumns(client, namespace, "invalid_col_source");
    Table table2 = createTableWithMultipleColumns(client, namespace, "invalid_col_target");

    String t1c1FQN = table1.getColumns().get(0).getFullyQualifiedName();
    String t2c1FQN = table2.getColumns().get(0).getFullyQualifiedName();

    LineageDetails details = new LineageDetails();
    details.setSqlQuery("SELECT * FROM table");
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(t1c1FQN)).withToColumn(t2c1FQN));
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of("invalid_column")).withToColumn(t2c1FQN));

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(table1.getEntityReference())
                    .withToEntity(table2.getEntityReference())
                    .withLineageDetails(details));

    String result = client.lineage().addLineage(addLineage);
    assertNotNull(result);

    EntityLineage lineage = getLineage(client, "table", table1.getId().toString(), "0", "1");
    boolean foundEdge =
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(table1.getId())
                        && edge.getToEntity().equals(table2.getId())
                        && edge.getLineageDetails() != null);
    assertTrue(foundEdge);

    deleteLineage(client, table1.getEntityReference(), table2.getEntityReference());
    cleanupTable(client, table1);
    cleanupTable(client, table2);
  }

  @Test
  void testComplexLineageGraph() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table t0 = createTable(client, namespace, "complex_0");
    Table t1 = createTable(client, namespace, "complex_1");
    Table t2 = createTable(client, namespace, "complex_2");
    Table t3 = createTable(client, namespace, "complex_3");
    Table t4 = createTable(client, namespace, "complex_4");
    Table t5 = createTable(client, namespace, "complex_5");

    addLineage(client, t0, t3);
    addLineage(client, t1, t4);
    addLineage(client, t2, t4);
    addLineage(client, t3, t4);
    addLineage(client, t4, t5);

    EntityLineage lineage = getLineage(client, "table", t4.getId().toString(), "2", "2");
    assertNotNull(lineage);

    assertEquals(4, lineage.getUpstreamEdges().size());
    assertEquals(1, lineage.getDownstreamEdges().size());

    deleteLineage(client, t0.getEntityReference(), t3.getEntityReference());
    deleteLineage(client, t1.getEntityReference(), t4.getEntityReference());
    deleteLineage(client, t2.getEntityReference(), t4.getEntityReference());
    deleteLineage(client, t3.getEntityReference(), t4.getEntityReference());
    deleteLineage(client, t4.getEntityReference(), t5.getEntityReference());

    cleanupTable(client, t0);
    cleanupTable(client, t1);
    cleanupTable(client, t2);
    cleanupTable(client, t3);
    cleanupTable(client, t4);
    cleanupTable(client, t5);
  }

  @Test
  void testUpdateLineageEdge() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table table1 = createTableWithMultipleColumns(client, namespace, "update_source");
    Table table2 = createTableWithMultipleColumns(client, namespace, "update_target");

    LineageDetails details1 = new LineageDetails();
    details1.setDescription("Initial lineage");
    details1.setSqlQuery("SELECT * FROM source");

    AddLineage addLineage1 =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(table1.getEntityReference())
                    .withToEntity(table2.getEntityReference())
                    .withLineageDetails(details1));

    client.lineage().addLineage(addLineage1);

    LineageDetails details2 = new LineageDetails();
    details2.setDescription("Updated lineage");
    details2.setSqlQuery("SELECT col1, col2 FROM source");
    String t1c1FQN = table1.getColumns().get(0).getFullyQualifiedName();
    String t2c1FQN = table2.getColumns().get(0).getFullyQualifiedName();
    details2
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(t1c1FQN)).withToColumn(t2c1FQN));

    AddLineage addLineage2 =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(table1.getEntityReference())
                    .withToEntity(table2.getEntityReference())
                    .withLineageDetails(details2));

    String result = client.lineage().addLineage(addLineage2);
    assertNotNull(result);

    EntityLineage lineage = getLineage(client, "table", table1.getId().toString(), "0", "1");
    boolean foundUpdated =
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(table1.getId())
                        && edge.getToEntity().equals(table2.getId())
                        && edge.getLineageDetails() != null
                        && edge.getLineageDetails().getDescription().equals("Updated lineage"));
    assertTrue(foundUpdated);

    deleteLineage(client, table1.getEntityReference(), table2.getEntityReference());
    cleanupTable(client, table1);
    cleanupTable(client, table2);
  }

  private Topic createTopic(OpenMetadataClient client, TestNamespace ns, String topicName)
      throws Exception {
    MessagingService messagingService = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic createTopic = new CreateTopic();
    createTopic.setName(ns.prefix(topicName));
    createTopic.setService(messagingService.getFullyQualifiedName());
    createTopic.setPartitions(1);

    MessageSchema messageSchema = new MessageSchema();
    messageSchema.setSchemaType(SchemaType.Avro);

    List<Field> fields = new ArrayList<>();
    Field field1 = new Field();
    field1.setName("field1");
    field1.setDataType(org.openmetadata.schema.type.FieldDataType.STRING);
    fields.add(field1);

    messageSchema.setSchemaFields(fields);
    createTopic.setMessageSchema(messageSchema);

    return client.topics().create(createTopic);
  }

  private DashboardDataModel createDashboardDataModel(
      OpenMetadataClient client, TestNamespace ns, String modelName) throws Exception {
    DashboardService dashboardService = DashboardServiceTestFactory.createMetabase(ns);

    CreateDashboardDataModel createModel = new CreateDashboardDataModel();
    createModel.setName(ns.prefix(modelName));
    createModel.setService(dashboardService.getFullyQualifiedName());
    createModel.setDataModelType(org.openmetadata.schema.type.DataModelType.MetabaseDataModel);

    List<Column> columns = new ArrayList<>();
    Column col1 = new Column();
    col1.setName("col1");
    col1.setDataType(org.openmetadata.schema.type.ColumnDataType.VARCHAR);
    col1.setDataLength(100);
    columns.add(col1);

    createModel.setColumns(columns);

    return client.dashboardDataModels().create(createModel);
  }

  private Container createContainer(
      OpenMetadataClient client, TestNamespace ns, String containerName) throws Exception {
    StorageService containerService = ContainerServiceTestFactory.createS3(ns);

    CreateContainer createContainer = new CreateContainer();
    createContainer.setName(ns.prefix(containerName));
    createContainer.setService(containerService.getFullyQualifiedName());

    ContainerDataModel dataModel = new ContainerDataModel();
    List<Column> columns = new ArrayList<>();
    Column col1 = new Column();
    col1.setName("container_col1");
    col1.setDataType(org.openmetadata.schema.type.ColumnDataType.VARCHAR);
    col1.setDataLength(100);
    columns.add(col1);

    dataModel.setColumns(columns);
    createContainer.setDataModel(dataModel);

    return client.containers().create(createContainer);
  }

  private MlModel createMlModel(OpenMetadataClient client, TestNamespace ns, String modelName)
      throws Exception {
    MlModelService mlModelService = MlModelServiceTestFactory.createMlflow(ns);

    CreateMlModel createMlModel = new CreateMlModel();
    createMlModel.setName(ns.prefix(modelName));
    createMlModel.setService(mlModelService.getFullyQualifiedName());
    createMlModel.setAlgorithm("regression");

    List<MlFeature> features = new ArrayList<>();
    MlFeature feature1 = new MlFeature();
    feature1.setName("feature1");
    feature1.setDataType(MlFeatureDataType.Numerical);
    features.add(feature1);

    createMlModel.setMlFeatures(features);

    return client.mlModels().create(createMlModel);
  }

  private Dashboard createDashboard(
      OpenMetadataClient client, TestNamespace ns, String dashboardName) throws Exception {
    DashboardService dashboardService = DashboardServiceTestFactory.createMetabase(ns);

    CreateDashboard createDashboard = new CreateDashboard();
    createDashboard.setName(ns.prefix(dashboardName));
    createDashboard.setService(dashboardService.getFullyQualifiedName());

    return client.dashboards().create(createDashboard);
  }

  private void cleanupTopic(OpenMetadataClient client, Topic topic) throws Exception {
    try {
      client.topics().delete(topic.getId().toString());
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }

  private void cleanupDashboardDataModel(OpenMetadataClient client, DashboardDataModel model)
      throws Exception {
    try {
      client.dashboardDataModels().delete(model.getId().toString());
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }

  private void cleanupContainer(OpenMetadataClient client, Container container) throws Exception {
    try {
      client.containers().delete(container.getId().toString());
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }

  private void cleanupMlModel(OpenMetadataClient client, MlModel mlModel) throws Exception {
    try {
      client.mlModels().delete(mlModel.getId().toString());
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }

  private void cleanupDashboard(OpenMetadataClient client, Dashboard dashboard) throws Exception {
    try {
      client.dashboards().delete(dashboard.getId().toString());
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }
}
