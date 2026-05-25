package org.openmetadata.service.migration.utils.v1112;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.StoredProcedure;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.ApiService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.FullyQualifiedName;

class MigrationUtilTest {
  private Handle handle;
  private CollectionDAO collectionDAO;
  private CollectionDAO.EntityRelationshipDAO relationshipDAO;
  private CollectionDAO.DatabaseServiceDAO databaseServiceDAO;
  private CollectionDAO.DatabaseDAO databaseDAO;
  private CollectionDAO.DatabaseSchemaDAO databaseSchemaDAO;
  private CollectionDAO.TableDAO tableDAO;
  private CollectionDAO.StoredProcedureDAO storedProcedureDAO;
  private CollectionDAO.DashboardServiceDAO dashboardServiceDAO;
  private CollectionDAO.DataModelDAO dashboardDataModelDAO;
  private CollectionDAO.ApiServiceDAO apiServiceDAO;
  private CollectionDAO.APICollectionDAO apiCollectionDAO;
  private CollectionDAO.APIEndpointDAO apiEndpointDAO;

  @BeforeEach
  void setUp() {
    handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    collectionDAO = mock(CollectionDAO.class);
    relationshipDAO = mock(CollectionDAO.EntityRelationshipDAO.class);
    databaseServiceDAO = mock(CollectionDAO.DatabaseServiceDAO.class);
    databaseDAO = mock(CollectionDAO.DatabaseDAO.class);
    databaseSchemaDAO = mock(CollectionDAO.DatabaseSchemaDAO.class);
    tableDAO = mock(CollectionDAO.TableDAO.class);
    storedProcedureDAO = mock(CollectionDAO.StoredProcedureDAO.class);
    dashboardServiceDAO = mock(CollectionDAO.DashboardServiceDAO.class);
    dashboardDataModelDAO = mock(CollectionDAO.DataModelDAO.class);
    apiServiceDAO = mock(CollectionDAO.ApiServiceDAO.class);
    apiCollectionDAO = mock(CollectionDAO.APICollectionDAO.class);
    apiEndpointDAO = mock(CollectionDAO.APIEndpointDAO.class);

    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(collectionDAO.dbServiceDAO()).thenReturn(databaseServiceDAO);
    when(collectionDAO.databaseDAO()).thenReturn(databaseDAO);
    when(collectionDAO.databaseSchemaDAO()).thenReturn(databaseSchemaDAO);
    when(collectionDAO.tableDAO()).thenReturn(tableDAO);
    when(collectionDAO.storedProcedureDAO()).thenReturn(storedProcedureDAO);
    when(collectionDAO.dashboardServiceDAO()).thenReturn(dashboardServiceDAO);
    when(collectionDAO.dashboardDataModelDAO()).thenReturn(dashboardDataModelDAO);
    when(collectionDAO.apiServiceDAO()).thenReturn(apiServiceDAO);
    when(collectionDAO.apiCollectionDAO()).thenReturn(apiCollectionDAO);
    when(collectionDAO.apiEndpointDAO()).thenReturn(apiEndpointDAO);
  }

  @Test
  void fixDatabaseFqnHashUpdatesBrokenDatabasesAndContinuesAfterLookupFailures() {
    UUID serviceId = UUID.randomUUID();
    UUID brokenDatabaseId = UUID.randomUUID();
    UUID failedDatabaseId = UUID.randomUUID();
    stubServiceRows("dbservice_entity", serviceId);

    when(databaseServiceDAO.findEntityById(serviceId))
        .thenReturn(
            new DatabaseService()
                .withId(serviceId)
                .withName("svc.with.dot")
                .withFullyQualifiedName("\"svc.with.dot\""));
    when(relationshipDAO.findTo(
            serviceId, Entity.DATABASE_SERVICE, Relationship.CONTAINS.ordinal(), Entity.DATABASE))
        .thenReturn(List.of(relationship(failedDatabaseId), relationship(brokenDatabaseId)));
    when(databaseDAO.findEntityById(failedDatabaseId))
        .thenThrow(new IllegalStateException("database lookup failed"));

    Database database =
        new Database()
            .withId(brokenDatabaseId)
            .withName("sales")
            .withFullyQualifiedName("svc.with.dot.sales");
    when(databaseDAO.findEntityById(brokenDatabaseId)).thenReturn(database);

    MigrationUtil.fixDatabaseFqnHash(handle, collectionDAO);

    ArgumentCaptor<Database> captor = ArgumentCaptor.forClass(Database.class);
    verify(databaseDAO).update(captor.capture());
    assertEquals(
        FullyQualifiedName.add("\"svc.with.dot\"", "sales"),
        captor.getValue().getFullyQualifiedName());
  }

