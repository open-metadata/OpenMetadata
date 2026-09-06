package org.openmetadata.service.migration.utils.v1120;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Answers.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.io.IOException;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.classification.AutoClassificationConfig;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.classification.LoadTags;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.migration.QueryStatus;
import org.openmetadata.service.migration.utils.LongStatementsUtil;
import org.openmetadata.service.util.FullyQualifiedName;

class MigrationUtilTest {

  @Test
  void fixDatabaseHierarchyFqnsRepairsDatabaseSchemaTableAndStoredProcedure() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    CollectionDAO.DatabaseServiceDAO databaseServiceDAO =
        mock(CollectionDAO.DatabaseServiceDAO.class);
    CollectionDAO.DatabaseDAO databaseDAO = mock(CollectionDAO.DatabaseDAO.class);
    CollectionDAO.DatabaseSchemaDAO schemaDAO = mock(CollectionDAO.DatabaseSchemaDAO.class);
    CollectionDAO.TableDAO tableDAO = mock(CollectionDAO.TableDAO.class);
    CollectionDAO.StoredProcedureDAO storedProcedureDAO =
        mock(CollectionDAO.StoredProcedureDAO.class);

    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(collectionDAO.dbServiceDAO()).thenReturn(databaseServiceDAO);
    when(collectionDAO.databaseDAO()).thenReturn(databaseDAO);
    when(collectionDAO.databaseSchemaDAO()).thenReturn(schemaDAO);
    when(collectionDAO.tableDAO()).thenReturn(tableDAO);
    when(collectionDAO.storedProcedureDAO()).thenReturn(storedProcedureDAO);

    UUID serviceId = UUID.randomUUID();
    UUID databaseId = UUID.randomUUID();
    UUID schemaId = UUID.randomUUID();
    UUID tableId = UUID.randomUUID();
    UUID storedProcedureId = UUID.randomUUID();

    stubServiceRows(handle, "dbservice_entity", serviceId);
    when(relationshipDAO.findTo(
            serviceId, Entity.DATABASE_SERVICE, Relationship.CONTAINS.ordinal(), Entity.DATABASE))
        .thenReturn(List.of(relationship(databaseId, Entity.DATABASE)));
    when(relationshipDAO.findTo(
            databaseId, Entity.DATABASE, Relationship.CONTAINS.ordinal(), Entity.DATABASE_SCHEMA))
        .thenReturn(List.of(relationship(schemaId, Entity.DATABASE_SCHEMA)));
    when(relationshipDAO.findTo(
            schemaId, Entity.DATABASE_SCHEMA, Relationship.CONTAINS.ordinal(), Entity.TABLE))
        .thenReturn(List.of(relationship(tableId, Entity.TABLE)));
    when(relationshipDAO.findTo(
            schemaId,
            Entity.DATABASE_SCHEMA,
            Relationship.CONTAINS.ordinal(),
            Entity.STORED_PROCEDURE))
        .thenReturn(List.of(relationship(storedProcedureId, Entity.STORED_PROCEDURE)));

    String serviceFqn = "\"db.service\"";
    DatabaseService databaseService =
        new DatabaseService()
            .withId(serviceId)
            .withName("db.service")
            .withFullyQualifiedName(serviceFqn);
    Database database =
        new Database()
            .withId(databaseId)
            .withName("warehouse")
            .withFullyQualifiedName("db.service.warehouse");
    DatabaseSchema schema =
        new DatabaseSchema()
            .withId(schemaId)
            .withName("analytics")
            .withDatabase(database.getEntityReference())
            .withFullyQualifiedName("db.service.warehouse.analytics");
    Table table =
        new Table()
            .withId(tableId)
            .withName("fact_orders")
            .withDatabaseSchema(schema.getEntityReference())
            .withFullyQualifiedName("db.service.warehouse.analytics.fact_orders")
            .withColumns(List.of(new Column().withName("order_total")));
    StoredProcedure storedProcedure =
        new StoredProcedure()
            .withId(storedProcedureId)
            .withName("refresh_orders")
            .withDatabaseSchema(schema.getEntityReference())
            .withFullyQualifiedName("db.service.warehouse.analytics.refresh_orders");

