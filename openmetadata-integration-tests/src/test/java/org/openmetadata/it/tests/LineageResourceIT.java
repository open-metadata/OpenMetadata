package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.StringReader;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Predicate;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Assumptions;
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
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateMlModel;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateStoredProcedure;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.data.StoredProcedureCode;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.api.lineage.LineageBand;
import org.openmetadata.schema.api.lineage.LineageLens;
import org.openmetadata.schema.api.lineage.LineageLevelKind;
import org.openmetadata.schema.api.lineage.LineageScene;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnLineage;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.MlFeatureDataType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.SchemaType;
import org.openmetadata.schema.type.StoredProcedureLanguage;
import org.openmetadata.schema.type.api.BulkAssets;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

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
  private static final String LINEAGE_PATH = "/v1/lineage";

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

    String result = executeAddLineage(client, addLineage);
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

    String result = executeAddLineage(client, addLineage);
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
  void testDirectionalSearchPreservePathsRetainsIntermediateNodes() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table root = createTable(client, namespace, "preserve_root");
    Table mid = createTable(client, namespace, "preserve_mid");
    Table leaf = createTable(client, namespace, "preserve_leaf");

    addLineage(client, root, mid);
    addLineage(client, mid, leaf);

    String queryFilter =
        """
        {
          "query": {
            "bool": {
              "must": [
                {"wildcard": {"name.keyword": {"value": "*preserve_leaf*"}}}
              ]
            }
          }
        }
        """;

    RequestOptions options =
        RequestOptions.builder()
            .queryParam("fqn", root.getFullyQualifiedName())
            .queryParam("upstreamDepth", "0")
            .queryParam("downstreamDepth", "3")
            .queryParam("includeDeleted", "false")
            .queryParam("query_filter", queryFilter)
            .queryParam("preserve_paths", "true")
            .build();

    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/lineage/getLineage/Downstream", null, options);
    JsonNode result = OBJECT_MAPPER.readTree(response);

    assertTrue(result.get("nodes").has(root.getFullyQualifiedName()));
    assertTrue(result.get("nodes").has(mid.getFullyQualifiedName()));
    assertTrue(result.get("nodes").has(leaf.getFullyQualifiedName()));
    assertEquals(2, result.get("downstreamEdges").size());

    deleteLineage(client, root.getEntityReference(), mid.getEntityReference());
    deleteLineage(client, mid.getEntityReference(), leaf.getEntityReference());
    cleanupTable(client, root);
    cleanupTable(client, mid);
    cleanupTable(client, leaf);
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

    String result = executeAddLineage(client, addLineage);
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
  void testPipelineReferenceLineageUsesOnlyUpstreamRelationships() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Pipeline unrelatedPipeline =
        createPipeline(client, namespace, "pipeline_reference_wrong_relation");
    Pipeline lineagePipeline = createPipeline(client, namespace, "pipeline_reference_lineage");
    Table sourceTable = createTable(client, namespace, "pipeline_reference_source");
    Table targetTable = createTable(client, namespace, "pipeline_reference_target");

    LineageDetails unrelatedDetails =
        new LineageDetails().withPipeline(unrelatedPipeline.getEntityReference());
    Entity.getCollectionDAO()
        .relationshipDAO()
        .insert(
            sourceTable.getId(),
            targetTable.getId(),
            Entity.TABLE,
            Entity.TABLE,
            Relationship.CONTAINS.ordinal(),
            JsonUtils.pojoToJson(unrelatedDetails));

    EntityLineage unrelatedLineage =
        getLineage(client, Entity.PIPELINE, unrelatedPipeline.getId().toString(), "1", "1");
    assertTrue(unrelatedLineage.getUpstreamEdges().isEmpty());
    assertTrue(unrelatedLineage.getDownstreamEdges().isEmpty());

    Entity.getCollectionDAO()
        .relationshipDAO()
        .delete(
            sourceTable.getId(),
            Entity.TABLE,
            targetTable.getId(),
            Entity.TABLE,
            Relationship.CONTAINS.ordinal());

    LineageDetails lineageDetails =
        new LineageDetails()
            .withPipeline(lineagePipeline.getEntityReference())
            .withSource(LineageDetails.Source.PIPELINE_LINEAGE);
    executeAddLineage(
        client,
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(sourceTable.getEntityReference())
                    .withToEntity(targetTable.getEntityReference())
                    .withLineageDetails(lineageDetails)));

    EntityLineage pipelineLineage =
        getLineage(client, Entity.PIPELINE, lineagePipeline.getId().toString(), "1", "1");
    assertTrue(
        pipelineLineage.getUpstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(sourceTable.getId())
                        && edge.getToEntity().equals(lineagePipeline.getId())));
    assertTrue(
        pipelineLineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(lineagePipeline.getId())
                        && edge.getToEntity().equals(targetTable.getId())));

    client
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            LINEAGE_PATH
                + "/pipeline/"
                + lineagePipeline.getId()
                + "/type/"
                + LineageDetails.Source.PIPELINE_LINEAGE.value(),
            null);

    EntityLineage sourceLineage =
        getLineage(client, Entity.TABLE, sourceTable.getId().toString(), "0", "1");
    assertTrue(
        sourceLineage.getDownstreamEdges().stream()
            .noneMatch(
                edge ->
                    edge.getFromEntity().equals(sourceTable.getId())
                        && edge.getToEntity().equals(targetTable.getId())));

    cleanupPipeline(client, unrelatedPipeline);
    cleanupPipeline(client, lineagePipeline);
    cleanupTable(client, sourceTable);
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

    String result = executeAddLineage(client, addLineage);
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

    String result = executeAddLineage(client, addLineage);
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

  @Test
  void testLineageSceneFocusedDatabaseProjectsTableEdgesToSchemas() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    DatabaseService service = DatabaseServiceTestFactory.createSnowflake(namespace);
    Database database = createDatabase(client, namespace, service, "scene_db");
    DatabaseSchema rawSchema = createSchema(client, namespace, database, "raw_schema");
    DatabaseSchema martSchema = createSchema(client, namespace, database, "mart_schema");
    Table rawOrders =
        createTableInSchema(client, namespace, rawSchema, "raw_orders", columns("order_id"));
    Table factOrders =
        createTableInSchema(client, namespace, martSchema, "fact_orders", columns("order_id"));

    addLineage(client, rawOrders, factOrders);

    LineageScene scene =
        getLineageSceneWithRetry(
            client,
            database.getFullyQualifiedName(),
            Entity.DATABASE,
            LineageBand.ASSET,
            lineageScene ->
                lineageScene.getNodes().stream()
                        .anyMatch(
                            node ->
                                rawSchema
                                    .getFullyQualifiedName()
                                    .equals(node.getFullyQualifiedName()))
                    && lineageScene.getNodes().stream()
                        .anyMatch(
                            node ->
                                martSchema
                                    .getFullyQualifiedName()
                                    .equals(node.getFullyQualifiedName()))
                    && lineageScene.getEdges().size() == 1);

    Map<String, String> nodeIdsByFqn = nodeIdsByFqn(scene);
    assertEquals(LineageBand.ASSET, scene.getBand());
    assertTrue(
        scene.getNodes().stream().allMatch(node -> node.getLevelKind() == LineageLevelKind.SCHEMA));
    assertEquals(1, scene.getEdges().size());
    assertEquals(
        nodeIdsByFqn.get(rawSchema.getFullyQualifiedName()), scene.getEdges().get(0).getFrom());
    assertEquals(
        nodeIdsByFqn.get(martSchema.getFullyQualifiedName()), scene.getEdges().get(0).getTo());
    assertTrue(Boolean.TRUE.equals(scene.getEdges().get(0).getIsRollup()));

    deleteLineage(client, rawOrders.getEntityReference(), factOrders.getEntityReference());
    cleanupDatabaseService(client, service);
  }

  @Test
  void testLineageSceneFieldBandReturnsColumnLineageEndpoints() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    DatabaseService service = DatabaseServiceTestFactory.createSnowflake(namespace);
    Database database = createDatabase(client, namespace, service, "scene_field_db");
    DatabaseSchema schema = createSchema(client, namespace, database, "field_schema");
    Table sourceTable =
        createTableInSchema(
            client, namespace, schema, "scene_col_source", columns("order_id", "customer_id"));
    Table targetTable =
        createTableInSchema(
            client, namespace, schema, "scene_col_target", columns("order_id", "customer_id"));

    String sourceColumn = sourceTable.getColumns().get(0).getFullyQualifiedName();
    String targetColumn = targetTable.getColumns().get(0).getFullyQualifiedName();
    LineageDetails details = new LineageDetails();
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
    executeAddLineage(client, addLineage);

    LineageScene scene =
        getLineageSceneWithRetry(
            client,
            sourceTable.getFullyQualifiedName(),
            Entity.TABLE,
            LineageBand.FIELD,
            lineageScene ->
                lineageScene.getEdges().stream()
                    .anyMatch(
                        edge ->
                            edge.getFrom().contains(sourceColumn)
                                && edge.getTo().contains(targetColumn)));

    assertEquals(LineageBand.FIELD, scene.getBand());
    assertTrue(scene.getNodes().stream().allMatch(node -> !node.getFields().isEmpty()));
    assertTrue(
        scene.getEdges().stream()
            .anyMatch(
                edge ->
                    edge.getBand() == LineageBand.FIELD
                        && edge.getFrom().contains(sourceColumn)
                        && edge.getTo().contains(targetColumn)));

    deleteLineage(client, sourceTable.getEntityReference(), targetTable.getEntityReference());
    cleanupDatabaseService(client, service);
  }

  @Test
  void testLineageSceneLayerRootUsesExactCrossServiceCounts() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    DatabaseService sourceService = DatabaseServiceTestFactory.createSnowflake(namespace);
    Database sourceDatabase = createDatabase(client, namespace, sourceService, "root_source_db");
    DatabaseSchema sourceSchema =
        createSchema(client, namespace, sourceDatabase, "root_source_schema");
    Table sourceTable =
        createTableInSchema(client, namespace, sourceSchema, "root_source", columns("id"));

    DatabaseService targetService = DatabaseServiceTestFactory.createSnowflake(namespace);
    Database targetDatabase = createDatabase(client, namespace, targetService, "root_target_db");
    DatabaseSchema targetSchema =
        createSchema(client, namespace, targetDatabase, "root_target_schema");
    Table targetTable =
        createTableInSchema(client, namespace, targetSchema, "root_target", columns("id"));

    addLineage(client, sourceTable, targetTable);

    LineageScene scene =
        getRootLineageSceneWithRetry(
            client,
            LineageLens.SERVICE,
            LineageBand.LAYER,
            991,
            lineageScene ->
                hasSceneNode(lineageScene, sourceService.getFullyQualifiedName())
                    && hasSceneNode(lineageScene, targetService.getFullyQualifiedName())
                    && hasSceneEdge(
                        lineageScene,
                        sourceService.getFullyQualifiedName(),
                        targetService.getFullyQualifiedName()));

    assertEquals(
        1, sceneNodeCount(scene, sourceService.getFullyQualifiedName(), LineageLevelKind.TABLE));
    assertEquals(
        1, sceneNodeCount(scene, targetService.getFullyQualifiedName(), LineageLevelKind.TABLE));

    deleteLineage(client, sourceTable.getEntityReference(), targetTable.getEntityReference());
    cleanupDatabaseService(client, sourceService);
    cleanupDatabaseService(client, targetService);
  }

  @Test
  void testLineageSceneDomainAndDataProductLenses() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");
    Domain sourceDomain =
        client
            .domains()
            .create(
                new CreateDomain()
                    .withName(namespace.prefix("lineage_source_domain"))
                    .withDescription("Source domain for lineage scene integration testing")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE));
    Domain targetDomain =
        client
            .domains()
            .create(
                new CreateDomain()
                    .withName(namespace.prefix("lineage_target_domain"))
                    .withDescription("Target domain for lineage scene integration testing")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE));
    DataProduct sourceProduct =
        client
            .dataProducts()
            .create(
                new CreateDataProduct()
                    .withName(namespace.prefix("lineage_source_product"))
                    .withDescription("Source data product for lineage scene integration testing")
                    .withDomains(List.of(sourceDomain.getFullyQualifiedName())));
    DataProduct targetProduct =
        client
            .dataProducts()
            .create(
                new CreateDataProduct()
                    .withName(namespace.prefix("lineage_target_product"))
                    .withDescription("Target data product for lineage scene integration testing")
                    .withDomains(List.of(targetDomain.getFullyQualifiedName())));

    DatabaseService service = DatabaseServiceTestFactory.createSnowflake(namespace);
    Database database = createDatabase(client, namespace, service, "lens_db");
    DatabaseSchema schema = createSchema(client, namespace, database, "lens_schema");
    Table sourceTable =
        createTableInSchema(
            client,
            namespace,
            schema,
            "lens_source",
            columns("id"),
            List.of(sourceDomain.getFullyQualifiedName()));
    Table targetTable =
        createTableInSchema(
            client,
            namespace,
            schema,
            "lens_target",
            columns("id"),
            List.of(targetDomain.getFullyQualifiedName()));

    client
        .dataProducts()
        .bulkAddAssets(
            sourceProduct.getFullyQualifiedName(),
            new BulkAssets().withAssets(List.of(sourceTable.getEntityReference())));
    client
        .dataProducts()
        .bulkAddAssets(
            targetProduct.getFullyQualifiedName(),
            new BulkAssets().withAssets(List.of(targetTable.getEntityReference())));
    addLineage(client, sourceTable, targetTable);
    waitForNestedAggregationBuckets(
        client,
        "domains.fullyQualifiedName",
        List.of(sourceDomain.getFullyQualifiedName(), targetDomain.getFullyQualifiedName()));
    waitForNestedAggregationBuckets(
        client,
        "dataProducts.fullyQualifiedName",
        List.of(sourceProduct.getFullyQualifiedName(), targetProduct.getFullyQualifiedName()));

    LineageScene domainScene =
        getRootLineageSceneWithRetry(
            client,
            LineageLens.DOMAIN,
            LineageBand.LAYER,
            992,
            lineageScene ->
                hasSceneEdge(
                    lineageScene,
                    sourceDomain.getFullyQualifiedName(),
                    targetDomain.getFullyQualifiedName()));
    assertEquals(
        1,
        sceneNodeCount(domainScene, sourceDomain.getFullyQualifiedName(), LineageLevelKind.TABLE));
    assertEquals(
        1,
        sceneNodeCount(domainScene, targetDomain.getFullyQualifiedName(), LineageLevelKind.TABLE));

    LineageScene dataProductScene =
        getRootLineageSceneWithRetry(
            client,
            LineageLens.DATA_PRODUCT,
            LineageBand.LAYER,
            993,
            lineageScene ->
                hasSceneEdge(
                    lineageScene,
                    sourceProduct.getFullyQualifiedName(),
                    targetProduct.getFullyQualifiedName()));
    assertEquals(
        1,
        sceneNodeCount(
            dataProductScene, sourceProduct.getFullyQualifiedName(), LineageLevelKind.TABLE));
    assertEquals(
        1,
        sceneNodeCount(
            dataProductScene, targetProduct.getFullyQualifiedName(), LineageLevelKind.TABLE));

    deleteLineage(client, sourceTable.getEntityReference(), targetTable.getEntityReference());
    client.dataProducts().delete(sourceProduct.getId().toString());
    client.dataProducts().delete(targetProduct.getId().toString());
    cleanupDatabaseService(client, service);
    client.domains().delete(sourceDomain.getId().toString());
    client.domains().delete(targetDomain.getId().toString());
  }

  @Test
  void testLineageSceneIncludesStoredProceduresAndDashboardDataModels() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    DatabaseService databaseService = DatabaseServiceTestFactory.createSnowflake(namespace);
    Database database = createDatabase(client, namespace, databaseService, "procedure_db");
    DatabaseSchema schema = createSchema(client, namespace, database, "procedure_schema");
    StoredProcedure storedProcedure =
        client
            .storedProcedures()
            .create(
                new CreateStoredProcedure()
                    .withName(namespace.prefix("lineage_procedure"))
                    .withDatabaseSchema(schema.getFullyQualifiedName())
                    .withStoredProcedureCode(
                        new StoredProcedureCode()
                            .withCode("CREATE PROCEDURE lineage_procedure() SELECT 1")
                            .withLanguage(StoredProcedureLanguage.SQL)));

    DashboardService dashboardService = DashboardServiceTestFactory.createMetabase(namespace);
    DashboardDataModel dataModel =
        client
            .dashboardDataModels()
            .create(
                new CreateDashboardDataModel()
                    .withName(namespace.prefix("lineage_data_model"))
                    .withService(dashboardService.getFullyQualifiedName())
                    .withDataModelType(org.openmetadata.schema.type.DataModelType.MetabaseDataModel)
                    .withColumns(columns("id")));

    addLineage(client, storedProcedure.getEntityReference(), dataModel.getEntityReference());

    LineageScene focusedScene =
        getLineageSceneWithRetry(
            client,
            storedProcedure.getFullyQualifiedName(),
            Entity.STORED_PROCEDURE,
            LineageBand.ASSET,
            lineageScene ->
                lineageScene.getNodes().stream()
                        .anyMatch(node -> node.getLevelKind() == LineageLevelKind.STORED_PROCEDURE)
                    && lineageScene.getNodes().stream()
                        .anyMatch(
                            node -> node.getLevelKind() == LineageLevelKind.DASHBOARD_DATA_MODEL));
    assertTrue(
        hasSceneEdge(
            focusedScene,
            storedProcedure.getFullyQualifiedName(),
            dataModel.getFullyQualifiedName()));

    LineageScene rootScene =
        getRootLineageSceneWithRetry(
            client,
            LineageLens.SERVICE,
            LineageBand.LAYER,
            994,
            lineageScene ->
                sceneNodeCount(
                            lineageScene,
                            databaseService.getFullyQualifiedName(),
                            LineageLevelKind.STORED_PROCEDURE)
                        == 1
                    && sceneNodeCount(
                            lineageScene,
                            dashboardService.getFullyQualifiedName(),
                            LineageLevelKind.DASHBOARD_DATA_MODEL)
                        == 1);
    assertTrue(
        hasSceneEdge(
            rootScene,
            databaseService.getFullyQualifiedName(),
            dashboardService.getFullyQualifiedName()));

    deleteLineage(client, storedProcedure.getEntityReference(), dataModel.getEntityReference());
    cleanupDatabaseService(client, databaseService);
    cleanupDashboardService(client, dashboardService);
  }

  @Test
  void testLineageSceneSamplingKeepsHighIndexParticipants() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    DatabaseService service = DatabaseServiceTestFactory.createSnowflake(namespace);
    Database database = createDatabase(client, namespace, service, "sampling_db");
    DatabaseSchema schema = createSchema(client, namespace, database, "sampling_schema");
    List<Table> tables = new ArrayList<>();
    for (int index = 0; index < 55; index++) {
      tables.add(
          createTableInSchema(
              client,
              namespace,
              schema,
              String.format("sampling_asset_%03d", index),
              columns("id")));
    }
    Table sourceTable = tables.get(53);
    Table targetTable = tables.get(54);
    addLineage(client, sourceTable, targetTable);

    LineageScene scene =
        getLineageSceneWithRetry(
            client,
            schema.getFullyQualifiedName(),
            Entity.DATABASE_SCHEMA,
            LineageBand.ASSET,
            50,
            lineageScene ->
                Boolean.TRUE.equals(lineageScene.getSampled())
                    && hasSceneEdge(
                        lineageScene,
                        sourceTable.getFullyQualifiedName(),
                        targetTable.getFullyQualifiedName()));

    assertTrue(Boolean.TRUE.equals(scene.getSampled()));
    assertTrue(hasSceneNode(scene, sourceTable.getFullyQualifiedName()));
    assertTrue(hasSceneNode(scene, targetTable.getFullyQualifiedName()));

    deleteLineage(client, sourceTable.getEntityReference(), targetTable.getEntityReference());
    cleanupDatabaseService(client, service);
  }

  @Test
  void testLineageSceneDomainRestrictionBypassesSharedRootCache() throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");
    Domain allowedDomain =
        admin
            .domains()
            .create(
                new CreateDomain()
                    .withName(namespace.prefix("allowed_lineage_domain"))
                    .withDescription("Allowed domain for lineage scene integration testing")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE));
    Domain blockedDomain =
        admin
            .domains()
            .create(
                new CreateDomain()
                    .withName(namespace.prefix("blocked_lineage_domain"))
                    .withDescription("Blocked domain for lineage scene integration testing")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE));

    DatabaseService allowedService = DatabaseServiceTestFactory.createSnowflake(namespace);
    Database allowedDatabase =
        createDatabase(admin, namespace, allowedService, "allowed_lineage_db");
    DatabaseSchema allowedSchema =
        createSchema(admin, namespace, allowedDatabase, "allowed_lineage_schema");
    Table allowedSource =
        createTableInSchema(
            admin,
            namespace,
            allowedSchema,
            "allowed_source",
            columns("id"),
            List.of(allowedDomain.getFullyQualifiedName()));
    Table allowedTarget =
        createTableInSchema(
            admin,
            namespace,
            allowedSchema,
            "allowed_target",
            columns("id"),
            List.of(allowedDomain.getFullyQualifiedName()));
    createTableInSchema(
        admin,
        namespace,
        allowedSchema,
        "allowed_standalone",
        columns("id"),
        List.of(allowedDomain.getFullyQualifiedName()));
    createTableInSchema(admin, namespace, allowedSchema, "allowed_domainless", columns("id"));
    createTableInSchema(
        admin,
        namespace,
        allowedSchema,
        "blocked_in_allowed_service",
        columns("id"),
        List.of(blockedDomain.getFullyQualifiedName()));

    DatabaseService blockedService = DatabaseServiceTestFactory.createSnowflake(namespace);
    Database blockedDatabase =
        createDatabase(admin, namespace, blockedService, "blocked_lineage_db");
    DatabaseSchema blockedSchema =
        createSchema(admin, namespace, blockedDatabase, "blocked_lineage_schema");
    Table blockedSource =
        createTableInSchema(
            admin,
            namespace,
            blockedSchema,
            "blocked_source",
            columns("id"),
            List.of(blockedDomain.getFullyQualifiedName()));
    Table blockedTarget =
        createTableInSchema(
            admin,
            namespace,
            blockedSchema,
            "blocked_target",
            columns("id"),
            List.of(blockedDomain.getFullyQualifiedName()));

    addLineage(admin, allowedSource, allowedTarget);
    addLineage(admin, blockedSource, blockedTarget);

    getRootLineageSceneWithRetry(
        admin,
        LineageLens.SERVICE,
        LineageBand.LAYER,
        995,
        scene ->
            hasSceneNode(scene, allowedService.getFullyQualifiedName())
                && hasSceneNode(scene, blockedService.getFullyQualifiedName()));

    org.openmetadata.schema.entity.teams.Role domainOnlyRole =
        admin.roles().getByName("DomainOnlyAccessRole");
    String userName = "lineage-" + allowedDomain.getId();
    String email = userName + "@test.openmetadata.org";
    org.openmetadata.schema.entity.teams.User restrictedUser =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(userName)
                    .withEmail(email)
                    .withDomains(List.of(allowedDomain.getFullyQualifiedName()))
                    .withRoles(List.of(domainOnlyRole.getId())));
    OpenMetadataClient restrictedClient = SdkClients.createClient(email, email, new String[] {});

    LineageScene restrictedScene =
        getRootLineageSceneWithRetry(
            restrictedClient,
            LineageLens.SERVICE,
            LineageBand.LAYER,
            995,
            scene ->
                hasSceneNode(scene, allowedService.getFullyQualifiedName())
                    && sceneNodeCount(
                            scene, allowedService.getFullyQualifiedName(), LineageLevelKind.TABLE)
                        == 4);
    assertFalse(hasSceneNode(restrictedScene, blockedService.getFullyQualifiedName()));
    assertEquals(
        4,
        sceneNodeCount(
            restrictedScene, allowedService.getFullyQualifiedName(), LineageLevelKind.TABLE));

    LineageScene restrictedServiceScene =
        getLineageSceneWithRetry(
            restrictedClient,
            allowedService.getFullyQualifiedName(),
            Entity.DATABASE_SERVICE,
            LineageBand.ASSET,
            995,
            scene ->
                sceneNodeCount(
                        scene, allowedDatabase.getFullyQualifiedName(), LineageLevelKind.TABLE)
                    == 4);
    assertEquals(
        4,
        sceneNodeCount(
            restrictedServiceScene,
            allowedDatabase.getFullyQualifiedName(),
            LineageLevelKind.TABLE));

    LineageScene restrictedDatabaseScene =
        getLineageSceneWithRetry(
            restrictedClient,
            allowedDatabase.getFullyQualifiedName(),
            Entity.DATABASE,
            LineageBand.ASSET,
            995,
            scene ->
                sceneNodeCount(scene, allowedSchema.getFullyQualifiedName(), LineageLevelKind.TABLE)
                    == 4);
    assertEquals(
        4,
        sceneNodeCount(
            restrictedDatabaseScene,
            allowedSchema.getFullyQualifiedName(),
            LineageLevelKind.TABLE));
    assertThrows(
        ForbiddenException.class,
        () ->
            getLineageScene(
                restrictedClient,
                blockedSource.getFullyQualifiedName(),
                Entity.TABLE,
                LineageBand.ASSET,
                995));

    admin.users().delete(restrictedUser.getId().toString());
    deleteLineage(admin, allowedSource.getEntityReference(), allowedTarget.getEntityReference());
    deleteLineage(admin, blockedSource.getEntityReference(), blockedTarget.getEntityReference());
    cleanupDatabaseService(admin, allowedService);
    cleanupDatabaseService(admin, blockedService);
    admin.domains().delete(allowedDomain.getId().toString());
    admin.domains().delete(blockedDomain.getId().toString());
  }

  @Test
  void testRootLineageSceneFiltersAssetsDeniedByPolicy() throws Exception {
    OpenMetadataClient admin = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");
    Domain allowedDomain =
        admin
            .domains()
            .create(
                new CreateDomain()
                    .withName(namespace.prefix("allowed_policy_scene_domain"))
                    .withDescription("Allowed domain for lineage scene authorization testing")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE));
    Domain deniedDomain =
        admin
            .domains()
            .create(
                new CreateDomain()
                    .withName(namespace.prefix("denied_policy_scene_domain"))
                    .withDescription("Denied domain for lineage scene authorization testing")
                    .withDomainType(CreateDomain.DomainType.AGGREGATE));
    DatabaseService deniedService = DatabaseServiceTestFactory.createSnowflake(namespace);
    Database deniedDatabase = createDatabase(admin, namespace, deniedService, "denied_scene_db");
    DatabaseSchema deniedSchema =
        createSchema(admin, namespace, deniedDatabase, "denied_scene_schema");
    Table deniedTable =
        createTableInSchema(
            admin,
            namespace,
            deniedSchema,
            "denied_scene_table",
            columns("id"),
            List.of(deniedDomain.getFullyQualifiedName()));
    DatabaseService allowedService = DatabaseServiceTestFactory.createSnowflake(namespace);
    Database allowedDatabase = createDatabase(admin, namespace, allowedService, "allowed_scene_db");
    DatabaseSchema allowedSchema =
        createSchema(admin, namespace, allowedDatabase, "allowed_scene_schema");
    Table allowedTable =
        createTableInSchema(
            admin,
            namespace,
            allowedSchema,
            "allowed_scene_table",
            columns("id"),
            List.of(allowedDomain.getFullyQualifiedName()));
    addLineage(admin, deniedTable, allowedTable);

    getLineageSceneWithRetry(
        admin,
        deniedTable.getFullyQualifiedName(),
        Entity.TABLE,
        LineageBand.ASSET,
        scene ->
            hasSceneEdge(
                scene, deniedTable.getFullyQualifiedName(), allowedTable.getFullyQualifiedName()));
    getRootLineageSceneWithFreshCacheKeyRetry(
        admin,
        LineageLens.SERVICE,
        LineageBand.LAYER,
        scene ->
            hasSceneEdge(
                scene,
                deniedService.getFullyQualifiedName(),
                allowedService.getFullyQualifiedName()));
    LineageScene adminAssetScene =
        getRootLineageScene(admin, LineageLens.SERVICE, LineageBand.ASSET, 990);
    assertTrue(hasSceneNode(adminAssetScene, deniedService.getFullyQualifiedName()));
    assertTrue(hasSceneNode(adminAssetScene, allowedService.getFullyQualifiedName()));
    LineageScene adminLayerScene =
        getRootLineageScene(admin, LineageLens.SERVICE, LineageBand.LAYER, 990);
    assertTrue(
        hasSceneEdge(
            adminLayerScene,
            deniedService.getFullyQualifiedName(),
            allowedService.getFullyQualifiedName()));

    Rule denyForeignDomainView =
        new Rule()
            .withName(namespace.prefix("deny_table_view"))
            .withResources(List.of(Entity.TABLE))
            .withOperations(List.of(MetadataOperation.VIEW_BASIC))
            .withEffect(Rule.Effect.DENY)
            .withCondition("!hasDomain()");
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName(namespace.prefix("deny_table_scene_policy"))
                    .withRules(List.of(denyForeignDomainView)));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName(namespace.prefix("deny_table_scene_role"))
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    String userName = "lineage-policy-" + allowedDomain.getId();
    String email = userName + "@test.openmetadata.org";
    User user =
        admin
            .users()
            .create(
                new CreateUser()
                    .withName(userName)
                    .withEmail(email)
                    .withDomains(List.of(allowedDomain.getFullyQualifiedName()))
                    .withRoles(List.of(role.getId())));

    try {
      OpenMetadataClient restrictedClient = SdkClients.createClient(email, email, new String[] {});
      LineageScene scene =
          getRootLineageScene(restrictedClient, LineageLens.SERVICE, LineageBand.ASSET, 990);

      assertFalse(hasSceneNode(scene, deniedService.getFullyQualifiedName()));
      assertFalse(hasSceneNode(scene, deniedTable.getFullyQualifiedName()));
      assertTrue(scene.getSampled());

      LineageScene focusedScene =
          getLineageScene(
              restrictedClient,
              allowedTable.getFullyQualifiedName(),
              Entity.TABLE,
              LineageBand.ASSET,
              990);
      assertTrue(hasSceneNode(focusedScene, allowedTable.getFullyQualifiedName()));
      assertFalse(hasSceneNode(focusedScene, deniedTable.getFullyQualifiedName()));
      assertFalse(
          hasSceneEdge(
              focusedScene,
              deniedTable.getFullyQualifiedName(),
              allowedTable.getFullyQualifiedName()));
      assertTrue(focusedScene.getSampled());

      LineageScene layerScene =
          getRootLineageScene(restrictedClient, LineageLens.SERVICE, LineageBand.LAYER, 990);
      assertFalse(hasSceneNode(layerScene, deniedService.getFullyQualifiedName()));
      assertTrue(hasSceneNode(layerScene, allowedService.getFullyQualifiedName()));
      assertFalse(
          hasSceneEdge(
              layerScene,
              deniedService.getFullyQualifiedName(),
              allowedService.getFullyQualifiedName()));
      assertEquals(
          1,
          sceneNodeCount(
              layerScene, allowedService.getFullyQualifiedName(), LineageLevelKind.TABLE));
      assertTrue(layerScene.getSampled());
    } finally {
      admin.users().delete(user.getId().toString());
      admin.roles().delete(role.getId().toString());
      admin.policies().delete(policy.getId().toString());
      deleteLineage(admin, deniedTable.getEntityReference(), allowedTable.getEntityReference());
      cleanupDatabaseService(admin, deniedService);
      cleanupDatabaseService(admin, allowedService);
      admin.domains().delete(allowedDomain.getId().toString());
      admin.domains().delete(deniedDomain.getId().toString());
    }
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

  private String executeAddLineage(OpenMetadataClient client, AddLineage lineage) {
    String[] holder = {null};
    Awaitility.await("Add lineage edge")
        .atMost(Duration.ofSeconds(30))
        .pollDelay(Duration.ofMillis(100))
        .pollInterval(Duration.ofSeconds(1))
        .ignoreExceptions()
        .until(
            () -> {
              holder[0] = client.lineage().addLineage(lineage);
              return true;
            });
    return holder[0];
  }

  private void addLineage(OpenMetadataClient client, EntityReference from, EntityReference to) {
    AddLineage addLineage =
        new AddLineage().withEdge(new EntitiesEdge().withFromEntity(from).withToEntity(to));
    executeAddLineage(client, addLineage);
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

  private JsonNode getLineageEdgeByName(OpenMetadataClient client, Table from, Table to)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                LINEAGE_PATH + "/getLineageEdge" + lineageEdgeByNamePath(from, to),
                null);
    return OBJECT_MAPPER.readTree(response);
  }

  private void deleteLineageByName(OpenMetadataClient client, Table from, Table to) {
    client
        .getHttpClient()
        .executeForString(HttpMethod.DELETE, LINEAGE_PATH + lineageEdgeByNamePath(from, to), null);
  }

  private String lineageEdgeByNamePath(Table from, Table to) {
    return "/table/name/"
        + encodePathSegment(from.getFullyQualifiedName())
        + "/table/name/"
        + encodePathSegment(to.getFullyQualifiedName());
  }

  private RequestOptions jsonPatchRequestOptions() {
    return RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();
  }

  private String encodePathSegment(String segment) {
    return URLEncoder.encode(segment, StandardCharsets.UTF_8).replace("+", "%20");
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

  private LineageScene getLineageSceneWithRetry(
      OpenMetadataClient client,
      String focusFqn,
      String entityType,
      LineageBand band,
      Predicate<LineageScene> predicate) {
    return getLineageSceneWithRetry(client, focusFqn, entityType, band, 200, predicate);
  }

  private LineageScene getLineageSceneWithRetry(
      OpenMetadataClient client,
      String focusFqn,
      String entityType,
      LineageBand band,
      int size,
      Predicate<LineageScene> predicate) {
    LineageScene[] holder = {null};
    Awaitility.await("Lineage scene for " + focusFqn)
        .atMost(Duration.ofSeconds(60))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              LineageScene scene = getLineageScene(client, focusFqn, entityType, band, size);
              if (predicate.test(scene)) {
                holder[0] = scene;
                return true;
              }
              return false;
            });
    return holder[0];
  }

  private LineageScene getLineageScene(
      OpenMetadataClient client, String focusFqn, String entityType, LineageBand band, int size)
      throws IOException {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("focusFqn", focusFqn)
            .queryParam("entityType", entityType)
            .queryParam("lens", LineageLens.SERVICE.value())
            .queryParam("band", band.value())
            .queryParam("upstreamDepth", "1")
            .queryParam("downstreamDepth", "1")
            .queryParam("size", String.valueOf(size))
            .queryParam("includeDeleted", "false")
            .build();

    String response =
        client.getHttpClient().executeForString(HttpMethod.GET, "/v1/lineage/scene", null, options);
    return OBJECT_MAPPER.readValue(response, LineageScene.class);
  }

  private LineageScene getRootLineageSceneWithRetry(
      OpenMetadataClient client,
      LineageLens lens,
      LineageBand band,
      int size,
      Predicate<LineageScene> predicate) {
    LineageScene[] holder = {null};
    Awaitility.await("Root lineage scene for " + lens.value())
        .atMost(Duration.ofSeconds(60))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              LineageScene scene = getRootLineageScene(client, lens, band, size);
              if (predicate.test(scene)) {
                holder[0] = scene;
                return true;
              }
              return false;
            });
    return holder[0];
  }

  private LineageScene getRootLineageSceneWithFreshCacheKeyRetry(
      OpenMetadataClient client,
      LineageLens lens,
      LineageBand band,
      Predicate<LineageScene> predicate) {
    LineageScene[] holder = {null};
    int[] size = {900};
    Awaitility.await("Uncached root lineage scene for " + lens.value())
        .atMost(Duration.ofSeconds(60))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              LineageScene scene = getRootLineageScene(client, lens, band, size[0]++);
              if (predicate.test(scene)) {
                holder[0] = scene;
                return true;
              }
              return false;
            });
    return holder[0];
  }

  private LineageScene getRootLineageScene(
      OpenMetadataClient client, LineageLens lens, LineageBand band, int size) throws IOException {
    RequestOptions options =
        RequestOptions.builder()
            .queryParam("lens", lens.value())
            .queryParam("band", band.value())
            .queryParam("upstreamDepth", "1")
            .queryParam("downstreamDepth", "1")
            .queryParam("size", String.valueOf(size))
            .queryParam("includeDeleted", "false")
            .build();
    String response =
        client.getHttpClient().executeForString(HttpMethod.GET, "/v1/lineage/scene", null, options);
    return OBJECT_MAPPER.readValue(response, LineageScene.class);
  }

  private void waitForNestedAggregationBuckets(
      OpenMetadataClient client, String fieldName, List<String> expectedBuckets) {
    Awaitility.await("Search aggregation buckets for " + fieldName)
        .atMost(Duration.ofSeconds(60))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .untilAsserted(
            () -> {
              String query =
                  """
                  {
                    "size": 0,
                    "query": {
                      "term": {
                        "deleted": false
                      }
                    },
                    "aggregations": {
                      "roots": {
                        "terms": {
                          "field": "%s",
                          "size": 10000
                        },
                        "aggregations": {
                          "types": {
                            "terms": {
                              "field": "entityType",
                              "size": 30
                            }
                          }
                        }
                      }
                    }
                  }
                  """
                      .formatted(fieldName);
              RequestOptions options =
                  RequestOptions.builder()
                      .queryParam(
                          "index", Entity.getSearchRepository().getIndexOrAliasName("dataAsset"))
                      .build();
              String response =
                  client
                      .getHttpClient()
                      .executeForString(
                          HttpMethod.POST, "/v1/test-support/search/search", query, options);
              JsonNode buckets =
                  OBJECT_MAPPER
                      .readTree(response)
                      .path("aggregations")
                      .path("roots")
                      .path("buckets");
              assertTrue(
                  expectedBuckets.stream()
                      .allMatch(expected -> hasAggregationBucket(buckets, expected)),
                  response);
            });
  }

  private boolean hasAggregationBucket(JsonNode buckets, String expected) {
    for (JsonNode bucket : buckets) {
      if (expected.equalsIgnoreCase(bucket.path("key").asText())) {
        return true;
      }
    }
    return false;
  }

  private Map<String, String> nodeIdsByFqn(LineageScene scene) {
    Map<String, String> nodeIdsByFqn = new LinkedHashMap<>();
    scene.getNodes().forEach(node -> nodeIdsByFqn.put(node.getFullyQualifiedName(), node.getId()));
    return nodeIdsByFqn;
  }

  private boolean hasSceneNode(LineageScene scene, String fullyQualifiedName) {
    return scene.getNodes().stream()
        .anyMatch(node -> fullyQualifiedName.equals(node.getFullyQualifiedName()));
  }

  private boolean hasSceneEdge(LineageScene scene, String fromFqn, String toFqn) {
    Map<String, String> nodeIds = nodeIdsByFqn(scene);
    String fromId = nodeIds.get(fromFqn);
    String toId = nodeIds.get(toFqn);
    return fromId != null
        && toId != null
        && scene.getEdges().stream()
            .anyMatch(edge -> fromId.equals(edge.getFrom()) && toId.equals(edge.getTo()));
  }

  private int sceneNodeCount(
      LineageScene scene, String fullyQualifiedName, LineageLevelKind levelKind) {
    return scene.getNodes().stream()
        .filter(node -> fullyQualifiedName.equals(node.getFullyQualifiedName()))
        .findFirst()
        .map(node -> node.getCounts().getOrDefault(levelKind.value(), 0))
        .orElse(0);
  }

  private Database createDatabase(
      OpenMetadataClient client,
      TestNamespace namespace,
      DatabaseService service,
      String databaseName)
      throws Exception {
    return client
        .databases()
        .create(
            new CreateDatabase()
                .withName(namespace.prefix(databaseName))
                .withService(service.getFullyQualifiedName()));
  }

  private DatabaseSchema createSchema(
      OpenMetadataClient client, TestNamespace namespace, Database database, String schemaName)
      throws Exception {
    return client
        .databaseSchemas()
        .create(
            new CreateDatabaseSchema()
                .withName(namespace.prefix(schemaName))
                .withDatabase(database.getFullyQualifiedName()));
  }

  private Table createTableInSchema(
      OpenMetadataClient client,
      TestNamespace namespace,
      DatabaseSchema schema,
      String tableName,
      List<Column> columns)
      throws Exception {
    return createTableInSchema(client, namespace, schema, tableName, columns, List.of());
  }

  private Table createTableInSchema(
      OpenMetadataClient client,
      TestNamespace namespace,
      DatabaseSchema schema,
      String tableName,
      List<Column> columns,
      List<String> domains)
      throws Exception {
    CreateTable createTable = new CreateTable();
    createTable.setName(namespace.prefix(tableName));
    createTable.setDatabaseSchema(schema.getFullyQualifiedName());
    createTable.setColumns(columns);
    createTable.setDomains(domains);
    return client.tables().create(createTable);
  }

  private List<Column> columns(String... names) {
    List<Column> columns = new ArrayList<>();
    for (String name : names) {
      columns.add(ColumnBuilder.of(name, "VARCHAR").dataLength(100).build());
    }
    return columns;
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

  private void cleanupDatabaseService(OpenMetadataClient client, DatabaseService service) {
    try {
      client
          .databaseServices()
          .delete(service.getId().toString(), Map.of("recursive", "true", "hardDelete", "true"));
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }

  private void cleanupDashboardService(OpenMetadataClient client, DashboardService service) {
    try {
      client
          .dashboardServices()
          .delete(service.getId().toString(), Map.of("recursive", "true", "hardDelete", "true"));
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

    String result = executeAddLineage(client, addLineage);
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

    String result = executeAddLineage(client, addLineage);
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
  void testAddLineageByFQNPath() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table sourceTable = createTable(client, namespace, "fqn_path_source");
    Table targetTable = createTable(client, namespace, "fqn_path_target");
    Pipeline pipeline = createPipeline(client, namespace, "fqn_path_pipeline");

    LineageDetails details =
        new LineageDetails()
            .withDescription("FQN path lineage")
            .withPipeline(pipeline.getEntityReference());

    String result =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                LINEAGE_PATH + lineageEdgeByNamePath(sourceTable, targetTable),
                details);
    assertNotNull(result);

    EntityLineage lineage = getLineage(client, "table", sourceTable.getId().toString(), "0", "1");
    assertTrue(
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                edge ->
                    edge.getFromEntity().equals(sourceTable.getId())
                        && edge.getToEntity().equals(targetTable.getId())));

    JsonNode edge = getLineageEdgeByName(client, sourceTable, targetTable).get("edge");
    assertEquals(pipeline.getId().toString(), edge.get("pipeline").get("id").asText());

    deleteLineageByName(client, sourceTable, targetTable);
    cleanupPipeline(client, pipeline);
    cleanupTable(client, sourceTable);
    cleanupTable(client, targetTable);
  }

  @Test
  void testPatchAndDeleteLineageEdgeByFQN() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table sourceTable = createTable(client, namespace, "fqn_patch_source");
    Table targetTable = createTable(client, namespace, "fqn_patch_target");

    addLineage(client, sourceTable, targetTable);

    JsonNode patch =
        OBJECT_MAPPER.readTree(
            """
            [{"op":"add","path":"/description","value":"Updated by FQN route"}]
            """);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.PATCH,
            LINEAGE_PATH + lineageEdgeByNamePath(sourceTable, targetTable),
            patch,
            jsonPatchRequestOptions());

    JsonNode edge = getLineageEdgeByName(client, sourceTable, targetTable).get("edge");
    assertEquals("Updated by FQN route", edge.get("description").asText());

    deleteLineageByName(client, sourceTable, targetTable);

    EntityLineage lineage = getLineage(client, "table", sourceTable.getId().toString(), "0", "1");
    assertTrue(
        lineage.getDownstreamEdges().stream()
            .noneMatch(
                downstreamEdge ->
                    downstreamEdge.getFromEntity().equals(sourceTable.getId())
                        && downstreamEdge.getToEntity().equals(targetTable.getId())));

    cleanupTable(client, sourceTable);
    cleanupTable(client, targetTable);
  }

  @Test
  void testDeleteLineageBySourceByFQN() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table sourceTable = createTable(client, namespace, "fqn_source_delete_source");
    Table targetTable = createTable(client, namespace, "fqn_source_delete_target");

    LineageDetails details =
        new LineageDetails()
            .withDescription("Query lineage by FQN")
            .withSource(LineageDetails.Source.QUERY_LINEAGE);
    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(sourceTable.getEntityReference())
                    .withToEntity(targetTable.getEntityReference())
                    .withLineageDetails(details));

    executeAddLineage(client, addLineage);
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.DELETE,
            LINEAGE_PATH
                + "/source/name/table/"
                + encodePathSegment(targetTable.getFullyQualifiedName())
                + "/type/"
                + encodePathSegment(LineageDetails.Source.QUERY_LINEAGE.value()),
            null);

    EntityLineage lineage = getLineage(client, "table", sourceTable.getId().toString(), "0", "1");
    assertTrue(
        lineage.getDownstreamEdges().stream()
            .noneMatch(
                downstreamEdge ->
                    downstreamEdge.getFromEntity().equals(sourceTable.getId())
                        && downstreamEdge.getToEntity().equals(targetTable.getId())));

    cleanupTable(client, sourceTable);
    cleanupTable(client, targetTable);
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

    String result = executeAddLineage(client, addLineage);
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

    String result = executeAddLineage(client, addLineage);
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

    String result = executeAddLineage(client, addLineage);
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

    String result = executeAddLineage(client, addLineage);
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

    String result = executeAddLineage(client, addLineage);
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

    String result = executeAddLineage(client, addLineage);
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

    try {
      addLineage(client, t0, t3);
      addLineage(client, t1, t4);
      addLineage(client, t2, t4);
      addLineage(client, t3, t4);
      addLineage(client, t4, t5);
    } catch (Exception e) {
      // Skip test if search index is not available (transient infrastructure issue)
      if (e.getMessage() != null && e.getMessage().contains("index_not_found")) {
        Assumptions.assumeTrue(false, "Search index not available, skipping test");
      }
      throw e;
    }

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

    executeAddLineage(client, addLineage1);

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

    String result = executeAddLineage(client, addLineage2);
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

  @Test
  void testExportLineageBasicChain() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table t1 = createTable(client, namespace, "export_chain_t1");
    Table t2 = createTable(client, namespace, "export_chain_t2");
    Table t3 = createTable(client, namespace, "export_chain_t3");
    Table t4 = createTable(client, namespace, "export_chain_t4");

    addLineage(client, t1, t2);
    addLineage(client, t2, t3);
    addLineage(client, t3, t4);

    String csvContent =
        exportLineageWithRetry(client, t2.getFullyQualifiedName(), "table", "2", "2", 3);
    List<CSVRecord> rows = parseCsvRows(csvContent);

    assertEdgeInCsv(rows, t1.getFullyQualifiedName(), t2.getFullyQualifiedName());
    assertEdgeInCsv(rows, t2.getFullyQualifiedName(), t3.getFullyQualifiedName());
    assertEdgeInCsv(rows, t3.getFullyQualifiedName(), t4.getFullyQualifiedName());

    deleteLineage(client, t1.getEntityReference(), t2.getEntityReference());
    deleteLineage(client, t2.getEntityReference(), t3.getEntityReference());
    deleteLineage(client, t3.getEntityReference(), t4.getEntityReference());

    cleanupTable(client, t1);
    cleanupTable(client, t2);
    cleanupTable(client, t3);
    cleanupTable(client, t4);
  }

  @Test
  void testExportLineageWithColumnLineage() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table sourceTable = createTableWithMultipleColumns(client, namespace, "export_col_src");
    Table targetTable = createTableWithMultipleColumns(client, namespace, "export_col_tgt");

    String srcCol1 = sourceTable.getColumns().get(0).getFullyQualifiedName();
    String srcCol2 = sourceTable.getColumns().get(1).getFullyQualifiedName();
    String tgtCol1 = targetTable.getColumns().get(0).getFullyQualifiedName();
    String tgtCol2 = targetTable.getColumns().get(1).getFullyQualifiedName();

    LineageDetails details = new LineageDetails();
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(srcCol1)).withToColumn(tgtCol1));
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(srcCol2)).withToColumn(tgtCol2));

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(sourceTable.getEntityReference())
                    .withToEntity(targetTable.getEntityReference())
                    .withLineageDetails(details));
    executeAddLineage(client, addLineage);

    String csvContent =
        exportLineageWithRetry(client, sourceTable.getFullyQualifiedName(), "table", "0", "1", 1);
    List<CSVRecord> rows = parseCsvRows(csvContent);

    assertEdgeInCsv(rows, sourceTable.getFullyQualifiedName(), targetTable.getFullyQualifiedName());

    boolean columnLineagePresent =
        rows.stream()
            .filter(
                r ->
                    sourceTable.getFullyQualifiedName().equals(r.get("fromFullyQualifiedName*"))
                        && targetTable
                            .getFullyQualifiedName()
                            .equals(r.get("toFullyQualifiedName*")))
            .anyMatch(r -> r.get("columnLineage") != null && !r.get("columnLineage").isEmpty());
    assertTrue(columnLineagePresent);

    deleteLineage(client, sourceTable.getEntityReference(), targetTable.getEntityReference());
    cleanupTable(client, sourceTable);
    cleanupTable(client, targetTable);
  }

  @Test
  void testExportLineageVaryingDepths() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table t1 = createTable(client, namespace, "export_depth_t1");
    Table t2 = createTable(client, namespace, "export_depth_t2");
    Table t3 = createTable(client, namespace, "export_depth_t3");
    Table t4 = createTable(client, namespace, "export_depth_t4");
    Table t5 = createTable(client, namespace, "export_depth_t5");

    addLineage(client, t1, t2);
    addLineage(client, t2, t3);
    addLineage(client, t3, t4);
    addLineage(client, t4, t5);

    // Depth 1,1: direct neighbors of t3 are present
    String csvDepth1 =
        exportLineageWithRetry(client, t3.getFullyQualifiedName(), "table", "1", "1", 2);
    List<CSVRecord> rowsDepth1 = parseCsvRows(csvDepth1);
    assertEdgeInCsv(rowsDepth1, t2.getFullyQualifiedName(), t3.getFullyQualifiedName());
    assertEdgeInCsv(rowsDepth1, t3.getFullyQualifiedName(), t4.getFullyQualifiedName());

    // Depth 2,2: extended chain edges t1→t2 and t4→t5 are also present
    String csvDepth2 =
        exportLineageWithRetry(client, t3.getFullyQualifiedName(), "table", "2", "2", 4);
    List<CSVRecord> rowsDepth2 = parseCsvRows(csvDepth2);
    assertEdgeInCsv(rowsDepth2, t1.getFullyQualifiedName(), t2.getFullyQualifiedName());
    assertEdgeInCsv(rowsDepth2, t4.getFullyQualifiedName(), t5.getFullyQualifiedName());
    assertTrue(rowsDepth2.size() > rowsDepth1.size());

    deleteLineage(client, t1.getEntityReference(), t2.getEntityReference());
    deleteLineage(client, t2.getEntityReference(), t3.getEntityReference());
    deleteLineage(client, t3.getEntityReference(), t4.getEntityReference());
    deleteLineage(client, t4.getEntityReference(), t5.getEntityReference());

    cleanupTable(client, t1);
    cleanupTable(client, t2);
    cleanupTable(client, t3);
    cleanupTable(client, t4);
    cleanupTable(client, t5);
  }

  private String exportLineageWithRetry(
      OpenMetadataClient client,
      String fqn,
      String type,
      String upstreamDepth,
      String downstreamDepth,
      int expectedMinRows) {
    String[] holder = {null};
    Awaitility.await("Export lineage CSV with at least " + expectedMinRows + " rows")
        .atMost(Duration.ofSeconds(60))
        .pollDelay(Duration.ofMillis(500))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              String csv =
                  client.lineage().exportLineage(fqn, type, upstreamDepth, downstreamDepth);
              try (CSVParser parser =
                  CSVFormat.DEFAULT.withFirstRecordAsHeader().parse(new StringReader(csv))) {
                List<CSVRecord> rows = parser.getRecords();
                if (rows.size() >= expectedMinRows) {
                  holder[0] = csv;
                  return true;
                }
              }
              return false;
            });
    return holder[0];
  }

  private List<CSVRecord> parseCsvRows(String csvContent) throws IOException {
    try (CSVParser parser =
        CSVFormat.DEFAULT.withFirstRecordAsHeader().parse(new StringReader(csvContent))) {
      return parser.getRecords();
    }
  }

  private void assertEdgeInCsv(List<CSVRecord> rows, String fromFqn, String toFqn) {
    boolean found =
        rows.stream()
            .anyMatch(
                r ->
                    fromFqn.equals(r.get("fromFullyQualifiedName*"))
                        && toFqn.equals(r.get("toFullyQualifiedName*")));
    assertTrue(found, String.format("Expected edge %s -> %s not found in CSV", fromFqn, toFqn));
  }

  private void assertEdgeInAsyncCsv(List<CSVRecord> rows, String fromFqn, String toFqn) {
    boolean found =
        rows.stream()
            .anyMatch(
                r -> fromFqn.equals(r.get("fromEntityFQN")) && toFqn.equals(r.get("toEntityFQN")));
    assertTrue(
        found, String.format("Expected edge %s -> %s not found in async CSV", fromFqn, toFqn));
  }

  @Test
  void testExportLineageAsyncBasicChain() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table t1 = createTable(client, namespace, "async_export_t1");
    Table t2 = createTable(client, namespace, "async_export_t2");
    Table t3 = createTable(client, namespace, "async_export_t3");

    addLineage(client, t1, t2);
    addLineage(client, t2, t3);

    RequestOptions.Builder options = RequestOptions.builder();
    options.queryParam("fqn", t2.getFullyQualifiedName());
    options.queryParam("type", "table");
    options.queryParam("upstreamDepth", "2");
    options.queryParam("downstreamDepth", "2");

    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/lineage/exportAsync", null, options.build());
    JsonNode result = OBJECT_MAPPER.readTree(response);
    assertNotNull(result.get("jobId"));
    assertFalse(result.get("jobId").asText().isEmpty());

    deleteLineage(client, t1.getEntityReference(), t2.getEntityReference());
    deleteLineage(client, t2.getEntityReference(), t3.getEntityReference());

    cleanupTable(client, t1);
    cleanupTable(client, t2);
    cleanupTable(client, t3);
  }

  @Test
  void testExportLineageByEntityCountAsyncBasicChain() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table t1 = createTable(client, namespace, "ec_async_export_t1");
    Table t2 = createTable(client, namespace, "ec_async_export_t2");
    Table t3 = createTable(client, namespace, "ec_async_export_t3");

    addLineage(client, t1, t2);
    addLineage(client, t2, t3);

    RequestOptions.Builder options = RequestOptions.builder();
    options.queryParam("fqn", t2.getFullyQualifiedName());
    options.queryParam("direction", "DOWNSTREAM");
    options.queryParam("nodeDepth", "1");
    options.queryParam("maxDepth", "2");
    options.queryParam("type", "table");

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/lineage/exportByEntityCountAsync", null, options.build());
    JsonNode result = OBJECT_MAPPER.readTree(response);
    assertNotNull(result.get("jobId"));
    assertFalse(result.get("jobId").asText().isEmpty());

    deleteLineage(client, t1.getEntityReference(), t2.getEntityReference());
    deleteLineage(client, t2.getEntityReference(), t3.getEntityReference());

    cleanupTable(client, t1);
    cleanupTable(client, t2);
    cleanupTable(client, t3);
  }

  @Test
  void testExportLineageAsyncWithColumnLineage() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table sourceTable = createTableWithMultipleColumns(client, namespace, "async_col_src");
    Table targetTable = createTableWithMultipleColumns(client, namespace, "async_col_tgt");

    String srcCol1 = sourceTable.getColumns().get(0).getFullyQualifiedName();
    String tgtCol1 = targetTable.getColumns().get(0).getFullyQualifiedName();

    LineageDetails details = new LineageDetails();
    details
        .getColumnsLineage()
        .add(new ColumnLineage().withFromColumns(List.of(srcCol1)).withToColumn(tgtCol1));

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(sourceTable.getEntityReference())
                    .withToEntity(targetTable.getEntityReference())
                    .withLineageDetails(details));
    executeAddLineage(client, addLineage);

    RequestOptions.Builder options = RequestOptions.builder();
    options.queryParam("fqn", sourceTable.getFullyQualifiedName());
    options.queryParam("type", "table");
    options.queryParam("upstreamDepth", "0");
    options.queryParam("downstreamDepth", "1");

    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/lineage/exportAsync", null, options.build());
    JsonNode result = OBJECT_MAPPER.readTree(response);
    assertNotNull(result.get("jobId"));
    assertFalse(result.get("jobId").asText().isEmpty());

    deleteLineage(client, sourceTable.getEntityReference(), targetTable.getEntityReference());
    cleanupTable(client, sourceTable);
    cleanupTable(client, targetTable);
  }

  // ====================================================================================
  // Temporal-field preservation tests (§1 — createdAt/createdBy on re-emission)
  // ====================================================================================

  @Test
  void createdAt_preservedOnReEmission() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table source = createTable(client, namespace, "temporal_src_reemit");
    Table target = createTable(client, namespace, "temporal_tgt_reemit");

    long beforeFirstPut = System.currentTimeMillis();

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(source.getEntityReference())
                    .withToEntity(target.getEntityReference()));
    executeAddLineage(client, addLineage);

    LineageDetails firstDetails = fetchEdgeLineageDetails(client, source, target).orElseThrow();
    Long firstCreatedAt = firstDetails.getCreatedAt();
    String firstCreatedBy = firstDetails.getCreatedBy();
    assertNotNull(firstCreatedAt, "createdAt must be set on first emit");
    assertTrue(
        firstCreatedAt >= beforeFirstPut,
        "createdAt should be >= the moment before first PUT, got " + firstCreatedAt);
    assertEquals("admin", firstCreatedBy, "createdBy should be the requesting user");

    Long lastUpdatedAt = firstDetails.getUpdatedAt();
    for (int i = 0; i < 4; i++) {
      executeAddLineage(client, addLineage);
      LineageDetails reemitted = fetchEdgeLineageDetails(client, source, target).orElseThrow();
      assertEquals(
          firstCreatedAt,
          reemitted.getCreatedAt(),
          "createdAt must be preserved across re-emissions (iteration " + i + ")");
      assertEquals(
          firstCreatedBy,
          reemitted.getCreatedBy(),
          "createdBy must be preserved across re-emissions (iteration " + i + ")");
      assertNotNull(reemitted.getUpdatedAt(), "updatedAt must be present");
      assertTrue(
          reemitted.getUpdatedAt() >= lastUpdatedAt,
          "updatedAt must advance (or stay equal) on re-emission");
      lastUpdatedAt = reemitted.getUpdatedAt();
      assertEquals("admin", reemitted.getUpdatedBy(), "updatedBy must reflect the latest user");
    }

    deleteLineage(client, source.getEntityReference(), target.getEntityReference());
    cleanupTable(client, source);
    cleanupTable(client, target);
  }

  @Test
  void firstAddSetsCreatedAtToNow() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table source = createTable(client, namespace, "temporal_first_src");
    Table target = createTable(client, namespace, "temporal_first_tgt");

    long before = System.currentTimeMillis();
    addLineage(client, source, target);
    long after = System.currentTimeMillis();

    LineageDetails details = fetchEdgeLineageDetails(client, source, target).orElseThrow();
    assertNotNull(details.getCreatedAt());
    assertNotNull(details.getUpdatedAt());
    assertNotNull(details.getCreatedBy());
    assertNotNull(details.getUpdatedBy());
    assertEquals(
        details.getCreatedAt(),
        details.getUpdatedAt(),
        "On first add, createdAt should equal updatedAt");
    assertEquals(
        details.getCreatedBy(),
        details.getUpdatedBy(),
        "On first add, createdBy should equal updatedBy");
    assertEquals("admin", details.getCreatedBy());
    assertTrue(
        details.getCreatedAt() >= before && details.getCreatedAt() <= after + 1000,
        "createdAt should be within the test window, got " + details.getCreatedAt());

    deleteLineage(client, source.getEntityReference(), target.getEntityReference());
    cleanupTable(client, source);
    cleanupTable(client, target);
  }

  @Test
  void callerSuppliedTimestamps_areRespectedOnFirstAdd() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table source = createTable(client, namespace, "temporal_supplied_src");
    Table target = createTable(client, namespace, "temporal_supplied_tgt");

    long suppliedTs = 1705314000000L;
    LineageDetails seedDetails =
        new LineageDetails()
            .withCreatedAt(suppliedTs)
            .withUpdatedAt(suppliedTs)
            .withCreatedBy("ingestion-bot")
            .withUpdatedBy("ingestion-bot");
    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(source.getEntityReference())
                    .withToEntity(target.getEntityReference())
                    .withLineageDetails(seedDetails));
    executeAddLineage(client, addLineage);

    LineageDetails details = fetchEdgeLineageDetails(client, source, target).orElseThrow();
    assertEquals(
        suppliedTs, details.getCreatedAt(), "Caller-supplied createdAt should be respected");
    assertEquals(
        "ingestion-bot", details.getCreatedBy(), "Caller-supplied createdBy should be respected");

    deleteLineage(client, source.getEntityReference(), target.getEntityReference());
    cleanupTable(client, source);
    cleanupTable(client, target);
  }

  @Test
  void outOfOrderTimestamps_applyMinMax() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table source = createTable(client, namespace, "temporal_minmax_src");
    Table target = createTable(client, namespace, "temporal_minmax_tgt");

    long march = 1709251200000L;
    long january = 1704067200000L;
    long february = 1706745600000L;

    putLineageWithTimestamps(client, source, target, march, march);
    LineageDetails afterMarch = fetchEdgeLineageDetails(client, source, target).orElseThrow();
    assertEquals(march, afterMarch.getCreatedAt());
    assertEquals(march, afterMarch.getUpdatedAt());

    putLineageWithTimestamps(client, source, target, january, january);
    LineageDetails afterJanuary = fetchEdgeLineageDetails(client, source, target).orElseThrow();
    assertEquals(
        january,
        afterJanuary.getCreatedAt(),
        "createdAt should be minimized to the earlier timestamp");
    assertEquals(
        march,
        afterJanuary.getUpdatedAt(),
        "updatedAt should be maximized — late-arriving older event does not roll it back");

    putLineageWithTimestamps(client, source, target, february, february);
    LineageDetails afterFebruary = fetchEdgeLineageDetails(client, source, target).orElseThrow();
    assertEquals(
        january, afterFebruary.getCreatedAt(), "createdAt unchanged when middle event arrives");
    assertEquals(
        march, afterFebruary.getUpdatedAt(), "updatedAt unchanged when middle event arrives");

    deleteLineage(client, source.getEntityReference(), target.getEntityReference());
    cleanupTable(client, source);
    cleanupTable(client, target);
  }

  // ====================================================================================
  // Time-window filter tests (§4 — searchLineage startTime/endTime)
  // ====================================================================================

  @Test
  void timeWindowFilter_excludesEdgesOutsideRange() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table source = createTable(client, namespace, "window_excl_src");
    Table earlyTarget = createTable(client, namespace, "window_excl_early");
    Table midTarget = createTable(client, namespace, "window_excl_mid");
    Table lateTarget = createTable(client, namespace, "window_excl_late");

    long tEarly = 1704067200000L;
    long tMid = 1706745600000L;
    long tLate = 1709251200000L;

    putLineageWithTimestamps(client, source, earlyTarget, tEarly, tEarly);
    putLineageWithTimestamps(client, source, midTarget, tMid, tMid);
    putLineageWithTimestamps(client, source, lateTarget, tLate, tLate);

    waitForEdgeInSearchLineage(client, source, midTarget);

    long windowStart = tEarly + 1_000_000L;
    long windowEnd = tLate - 1_000_000L;

    JsonNode filtered =
        searchLineageWithWindow(
            client, source.getFullyQualifiedName(), 0, 1, windowStart, windowEnd);
    JsonNode nodes = filtered.get("nodes");
    assertNotNull(nodes);
    assertTrue(
        nodes.has(midTarget.getFullyQualifiedName()), "Mid-window edge target should be present");
    assertFalse(
        nodes.has(earlyTarget.getFullyQualifiedName()), "Early edge target should be filtered out");
    assertFalse(
        nodes.has(lateTarget.getFullyQualifiedName()), "Late edge target should be filtered out");

    deleteLineage(client, source.getEntityReference(), earlyTarget.getEntityReference());
    deleteLineage(client, source.getEntityReference(), midTarget.getEntityReference());
    deleteLineage(client, source.getEntityReference(), lateTarget.getEntityReference());
    cleanupTable(client, source);
    cleanupTable(client, earlyTarget);
    cleanupTable(client, midTarget);
    cleanupTable(client, lateTarget);
  }

  @Test
  void timeWindowFilter_includesOverlappingEdges() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table source = createTable(client, namespace, "window_overlap_src");
    Table target = createTable(client, namespace, "window_overlap_tgt");

    long t1 = 1704067200000L;
    long t8 = 1722470400000L;

    putLineageWithTimestamps(client, source, target, t1, t8);
    waitForEdgeInSearchLineage(client, source, target);

    long windowStart = 1715000000000L;
    long windowEnd = 1730000000000L;

    JsonNode filtered =
        searchLineageWithWindow(
            client, source.getFullyQualifiedName(), 0, 1, windowStart, windowEnd);
    JsonNode nodes = filtered.get("nodes");
    assertNotNull(nodes);
    assertTrue(
        nodes.has(target.getFullyQualifiedName()),
        "Edge with createdAt outside but updatedAt inside should be included via overlap");

    deleteLineage(client, source.getEntityReference(), target.getEntityReference());
    cleanupTable(client, source);
    cleanupTable(client, target);
  }

  @Test
  void timeWindowFilter_excludesTimestampedManualSourceEdgesOutsideRange() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table source = createTable(client, namespace, "window_manual_src");
    Table target = createTable(client, namespace, "window_manual_tgt");

    long outsideWindow = 1577836800000L;
    LineageDetails manualDetails =
        new LineageDetails()
            .withSource(LineageDetails.Source.MANUAL)
            .withCreatedAt(outsideWindow)
            .withUpdatedAt(outsideWindow);
    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(source.getEntityReference())
                    .withToEntity(target.getEntityReference())
                    .withLineageDetails(manualDetails));
    executeAddLineage(client, addLineage);

    waitForEdgeInSearchLineage(client, source, target);

    long windowStart = 1704067200000L;
    long windowEnd = 1709251200000L;
    JsonNode filtered =
        searchLineageWithWindow(
            client, source.getFullyQualifiedName(), 0, 1, windowStart, windowEnd);
    JsonNode nodes = filtered.get("nodes");
    assertNotNull(nodes);
    assertFalse(
        nodes.has(target.getFullyQualifiedName()),
        "Timestamped manual-source edge should be filtered by the time window");

    deleteLineage(client, source.getEntityReference(), target.getEntityReference());
    cleanupTable(client, source);
    cleanupTable(client, target);
  }

  @Test
  void timeWindowFilter_emptyParamsReturnsAllEdges() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table source = createTable(client, namespace, "window_all_src");
    Table target = createTable(client, namespace, "window_all_tgt");

    long ancient = 946684800000L;
    putLineageWithTimestamps(client, source, target, ancient, ancient);
    waitForEdgeInSearchLineage(client, source, target);

    JsonNode unfiltered =
        searchLineageWithWindow(client, source.getFullyQualifiedName(), 0, 1, null, null);
    JsonNode nodes = unfiltered.get("nodes");
    assertNotNull(nodes);
    assertTrue(
        nodes.has(target.getFullyQualifiedName()),
        "Unfiltered query should return edges regardless of timestamps");

    deleteLineage(client, source.getEntityReference(), target.getEntityReference());
    cleanupTable(client, source);
    cleanupTable(client, target);
  }

  // ====================================================================================
  // Audit / change-event emission tests (§8)
  // ====================================================================================

  @Test
  void addLineage_emitsEntityLineageAddedAuditEvent() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table source = createTable(client, namespace, "audit_added_src");
    Table target = createTable(client, namespace, "audit_added_tgt");

    long startTs = System.currentTimeMillis() - 1000;
    addLineage(client, source, target);

    String expectedFqn =
        source.getFullyQualifiedName() + "--upstream-->" + target.getFullyQualifiedName();
    JsonNode entry =
        awaitAuditLogEntry(client, "entityLineageAdded", expectedFqn, startTs)
            .orElseThrow(
                () ->
                    new AssertionError(
                        "Expected entityLineageAdded audit log entry for " + expectedFqn));

    assertEquals("lineage", entry.path("entityType").asText());
    assertEquals(expectedFqn, entry.path("entityFQN").asText());
    JsonNode changeEvent = entry.path("changeEvent");
    assertTrue(
        changeEvent.isObject() && !changeEvent.isEmpty(), "changeEvent payload should be present");
    JsonNode edge = changeEvent.path("entity");
    assertEquals(
        source.getId().toString(),
        edge.path("fromEntity").path("id").asText(),
        "Event payload should carry the from-entity reference");
    assertEquals(
        target.getId().toString(),
        edge.path("toEntity").path("id").asText(),
        "Event payload should carry the to-entity reference");
    assertTrue(
        edge.has("lineageDetails") || edge.path("lineageDetails").isNull(),
        "Event payload should include a lineageDetails slot");

    deleteLineage(client, source.getEntityReference(), target.getEntityReference());
    cleanupTable(client, source);
    cleanupTable(client, target);
  }

  @Test
  void deleteLineage_emitsEntityLineageDeletedAuditEvent() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table source = createTable(client, namespace, "audit_deleted_src");
    Table target = createTable(client, namespace, "audit_deleted_tgt");

    addLineage(client, source, target);
    LineageDetails preDelete = fetchEdgeLineageDetails(client, source, target).orElseThrow();
    Long originalCreatedAt = preDelete.getCreatedAt();
    String originalCreatedBy = preDelete.getCreatedBy();

    long startTs = System.currentTimeMillis() - 1000;
    deleteLineage(client, source.getEntityReference(), target.getEntityReference());

    String expectedFqn =
        source.getFullyQualifiedName() + "--upstream-->" + target.getFullyQualifiedName();
    JsonNode entry =
        awaitAuditLogEntry(client, "entityLineageDeleted", expectedFqn, startTs)
            .orElseThrow(
                () ->
                    new AssertionError(
                        "Expected entityLineageDeleted audit log entry for " + expectedFqn));

    assertEquals("lineage", entry.path("entityType").asText());
    JsonNode lineageDetails = entry.path("changeEvent").path("entity").path("lineageDetails");
    assertTrue(
        lineageDetails.isObject(), "lineageDetails on delete should include pre-deletion snapshot");
    assertEquals(
        originalCreatedAt.longValue(),
        lineageDetails.path("createdAt").asLong(),
        "Delete event should retain the original createdAt");
    assertEquals(
        originalCreatedBy,
        lineageDetails.path("createdBy").asText(),
        "Delete event should retain the original createdBy");

    cleanupTable(client, source);
    cleanupTable(client, target);
  }

  @Test
  void buildExtendedLineage_doesNotEmitDerivedAuditEvents() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table source = createTable(client, namespace, "audit_extended_src");
    Table target = createTable(client, namespace, "audit_extended_tgt");

    long startTs = System.currentTimeMillis() - 1000;
    addLineage(client, source, target);

    String expectedFqn =
        source.getFullyQualifiedName() + "--upstream-->" + target.getFullyQualifiedName();
    awaitAuditLogEntry(client, "entityLineageAdded", expectedFqn, startTs).orElseThrow();

    List<JsonNode> events = listAuditLogs(client, "entityLineageAdded", startTs);
    long forThisEdge =
        events.stream().filter(e -> expectedFqn.equals(e.path("entityFQN").asText())).count();
    assertEquals(
        1,
        forThisEdge,
        "buildExtendedLineage cascades should NOT produce additional entityLineageAdded "
            + "events for derived service/domain/dataProduct edges");

    deleteLineage(client, source.getEntityReference(), target.getEntityReference());
    cleanupTable(client, source);
    cleanupTable(client, target);
  }

  @Test
  void reEmission_doesNotEmitDuplicateEvents() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table source = createTable(client, namespace, "audit_reemit_src");
    Table target = createTable(client, namespace, "audit_reemit_tgt");

    long startTs = System.currentTimeMillis() - 1000;
    addLineage(client, source, target);
    addLineage(client, source, target);
    addLineage(client, source, target);

    String expectedFqn =
        source.getFullyQualifiedName() + "--upstream-->" + target.getFullyQualifiedName();
    awaitAuditLogEntry(client, "entityLineageAdded", expectedFqn, startTs).orElseThrow();

    List<JsonNode> addedEvents = listAuditLogs(client, "entityLineageAdded", startTs);
    long addedCount =
        addedEvents.stream().filter(e -> expectedFqn.equals(e.path("entityFQN").asText())).count();
    assertEquals(
        1,
        addedCount,
        "Idempotent re-emissions should NOT produce additional entityLineageAdded events");

    List<JsonNode> updatedEvents = listAuditLogs(client, "entityLineageUpdated", startTs);
    long updatedCount =
        updatedEvents.stream()
            .filter(e -> expectedFqn.equals(e.path("entityFQN").asText()))
            .count();
    assertEquals(
        0,
        updatedCount,
        "Idempotent re-emissions with unchanged payload should NOT emit entityLineageUpdated");

    deleteLineage(client, source.getEntityReference(), target.getEntityReference());
    cleanupTable(client, source);
    cleanupTable(client, target);
  }

  @Test
  void contentChange_emitsEntityLineageUpdatedEvent() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table source = createTable(client, namespace, "audit_content_src");
    Table target = createTable(client, namespace, "audit_content_tgt");

    long startTs = System.currentTimeMillis() - 1000;
    putLineageWithSqlQuery(client, source, target, "SELECT a FROM t");
    putLineageWithSqlQuery(client, source, target, "SELECT b FROM t");

    String expectedFqn =
        source.getFullyQualifiedName() + "--upstream-->" + target.getFullyQualifiedName();
    awaitAuditLogEntry(client, "entityLineageAdded", expectedFqn, startTs).orElseThrow();
    JsonNode updatedEntry =
        awaitAuditLogEntry(client, "entityLineageUpdated", expectedFqn, startTs).orElseThrow();

    List<JsonNode> addedEvents = listAuditLogs(client, "entityLineageAdded", startTs);
    long addedCount =
        addedEvents.stream().filter(e -> expectedFqn.equals(e.path("entityFQN").asText())).count();
    assertEquals(
        1, addedCount, "Exactly one entityLineageAdded event should be emitted for first add");

    List<JsonNode> updatedEvents = listAuditLogs(client, "entityLineageUpdated", startTs);
    long updatedCount =
        updatedEvents.stream()
            .filter(e -> expectedFqn.equals(e.path("entityFQN").asText()))
            .count();
    assertEquals(
        1,
        updatedCount,
        "Exactly one entityLineageUpdated event should be emitted on content change");

    JsonNode updatedSql =
        updatedEntry.path("changeEvent").path("entity").path("lineageDetails").path("sqlQuery");
    assertEquals(
        "SELECT b FROM t",
        updatedSql.asText(),
        "Updated event payload should carry the new sqlQuery");

    deleteLineage(client, source.getEntityReference(), target.getEntityReference());
    cleanupTable(client, source);
    cleanupTable(client, target);
  }

  @Test
  void onlyTimestampChange_doesNotEmitUpdatedEvent() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table source = createTable(client, namespace, "audit_ts_only_src");
    Table target = createTable(client, namespace, "audit_ts_only_tgt");

    long startTs = System.currentTimeMillis() - 1000;
    putLineageWithSqlQuery(client, source, target, "SELECT x FROM y");
    putLineageWithSqlQuery(client, source, target, "SELECT x FROM y");

    String expectedFqn =
        source.getFullyQualifiedName() + "--upstream-->" + target.getFullyQualifiedName();
    awaitAuditLogEntry(client, "entityLineageAdded", expectedFqn, startTs).orElseThrow();

    List<JsonNode> updatedEvents = listAuditLogs(client, "entityLineageUpdated", startTs);
    long updatedCount =
        updatedEvents.stream()
            .filter(e -> expectedFqn.equals(e.path("entityFQN").asText()))
            .count();
    assertEquals(
        0,
        updatedCount,
        "Re-PUT with identical content (only timestamp bumps) should NOT emit "
            + "entityLineageUpdated");

    deleteLineage(client, source.getEntityReference(), target.getEntityReference());
    cleanupTable(client, source);
    cleanupTable(client, target);
  }

  private void putLineageWithSqlQuery(
      OpenMetadataClient client, Table from, Table to, String sqlQuery) {
    LineageDetails details = new LineageDetails().withSqlQuery(sqlQuery);
    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(from.getEntityReference())
                    .withToEntity(to.getEntityReference())
                    .withLineageDetails(details));
    executeAddLineage(client, addLineage);
  }

  // ====================================================================================
  // Helpers for temporal/window/audit tests
  // ====================================================================================

  private void putLineageWithTimestamps(
      OpenMetadataClient client, Table from, Table to, long createdAt, long updatedAt) {
    LineageDetails details = new LineageDetails().withCreatedAt(createdAt).withUpdatedAt(updatedAt);
    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(from.getEntityReference())
                    .withToEntity(to.getEntityReference())
                    .withLineageDetails(details));
    executeAddLineage(client, addLineage);
  }

  private Optional<LineageDetails> fetchEdgeLineageDetails(
      OpenMetadataClient client, Table from, Table to) throws Exception {
    EntityLineage lineage = getLineage(client, "table", from.getId().toString(), "0", "1");
    return lineage.getDownstreamEdges().stream()
        .filter(
            e ->
                e.getFromEntity().equals(from.getId())
                    && e.getToEntity().equals(to.getId())
                    && e.getLineageDetails() != null)
        .map(Edge::getLineageDetails)
        .findFirst();
  }

  private JsonNode searchLineageWithWindow(
      OpenMetadataClient client,
      String fqn,
      int upstreamDepth,
      int downstreamDepth,
      Long startTime,
      Long endTime)
      throws Exception {
    RequestOptions.Builder options =
        RequestOptions.builder()
            .queryParam("fqn", fqn)
            .queryParam("type", "table")
            .queryParam("upstreamDepth", String.valueOf(upstreamDepth))
            .queryParam("downstreamDepth", String.valueOf(downstreamDepth))
            .queryParam("includeDeleted", "false");
    if (startTime != null) {
      options.queryParam("startTime", String.valueOf(startTime));
    }
    if (endTime != null) {
      options.queryParam("endTime", String.valueOf(endTime));
    }
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/lineage/getLineage", null, options.build());
    return OBJECT_MAPPER.readTree(response);
  }

  private void waitForEdgeInSearchLineage(OpenMetadataClient client, Table from, Table to) {
    Awaitility.await("ES index has edge " + from.getName() + " → " + to.getName())
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              JsonNode result =
                  searchLineageWithWindow(client, from.getFullyQualifiedName(), 0, 3, null, null);
              JsonNode nodes = result.get("nodes");
              return nodes != null && nodes.has(to.getFullyQualifiedName());
            });
  }

  private Optional<JsonNode> awaitAuditLogEntry(
      OpenMetadataClient client, String eventType, String entityFqn, long startTs) {
    JsonNode[] holder = new JsonNode[1];
    Awaitility.await("Audit log entry " + eventType + " for " + entityFqn)
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofSeconds(2))
        .ignoreExceptions()
        .until(
            () -> {
              List<JsonNode> entries = listAuditLogs(client, eventType, startTs);
              for (JsonNode entry : entries) {
                if (entityFqn.equals(entry.path("entityFQN").asText())) {
                  holder[0] = entry;
                  return true;
                }
              }
              return false;
            });
    return Optional.ofNullable(holder[0]);
  }

  private List<JsonNode> listAuditLogs(OpenMetadataClient client, String eventType, long startTs)
      throws Exception {
    Map<String, String> params = new HashMap<>();
    params.put("eventType", eventType);
    params.put("entityType", "lineage");
    params.put("startTs", String.valueOf(startTs));
    params.put("limit", "200");
    RequestOptions.Builder options = RequestOptions.builder();
    for (Map.Entry<String, String> entry : params.entrySet()) {
      options.queryParam(entry.getKey(), entry.getValue());
    }
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/audit/logs", null, options.build());
    JsonNode root = OBJECT_MAPPER.readTree(response);
    JsonNode data = root.path("data");
    List<JsonNode> out = new ArrayList<>();
    if (data.isArray()) {
      data.forEach(out::add);
    }
    return out;
  }

  // ====================================================================================
  // Special-character FQN tests — quoted identifiers (dots, spaces)
  // ====================================================================================

  @Test
  void testSpecialCharFQNLineageRoundtrip() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace namespace = new TestNamespace("LineageResourceIT");

    Table dotTable = createTableWithSpecialName(client, namespace, "special.dot.table");
    Table spaceTable = createTableWithSpecialName(client, namespace, "space name table");
    Table targetTable = createTable(client, namespace, "special_char_normal_target");

    // OM quotes only segments containing dots (the FQN separator).
    // Spaces are stored as literal characters in the FQN with no double-quote wrapping.
    assertTrue(
        dotTable.getFullyQualifiedName().contains("\""),
        "Dot-name table FQN should be quoted by OM: " + dotTable.getFullyQualifiedName());
    assertFalse(
        spaceTable.getFullyQualifiedName().contains("\""),
        "Space-name table FQN should NOT be quoted (spaces are literal): "
            + spaceTable.getFullyQualifiedName());

    try {
      assertFQNLineageRoundtrip(client, dotTable, targetTable);
      assertFQNLineageRoundtrip(client, spaceTable, targetTable);
    } finally {
      cleanupTable(client, dotTable);
      cleanupTable(client, spaceTable);
      cleanupTable(client, targetTable);
    }
  }

  private void assertFQNLineageRoundtrip(OpenMetadataClient client, Table from, Table to)
      throws Exception {
    String path = lineageEdgeByNamePath(from, to);

    String putResult =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                LINEAGE_PATH + path,
                new LineageDetails().withDescription("special char FQN roundtrip"));
    assertNotNull(putResult, "PUT by FQN returned null for: " + from.getFullyQualifiedName());

    EntityLineage lineage = getLineage(client, "table", from.getId().toString(), "0", "1");
    assertTrue(
        lineage.getDownstreamEdges().stream()
            .anyMatch(
                e -> e.getFromEntity().equals(from.getId()) && e.getToEntity().equals(to.getId())),
        "Edge not in graph after PUT by FQN: " + from.getFullyQualifiedName());

    JsonNode edgeResponse = getLineageEdgeByName(client, from, to);
    assertNotNull(
        edgeResponse.get("edge"),
        "GET by FQN returned no edge field for: " + from.getFullyQualifiedName());

    client.getHttpClient().executeForString(HttpMethod.DELETE, LINEAGE_PATH + path, null);

    EntityLineage lineageAfter = getLineage(client, "table", from.getId().toString(), "0", "1");
    assertTrue(
        lineageAfter.getDownstreamEdges().stream()
            .noneMatch(
                e -> e.getFromEntity().equals(from.getId()) && e.getToEntity().equals(to.getId())),
        "Edge still in graph after DELETE by FQN: " + from.getFullyQualifiedName());
  }

  private Table createTableWithSpecialName(
      OpenMetadataClient client, TestNamespace namespace, String specialName) throws Exception {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(namespace);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(namespace, service);

    CreateTable createTable = new CreateTable();
    createTable.setName(namespace.prefix(specialName));
    createTable.setDatabaseSchema(schema.getFullyQualifiedName());
    createTable.setColumns(
        List.of(ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build()));
    return client.tables().create(createTable);
  }
}