  @Test
  void fixDatabaseFqnHashSkipsServicesWithoutQuotedNames() {
    UUID serviceId = UUID.randomUUID();
    stubServiceRows("dbservice_entity", serviceId);
    when(databaseServiceDAO.findEntityById(serviceId))
        .thenReturn(
            new DatabaseService()
                .withId(serviceId)
                .withName("svc.with.dot")
                .withFullyQualifiedName("svc.with.dot"));

    MigrationUtil.fixDatabaseFqnHash(handle, collectionDAO);

    verify(relationshipDAO, never()).findTo(any(), any(), any(Integer.class), any());
    verify(databaseDAO, never()).update(any(Database.class));
  }

  @Test
  void fixDatabaseSchemaFqnHashUpdatesSchemasUnderQuotedServices() {
    UUID serviceId = UUID.randomUUID();
    UUID databaseId = UUID.randomUUID();
    UUID schemaId = UUID.randomUUID();
    stubServiceRows("dbservice_entity", serviceId);

    when(relationshipDAO.findTo(
            serviceId, Entity.DATABASE_SERVICE, Relationship.CONTAINS.ordinal(), Entity.DATABASE))
        .thenReturn(List.of(relationship(databaseId)));
    when(relationshipDAO.findTo(
            databaseId, Entity.DATABASE, Relationship.CONTAINS.ordinal(), Entity.DATABASE_SCHEMA))
        .thenReturn(List.of(relationship(schemaId)));

    Database database =
        new Database()
            .withId(databaseId)
            .withName("warehouse")
            .withFullyQualifiedName("\"svc.with.dot\".warehouse");
    DatabaseSchema schema =
        new DatabaseSchema()
            .withId(schemaId)
            .withName("analytics")
            .withFullyQualifiedName("svc.with.dot.warehouse.analytics")
            .withDatabase(entityReference(databaseId));

    when(databaseSchemaDAO.findEntityById(schemaId)).thenReturn(schema);
    when(databaseDAO.findEntityById(databaseId)).thenReturn(database);

    MigrationUtil.fixDatabaseSchemaFqnHash(handle, collectionDAO);

    ArgumentCaptor<DatabaseSchema> captor = ArgumentCaptor.forClass(DatabaseSchema.class);
    verify(databaseSchemaDAO).update(captor.capture());
    assertEquals(
        FullyQualifiedName.add(database.getFullyQualifiedName(), schema.getName()),
        captor.getValue().getFullyQualifiedName());
  }

  @Test
  void fixDatabaseSchemaFqnHashReturnsWhenNoDatabasesExistUnderQuotedServices() {
    UUID serviceId = UUID.randomUUID();
    stubServiceRows("dbservice_entity", serviceId);
    when(relationshipDAO.findTo(
            serviceId, Entity.DATABASE_SERVICE, Relationship.CONTAINS.ordinal(), Entity.DATABASE))
        .thenReturn(List.of());

    MigrationUtil.fixDatabaseSchemaFqnHash(handle, collectionDAO);

    verify(databaseSchemaDAO, never()).update(any(DatabaseSchema.class));
  }