    when(databaseServiceDAO.findEntityById(serviceId)).thenReturn(databaseService);
    when(databaseDAO.findEntityById(databaseId)).thenReturn(database);
    when(schemaDAO.findEntityById(schemaId)).thenReturn(schema);
    when(tableDAO.findEntityById(tableId)).thenReturn(table);
    when(storedProcedureDAO.findEntityById(storedProcedureId)).thenReturn(storedProcedure);

    MigrationUtil.fixDatabaseFqnHash(handle, collectionDAO);
    MigrationUtil.fixDatabaseSchemaFqnHash(handle, collectionDAO);
    MigrationUtil.fixTableFqnHash(handle, collectionDAO);
    MigrationUtil.fixStoredProcedureFqnHash(handle, collectionDAO);

    String databaseFqn = FullyQualifiedName.add(serviceFqn, database.getName());
    String schemaFqn = FullyQualifiedName.add(databaseFqn, schema.getName());
    String tableFqn = FullyQualifiedName.add(schemaFqn, table.getName());
    String storedProcedureFqn = FullyQualifiedName.add(schemaFqn, storedProcedure.getName());

    assertEquals(databaseFqn, database.getFullyQualifiedName());
    assertEquals(schemaFqn, schema.getFullyQualifiedName());
    assertEquals(tableFqn, table.getFullyQualifiedName());
    assertEquals(tableFqn + ".order_total", table.getColumns().get(0).getFullyQualifiedName());
    assertEquals(storedProcedureFqn, storedProcedure.getFullyQualifiedName());
  }

  @Test
  void fixServiceChildFqnsRepairsDashboardDataModelsApiCollectionsAndEndpoints() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    CollectionDAO.DashboardServiceDAO dashboardServiceDAO =
        mock(CollectionDAO.DashboardServiceDAO.class);
    CollectionDAO.DataModelDAO dataModelDAO = mock(CollectionDAO.DataModelDAO.class);
    CollectionDAO.ApiServiceDAO apiServiceDAO = mock(CollectionDAO.ApiServiceDAO.class);
    CollectionDAO.APICollectionDAO apiCollectionDAO = mock(CollectionDAO.APICollectionDAO.class);
    CollectionDAO.APIEndpointDAO apiEndpointDAO = mock(CollectionDAO.APIEndpointDAO.class);

    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(collectionDAO.dashboardServiceDAO()).thenReturn(dashboardServiceDAO);
    when(collectionDAO.dashboardDataModelDAO()).thenReturn(dataModelDAO);
    when(collectionDAO.apiServiceDAO()).thenReturn(apiServiceDAO);
    when(collectionDAO.apiCollectionDAO()).thenReturn(apiCollectionDAO);
    when(collectionDAO.apiEndpointDAO()).thenReturn(apiEndpointDAO);

    UUID dashboardServiceId = UUID.randomUUID();
    UUID dataModelId = UUID.randomUUID();
    UUID apiServiceId = UUID.randomUUID();
    UUID apiCollectionId = UUID.randomUUID();
    UUID apiEndpointId = UUID.randomUUID();

    stubServiceRows(handle, "dashboard_service_entity", dashboardServiceId);
    stubServiceRows(handle, "api_service_entity", apiServiceId);
    when(relationshipDAO.findTo(
            dashboardServiceId,
            Entity.DASHBOARD_SERVICE,
            Relationship.CONTAINS.ordinal(),
            Entity.DASHBOARD_DATA_MODEL))
        .thenReturn(List.of(relationship(dataModelId, Entity.DASHBOARD_DATA_MODEL)));
    when(relationshipDAO.findTo(
            apiServiceId,
            Entity.API_SERVICE,
            Relationship.CONTAINS.ordinal(),
            Entity.API_COLLECTION))
        .thenReturn(List.of(relationship(apiCollectionId, Entity.API_COLLECTION)));
    when(relationshipDAO.findTo(
            apiCollectionId,
            Entity.API_COLLECTION,
            Relationship.CONTAINS.ordinal(),
            Entity.API_ENDPOINT))
        .thenReturn(List.of(relationship(apiEndpointId, Entity.API_ENDPOINT)));

    String dashboardServiceFqn = "\"dash.service\"";
    DashboardService dashboardService =
        new DashboardService()
            .withId(dashboardServiceId)
            .withName("dash.service")
            .withFullyQualifiedName(dashboardServiceFqn);
    DashboardDataModel dataModel =
        new DashboardDataModel()
            .withId(dataModelId)
            .withName("orders")
            .withFullyQualifiedName("dash.service.model.orders")
            .withColumns(List.of(new Column().withName("metric")));

    String apiServiceFqn = "\"api.service\"";
    ApiService apiService =
        new ApiService()
            .withId(apiServiceId)
            .withName("api.service")
            .withFullyQualifiedName(apiServiceFqn);
    APICollection apiCollection =
        new APICollection()
            .withId(apiCollectionId)
            .withName("payments")
            .withFullyQualifiedName("api.service.payments");
    APIEndpoint apiEndpoint =
        new APIEndpoint()
            .withId(apiEndpointId)
            .withName("charge")
            .withApiCollection(apiCollection.getEntityReference())
            .withFullyQualifiedName("api.service.payments.charge");

    when(dashboardServiceDAO.findEntityById(dashboardServiceId)).thenReturn(dashboardService);
    when(dataModelDAO.findEntityById(dataModelId)).thenReturn(dataModel);
    when(apiServiceDAO.findEntityById(apiServiceId)).thenReturn(apiService);
    when(apiCollectionDAO.findEntityById(apiCollectionId)).thenReturn(apiCollection);
    when(apiEndpointDAO.findEntityById(apiEndpointId)).thenReturn(apiEndpoint);

    MigrationUtil.fixDashboardDataModelFqnHash(handle, collectionDAO);
    MigrationUtil.fixApiCollectionFqnHash(handle, collectionDAO);
    MigrationUtil.fixApiEndpointFqnHash(handle, collectionDAO);

    String dataModelFqn =
        FullyQualifiedName.add(dashboardServiceFqn + ".model", dataModel.getName());
    String apiCollectionFqn = FullyQualifiedName.add(apiServiceFqn, apiCollection.getName());
    String apiEndpointFqn = FullyQualifiedName.add(apiCollectionFqn, apiEndpoint.getName());

    assertEquals(dataModelFqn, dataModel.getFullyQualifiedName());
    assertEquals(dataModelFqn + ".metric", dataModel.getColumns().get(0).getFullyQualifiedName());
    assertEquals(apiCollectionFqn, apiCollection.getFullyQualifiedName());
    assertEquals(apiEndpointFqn, apiEndpoint.getFullyQualifiedName());
  }

  @Test
  void fixServiceChildFqnsRepairsDashboardChartPipelineTopicAndMlModel() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    CollectionDAO.DashboardServiceDAO dashboardServiceDAO =
        mock(CollectionDAO.DashboardServiceDAO.class);
    CollectionDAO.DashboardDAO dashboardDAO = mock(CollectionDAO.DashboardDAO.class);
    CollectionDAO.ChartDAO chartDAO = mock(CollectionDAO.ChartDAO.class);
    CollectionDAO.PipelineServiceDAO pipelineServiceDAO =
        mock(CollectionDAO.PipelineServiceDAO.class);
    CollectionDAO.PipelineDAO pipelineDAO = mock(CollectionDAO.PipelineDAO.class);
    CollectionDAO.MessagingServiceDAO messagingServiceDAO =
        mock(CollectionDAO.MessagingServiceDAO.class);
    CollectionDAO.TopicDAO topicDAO = mock(CollectionDAO.TopicDAO.class);
    CollectionDAO.MlModelServiceDAO mlModelServiceDAO = mock(CollectionDAO.MlModelServiceDAO.class);
    CollectionDAO.MlModelDAO mlModelDAO = mock(CollectionDAO.MlModelDAO.class);

    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(collectionDAO.dashboardServiceDAO()).thenReturn(dashboardServiceDAO);
    when(collectionDAO.dashboardDAO()).thenReturn(dashboardDAO);
    when(collectionDAO.chartDAO()).thenReturn(chartDAO);
    when(collectionDAO.pipelineServiceDAO()).thenReturn(pipelineServiceDAO);
    when(collectionDAO.pipelineDAO()).thenReturn(pipelineDAO);
    when(collectionDAO.messagingServiceDAO()).thenReturn(messagingServiceDAO);
    when(collectionDAO.topicDAO()).thenReturn(topicDAO);
    when(collectionDAO.mlModelServiceDAO()).thenReturn(mlModelServiceDAO);
    when(collectionDAO.mlModelDAO()).thenReturn(mlModelDAO);

    UUID dashboardServiceId = UUID.randomUUID();
    UUID pipelineServiceId = UUID.randomUUID();
    UUID messagingServiceId = UUID.randomUUID();
    UUID mlModelServiceId = UUID.randomUUID();
    UUID dashboardId = UUID.randomUUID();
    UUID chartId = UUID.randomUUID();
    UUID pipelineId = UUID.randomUUID();
    UUID topicId = UUID.randomUUID();
    UUID mlModelId = UUID.randomUUID();

    stubServiceRows(handle, "dashboard_service_entity", dashboardServiceId);
    stubServiceRows(handle, "pipeline_service_entity", pipelineServiceId);
    stubServiceRows(handle, "messaging_service_entity", messagingServiceId);
    stubServiceRows(handle, "mlmodel_service_entity", mlModelServiceId);

    String dashboardServiceFqn = "\"dash.service\"";
    DashboardService dashboardService =
        new DashboardService()
            .withId(dashboardServiceId)
            .withName("dash.service")
            .withFullyQualifiedName(dashboardServiceFqn);
    String pipelineServiceFqn = "\"pipe.service\"";
    PipelineService pipelineService =
        new PipelineService()
            .withId(pipelineServiceId)
            .withName("pipe.service")
            .withFullyQualifiedName(pipelineServiceFqn);
    String messagingServiceFqn = "\"msg.service\"";
    MessagingService messagingService =
        new MessagingService()
            .withId(messagingServiceId)
            .withName("msg.service")
            .withFullyQualifiedName(messagingServiceFqn);
    String mlModelServiceFqn = "\"ml.service\"";
    MlModelService mlModelService =
        new MlModelService()
            .withId(mlModelServiceId)
            .withName("ml.service")
            .withFullyQualifiedName(mlModelServiceFqn);

    // Stored FQNs use the unquoted service name (the pre-2023-06-19 getName() bug), so canonical
    // FQN lookup misses and re-ingestion creates duplicates instead of healing the row.
    Dashboard dashboard =
        new Dashboard()
            .withId(dashboardId)
            .withName("sales")
            .withFullyQualifiedName("dash.service.sales");
    Chart chart =
        new Chart()
            .withId(chartId)
            .withName("revenue")
            .withFullyQualifiedName("dash.service.revenue");
    Pipeline pipeline =
        new Pipeline()
            .withId(pipelineId)
            .withName("etl")
            .withFullyQualifiedName("pipe.service.etl");
    Topic topic =
        new Topic().withId(topicId).withName("events").withFullyQualifiedName("msg.service.events");
    MlModel mlModel =
        new MlModel()
            .withId(mlModelId)
            .withName("classifier")
            .withFullyQualifiedName("ml.service.classifier");

    when(dashboardServiceDAO.findEntityById(dashboardServiceId)).thenReturn(dashboardService);
    when(pipelineServiceDAO.findEntityById(pipelineServiceId)).thenReturn(pipelineService);
    when(messagingServiceDAO.findEntityById(messagingServiceId)).thenReturn(messagingService);
    when(mlModelServiceDAO.findEntityById(mlModelServiceId)).thenReturn(mlModelService);
    when(relationshipDAO.findTo(
            dashboardServiceId,
            Entity.DASHBOARD_SERVICE,
            Relationship.CONTAINS.ordinal(),
            Entity.DASHBOARD))
        .thenReturn(List.of(relationship(dashboardId, Entity.DASHBOARD)));
    when(relationshipDAO.findTo(
            dashboardServiceId,
            Entity.DASHBOARD_SERVICE,
            Relationship.CONTAINS.ordinal(),
            Entity.CHART))
        .thenReturn(List.of(relationship(chartId, Entity.CHART)));
    when(relationshipDAO.findTo(
            pipelineServiceId,
            Entity.PIPELINE_SERVICE,
            Relationship.CONTAINS.ordinal(),
            Entity.PIPELINE))
        .thenReturn(List.of(relationship(pipelineId, Entity.PIPELINE)));
    when(relationshipDAO.findTo(
            messagingServiceId,
            Entity.MESSAGING_SERVICE,
            Relationship.CONTAINS.ordinal(),
            Entity.TOPIC))
        .thenReturn(List.of(relationship(topicId, Entity.TOPIC)));
    when(relationshipDAO.findTo(
            mlModelServiceId,
            Entity.MLMODEL_SERVICE,
            Relationship.CONTAINS.ordinal(),
            Entity.MLMODEL))
        .thenReturn(List.of(relationship(mlModelId, Entity.MLMODEL)));
    when(dashboardDAO.findEntityById(dashboardId)).thenReturn(dashboard);
    when(chartDAO.findEntityById(chartId)).thenReturn(chart);
    when(pipelineDAO.findEntityById(pipelineId)).thenReturn(pipeline);
    when(topicDAO.findEntityById(topicId)).thenReturn(topic);
    when(mlModelDAO.findEntityById(mlModelId)).thenReturn(mlModel);

    // Before migration, the canonical FQN (built from the quoted service FQN) differs from the
    // corrupted stored FQN (built from the unquoted service name). The hash diverges accordingly,
    // so the rows are unreachable via canonical FQN lookup.
    String expectedDashboardFqn = FullyQualifiedName.add(dashboardServiceFqn, dashboard.getName());
    String expectedChartFqn = FullyQualifiedName.add(dashboardServiceFqn, chart.getName());
    String expectedPipelineFqn = FullyQualifiedName.add(pipelineServiceFqn, pipeline.getName());
    String expectedTopicFqn = FullyQualifiedName.add(messagingServiceFqn, topic.getName());
    String expectedMlModelFqn = FullyQualifiedName.add(mlModelServiceFqn, mlModel.getName());
    assertNotEquals(expectedDashboardFqn, dashboard.getFullyQualifiedName());
    assertNotEquals(expectedChartFqn, chart.getFullyQualifiedName());
    assertNotEquals(expectedPipelineFqn, pipeline.getFullyQualifiedName());
    assertNotEquals(expectedTopicFqn, topic.getFullyQualifiedName());
    assertNotEquals(expectedMlModelFqn, mlModel.getFullyQualifiedName());

    MigrationUtil.fixDashboardFqnHash(handle, collectionDAO);
    MigrationUtil.fixChartFqnHash(handle, collectionDAO);
    MigrationUtil.fixPipelineFqnHash(handle, collectionDAO);
    MigrationUtil.fixTopicFqnHash(handle, collectionDAO);
    MigrationUtil.fixMlModelFqnHash(handle, collectionDAO);

    // After migration, stored FQNs match the canonical form the repositories now compute, so
    // canonical FQN lookup resolves and upserts heal the row instead of creating duplicates.
    assertEquals(expectedDashboardFqn, dashboard.getFullyQualifiedName());
    assertEquals(expectedChartFqn, chart.getFullyQualifiedName());
    assertEquals(expectedPipelineFqn, pipeline.getFullyQualifiedName());
    assertEquals(expectedTopicFqn, topic.getFullyQualifiedName());
    assertEquals(expectedMlModelFqn, mlModel.getFullyQualifiedName());
  }

  @Test
  void fixMethodsReturnEarlyWhenNoDottedServicesExist() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);

    stubServiceRows(handle, "dbservice_entity");
    stubServiceRows(handle, "dashboard_service_entity");
    stubServiceRows(handle, "api_service_entity");
    stubServiceRows(handle, "pipeline_service_entity");
    stubServiceRows(handle, "messaging_service_entity");
    stubServiceRows(handle, "mlmodel_service_entity");

    MigrationUtil.fixDatabaseFqnHash(handle, collectionDAO);
    MigrationUtil.fixDatabaseSchemaFqnHash(handle, collectionDAO);
    MigrationUtil.fixTableFqnHash(handle, collectionDAO);
    MigrationUtil.fixStoredProcedureFqnHash(handle, collectionDAO);
    MigrationUtil.fixDashboardFqnHash(handle, collectionDAO);
    MigrationUtil.fixChartFqnHash(handle, collectionDAO);
    MigrationUtil.fixDashboardDataModelFqnHash(handle, collectionDAO);
    MigrationUtil.fixApiCollectionFqnHash(handle, collectionDAO);
    MigrationUtil.fixApiEndpointFqnHash(handle, collectionDAO);
    MigrationUtil.fixPipelineFqnHash(handle, collectionDAO);
    MigrationUtil.fixTopicFqnHash(handle, collectionDAO);
    MigrationUtil.fixMlModelFqnHash(handle, collectionDAO);

    verifyNoInteractions(collectionDAO);
  }

  @Test
  void updateClassificationAndRecognizersExecutesClassificationAndTagStatements() {
    Handle handle = mock(Handle.class);
    MigrationDAO migrationDAO = mock(MigrationDAO.class);

    LoadTags loadTags =
        new LoadTags()
            .withCreateClassification(
                new CreateClassification()
                    .withName("PII")
                    .withAutoClassificationConfig(new AutoClassificationConfig()))
            .withCreateTags(
                List.of(
                    new CreateTag()
                        .withName("Sensitive")
                        .withAutoClassificationEnabled(true)
                        .withAutoClassificationPriority(25)));

    String classificationStatement = "UPDATE classification_entity SET config = ?";
    String tagStatement = "UPDATE tag_entity SET config = ?";
    Object[] classificationArgs = {
      JsonUtils.pojoToJson(loadTags.getCreateClassification().getAutoClassificationConfig()), "PII"
    };
    Object[] tagArgs = {
      "true",
      25,
      JsonUtils.pojoToJson(loadTags.getCreateTags().get(0).getRecognizers()),
      "PII.Sensitive"
    };

    Map<String, QueryStatus> classificationResult =
        Map.of("classification", new QueryStatus(QueryStatus.Status.SUCCESS, "classification ok"));
    Map<String, QueryStatus> tagResult =
        Map.of("tag", new QueryStatus(QueryStatus.Status.SUCCESS, "tag ok"));

    try (MockedStatic<EntityRepository> entityRepositoryMock = mockStatic(EntityRepository.class);
        MockedStatic<LongStatementsUtil> longStatementsMock =
            mockStatic(LongStatementsUtil.class)) {
      entityRepositoryMock
          .when(
              () ->
                  EntityRepository.getEntitiesFromSeedData(
                      Entity.CLASSIFICATION,
                      ".*json/data/tags/piiTagsWithRecognizers.json$",
                      LoadTags.class))
          .thenReturn(List.of(loadTags));
      longStatementsMock
          .when(
              () ->
                  LongStatementsUtil.executeAndUpdate(
                      handle,
                      migrationDAO,
                      "1.12.0",
                      false,
                      classificationStatement,
                      classificationArgs))
          .thenReturn(classificationResult);
      longStatementsMock
          .when(
              () ->
                  LongStatementsUtil.executeAndUpdate(
                      handle, migrationDAO, "1.12.0", false, tagStatement, tagArgs))
          .thenReturn(tagResult);

      Map<String, QueryStatus> result =
          MigrationUtil.updateClassificationAndRecognizers(
              classificationStatement, tagStatement, handle, migrationDAO, "1.12.0", false);

      assertEquals(2, result.size());
      assertEquals(QueryStatus.Status.SUCCESS, result.get("classification").getStatus());
      assertEquals(QueryStatus.Status.SUCCESS, result.get("tag").getStatus());
    }
  }

  @Test
  void updateClassificationAndRecognizersReportsSeedLoadFailures() {
    try (MockedStatic<EntityRepository> entityRepositoryMock = mockStatic(EntityRepository.class)) {
      entityRepositoryMock
          .when(
              () ->
                  EntityRepository.getEntitiesFromSeedData(
                      Entity.CLASSIFICATION,
                      ".*json/data/tags/piiTagsWithRecognizers.json$",
                      LoadTags.class))
          .thenThrow(new IOException("missing seed data"));

      Map<String, QueryStatus> result =
          MigrationUtil.updateClassificationAndRecognizers(
              "UPDATE classification",
              "UPDATE tag",
              mock(Handle.class),
              mock(MigrationDAO.class),
              "1.12.0",
              false);

      assertEquals(1, result.size());
      assertEquals(QueryStatus.Status.FAILURE, result.get("loadPiiTagsSeedData").getStatus());
      assertTrue(result.get("loadPiiTagsSeedData").getMessage().contains("missing seed data"));
    }
  }

  private static void stubServiceRows(Handle handle, String tableName, UUID... ids) {
    String query = String.format("SELECT id FROM %s WHERE name LIKE '%%.%%'", tableName);
    List<Map<String, Object>> rows =
        Arrays.stream(ids)
            .map(
                id -> {
                  Map<String, Object> row = new HashMap<>();
                  row.put("id", id.toString());
                  return row;
                })
            .toList();
    when(handle.createQuery(query).mapToMap().list()).thenReturn(rows);
  }

  private static CollectionDAO.EntityRelationshipRecord relationship(UUID id, String type) {
    return CollectionDAO.EntityRelationshipRecord.builder().id(id).type(type).json("{}").build();
  }
}
