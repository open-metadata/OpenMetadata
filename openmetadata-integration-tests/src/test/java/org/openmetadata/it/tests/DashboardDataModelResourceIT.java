package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for DashboardDataModel entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds dashboard data model-specific tests
 * for columns and data model types.
 *
 * <p>Migrated from: org.openmetadata.service.resources.datamodels.DashboardDataModelResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class DashboardDataModelResourceIT
    extends BaseEntityIT<DashboardDataModel, CreateDashboardDataModel> {

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateDashboardDataModel createMinimalRequest(
      TestNamespace ns, OpenMetadataClient client) {
    DashboardService service = DashboardServiceTestFactory.createLooker(client, ns);

    List<Column> columns =
        Arrays.asList(
            new Column().withName("id").withDataType(ColumnDataType.INT),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(256));

    return new CreateDashboardDataModel()
        .withName(ns.prefix("datamodel"))
        .withDescription("Test dashboard data model created by integration test")
        .withService(service.getFullyQualifiedName())
        .withDataModelType(DataModelType.LookMlView)
        .withColumns(columns);
  }

  @Override
  protected CreateDashboardDataModel createRequest(
      String name, TestNamespace ns, OpenMetadataClient client) {
    DashboardService service = DashboardServiceTestFactory.createLooker(client, ns);

    List<Column> columns =
        Arrays.asList(
            new Column().withName("id").withDataType(ColumnDataType.INT),
            new Column()
                .withName("value")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(256));

    return new CreateDashboardDataModel()
        .withName(name)
        .withDescription("Test dashboard data model")
        .withService(service.getFullyQualifiedName())
        .withDataModelType(DataModelType.LookMlView)
        .withColumns(columns);
  }

  @Override
  protected DashboardDataModel createEntity(
      CreateDashboardDataModel createRequest, OpenMetadataClient client) {
    return client.dashboardDataModels().create(createRequest);
  }

  @Override
  protected DashboardDataModel getEntity(String id, OpenMetadataClient client) {
    return client.dashboardDataModels().get(id);
  }

  @Override
  protected DashboardDataModel getEntityByName(String fqn, OpenMetadataClient client) {
    return client.dashboardDataModels().getByName(fqn);
  }

  @Override
  protected DashboardDataModel patchEntity(
      String id, DashboardDataModel entity, OpenMetadataClient client) {
    return client.dashboardDataModels().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.dashboardDataModels().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.dashboardDataModels().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.dashboardDataModels().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "dashboardDataModel";
  }

  @Override
  protected void validateCreatedEntity(
      DashboardDataModel entity, CreateDashboardDataModel createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getService(), "DashboardDataModel must have a service");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain data model name");
  }

  @Override
  protected ListResponse<DashboardDataModel> listEntities(
      ListParams params, OpenMetadataClient client) {
    return client.dashboardDataModels().list(params);
  }

  @Override
  protected DashboardDataModel getEntityWithFields(
      String id, String fields, OpenMetadataClient client) {
    return client.dashboardDataModels().get(id, fields);
  }

  @Override
  protected DashboardDataModel getEntityByNameWithFields(
      String fqn, String fields, OpenMetadataClient client) {
    return client.dashboardDataModels().getByName(fqn, fields);
  }

  @Override
  protected DashboardDataModel getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.dashboardDataModels().get(id, "owners,followers,tags,columns,domain", "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.dashboardDataModels().getVersionList(id);
  }

  @Override
  protected DashboardDataModel getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.dashboardDataModels().getVersion(id.toString(), version);
  }

  // ===================================================================
  // DASHBOARD DATA MODEL-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_dataModelWithColumns_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createLooker(client, ns);

    List<Column> columns =
        Arrays.asList(
            new Column().withName("user_id").withDataType(ColumnDataType.BIGINT),
            new Column()
                .withName("first_name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(128),
            new Column()
                .withName("last_name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(128),
            new Column().withName("created_at").withDataType(ColumnDataType.TIMESTAMP));

    CreateDashboardDataModel request =
        new CreateDashboardDataModel()
            .withName(ns.prefix("dm_columns"))
            .withDescription("Data model with columns")
            .withService(service.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(columns);

    DashboardDataModel dataModel = createEntity(request, client);
    assertNotNull(dataModel);
    assertNotNull(dataModel.getColumns());
    assertEquals(4, dataModel.getColumns().size());
  }

  @Test
  void post_dataModelWithNestedColumns_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createLooker(client, ns);

    Column nestedColumn =
        new Column()
            .withName("address")
            .withDataType(ColumnDataType.STRUCT)
            .withChildren(
                Arrays.asList(
                    new Column()
                        .withName("street")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(256),
                    new Column()
                        .withName("city")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(128),
                    new Column()
                        .withName("zip")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(20)));

    List<Column> columns =
        Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.INT), nestedColumn);

    CreateDashboardDataModel request =
        new CreateDashboardDataModel()
            .withName(ns.prefix("dm_nested"))
            .withDescription("Data model with nested columns")
            .withService(service.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(columns);

    DashboardDataModel dataModel = createEntity(request, client);
    assertNotNull(dataModel);
    assertNotNull(dataModel.getColumns());
    assertEquals(2, dataModel.getColumns().size());

    // Find the struct column and verify children
    Column structColumn =
        dataModel.getColumns().stream()
            .filter(c -> c.getName().equals("address"))
            .findFirst()
            .orElseThrow();
    assertNotNull(structColumn.getChildren());
    assertEquals(3, structColumn.getChildren().size());
  }

  @Test
  void put_dataModelDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createLooker(client, ns);

    List<Column> columns =
        Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.INT));

    CreateDashboardDataModel request =
        new CreateDashboardDataModel()
            .withName(ns.prefix("dm_update_desc"))
            .withDescription("Initial description")
            .withService(service.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(columns);

    DashboardDataModel dataModel = createEntity(request, client);
    assertEquals("Initial description", dataModel.getDescription());

    // Update description
    dataModel.setDescription("Updated description");
    DashboardDataModel updated = patchEntity(dataModel.getId().toString(), dataModel, client);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_dataModelWithDifferentTypes_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createLooker(client, ns);

    List<Column> columns =
        Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.INT));

    // Test LookMlView
    CreateDashboardDataModel request1 =
        new CreateDashboardDataModel()
            .withName(ns.prefix("dm_lookml"))
            .withDescription("LookML View")
            .withService(service.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(columns);

    DashboardDataModel dm1 = createEntity(request1, client);
    assertEquals(DataModelType.LookMlView, dm1.getDataModelType());

    // Test LookMlExplore
    CreateDashboardDataModel request2 =
        new CreateDashboardDataModel()
            .withName(ns.prefix("dm_explore"))
            .withDescription("LookML Explore")
            .withService(service.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlExplore)
            .withColumns(columns);

    DashboardDataModel dm2 = createEntity(request2, client);
    assertEquals(DataModelType.LookMlExplore, dm2.getDataModelType());
  }

  @Test
  void test_dataModelNameUniquenessWithinService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createLooker(client, ns);

    String dataModelName = ns.prefix("unique_dm");
    List<Column> columns =
        Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.INT));

    CreateDashboardDataModel request1 =
        new CreateDashboardDataModel()
            .withName(dataModelName)
            .withDescription("First data model")
            .withService(service.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(columns);

    DashboardDataModel dm1 = createEntity(request1, client);
    assertNotNull(dm1);

    // Attempt to create duplicate within same service
    CreateDashboardDataModel request2 =
        new CreateDashboardDataModel()
            .withName(dataModelName)
            .withDescription("Duplicate data model")
            .withService(service.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(columns);

    assertThrows(
        Exception.class,
        () -> createEntity(request2, client),
        "Creating duplicate data model in same service should fail");
  }
}