  @Test
  void fixTableFqnHashUpdatesTableAndColumnFullyQualifiedNames() {
    UUID serviceId = UUID.randomUUID();
    UUID databaseId = UUID.randomUUID();
    UUID schemaId = UUID.randomUUID();
    UUID tableId = UUID.randomUUID();
    stubServiceRows("dbservice_entity", serviceId);

    when(relationshipDAO.findTo(
            serviceId, Entity.DATABASE_SERVICE, Relationship.CONTAINS.ordinal(), Entity.DATABASE))
        .thenReturn(List.of(relationship(databaseId)));
    when(relationshipDAO.findTo(
            databaseId, Entity.DATABASE, Relationship.CONTAINS.ordinal(), Entity.DATABASE_SCHEMA))
        .thenReturn(List.of(relationship(schemaId)));
    when(relationshipDAO.findTo(
            schemaId, Entity.DATABASE_SCHEMA, Relationship.CONTAINS.ordinal(), Entity.TABLE))
        .thenReturn(List.of(relationship(tableId)));

    DatabaseSchema schema =
        new DatabaseSchema()
            .withId(schemaId)
            .withName("analytics")
            .withFullyQualifiedName("\"svc.with.dot\".warehouse.analytics")
            .withDatabase(entityReference(databaseId));
    Table table =
        new Table()
            .withId(tableId)
            .withName("daily_sales")
            .withFullyQualifiedName("svc.with.dot.warehouse.analytics.daily_sales")
            .withDatabaseSchema(entityReference(schemaId))
            .withColumns(
                new ArrayList<>(
                    List.of(
                        new Column()
                            .withName("payload")
                            .withDataType(ColumnDataType.STRUCT)
                            .withChildren(
                                new ArrayList<>(
                                    List.of(
                                        new Column()
                                            .withName("revenue")
                                            .withDataType(ColumnDataType.INT)))))));

    when(databaseSchemaDAO.findEntityById(schemaId)).thenReturn(schema);
    when(tableDAO.findEntityById(tableId)).thenReturn(table);

    MigrationUtil.fixTableFqnHash(handle, collectionDAO);

    ArgumentCaptor<Table> captor = ArgumentCaptor.forClass(Table.class);
    verify(tableDAO).update(captor.capture());

    Table updated = captor.getValue();
    String expectedFqn = FullyQualifiedName.add(schema.getFullyQualifiedName(), table.getName());
    assertEquals(expectedFqn, updated.getFullyQualifiedName());
    assertEquals(expectedFqn + ".payload", updated.getColumns().getFirst().getFullyQualifiedName());
    assertEquals(
        expectedFqn + ".payload.revenue",
        updated.getColumns().getFirst().getChildren().getFirst().getFullyQualifiedName());
  }

  @Test
  void fixStoredProcedureFqnHashUpdatesStoredProceduresUnderQuotedServices() {
    UUID serviceId = UUID.randomUUID();
    UUID databaseId = UUID.randomUUID();
    UUID schemaId = UUID.randomUUID();
    UUID storedProcedureId = UUID.randomUUID();
    stubServiceRows("dbservice_entity", serviceId);

    when(relationshipDAO.findTo(
            serviceId, Entity.DATABASE_SERVICE, Relationship.CONTAINS.ordinal(), Entity.DATABASE))
        .thenReturn(List.of(relationship(databaseId)));
    when(relationshipDAO.findTo(
            databaseId, Entity.DATABASE, Relationship.CONTAINS.ordinal(), Entity.DATABASE_SCHEMA))
        .thenReturn(List.of(relationship(schemaId)));
    when(relationshipDAO.findTo(
            schemaId,
            Entity.DATABASE_SCHEMA,
            Relationship.CONTAINS.ordinal(),
            Entity.STORED_PROCEDURE))
        .thenReturn(List.of(relationship(storedProcedureId)));

    DatabaseSchema schema =
        new DatabaseSchema()
            .withId(schemaId)
            .withName("analytics")
            .withFullyQualifiedName("\"svc.with.dot\".warehouse.analytics")
            .withDatabase(entityReference(databaseId));
    StoredProcedure storedProcedure =
        new StoredProcedure()
            .withId(storedProcedureId)
            .withName("refresh_sales")
            .withFullyQualifiedName("svc.with.dot.warehouse.analytics.refresh_sales")
            .withDatabaseSchema(entityReference(schemaId));

    when(databaseSchemaDAO.findEntityById(schemaId)).thenReturn(schema);
    when(storedProcedureDAO.findEntityById(storedProcedureId)).thenReturn(storedProcedure);

    MigrationUtil.fixStoredProcedureFqnHash(handle, collectionDAO);

    ArgumentCaptor<StoredProcedure> captor = ArgumentCaptor.forClass(StoredProcedure.class);
    verify(storedProcedureDAO).update(captor.capture());
    assertEquals(
        FullyQualifiedName.add(schema.getFullyQualifiedName(), storedProcedure.getName()),
        captor.getValue().getFullyQualifiedName());
  }

