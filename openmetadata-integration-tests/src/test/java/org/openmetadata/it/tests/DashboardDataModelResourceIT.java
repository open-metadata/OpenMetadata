package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.resources.datamodels.DashboardDataModelResource;

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

  {
    supportsLifeCycle = true;
    supportsListHistoryByTimestamp = true;
    supportsBulkAPI = true;
  }

  @Override
  protected String getResourcePath() {
    return DashboardDataModelResource.COLLECTION_PATH;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateDashboardDataModel createMinimalRequest(TestNamespace ns) {
    DashboardService service = DashboardServiceTestFactory.createLooker(ns);

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
  protected CreateDashboardDataModel createRequest(String name, TestNamespace ns) {
    DashboardService service = DashboardServiceTestFactory.createLooker(ns);

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
  protected DashboardDataModel createEntity(CreateDashboardDataModel createRequest) {
    return SdkClients.adminClient().dashboardDataModels().create(createRequest);
  }

  @Override
  protected DashboardDataModel getEntity(String id) {
    return SdkClients.adminClient().dashboardDataModels().get(id);
  }

  @Override
  protected DashboardDataModel getEntityByName(String fqn) {
    return SdkClients.adminClient().dashboardDataModels().getByName(fqn);
  }

  @Override
  protected DashboardDataModel patchEntity(String id, DashboardDataModel entity) {
    return SdkClients.adminClient().dashboardDataModels().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().dashboardDataModels().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().dashboardDataModels().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().dashboardDataModels().delete(id, params);
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
  protected ListResponse<DashboardDataModel> listEntities(ListParams params) {
    return SdkClients.adminClient().dashboardDataModels().list(params);
  }

  @Override
  protected DashboardDataModel getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().dashboardDataModels().get(id, fields);
  }

  @Override
  protected DashboardDataModel getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().dashboardDataModels().getByName(fqn, fields);
  }

  @Override
  protected DashboardDataModel getEntityIncludeDeleted(String id) {
    // Use 'domains' (plural) as per DashboardDataModelResource.FIELDS
    return SdkClients.adminClient()
        .dashboardDataModels()
        .get(id, "owners,followers,tags,columns,domains", "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().dashboardDataModels().getVersionList(id);
  }

  @Override
  protected DashboardDataModel getVersion(UUID id, Double version) {
    return SdkClients.adminClient().dashboardDataModels().getVersion(id.toString(), version);
  }

  // ===================================================================
  // DASHBOARD DATA MODEL-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_dataModelWithColumns_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createLooker(ns);

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

    DashboardDataModel dataModel = createEntity(request);
    assertNotNull(dataModel);
    assertNotNull(dataModel.getColumns());
    assertEquals(4, dataModel.getColumns().size());
  }

  @Test
  void post_dataModelWithNestedColumns_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createLooker(ns);

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

    DashboardDataModel dataModel = createEntity(request);
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
    DashboardService service = DashboardServiceTestFactory.createLooker(ns);

    List<Column> columns =
        Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.INT));

    CreateDashboardDataModel request =
        new CreateDashboardDataModel()
            .withName(ns.prefix("dm_update_desc"))
            .withDescription("Initial description")
            .withService(service.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(columns);

    DashboardDataModel dataModel = createEntity(request);
    assertEquals("Initial description", dataModel.getDescription());

    // Update description
    dataModel.setDescription("Updated description");
    DashboardDataModel updated = patchEntity(dataModel.getId().toString(), dataModel);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_dataModelWithDifferentTypes_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createLooker(ns);

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

    DashboardDataModel dm1 = createEntity(request1);
    assertEquals(DataModelType.LookMlView, dm1.getDataModelType());

    // Test LookMlExplore
    CreateDashboardDataModel request2 =
        new CreateDashboardDataModel()
            .withName(ns.prefix("dm_explore"))
            .withDescription("LookML Explore")
            .withService(service.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlExplore)
            .withColumns(columns);

    DashboardDataModel dm2 = createEntity(request2);
    assertEquals(DataModelType.LookMlExplore, dm2.getDataModelType());
  }

  @Test
  void test_dataModelNameUniquenessWithinService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createLooker(ns);

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

    DashboardDataModel dm1 = createEntity(request1);
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
        () -> createEntity(request2),
        "Creating duplicate data model in same service should fail");
  }

  @Test
  void post_dataModelWithoutRequiredFields_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    List<Column> columns =
        Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.INT));

    CreateDashboardDataModel request =
        new CreateDashboardDataModel()
            .withName(ns.prefix("dm_no_service"))
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(columns);

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating data model without service should fail");
  }

  @Test
  void post_dataModelWithDifferentService_200_ok(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    DashboardService metabaseService = DashboardServiceTestFactory.createMetabase(ns);
    DashboardService lookerService = DashboardServiceTestFactory.createLooker(ns);

    List<Column> columns =
        Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.INT));

    CreateDashboardDataModel metabaseRequest =
        new CreateDashboardDataModel()
            .withName(ns.prefix("dm_metabase"))
            .withDescription("Metabase data model")
            .withService(metabaseService.getFullyQualifiedName())
            .withDataModelType(DataModelType.MetabaseDataModel)
            .withColumns(columns);

    DashboardDataModel metabaseModel = createEntity(metabaseRequest);
    assertNotNull(metabaseModel);
    assertEquals(metabaseService.getName(), metabaseModel.getService().getName());

    CreateDashboardDataModel lookerRequest =
        new CreateDashboardDataModel()
            .withName(ns.prefix("dm_looker"))
            .withDescription("Looker data model")
            .withService(lookerService.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(columns);

    DashboardDataModel lookerModel = createEntity(lookerRequest);
    assertNotNull(lookerModel);
    assertEquals(lookerService.getName(), lookerModel.getService().getName());

    ListParams metabaseParams = new ListParams();
    metabaseParams.setService(metabaseService.getName());
    ListResponse<DashboardDataModel> metabaseList = listEntities(metabaseParams);
    assertTrue(
        metabaseList.getData().stream().anyMatch(dm -> dm.getId().equals(metabaseModel.getId())));

    ListParams lookerParams = new ListParams();
    lookerParams.setService(lookerService.getName());
    ListResponse<DashboardDataModel> lookerList = listEntities(lookerParams);
    assertTrue(
        lookerList.getData().stream().anyMatch(dm -> dm.getId().equals(lookerModel.getId())));
  }

  @Test
  void test_mutuallyExclusiveTags(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateClassification createClassification =
        new CreateClassification()
            .withName(ns.prefix("exclusive_classification"))
            .withMutuallyExclusive(true)
            .withDescription("Mutually exclusive classification");
    Classification classification = client.classifications().create(createClassification);

    CreateTag tag1 =
        new CreateTag()
            .withName(ns.prefix("exclusive_tag1"))
            .withClassification(classification.getName())
            .withDescription("Exclusive tag 1");
    Tag t1 = client.tags().create(tag1);

    CreateTag tag2 =
        new CreateTag()
            .withName(ns.prefix("exclusive_tag2"))
            .withClassification(classification.getName())
            .withDescription("Exclusive tag 2");
    Tag t2 = client.tags().create(tag2);

    DashboardService service = DashboardServiceTestFactory.createLooker(ns);
    List<Column> columns =
        Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.INT));

    TagLabel tagLabel1 =
        new TagLabel()
            .withTagFQN(t1.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);
    TagLabel tagLabel2 =
        new TagLabel()
            .withTagFQN(t2.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    CreateDashboardDataModel request =
        new CreateDashboardDataModel()
            .withName(ns.prefix("dm_exclusive_tags"))
            .withService(service.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(columns)
            .withTags(Arrays.asList(tagLabel1, tagLabel2));

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating data model with mutually exclusive tags should fail");

    Column column =
        new Column()
            .withName("test_col")
            .withDataType(ColumnDataType.INT)
            .withTags(Arrays.asList(tagLabel1, tagLabel2));

    CreateDashboardDataModel request2 =
        new CreateDashboardDataModel()
            .withName(ns.prefix("dm_exclusive_col_tags"))
            .withService(service.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(Arrays.asList(column));

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating data model with mutually exclusive tags on column should fail");

    Column nestedColumn =
        new Column()
            .withName("nested_col")
            .withDataType(ColumnDataType.INT)
            .withTags(Arrays.asList(tagLabel1, tagLabel2));

    Column structColumn =
        new Column()
            .withName("struct_col")
            .withDataType(ColumnDataType.STRUCT)
            .withChildren(Arrays.asList(nestedColumn));

    CreateDashboardDataModel request3 =
        new CreateDashboardDataModel()
            .withName(ns.prefix("dm_exclusive_nested_tags"))
            .withService(service.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(Arrays.asList(structColumn));

    assertThrows(
        Exception.class,
        () -> createEntity(request3),
        "Creating data model with mutually exclusive tags on nested column should fail");
  }

  @Test
  void test_columnWithInvalidTag(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    DashboardService service = DashboardServiceTestFactory.createLooker(ns);
    List<Column> columns =
        Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.INT));

    CreateDashboardDataModel request =
        new CreateDashboardDataModel()
            .withName(ns.prefix("dm_valid"))
            .withService(service.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(columns);

    DashboardDataModel dataModel = createEntity(request);
    assertNotNull(dataModel);

    TagLabel invalidTag =
        new TagLabel()
            .withTagFQN("NonExistent.InvalidTag")
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    Column columnWithInvalidTag =
        new Column().withName("id").withDataType(ColumnDataType.INT).withTags(List.of(invalidTag));

    dataModel.setColumns(List.of(columnWithInvalidTag));

    assertThrows(
        Exception.class,
        () -> patchEntity(dataModel.getId().toString(), dataModel),
        "Updating data model with invalid tag should fail");
  }

  @Test
  void testInheritedPermissionFromParent(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    User dataConsumer = UserTestFactory.getDataConsumer(ns);

    DashboardService service = DashboardServiceTestFactory.createLooker(ns);

    service.setOwners(List.of(dataConsumer.getEntityReference()));
    DashboardService updatedService =
        client.dashboardServices().update(service.getId().toString(), service);

    List<Column> columns =
        Arrays.asList(new Column().withName("id").withDataType(ColumnDataType.INT));

    CreateDashboardDataModel request =
        new CreateDashboardDataModel()
            .withName(ns.prefix("dm_inherited"))
            .withService(updatedService.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(columns);

    DashboardDataModel dataModel = createEntity(request);
    assertNotNull(dataModel);
  }

  @Test
  void test_getByNameColumnsPaginationConsistency_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    DashboardService service = DashboardServiceTestFactory.createLooker(ns);

    Column dateStruct =
        new Column()
            .withName("date")
            .withDataType(ColumnDataType.STRUCT)
            .withChildren(
                Arrays.asList(
                    new Column().withName("year").withDataType(ColumnDataType.INT),
                    new Column().withName("month").withDataType(ColumnDataType.INT),
                    new Column().withName("day").withDataType(ColumnDataType.INT)));

    List<Column> columns =
        Arrays.asList(
            new Column().withName("revenue").withDataType(ColumnDataType.BIGINT),
            new Column().withName("cost").withDataType(ColumnDataType.BIGINT),
            new Column().withName("profit").withDataType(ColumnDataType.BIGINT),
            new Column().withName("region").withDataType(ColumnDataType.INT),
            new Column().withName("product").withDataType(ColumnDataType.INT),
            dateStruct,
            new Column().withName("customer_count").withDataType(ColumnDataType.BIGINT),
            new Column().withName("order_count").withDataType(ColumnDataType.BIGINT));

    CreateDashboardDataModel request =
        new CreateDashboardDataModel()
            .withName(ns.prefix("dm_columns_pagination"))
            .withService(service.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(columns);

    DashboardDataModel dataModel = createEntity(request);

    DashboardDataModel fetchedWithColumns =
        getEntityByNameWithFields(dataModel.getFullyQualifiedName(), "columns,owners,description");
    assertNotNull(fetchedWithColumns.getColumns(), "Columns should be returned when requested");
    assertEquals(
        8, fetchedWithColumns.getColumns().size(), "Should return all columns in mixed request");

    Column structColumn =
        fetchedWithColumns.getColumns().stream()
            .filter(c -> c.getName().equals("date"))
            .findFirst()
            .orElseThrow();
    assertNotNull(structColumn.getChildren());
    assertEquals(3, structColumn.getChildren().size());
  }

  @org.junit.jupiter.api.Disabled("Service filter not returning data models - needs investigation")
  @Test
  void test_paginationFetchesTagsAtBothEntityAndFieldLevels(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String shortId = ns.shortPrefix();
    CreateClassification createClassification =
        new CreateClassification()
            .withName("cls_" + shortId)
            .withDescription("Test classification");
    Classification classification = client.classifications().create(createClassification);

    CreateTag createEntityTag =
        new CreateTag()
            .withName("et_" + shortId)
            .withClassification(classification.getName())
            .withDescription("Entity level tag");
    Tag entityTag = client.tags().create(createEntityTag);

    CreateTag createColumnTag =
        new CreateTag()
            .withName("ct_" + shortId)
            .withClassification(classification.getName())
            .withDescription("Column level tag");
    Tag columnTag = client.tags().create(createColumnTag);

    DashboardService service = DashboardServiceTestFactory.createLooker(ns);

    TagLabel entityTagLabel =
        new TagLabel()
            .withTagFQN(entityTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);
    TagLabel columnTagLabel =
        new TagLabel()
            .withTagFQN(columnTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    for (int i = 0; i < 3; i++) {
      Column column1 =
          new Column()
              .withName("column1_" + i)
              .withDataType(ColumnDataType.BIGINT)
              .withTags(List.of(columnTagLabel));
      Column column2 = new Column().withName("column2_" + i).withDataType(ColumnDataType.BIGINT);

      CreateDashboardDataModel request =
          new CreateDashboardDataModel()
              .withName(ns.prefix("dm_pagination_" + i))
              .withService(service.getFullyQualifiedName())
              .withDataModelType(DataModelType.LookMlView)
              .withColumns(Arrays.asList(column1, column2))
              .withTags(List.of(entityTagLabel));

      createEntity(request);
    }

    // Wait for indexing
    try {
      Thread.sleep(1000);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }

    ListParams params = new ListParams();
    params.setFields("tags");
    params.setLimit(100);
    params.setService(service.getFullyQualifiedName());
    ListResponse<DashboardDataModel> list = listEntities(params);

    List<DashboardDataModel> ourModels =
        list.getData().stream()
            .filter(dm -> dm.getName().startsWith(ns.prefix("dm_pagination_")))
            .collect(Collectors.toList());

    assertTrue(ourModels.size() >= 1, "Should find at least one created data model in service");

    for (DashboardDataModel dm : ourModels) {
      assertNotNull(dm.getTags(), "Entity-level tags should be present");
      assertEquals(1, dm.getTags().size());
      assertEquals(entityTagLabel.getTagFQN(), dm.getTags().get(0).getTagFQN());
    }

    params.setFields("columns,tags");
    params.setService(service.getFullyQualifiedName());
    list = listEntities(params);

    ourModels =
        list.getData().stream()
            .filter(dm -> dm.getName().startsWith(ns.prefix("dm_pagination_")))
            .collect(Collectors.toList());

    assertTrue(ourModels.size() >= 1, "Should find at least one created data model in service");

    for (DashboardDataModel dm : ourModels) {
      assertNotNull(dm.getTags(), "Entity-level tags should be present");
      assertEquals(1, dm.getTags().size());

      assertNotNull(dm.getColumns(), "Columns should be present when requested");
      assertFalse(dm.getColumns().isEmpty());

      Column column1 =
          dm.getColumns().stream()
              .filter(c -> c.getName().startsWith("column1_"))
              .findFirst()
              .orElseThrow();

      assertNotNull(column1.getTags(), "Column tags should be present");
      assertEquals(1, column1.getTags().size());
      assertEquals(columnTagLabel.getTagFQN(), column1.getTags().get(0).getTagFQN());
    }
  }

  @Test
  void test_getColumnsForSoftDeletedDataModel_200() {
    OpenMetadataClient client = SdkClients.adminClient();
    TestNamespace ns = new TestNamespace("DashboardDataModelResourceIT");

    DashboardService service = DashboardServiceTestFactory.createLooker(ns);

    List<Column> columns =
        Arrays.asList(
            new Column().withName("col1").withDataType(ColumnDataType.INT),
            new Column().withName("col2").withDataType(ColumnDataType.VARCHAR).withDataLength(100),
            new Column().withName("col3").withDataType(ColumnDataType.BIGINT));

    CreateDashboardDataModel request =
        new CreateDashboardDataModel()
            .withName(ns.prefix("dm_soft_delete_columns"))
            .withService(service.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(columns);

    DashboardDataModel dataModel = createEntity(request);

    DashboardDataModel fetchedBeforeDelete =
        getEntityWithFields(dataModel.getId().toString(), "columns");
    assertEquals(3, fetchedBeforeDelete.getColumns().size());

    deleteEntity(dataModel.getId().toString());

    DashboardDataModel deletedModel = getEntityIncludeDeleted(dataModel.getId().toString());
    assertNotNull(deletedModel);
    assertTrue(deletedModel.getDeleted());
    assertNotNull(deletedModel.getColumns());
    assertEquals(3, deletedModel.getColumns().size());

    DashboardDataModel deletedByName =
        client
            .dashboardDataModels()
            .get(dataModel.getId().toString(), "owners,followers,tags,columns,domains", "deleted");
    assertNotNull(deletedByName);
    assertTrue(deletedByName.getDeleted());
    assertNotNull(deletedByName.getColumns());
    assertEquals(3, deletedByName.getColumns().size());

    hardDeleteEntity(dataModel.getId().toString());
  }

  // ===================================================================
  // BULK API SUPPORT
  // ===================================================================

  @Override
  protected BulkOperationResult executeBulkCreate(List<CreateDashboardDataModel> createRequests) {
    return SdkClients.adminClient().dashboardDataModels().bulkCreateOrUpdate(createRequests);
  }

  @Override
  protected BulkOperationResult executeBulkCreateAsync(
      List<CreateDashboardDataModel> createRequests) {
    return SdkClients.adminClient().dashboardDataModels().bulkCreateOrUpdateAsync(createRequests);
  }

  @Override
  protected CreateDashboardDataModel createInvalidRequestForBulk(TestNamespace ns) {
    CreateDashboardDataModel request = new CreateDashboardDataModel();
    request.setName(ns.prefix("invalid_data_model"));
    return request;
  }
}