  @Test
  void fixDashboardDataModelFqnHashUpdatesModelsAndColumns() {
    UUID serviceId = UUID.randomUUID();
    UUID modelId = UUID.randomUUID();
    stubServiceRows("dashboard_service_entity", serviceId);

    when(dashboardServiceDAO.findEntityById(serviceId))
        .thenReturn(
            new DashboardService()
                .withId(serviceId)
                .withName("dash.with.dot")
                .withFullyQualifiedName("\"dash.with.dot\""));
    when(relationshipDAO.findTo(
            serviceId,
            Entity.DASHBOARD_SERVICE,
            Relationship.CONTAINS.ordinal(),
            Entity.DASHBOARD_DATA_MODEL))
        .thenReturn(List.of(relationship(modelId)));

    DashboardDataModel dataModel =
        new DashboardDataModel()
            .withId(modelId)
            .withName("daily_metrics")
            .withFullyQualifiedName("dash.with.dot.model.daily_metrics")
            .withColumns(
                new ArrayList<>(
                    List.of(new Column().withName("metric").withDataType(ColumnDataType.STRING))));
    when(dashboardDataModelDAO.findEntityById(modelId)).thenReturn(dataModel);

    MigrationUtil.fixDashboardDataModelFqnHash(handle, collectionDAO);

    ArgumentCaptor<DashboardDataModel> captor = ArgumentCaptor.forClass(DashboardDataModel.class);
    verify(dashboardDataModelDAO).update(captor.capture());
    String expectedFqn = FullyQualifiedName.add("\"dash.with.dot\".model", dataModel.getName());
    assertEquals(expectedFqn, captor.getValue().getFullyQualifiedName());
    assertEquals(
        expectedFqn + ".metric", captor.getValue().getColumns().getFirst().getFullyQualifiedName());
  }

  @Test
  void fixApiCollectionFqnHashUpdatesCollections() {
    UUID serviceId = UUID.randomUUID();
    UUID collectionId = UUID.randomUUID();
    stubServiceRows("api_service_entity", serviceId);

    when(apiServiceDAO.findEntityById(serviceId))
        .thenReturn(
            new ApiService()
                .withId(serviceId)
                .withName("api.with.dot")
                .withFullyQualifiedName("\"api.with.dot\""));
    when(relationshipDAO.findTo(
            serviceId, Entity.API_SERVICE, Relationship.CONTAINS.ordinal(), Entity.API_COLLECTION))
        .thenReturn(List.of(relationship(collectionId)));

    APICollection apiCollection =
        new APICollection()
            .withId(collectionId)
            .withName("payments")
            .withFullyQualifiedName("api.with.dot.payments");
    when(apiCollectionDAO.findEntityById(collectionId)).thenReturn(apiCollection);

    MigrationUtil.fixApiCollectionFqnHash(handle, collectionDAO);

    ArgumentCaptor<APICollection> captor = ArgumentCaptor.forClass(APICollection.class);
    verify(apiCollectionDAO).update(captor.capture());
    assertEquals(
        FullyQualifiedName.add("\"api.with.dot\"", apiCollection.getName()),
        captor.getValue().getFullyQualifiedName());
  }

  @Test
  void fixApiCollectionFqnHashSwallowsServiceLookupFailures() {
    UUID serviceId = UUID.randomUUID();
    stubServiceRows("api_service_entity", serviceId);
    when(apiServiceDAO.findEntityById(serviceId))
        .thenThrow(new IllegalStateException("service lookup failed"));

    MigrationUtil.fixApiCollectionFqnHash(handle, collectionDAO);

    verify(apiCollectionDAO, never()).update(any(APICollection.class));
  }

  @Test
  void fixApiEndpointFqnHashUpdatesEndpointsUnderQuotedCollections() {
    UUID serviceId = UUID.randomUUID();
    UUID collectionId = UUID.randomUUID();
    UUID endpointId = UUID.randomUUID();
    stubServiceRows("api_service_entity", serviceId);

    when(relationshipDAO.findTo(
            serviceId, Entity.API_SERVICE, Relationship.CONTAINS.ordinal(), Entity.API_COLLECTION))
        .thenReturn(List.of(relationship(collectionId)));
    when(relationshipDAO.findTo(
            collectionId,
            Entity.API_COLLECTION,
            Relationship.CONTAINS.ordinal(),
            Entity.API_ENDPOINT))
        .thenReturn(List.of(relationship(endpointId)));

    APICollection apiCollection =
        new APICollection()
            .withId(collectionId)
            .withName("payments")
            .withFullyQualifiedName("\"api.with.dot\".payments");
    APIEndpoint endpoint =
        new APIEndpoint()
            .withId(endpointId)
            .withName("listTransactions")
            .withFullyQualifiedName("api.with.dot.payments.listTransactions")
            .withApiCollection(entityReference(collectionId));

    when(apiCollectionDAO.findEntityById(collectionId)).thenReturn(apiCollection);
    when(apiEndpointDAO.findEntityById(endpointId)).thenReturn(endpoint);

    MigrationUtil.fixApiEndpointFqnHash(handle, collectionDAO);

    ArgumentCaptor<APIEndpoint> captor = ArgumentCaptor.forClass(APIEndpoint.class);
    verify(apiEndpointDAO).update(captor.capture());
    assertEquals(
        FullyQualifiedName.add(apiCollection.getFullyQualifiedName(), endpoint.getName()),
        captor.getValue().getFullyQualifiedName());
  }

  @Test
  void fixApiEndpointFqnHashSkipsMissingCollections() {
    UUID serviceId = UUID.randomUUID();
    UUID collectionId = UUID.randomUUID();
    stubServiceRows("api_service_entity", serviceId);
    when(relationshipDAO.findTo(
            serviceId, Entity.API_SERVICE, Relationship.CONTAINS.ordinal(), Entity.API_COLLECTION))
        .thenReturn(List.of(relationship(collectionId)));
    when(relationshipDAO.findTo(
            collectionId,
            Entity.API_COLLECTION,
            Relationship.CONTAINS.ordinal(),
            Entity.API_ENDPOINT))
        .thenReturn(List.of(UUID.randomUUID()).stream().map(this::relationship).toList());
    when(apiEndpointDAO.findEntityById(any(UUID.class)))
        .thenReturn(
            new APIEndpoint()
                .withId(UUID.randomUUID())
                .withName("orphaned")
                .withFullyQualifiedName("orphaned.endpoint")
                .withApiCollection(entityReference(collectionId)));
    when(apiCollectionDAO.findEntityById(collectionId)).thenReturn(null);

    MigrationUtil.fixApiEndpointFqnHash(handle, collectionDAO);

    verify(apiEndpointDAO, never()).update(any(APIEndpoint.class));
  }

  @Test
  void fixApiEndpointFqnHashReturnsWhenCollectionsDoNotExist() {
    UUID serviceId = UUID.randomUUID();
    stubServiceRows("api_service_entity", serviceId);
    when(relationshipDAO.findTo(
            serviceId, Entity.API_SERVICE, Relationship.CONTAINS.ordinal(), Entity.API_COLLECTION))
        .thenReturn(List.of());

    MigrationUtil.fixApiEndpointFqnHash(handle, collectionDAO);

    verify(apiEndpointDAO, never()).update(any(APIEndpoint.class));
  }

  @Test
  void fixDatabaseFqnHashSwallowsServiceQueryErrors() {
    when(handle.createQuery(serviceQuery("dbservice_entity")).mapToMap().list())
        .thenThrow(new IllegalStateException("broken metadata query"));

    MigrationUtil.fixDatabaseFqnHash(handle, collectionDAO);

    verify(databaseServiceDAO, never()).findEntityById(any(UUID.class));
  }

  private void stubServiceRows(String serviceTable, UUID... serviceIds) {
    when(handle.createQuery(serviceQuery(serviceTable)).mapToMap().list())
        .thenReturn(
            List.of(serviceIds).stream()
                .map(id -> Map.<String, Object>of("id", id.toString()))
                .toList());
  }

  private String serviceQuery(String serviceTable) {
    return String.format("SELECT id FROM %s WHERE name LIKE '%%.%%'", serviceTable);
  }

  private CollectionDAO.EntityRelationshipRecord relationship(UUID id) {
    return CollectionDAO.EntityRelationshipRecord.builder().id(id).build();
  }

  private EntityReference entityReference(UUID id) {
    return new EntityReference().withId(id);
  }
}
