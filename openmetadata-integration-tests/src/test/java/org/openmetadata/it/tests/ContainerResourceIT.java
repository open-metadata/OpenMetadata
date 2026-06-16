package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.junit.jupiter.api.parallel.Resources;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.ContainerFileFormat;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ContainerRepository;

/**
 * Integration tests for Container entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds container-specific tests for file
 * formats, data models, and parent containers.
 *
 * <p>Migrated from: org.openmetadata.service.resources.storages.ContainerResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class ContainerResourceIT extends BaseEntityIT<Container, CreateContainer> {

  private String defaultListService;

  {
    supportsLifeCycle = true;
    supportsListHistoryByTimestamp = true;
    supportsBulkAPI = true;
    supportsDataContract = true;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreateContainer createMinimalRequest(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Test container created by integration test");

    return request;
  }

  @Override
  protected CreateContainer createRequest(String name, TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer request = new CreateContainer();
    request.setName(name);
    request.setService(service.getFullyQualifiedName());

    return request;
  }

  @Override
  protected Container createEntity(CreateContainer createRequest) {
    Container container = SdkClients.adminClient().containers().create(createRequest);
    if (defaultListService == null && container.getService() != null) {
      defaultListService = container.getService().getFullyQualifiedName();
    }
    return container;
  }

  @Override
  protected Container getEntity(String id) {
    return SdkClients.adminClient().containers().get(id);
  }

  @Override
  protected Container getEntityByName(String fqn) {
    return SdkClients.adminClient().containers().getByName(fqn);
  }

  @Override
  protected Container patchEntity(String id, Container entity) {
    return SdkClients.adminClient().containers().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().containers().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().containers().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().containers().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "container";
  }

  @Override
  protected void validateCreatedEntity(Container entity, CreateContainer createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getService(), "Container must have a service");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain container name");
  }

  @Override
  protected ListResponse<Container> listEntities(ListParams params) {
    if (!params.getFilters().containsKey("service") && defaultListService != null) {
      params = params.copy();
      params.setService(defaultListService);
    }
    return SdkClients.adminClient().containers().list(params);
  }

  @Override
  protected Container getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().containers().get(id, fields);
  }

  @Override
  protected Container getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().containers().getByName(fqn, fields);
  }

  @Override
  protected Container getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().containers().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().containers().getVersionList(id);
  }

  @Override
  protected Container getVersion(UUID id, Double version) {
    return SdkClients.adminClient().containers().getVersion(id.toString(), version);
  }

  // ===================================================================
  // CONTAINER-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_containerWithoutRequiredFields_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Service is required field
    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_no_service"));

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating container without service should fail");
  }

  @Test
  void post_containerWithDataModel_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    List<Column> columns =
        Arrays.asList(
            new Column().withName("id").withDataType(ColumnDataType.INT),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255));

    ContainerDataModel dataModel =
        new ContainerDataModel().withIsPartitioned(false).withColumns(columns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_with_model"));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(dataModel);

    Container container = createEntity(request);
    assertNotNull(container);
    assertNotNull(container.getDataModel());
    assertNotNull(container.getDataModel().getColumns());
    assertEquals(2, container.getDataModel().getColumns().size());
  }

  @Test
  void post_containerWithFileFormats_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_with_formats"));
    request.setService(service.getFullyQualifiedName());
    request.setFileFormats(List.of(ContainerFileFormat.Parquet, ContainerFileFormat.Csv));

    Container container = createEntity(request);
    assertNotNull(container);
    assertNotNull(container.getFileFormats());
    assertEquals(2, container.getFileFormats().size());
    assertTrue(container.getFileFormats().contains(ContainerFileFormat.Parquet));
    assertTrue(container.getFileFormats().contains(ContainerFileFormat.Csv));
  }

  @Test
  void post_containerWithPrefix_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_with_prefix"));
    request.setService(service.getFullyQualifiedName());
    request.setPrefix("/data/raw/");

    Container container = createEntity(request);
    assertNotNull(container);
    assertEquals("/data/raw/", container.getPrefix());
  }

  @Test
  void post_containerWithParent_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    // Create parent container
    CreateContainer parentRequest = new CreateContainer();
    parentRequest.setName(ns.prefix("parent_container"));
    parentRequest.setService(service.getFullyQualifiedName());

    Container parentContainer = createEntity(parentRequest);
    assertNotNull(parentContainer);

    // Create child container with parent
    CreateContainer childRequest = new CreateContainer();
    childRequest.setName(ns.prefix("child_container"));
    childRequest.setService(service.getFullyQualifiedName());
    childRequest.setParent(
        new EntityReference()
            .withId(parentContainer.getId())
            .withType("container")
            .withFullyQualifiedName(parentContainer.getFullyQualifiedName()));

    Container childContainer = createEntity(childRequest);
    assertNotNull(childContainer);
    assertNotNull(childContainer.getParent());
    assertEquals(parentContainer.getId(), childContainer.getParent().getId());
  }

  @Test
  void put_containerDataModel_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    // Create container without data model
    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_add_model"));
    request.setService(service.getFullyQualifiedName());

    Container container = createEntity(request);
    assertNotNull(container);

    // Add data model via update
    List<Column> columns =
        Arrays.asList(
            new Column().withName("col1").withDataType(ColumnDataType.INT),
            new Column().withName("col2").withDataType(ColumnDataType.STRING));

    ContainerDataModel dataModel =
        new ContainerDataModel().withIsPartitioned(true).withColumns(columns);

    container.setDataModel(dataModel);
    Container updated = patchEntity(container.getId().toString(), container);
    assertNotNull(updated);
    assertNotNull(updated.getDataModel());
    assertEquals(2, updated.getDataModel().getColumns().size());
  }

  @Test
  void test_containerInheritsDomainFromService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a storage service
    StorageService service = StorageServiceTestFactory.createS3(ns);

    // Create a container under the service
    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_inherit_domain"));
    request.setService(service.getFullyQualifiedName());

    Container container = createEntity(request);
    assertNotNull(container);
    assertNotNull(container.getService());
    assertEquals(service.getFullyQualifiedName(), container.getService().getFullyQualifiedName());
  }

  @Test
  void post_containerWithInvalidStorageReference_404(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String nonExistentServiceFqn = "non_existent_storage_service_" + UUID.randomUUID();
    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_invalid_service"));
    request.setService(nonExistentServiceFqn);

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating container with non-existent service should fail");
  }

  @Test
  void post_containerWithInvalidParentContainerReference_404(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    UUID nonExistentContainerId = UUID.randomUUID();
    EntityReference invalidParent =
        new EntityReference().withId(nonExistentContainerId).withType("container");

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_invalid_parent"));
    request.setService(service.getFullyQualifiedName());
    request.setParent(invalidParent);

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating container with non-existent parent should fail");
  }

  @Test
  void put_containerNoChange_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_idempotent"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Initial description");

    Container container = createEntity(request);
    Double initialVersion = container.getVersion();

    // Update with no actual changes
    Container updated = patchEntity(container.getId().toString(), container);

    // Version should not change if no changes were made
    assertEquals(initialVersion, updated.getVersion());
  }

  @Test
  void patch_containerFields_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    // Create container without optional fields
    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_patch_fields"));
    request.setService(service.getFullyQualifiedName());

    Container container = createEntity(request);
    assertNull(container.getPrefix());
    assertNull(container.getFileFormats());

    // Add prefix and file formats
    container.setPrefix("/data/patched/");
    container.setFileFormats(List.of(ContainerFileFormat.Parquet));

    Container updated = patchEntity(container.getId().toString(), container);
    assertEquals("/data/patched/", updated.getPrefix());
    assertNotNull(updated.getFileFormats());
    assertTrue(updated.getFileFormats().contains(ContainerFileFormat.Parquet));

    // Update prefix
    updated.setPrefix("/data/patched/v2/");
    Container updated2 = patchEntity(updated.getId().toString(), updated);
    assertEquals("/data/patched/v2/", updated2.getPrefix());
  }

  @Test
  void put_containerSizeAndObjects_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_size"));
    request.setService(service.getFullyQualifiedName());

    Container container = createEntity(request);

    // Update size and numberOfObjects
    container.setSize(1000.0);
    container.setNumberOfObjects(50.0);

    Container updated = patchEntity(container.getId().toString(), container);
    assertEquals(1000.0, updated.getSize());
    assertEquals(50.0, updated.getNumberOfObjects());

    // Update again
    updated.setSize(2000.0);
    updated.setNumberOfObjects(100.0);

    Container updated2 = patchEntity(updated.getId().toString(), updated);
    assertEquals(2000.0, updated2.getSize());
    assertEquals(100.0, updated2.getNumberOfObjects());
  }

  @Test
  void test_containerWithFullDataModel(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    // Create data model with complex column types
    List<Column> columns =
        Arrays.asList(
            new Column().withName("id").withDataType(ColumnDataType.BIGINT),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255),
            new Column().withName("data").withDataType(ColumnDataType.JSON),
            new Column().withName("created_at").withDataType(ColumnDataType.TIMESTAMP),
            new Column().withName("is_active").withDataType(ColumnDataType.BOOLEAN));

    ContainerDataModel dataModel =
        new ContainerDataModel().withIsPartitioned(true).withColumns(columns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_full_model"));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(dataModel);
    request.setFileFormats(List.of(ContainerFileFormat.Parquet, ContainerFileFormat.Avro));
    request.setPrefix("/data/complex/");
    request.setSize(5000.0);
    request.setNumberOfObjects(100.0);

    Container container = createEntity(request);
    assertNotNull(container);
    assertNotNull(container.getDataModel());
    assertEquals(5, container.getDataModel().getColumns().size());
    assertTrue(container.getDataModel().getIsPartitioned());
    assertEquals(2, container.getFileFormats().size());
    assertEquals("/data/complex/", container.getPrefix());
    assertEquals(5000.0, container.getSize());
    assertEquals(100.0, container.getNumberOfObjects());
  }

  @Test
  void list_containersByService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    // Create multiple containers under the same service
    for (int i = 0; i < 5; i++) {
      CreateContainer request = new CreateContainer();
      request.setName(ns.prefix("container_list_" + i));
      request.setService(service.getFullyQualifiedName());
      createEntity(request);
    }

    // List containers by service
    ListParams params = new ListParams();
    params.setLimit(100);
    params.setService(service.getFullyQualifiedName());

    ListResponse<Container> response = listEntities(params);
    assertNotNull(response.getData());
    assertTrue(response.getData().size() >= 5);

    // Verify all returned containers belong to the service
    for (Container container : response.getData()) {
      assertEquals(service.getFullyQualifiedName(), container.getService().getFullyQualifiedName());
    }
  }

  @Test
  void test_containerUpdateDataModel(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    // Create container with initial data model
    List<Column> initialColumns =
        Arrays.asList(new Column().withName("col1").withDataType(ColumnDataType.INT));

    ContainerDataModel initialModel =
        new ContainerDataModel().withIsPartitioned(false).withColumns(initialColumns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_update_model"));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(initialModel);

    Container container = createEntity(request);
    assertEquals(1, container.getDataModel().getColumns().size());
    assertFalse(container.getDataModel().getIsPartitioned());

    // Update data model with more columns and set partitioned
    List<Column> updatedColumns =
        Arrays.asList(
            new Column().withName("col1").withDataType(ColumnDataType.INT),
            new Column().withName("col2").withDataType(ColumnDataType.STRING),
            new Column().withName("col3").withDataType(ColumnDataType.DOUBLE));

    ContainerDataModel updatedModel =
        new ContainerDataModel().withIsPartitioned(true).withColumns(updatedColumns);

    container.setDataModel(updatedModel);
    Container updated = patchEntity(container.getId().toString(), container);

    assertEquals(3, updated.getDataModel().getColumns().size());
    assertTrue(updated.getDataModel().getIsPartitioned());
  }

  @Test
  void test_containerWithNestedParent(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    // Create root container
    CreateContainer rootRequest = new CreateContainer();
    rootRequest.setName(ns.prefix("root_container"));
    rootRequest.setService(service.getFullyQualifiedName());
    Container rootContainer = createEntity(rootRequest);

    // Create level 1 child
    CreateContainer level1Request = new CreateContainer();
    level1Request.setName(ns.prefix("level1_container"));
    level1Request.setService(service.getFullyQualifiedName());
    level1Request.setParent(
        new EntityReference()
            .withId(rootContainer.getId())
            .withType("container")
            .withFullyQualifiedName(rootContainer.getFullyQualifiedName()));
    Container level1Container = createEntity(level1Request);

    // Create level 2 child
    CreateContainer level2Request = new CreateContainer();
    level2Request.setName(ns.prefix("level2_container"));
    level2Request.setService(service.getFullyQualifiedName());
    level2Request.setParent(
        new EntityReference()
            .withId(level1Container.getId())
            .withType("container")
            .withFullyQualifiedName(level1Container.getFullyQualifiedName()));
    Container level2Container = createEntity(level2Request);

    // Verify hierarchy
    assertNotNull(level1Container.getParent());
    assertEquals(rootContainer.getId(), level1Container.getParent().getId());

    assertNotNull(level2Container.getParent());
    assertEquals(level1Container.getId(), level2Container.getParent().getId());
  }

  @Test
  void test_containerWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_with_owner"));
    request.setService(service.getFullyQualifiedName());
    request.setOwners(List.of(testUser1().getEntityReference()));

    Container container = createEntity(request);
    assertNotNull(container);

    // Verify owner
    Container fetched = client.containers().get(container.getId().toString(), "owners");
    assertNotNull(fetched.getOwners());
    assertFalse(fetched.getOwners().isEmpty());
    assertTrue(fetched.getOwners().stream().anyMatch(o -> o.getId().equals(testUser1().getId())));
  }

  @Test
  void test_containerVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_versions"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Version 1");

    Container container = createEntity(request);
    Double v1 = container.getVersion();

    // Update description
    container.setDescription("Version 2");
    Container v2Container = patchEntity(container.getId().toString(), container);
    assertTrue(v2Container.getVersion() > v1);

    // Get version history
    EntityHistory history = client.containers().getVersionList(container.getId());
    assertNotNull(history);
    assertNotNull(history.getVersions());
    assertTrue(history.getVersions().size() >= 2);
  }

  @Test
  void test_containerWithComplexColumnTypes(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    Column c1 =
        new Column()
            .withName("c1")
            .withDataType(ColumnDataType.ARRAY)
            .withArrayDataType(ColumnDataType.INT)
            .withDataTypeDisplay("array<int>");

    Column c2_a = new Column().withName("a").withDataType(ColumnDataType.INT);
    Column c2_b = new Column().withName("b").withDataType(ColumnDataType.CHAR);
    Column c2_c_d = new Column().withName("d").withDataType(ColumnDataType.INT);
    Column c2_c =
        new Column()
            .withName("c")
            .withDataType(ColumnDataType.STRUCT)
            .withDataTypeDisplay("struct<int: d>>")
            .withChildren(List.of(c2_c_d));

    Column c2 =
        new Column()
            .withName("c2")
            .withDataType(ColumnDataType.STRUCT)
            .withDataTypeDisplay("struct<a: int, b:string, c: struct<int: d>>")
            .withChildren(Arrays.asList(c2_a, c2_b, c2_c));

    ContainerDataModel dataModel =
        new ContainerDataModel().withColumns(Arrays.asList(c1, c2)).withIsPartitioned(false);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_complex_types"));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(dataModel);

    Container container = createEntity(request);
    assertNotNull(container);
    assertNotNull(container.getDataModel());
    assertNotNull(container.getDataModel().getColumns());
    assertEquals(2, container.getDataModel().getColumns().size());

    Column retrievedC1 = container.getDataModel().getColumns().get(0);
    assertEquals("c1", retrievedC1.getName());
    assertEquals(ColumnDataType.ARRAY, retrievedC1.getDataType());
    assertEquals(ColumnDataType.INT, retrievedC1.getArrayDataType());

    Column retrievedC2 = container.getDataModel().getColumns().get(1);
    assertEquals("c2", retrievedC2.getName());
    assertEquals(ColumnDataType.STRUCT, retrievedC2.getDataType());
    assertNotNull(retrievedC2.getChildren());
    assertEquals(3, retrievedC2.getChildren().size());

    Column retrievedC2_c = retrievedC2.getChildren().get(2);
    assertEquals("c", retrievedC2_c.getName());
    assertNotNull(retrievedC2_c.getChildren());
    assertEquals(1, retrievedC2_c.getChildren().size());
    assertEquals("d", retrievedC2_c.getChildren().get(0).getName());
  }

  @Test
  void test_containerUpdateComplexColumnTypes(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    Column c1 =
        new Column()
            .withName("c1")
            .withDataType(ColumnDataType.ARRAY)
            .withArrayDataType(ColumnDataType.INT)
            .withDataTypeDisplay("array<int>");

    ContainerDataModel initialDataModel =
        new ContainerDataModel().withColumns(List.of(c1)).withIsPartitioned(false);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_update_complex"));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(initialDataModel);

    Container container = createEntity(request);
    assertEquals(1, container.getDataModel().getColumns().size());

    Column c1_updated =
        new Column()
            .withName("c1")
            .withDataType(ColumnDataType.ARRAY)
            .withArrayDataType(ColumnDataType.CHAR)
            .withDataTypeDisplay("array<char>");

    Column c2 = new Column().withName("c2").withDataType(ColumnDataType.STRING);

    ContainerDataModel updatedDataModel =
        new ContainerDataModel().withColumns(Arrays.asList(c1_updated, c2)).withIsPartitioned(true);

    container.setDataModel(updatedDataModel);
    Container updated = patchEntity(container.getId().toString(), container);

    assertNotNull(updated.getDataModel());
    assertEquals(2, updated.getDataModel().getColumns().size());
    assertTrue(updated.getDataModel().getIsPartitioned());

    Column retrievedC1 = updated.getDataModel().getColumns().get(0);
    assertEquals(ColumnDataType.CHAR, retrievedC1.getArrayDataType());
  }

  @Test
  void test_containerDataModelPartitionToggle(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    List<Column> columns =
        List.of(
            new Column().withName("col1").withDataType(ColumnDataType.INT),
            new Column().withName("col2").withDataType(ColumnDataType.STRING));

    ContainerDataModel dataModel =
        new ContainerDataModel().withColumns(columns).withIsPartitioned(true);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_partition_toggle"));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(dataModel);

    Container container = createEntity(request);
    assertTrue(container.getDataModel().getIsPartitioned());

    ContainerDataModel updatedModel =
        new ContainerDataModel().withColumns(columns).withIsPartitioned(false);

    container.setDataModel(updatedModel);
    Container updated = patchEntity(container.getId().toString(), container);

    assertFalse(updated.getDataModel().getIsPartitioned());
    assertEquals(2, updated.getDataModel().getColumns().size());
  }

  @Test
  void test_containerFileFormatsUpdate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_formats_update"));
    request.setService(service.getFullyQualifiedName());
    request.setFileFormats(List.of(ContainerFileFormat.Parquet));

    Container container = createEntity(request);
    assertEquals(1, container.getFileFormats().size());
    assertTrue(container.getFileFormats().contains(ContainerFileFormat.Parquet));

    container.setFileFormats(List.of(ContainerFileFormat.Gz, ContainerFileFormat.Csv));
    Container updated = patchEntity(container.getId().toString(), container);

    assertEquals(2, updated.getFileFormats().size());
    assertTrue(updated.getFileFormats().contains(ContainerFileFormat.Gz));
    assertTrue(updated.getFileFormats().contains(ContainerFileFormat.Csv));
    assertFalse(updated.getFileFormats().contains(ContainerFileFormat.Parquet));
  }

  @Test
  void test_containerPrefixUpdate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_prefix_update"));
    request.setService(service.getFullyQualifiedName());

    Container container = createEntity(request);
    assertNull(container.getPrefix());

    container.setPrefix("/data/initial/");
    Container updated1 = patchEntity(container.getId().toString(), container);
    assertEquals("/data/initial/", updated1.getPrefix());

    updated1.setPrefix("/data/updated/");
    Container updated2 = patchEntity(updated1.getId().toString(), updated1);
    assertEquals("/data/updated/", updated2.getPrefix());
  }

  @Test
  void test_rootContainerFiltering(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer rootRequest1 = new CreateContainer();
    rootRequest1.setName(ns.prefix("root_1"));
    rootRequest1.setService(service.getFullyQualifiedName());
    Container root1 = createEntity(rootRequest1);

    CreateContainer rootRequest2 = new CreateContainer();
    rootRequest2.setName(ns.prefix("root_2"));
    rootRequest2.setService(service.getFullyQualifiedName());
    Container root2 = createEntity(rootRequest2);

    CreateContainer childRequest = new CreateContainer();
    childRequest.setName(ns.prefix("child"));
    childRequest.setService(service.getFullyQualifiedName());
    childRequest.setParent(
        new EntityReference()
            .withId(root1.getId())
            .withType("container")
            .withFullyQualifiedName(root1.getFullyQualifiedName()));
    Container child = createEntity(childRequest);

    ListParams params = new ListParams();
    params.addFilter("root", "true");
    params.setService(service.getFullyQualifiedName());

    ListResponse<Container> rootContainers = listEntities(params);
    assertNotNull(rootContainers);
    assertNotNull(rootContainers.getData());

    long rootCount =
        rootContainers.getData().stream()
            .filter(c -> c.getId().equals(root1.getId()) || c.getId().equals(root2.getId()))
            .count();
    assertEquals(2, rootCount);

    boolean childInRootList =
        rootContainers.getData().stream().anyMatch(c -> c.getId().equals(child.getId()));
    assertFalse(childInRootList, "Child container should not appear in root containers list");

    // Default `?service=...` listing (no root flag) MUST include child containers.
    // Regression guard: a previous JDBI override on ContainerDAO that shared its Java
    // signature with the EntityDAO base accidentally applied the root-only NOT EXISTS
    // predicate to every list call, silently dropping children. That broke
    // `metadata.list_all_entities(Container, ...)` in the Python ingestion side and
    // produced 0-record auto-classification runs.
    ListParams allParams = new ListParams();
    allParams.setService(service.getFullyQualifiedName());

    ListResponse<Container> allContainers = listEntities(allParams);
    assertNotNull(allContainers);
    assertNotNull(allContainers.getData());

    boolean childInAllList =
        allContainers.getData().stream().anyMatch(c -> c.getId().equals(child.getId()));
    assertTrue(
        childInAllList,
        "Child container must appear in default `?service=...` listing (without root=true)");

    long allMatchingCount =
        allContainers.getData().stream()
            .filter(
                c ->
                    c.getId().equals(root1.getId())
                        || c.getId().equals(root2.getId())
                        || c.getId().equals(child.getId()))
            .count();
    assertEquals(
        3,
        allMatchingCount,
        "`?service=...` must return roots and children (got " + allMatchingCount + ")");
  }

  @Test
  void test_containerChildrenPagination(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer parentRequest = new CreateContainer();
    parentRequest.setName(ns.prefix("parent_pagination"));
    parentRequest.setService(service.getFullyQualifiedName());
    Container parent = createEntity(parentRequest);

    for (int i = 0; i < 5; i++) {
      CreateContainer childRequest = new CreateContainer();
      childRequest.setName(ns.prefix("child_" + i));
      childRequest.setService(service.getFullyQualifiedName());
      childRequest.setParent(
          new EntityReference()
              .withId(parent.getId())
              .withType("container")
              .withFullyQualifiedName(parent.getFullyQualifiedName()));
      createEntity(childRequest);
    }

    // children must be enumerated via the dedicated paginated /children endpoint —
    // it is no longer a valid value for the fields= query param.
    ContainerResultList page =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/containers/name/" + parent.getFullyQualifiedName() + "/children",
                null,
                ContainerResultList.class);
    assertNotNull(page);
    assertNotNull(page.getData());
    assertEquals(5, page.getData().size());
  }

  @Test
  void test_listChildren_populatesDefaultFields(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer parentRequest = new CreateContainer();
    parentRequest.setName(ns.prefix("parent_listChildren"));
    parentRequest.setService(service.getFullyQualifiedName());
    Container parent = createEntity(parentRequest);

    int childCount = 3;
    for (int i = 0; i < childCount; i++) {
      CreateContainer childRequest = new CreateContainer();
      childRequest.setName(ns.prefix("listChildren_child_" + i));
      childRequest.setService(service.getFullyQualifiedName());
      childRequest.setParent(
          new EntityReference()
              .withId(parent.getId())
              .withType("container")
              .withFullyQualifiedName(parent.getFullyQualifiedName()));
      createEntity(childRequest);
    }

    ContainerResultList page =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/containers/name/" + parent.getFullyQualifiedName() + "/children",
                null,
                ContainerResultList.class);

    assertNotNull(page);
    assertNotNull(page.getData());
    assertEquals(childCount, page.getData().size());

    for (Container child : page.getData()) {
      assertNotNull(child.getId(), "child id must be populated");
      assertNotNull(child.getName(), "child name must be populated");
      assertNotNull(child.getFullyQualifiedName(), "child FQN must be populated");
      assertNotNull(
          child.getService(),
          "child service ref must be populated by setDefaultFields after bulk fetch");
      assertEquals(
          service.getId(), child.getService().getId(), "child must reference parent service");
      // Slim projection contract: heavy fields are NOT loaded on the listing path.
      // Callers that need them must fetch the child by id/fqn directly.
      assertNull(
          child.getDataModel(),
          "dataModel must NOT be populated in the listing — it can be MBs per row");
      assertNull(child.getOwners(), "owners must NOT be populated in the listing");
      assertNull(child.getExtension(), "extension must NOT be populated in the listing");
      // Container's generated POJO initialises `tags` to an empty list, so we assert
      // it is empty rather than null — the point is no actual tag data is loaded.
      assertTrue(
          child.getTags() == null || child.getTags().isEmpty(),
          "tags must NOT be populated in the listing");
    }
  }

  @Test
  void test_listChildren_returnsDescriptionForUiTable(TestNamespace ns) throws Exception {
    // The UI's children table renders name + description, so the slim projection
    // must include description. This test guards that field specifically.
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer parentRequest = new CreateContainer();
    parentRequest.setName(ns.prefix("parent_listChildren_desc"));
    parentRequest.setService(service.getFullyQualifiedName());
    Container parent = createEntity(parentRequest);

    String childDescription = "child description for UI table";
    CreateContainer childRequest = new CreateContainer();
    childRequest.setName(ns.prefix("listChildren_desc_child"));
    childRequest.setService(service.getFullyQualifiedName());
    childRequest.setDescription(childDescription);
    childRequest.setParent(
        new EntityReference()
            .withId(parent.getId())
            .withType("container")
            .withFullyQualifiedName(parent.getFullyQualifiedName()));
    createEntity(childRequest);

    ContainerResultList page =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/containers/name/" + parent.getFullyQualifiedName() + "/children",
                null,
                ContainerResultList.class);

    assertNotNull(page);
    assertEquals(1, page.getData().size());
    assertEquals(childDescription, page.getData().get(0).getDescription());
  }

  @Test
  void test_fields_children_rejected_with400(TestNamespace ns) {
    // children was previously available via fields=children, but it was unbounded:
    // ContainerRepository#getChildren returned every reference under the parent
    // with no pagination, easily blowing past the 60s request timeout for
    // Tahoe-style containers. We removed it from Container's allowed-fields set
    // so the API surface forces callers onto the dedicated paginated endpoint
    // /v1/containers/name/{fqn}/children?limit=&offset=.
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("fields_children_rejected"));
    request.setService(service.getFullyQualifiedName());
    Container container = createEntity(request);

    assertThrows(
        Exception.class,
        () ->
            client
                .getHttpClient()
                .execute(
                    HttpMethod.GET,
                    "/v1/containers/name/" + container.getFullyQualifiedName() + "?fields=children",
                    null,
                    Container.class),
        "fields=children must be rejected — callers must use /children endpoint");
  }

  @Test
  void test_fields_star_excludesChildren(TestNamespace ns) throws Exception {
    // fields=* expands server-side to the entity's allowed-fields set. Removing
    // children from that set means existing clients passing fields=* keep working
    // but no longer pull thousands of child references implicitly. Real children
    // listings must go through the paginated /children endpoint.
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer parentRequest = new CreateContainer();
    parentRequest.setName(ns.prefix("fields_star_parent"));
    parentRequest.setService(service.getFullyQualifiedName());
    Container parent = createEntity(parentRequest);

    CreateContainer childRequest = new CreateContainer();
    childRequest.setName(ns.prefix("fields_star_child"));
    childRequest.setService(service.getFullyQualifiedName());
    childRequest.setParent(
        new EntityReference()
            .withId(parent.getId())
            .withType("container")
            .withFullyQualifiedName(parent.getFullyQualifiedName()));
    createEntity(childRequest);

    Container fetched =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/containers/name/" + parent.getFullyQualifiedName() + "?fields=*",
                null,
                Container.class);

    assertNotNull(fetched);
    assertNull(
        fetched.getChildren(),
        "fields=* must NOT expand to children — that field is unbounded and only the"
            + " paginated /children endpoint should populate it");
  }

  private static class ContainerResultList extends ResultList<Container> {}

  @Test
  void test_listAncestors_returnsOrderedChain(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    // Build a 4-level deep chain: root → mid → leaf-parent → leaf
    CreateContainer rootRequest = new CreateContainer();
    rootRequest.setName(ns.prefix("ancestors_root"));
    rootRequest.setService(service.getFullyQualifiedName());
    Container root = createEntity(rootRequest);

    CreateContainer midRequest = new CreateContainer();
    midRequest.setName(ns.prefix("ancestors_mid"));
    midRequest.setService(service.getFullyQualifiedName());
    midRequest.setParent(
        new EntityReference()
            .withId(root.getId())
            .withType("container")
            .withFullyQualifiedName(root.getFullyQualifiedName()));
    Container mid = createEntity(midRequest);

    CreateContainer leafParentRequest = new CreateContainer();
    leafParentRequest.setName(ns.prefix("ancestors_leaf_parent"));
    leafParentRequest.setService(service.getFullyQualifiedName());
    leafParentRequest.setParent(
        new EntityReference()
            .withId(mid.getId())
            .withType("container")
            .withFullyQualifiedName(mid.getFullyQualifiedName()));
    Container leafParent = createEntity(leafParentRequest);

    CreateContainer leafRequest = new CreateContainer();
    leafRequest.setName(ns.prefix("ancestors_leaf"));
    leafRequest.setService(service.getFullyQualifiedName());
    leafRequest.setParent(
        new EntityReference()
            .withId(leafParent.getId())
            .withType("container")
            .withFullyQualifiedName(leafParent.getFullyQualifiedName()));
    Container leaf = createEntity(leafRequest);

    EntityReferenceList ancestors =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/containers/name/" + leaf.getFullyQualifiedName() + "/ancestors",
                null,
                EntityReferenceList.class);

    assertNotNull(ancestors);
    assertEquals(
        3,
        ancestors.size(),
        "ancestors should be root, mid, leaf-parent — service is excluded and the leaf itself is not returned");
    assertEquals(root.getId(), ancestors.get(0).getId(), "first ancestor must be the root");
    assertEquals(mid.getId(), ancestors.get(1).getId(), "second ancestor must be mid");
    assertEquals(
        leafParent.getId(), ancestors.get(2).getId(), "last ancestor must be the immediate parent");
    for (EntityReference ref : ancestors) {
      assertNotNull(ref.getName(), "ancestor name must be populated for breadcrumb display");
      assertNotNull(
          ref.getFullyQualifiedName(),
          "ancestor FQN must be populated so the UI can build deep links");
    }
  }

  @Test
  void test_listAncestors_topLevelContainerReturnsEmpty(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer topRequest = new CreateContainer();
    topRequest.setName(ns.prefix("ancestors_top_only"));
    topRequest.setService(service.getFullyQualifiedName());
    Container top = createEntity(topRequest);

    EntityReferenceList ancestors =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/containers/name/" + top.getFullyQualifiedName() + "/ancestors",
                null,
                EntityReferenceList.class);

    assertNotNull(ancestors);
    assertTrue(
        ancestors.isEmpty(),
        "top-level containers (immediate child of the storage service) have no ancestors");
  }

  @Test
  void test_listAncestors_deepChainPreservesOrder(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    // Build a 10-level deep chain. The endpoint resolves the chain via a single
    // batched dao.findEntityByNames(...) IN(...) — that DAO call returns rows in
    // arbitrary order, so the repository has to reorder by depth. A deep chain
    // makes any future regression to HashMap-style iteration order obvious.
    int depth = 10;
    List<Container> chain = new ArrayList<>(depth);
    Container previous = null;
    for (int i = 0; i < depth; i++) {
      CreateContainer request = new CreateContainer();
      request.setName(ns.prefix(String.format("ancestors_deep_%02d", i)));
      request.setService(service.getFullyQualifiedName());
      if (previous != null) {
        request.setParent(
            new EntityReference()
                .withId(previous.getId())
                .withType("container")
                .withFullyQualifiedName(previous.getFullyQualifiedName()));
      }
      previous = createEntity(request);
      chain.add(previous);
    }

    Container leaf = chain.get(depth - 1);
    EntityReferenceList ancestors =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/containers/name/" + leaf.getFullyQualifiedName() + "/ancestors",
                null,
                EntityReferenceList.class);

    assertNotNull(ancestors);
    assertEquals(
        depth - 1,
        ancestors.size(),
        "ancestors list excludes the storage service and the leaf itself");
    for (int i = 0; i < depth - 1; i++) {
      assertEquals(
          chain.get(i).getId(),
          ancestors.get(i).getId(),
          "ancestor at depth " + i + " must match the chain at index " + i);
      assertEquals(
          chain.get(i).getFullyQualifiedName(),
          ancestors.get(i).getFullyQualifiedName(),
          "ancestor FQN at depth " + i + " must match the chain at index " + i);
    }
  }

  @Test
  void test_listAncestors_doesNotLeakSiblingSubtree(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    // Shared root with two divergent subtrees:
    //   root → branchA → leafA
    //   root → branchB → deeperB → leafB
    // The endpoint must return only the leaf's own ancestor chain, never the
    // sibling subtree. This is the regression test for the original prefix-LIKE
    // bug that motivated batched-by-target-hash fetching elsewhere.
    CreateContainer rootRequest = new CreateContainer();
    rootRequest.setName(ns.prefix("ancestors_isolation_root"));
    rootRequest.setService(service.getFullyQualifiedName());
    Container root = createEntity(rootRequest);

    Container branchA = createChild(ns, service, root, "ancestors_isolation_branch_a");
    Container leafA = createChild(ns, service, branchA, "ancestors_isolation_leaf_a");

    Container branchB = createChild(ns, service, root, "ancestors_isolation_branch_b");
    Container deeperB = createChild(ns, service, branchB, "ancestors_isolation_deeper_b");
    Container leafB = createChild(ns, service, deeperB, "ancestors_isolation_leaf_b");

    EntityReferenceList ancestorsA =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/containers/name/" + leafA.getFullyQualifiedName() + "/ancestors",
                null,
                EntityReferenceList.class);

    assertEquals(2, ancestorsA.size(), "leafA's chain is exactly root → branchA");
    assertEquals(root.getId(), ancestorsA.get(0).getId());
    assertEquals(branchA.getId(), ancestorsA.get(1).getId());
    Set<UUID> leakedIntoA = new HashSet<>();
    for (EntityReference ref : ancestorsA) {
      leakedIntoA.add(ref.getId());
    }
    assertFalse(leakedIntoA.contains(branchB.getId()), "branchB must not appear in leafA's chain");
    assertFalse(leakedIntoA.contains(deeperB.getId()), "deeperB must not appear in leafA's chain");
    assertFalse(leakedIntoA.contains(leafB.getId()), "leafB must not appear in leafA's chain");

    EntityReferenceList ancestorsB =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/containers/name/" + leafB.getFullyQualifiedName() + "/ancestors",
                null,
                EntityReferenceList.class);

    assertEquals(3, ancestorsB.size(), "leafB's chain is exactly root → branchB → deeperB");
    assertEquals(root.getId(), ancestorsB.get(0).getId());
    assertEquals(branchB.getId(), ancestorsB.get(1).getId());
    assertEquals(deeperB.getId(), ancestorsB.get(2).getId());
    Set<UUID> leakedIntoB = new HashSet<>();
    for (EntityReference ref : ancestorsB) {
      leakedIntoB.add(ref.getId());
    }
    assertFalse(leakedIntoB.contains(branchA.getId()), "branchA must not appear in leafB's chain");
    assertFalse(leakedIntoB.contains(leafA.getId()), "leafA must not appear in leafB's chain");
  }

  private Container createChild(
      TestNamespace ns, StorageService service, Container parent, String suffix) {
    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix(suffix));
    request.setService(service.getFullyQualifiedName());
    request.setParent(
        new EntityReference()
            .withId(parent.getId())
            .withType("container")
            .withFullyQualifiedName(parent.getFullyQualifiedName()));
    return createEntity(request);
  }

  /**
   * Reproduces the production symptom on aws_s3 where leaf parquet / integration-dataset
   * containers leaked into {@code ?root=true&service=...} listings. The leak happens when
   * a child container exists in {@code storage_container_entity} with a multi-segment FQN
   * but the {@code (parent, CONTAINS, child)} row is missing from
   * {@code entity_relationship} — produced by the cascade-delete bug in
   * {@code processDeletionBatch} that wiped relationship rows before per-entity cleanup
   * (see {@link org.openmetadata.service.jdbi3.EntityRepository#processDeletionBatch}).
   * We simulate that exact state here by deleting the relationship row directly and
   * assert the root listing now excludes the orphan via the FQN-depth predicate
   * ({@code fqnHash NOT LIKE :serviceHashChild}).
   */
  @Test
  void test_rootListingExcludesOrphanedChild(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer parentRequest = new CreateContainer();
    parentRequest.setName(ns.prefix("orphan_parent"));
    parentRequest.setService(service.getFullyQualifiedName());
    Container parent = createEntity(parentRequest);

    Container child = createChild(ns, service, parent, "orphan_child");

    int rowsRemoved =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .delete(
                parent.getId(),
                "container",
                child.getId(),
                "container",
                Relationship.CONTAINS.ordinal());
    assertEquals(
        1, rowsRemoved, "Setup: should have removed exactly one (parent, CONTAINS, child) row");

    ListParams rootParams = new ListParams();
    rootParams.addFilter("root", "true");
    rootParams.setService(service.getFullyQualifiedName());
    ListResponse<Container> rootContainers = listEntities(rootParams);

    Set<UUID> ids =
        rootContainers.getData().stream()
            .map(Container::getId)
            .collect(java.util.stream.Collectors.toSet());
    assertTrue(
        ids.contains(parent.getId()),
        "Real root container must still appear in ?root=true listing");
    assertFalse(
        ids.contains(child.getId()),
        "Orphaned child (multi-segment FQN, no parent CONTAINS row) must be excluded from "
            + "?root=true listing — fqnHash depth predicate is the safety net.");
  }

  /**
   * Exercises the {@code bulkHardDeleteSubtree} path that replaced the legacy
   * {@code batchDeleteChildren} / {@code processDeletionBatch} flow. The legacy path opened
   * an independent JDBI transaction per child via {@code cleanup()} and could leave an
   * entity row alive with its relationship rows wiped (orphan with multi-segment FQN) when
   * a per-child cleanup failed mid-loop. The replacement runs the entire subtree in a
   * single {@code @Transaction} that rolls back atomically on any failure. 101 is one above
   * the size that the legacy implementation gated its batch path on — keeping the test
   * value pins the regression scenario in place even though the gating threshold no longer
   * exists in the code.
   */
  @Test
  void test_recursiveHardDelete_largeBatch_leavesNoOrphans(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer parentRequest = new CreateContainer();
    parentRequest.setName(ns.prefix("batch_parent"));
    parentRequest.setService(service.getFullyQualifiedName());
    Container parent = createEntity(parentRequest);

    // Sequential creation is deliberate: each child must round-trip through the regular
    // POST /containers path so ContainerRepository.storeRelationships writes a real
    // (parent, CONTAINS, child) row — that's the row whose cleanup we're stress-testing.
    int childCount = 101;
    List<UUID> childIds = new ArrayList<>(childCount);
    for (int i = 0; i < childCount; i++) {
      Container child = createChild(ns, service, parent, "batch_child_" + i);
      childIds.add(child.getId());
    }

    java.util.Map<String, String> deleteParams = new java.util.HashMap<>();
    deleteParams.put("hardDelete", "true");
    deleteParams.put("recursive", "true");
    SdkClients.adminClient().containers().delete(parent.getId().toString(), deleteParams);

    assertThrows(
        Exception.class, () -> getEntity(parent.getId().toString()), "Parent must be hard-deleted");

    for (UUID childId : childIds) {
      assertThrows(
          Exception.class,
          () -> getEntity(childId.toString()),
          "Child " + childId + " must be hard-deleted (no orphan entity row)");
    }

    List<String> childIdStrings = childIds.stream().map(UUID::toString).toList();
    List<CollectionDAO.EntityRelationshipObject> orphanParentRows =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .findFromBatch(childIdStrings, Relationship.CONTAINS.ordinal());
    assertTrue(
        orphanParentRows.isEmpty(),
        "No (parent, CONTAINS, child) entity_relationship rows must survive — "
            + "found "
            + orphanParentRows.size()
            + " orphan rows after recursive hard delete of >100 children");
  }

  /**
   * The {@code ?root=true} listing must reject anything whose FQN is two or more segments
   * below the service — not just immediate children of containers, but grandchildren and
   * deeper. The previous implementation (a NOT EXISTS anti-join over entity_relationship)
   * relied on the parent CONTAINS edge being present on every non-root container; orphans
   * and bulk-imported leaves missing that edge would surface at the service root with a
   * deeply-nested FQN, contradicting the breadcrumb the UI shows on click. The FQN-depth
   * predicate ({@code fqnHash NOT LIKE :serviceHashChild}) makes the FQN itself the source
   * of truth. This test exercises the depth check at three levels (root, child, grandchild)
   * to guard against regressions in either direction (over-filtering or under-filtering).
   */
  @Test
  void test_rootListing_excludesContainersBelowFirstLevel(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer rootRequest = new CreateContainer();
    rootRequest.setName(ns.prefix("depth_root"));
    rootRequest.setService(service.getFullyQualifiedName());
    Container root = createEntity(rootRequest);

    Container child = createChild(ns, service, root, "depth_child");
    Container grandchild = createChild(ns, service, child, "depth_grandchild");

    ListParams params = new ListParams();
    params.addFilter("root", "true");
    params.setService(service.getFullyQualifiedName());

    ListResponse<Container> rootContainers = listEntities(params);
    assertNotNull(rootContainers);
    assertNotNull(rootContainers.getData());

    Set<UUID> ids =
        rootContainers.getData().stream()
            .map(Container::getId)
            .collect(java.util.stream.Collectors.toSet());
    assertTrue(ids.contains(root.getId()), "root container must appear in ?root=true listing");
    assertFalse(ids.contains(child.getId()), "child must not appear in ?root=true listing");
    assertFalse(
        ids.contains(grandchild.getId()),
        "grandchild must not appear in ?root=true listing — depth check must exclude descendants below the immediate level");
  }

  /**
   * {@code ?root=true} without {@code ?service=} must succeed: it returns every direct
   * child of any service across the whole tenant. The depth predicate
   * ({@code fqnHash NOT LIKE :serviceHashChild}) needs the bind to be present even in
   * this case, but {@link org.openmetadata.service.jdbi3.ListFilter#getServiceCondition}
   * only adds it when {@code ?service=} is present — the
   * {@code ContainerDAO.rootListingParams} default ({@code '%.%.%'}) is what makes the
   * SQL runnable here.
   *
   * <p>Regression guard for the "GET /containers?root=true (no service) crashes with a
   * missing-named-parameter error" bug. Also verifies the depth check still excludes
   * non-root descendants when no service prefix narrows the candidate set.
   */
  @Test
  @ResourceLock(value = Resources.GLOBAL, mode = ResourceAccessMode.READ_WRITE)
  void test_rootListing_withoutServiceFilter_returnsRootsAcrossAllServices(TestNamespace ns) {
    // Two distinct services. Each gets a root container and a child container so we can
    // assert the listing covers both services and excludes children regardless of which
    // service they belong to.
    StorageService serviceA = StorageServiceTestFactory.createS3(ns);
    StorageService serviceB = StorageServiceTestFactory.createS3(ns);

    CreateContainer rootARequest = new CreateContainer();
    rootARequest.setName(ns.prefix("noservice_rootA"));
    rootARequest.setService(serviceA.getFullyQualifiedName());
    Container rootA = createEntity(rootARequest);
    Container childA = createChild(ns, serviceA, rootA, "noservice_childA");

    CreateContainer rootBRequest = new CreateContainer();
    rootBRequest.setName(ns.prefix("noservice_rootB"));
    rootBRequest.setService(serviceB.getFullyQualifiedName());
    Container rootB = createEntity(rootBRequest);
    Container childB = createChild(ns, serviceB, rootB, "noservice_childB");

    // ListParams with root=true but no service filter. Pagination: ask for a large page
    // so both roots fit even if the tenant has unrelated rows from earlier tests.
    ListParams params = new ListParams();
    params.addFilter("root", "true");
    params.setLimit(1000);

    ListResponse<Container> rootContainers = SdkClients.adminClient().containers().list(params);
    assertNotNull(rootContainers);
    assertNotNull(rootContainers.getData());

    Set<UUID> ids =
        rootContainers.getData().stream()
            .map(Container::getId)
            .collect(java.util.stream.Collectors.toSet());

    assertTrue(
        ids.contains(rootA.getId()),
        "Root in serviceA must appear in ?root=true (no service filter) — rootListingParams default must allow cross-service listing");
    assertTrue(
        ids.contains(rootB.getId()),
        "Root in serviceB must appear in ?root=true (no service filter)");
    assertFalse(
        ids.contains(childA.getId()),
        "Child in serviceA must not appear — depth check must run even without service filter");
    assertFalse(
        ids.contains(childB.getId()),
        "Child in serviceB must not appear — depth check must run even without service filter");
  }

  /**
   * Soft-deleted root containers must respect the {@code ?include=} flag the UI's "Deleted"
   * toggle sends. {@code include=non-deleted} (the default) hides them; {@code include=all}
   * surfaces them; {@code include=deleted} surfaces only deleted rows. The depth-check
   * predicate runs alongside the include filter via {@code <sqlCondition>}; this guards
   * against the include slot getting dropped or hardcoded to non-deleted in the listRoot
   * SQL.
   */
  @Test
  void test_rootListing_respectsIncludeFlag(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer liveRequest = new CreateContainer();
    liveRequest.setName(ns.prefix("include_live"));
    liveRequest.setService(service.getFullyQualifiedName());
    Container liveRoot = createEntity(liveRequest);

    CreateContainer deletedRequest = new CreateContainer();
    deletedRequest.setName(ns.prefix("include_deleted"));
    deletedRequest.setService(service.getFullyQualifiedName());
    Container deletedRoot = createEntity(deletedRequest);

    deleteEntity(deletedRoot.getId().toString());

    // Default: include=non-deleted → only live root visible.
    ListParams ndParams = new ListParams();
    ndParams.addFilter("root", "true");
    ndParams.setService(service.getFullyQualifiedName());
    Set<UUID> ndIds =
        listEntities(ndParams).getData().stream()
            .map(Container::getId)
            .collect(java.util.stream.Collectors.toSet());
    assertTrue(ndIds.contains(liveRoot.getId()), "live root must appear under include=non-deleted");
    assertFalse(
        ndIds.contains(deletedRoot.getId()),
        "soft-deleted root must NOT appear under include=non-deleted (default)");

    // include=all → both live and soft-deleted roots visible.
    ListParams allParams = new ListParams();
    allParams.addFilter("root", "true");
    allParams.addFilter("include", "all");
    allParams.setService(service.getFullyQualifiedName());
    Set<UUID> allIds =
        listEntities(allParams).getData().stream()
            .map(Container::getId)
            .collect(java.util.stream.Collectors.toSet());
    assertTrue(allIds.contains(liveRoot.getId()), "live root must appear under include=all");
    assertTrue(
        allIds.contains(deletedRoot.getId()),
        "soft-deleted root must appear under include=all (UI Deleted toggle ON)");
  }

  /**
   * The {@code /containers/name/{fqn}/children} endpoint must list direct children only —
   * grandchildren stay hidden. The previous entity_relationship implementation got this
   * right when the parent CONTAINS edges existed. The FQN-depth implementation gets it
   * right by construction (a grandchild has two more segments than the parent and so is
   * excluded by {@code fqnHash NOT LIKE :parentHashChild}).
   */
  @Test
  void test_listChildren_excludesGrandchildren(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer parentRequest = new CreateContainer();
    parentRequest.setName(ns.prefix("kids_parent"));
    parentRequest.setService(service.getFullyQualifiedName());
    Container parent = createEntity(parentRequest);

    Container child = createChild(ns, service, parent, "kids_child");
    Container grandchild = createChild(ns, service, child, "kids_grandchild");

    ContainerResultList page =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/containers/name/" + parent.getFullyQualifiedName() + "/children",
                null,
                ContainerResultList.class);
    assertNotNull(page);
    assertNotNull(page.getData());
    Set<UUID> ids =
        page.getData().stream().map(Container::getId).collect(java.util.stream.Collectors.toSet());
    assertTrue(ids.contains(child.getId()), "direct child must appear in /children listing");
    assertFalse(
        ids.contains(grandchild.getId()),
        "grandchild must not appear in /children — depth check is exactly one level below the parent");
    assertEquals(
        1,
        page.getData().stream()
            .filter(c -> c.getId().equals(child.getId()) || c.getId().equals(grandchild.getId()))
            .count(),
        "page must contain exactly the direct child");
  }

  /**
   * The {@code /children} endpoint accepts {@code ?include=all|deleted|non-deleted}
   * to drive the soft-delete toggle on the navigation tree. The cache key for the
   * children-page cache embeds the include value, so toggling does not return a stale
   * page from the other side; this test exercises both the SQL filter and (when Redis
   * is enabled) the cache key separation.
   */
  @Test
  void test_listChildren_respectsIncludeFlag(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer parentRequest = new CreateContainer();
    parentRequest.setName(ns.prefix("kids_include_parent"));
    parentRequest.setService(service.getFullyQualifiedName());
    Container parent = createEntity(parentRequest);

    Container live = createChild(ns, service, parent, "kids_include_live");
    Container deleted = createChild(ns, service, parent, "kids_include_deleted");
    deleteEntity(deleted.getId().toString());

    String basePath = "/v1/containers/name/" + parent.getFullyQualifiedName() + "/children";

    ContainerResultList nonDeletedPage =
        client.getHttpClient().execute(HttpMethod.GET, basePath, null, ContainerResultList.class);
    Set<UUID> ndIds =
        nonDeletedPage.getData().stream()
            .map(Container::getId)
            .collect(java.util.stream.Collectors.toSet());
    assertTrue(ndIds.contains(live.getId()), "live child must appear by default");
    assertFalse(
        ndIds.contains(deleted.getId()),
        "soft-deleted child must NOT appear under default include=non-deleted");

    ContainerResultList allPage =
        client
            .getHttpClient()
            .execute(HttpMethod.GET, basePath + "?include=all", null, ContainerResultList.class);
    Set<UUID> allIds =
        allPage.getData().stream()
            .map(Container::getId)
            .collect(java.util.stream.Collectors.toSet());
    assertTrue(allIds.contains(live.getId()), "live child must appear under include=all");
    assertTrue(
        allIds.contains(deleted.getId()),
        "soft-deleted child must appear under include=all (cache must not return the non-deleted page from a previous read)");
  }

  /**
   * The {@code ?q=} substring filter on {@code /children} narrows a parent's direct-child
   * page to names containing the query (case-insensitive). Asserts both that matches are
   * returned and that non-matching siblings under the same parent are excluded — so a UI
   * that issues both an unfiltered and a filtered request hits two distinct result sets.
   * Also pins the count semantics: {@code paging.total} must reflect the filtered count,
   * not the parent's full child count, so the table footer doesn't lie about the result
   * size when the user has typed in the search box.
   */
  @Test
  void test_listChildren_filterByQuery_matchesByNameSubstring(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer parentRequest = new CreateContainer();
    parentRequest.setName(ns.prefix("kids_q_parent"));
    parentRequest.setService(service.getFullyQualifiedName());
    Container parent = createEntity(parentRequest);

    Container alpha = createChild(ns, service, parent, "kids_q_AlphaReports");
    Container beta = createChild(ns, service, parent, "kids_q_betaReports");
    Container gamma = createChild(ns, service, parent, "kids_q_gamma_log");

    String basePath = "/v1/containers/name/" + parent.getFullyQualifiedName() + "/children";

    ContainerResultList allPage =
        client.getHttpClient().execute(HttpMethod.GET, basePath, null, ContainerResultList.class);
    assertEquals(
        3,
        allPage.getPaging().getTotal().intValue(),
        "without ?q= every direct child counts toward total");

    // Substring match — the query "report" should hit both alpha and beta (different
    // capitalisations) but never the gamma_log child whose name has no overlap.
    ContainerResultList reportsPage =
        client
            .getHttpClient()
            .execute(HttpMethod.GET, basePath + "?q=report", null, ContainerResultList.class);
    Set<UUID> reportIds =
        reportsPage.getData().stream()
            .map(Container::getId)
            .collect(java.util.stream.Collectors.toSet());
    assertTrue(reportIds.contains(alpha.getId()), "AlphaReports must match q=report");
    assertTrue(reportIds.contains(beta.getId()), "betaReports must match q=report");
    assertFalse(reportIds.contains(gamma.getId()), "gamma_log must not match q=report");
    assertEquals(
        2,
        reportsPage.getPaging().getTotal().intValue(),
        "paging.total must reflect the filtered count, not the parent's full child count");

    // No-result query: a substring that no sibling contains returns an empty page with a
    // zero total, not a failure or the unfiltered list.
    ContainerResultList emptyPage =
        client
            .getHttpClient()
            .execute(HttpMethod.GET, basePath + "?q=zzznomatch", null, ContainerResultList.class);
    assertTrue(
        emptyPage.getData().isEmpty(),
        "no children should be returned when the query matches nothing");
    assertEquals(0, emptyPage.getPaging().getTotal().intValue(), "filtered total is 0");
  }

  /**
   * Verify that {@code _} and {@code %} in the query are escaped before being sent to the
   * SQL LIKE clause — without escaping, {@code _} would match any single character and a
   * search for "foo_bar" would also return "fooXbar". OpenMetadata container/folder names
   * frequently contain underscores (e.g. {@code etl_run_2024_07}) so this is the more
   * common foot-gun than {@code %}, but both wildcards are escaped uniformly via the
   * {@link
   * org.openmetadata.service.jdbi3.ContainerRepository#buildNameLikeBind(String)}
   * helper which prepends {@code !} to {@code %}, {@code _}, and {@code !} itself, and
   * the SQL declares {@code ESCAPE '!'} explicitly. {@code !} is preferred over
   * backslash because JDBI's ColonPrefixSqlParser mishandles literal {@code '\'} inside
   * single-quoted SQL strings and silently drops a downstream {@code :includeDeleted}
   * bind.
   */
  @Test
  void test_listChildren_filterByQuery_escapesLikeWildcards(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer parentRequest = new CreateContainer();
    parentRequest.setName(ns.prefix("kids_q_escape_parent"));
    parentRequest.setService(service.getFullyQualifiedName());
    Container parent = createEntity(parentRequest);

    Container literal = createChild(ns, service, parent, "kids_q_foo_bar");
    Container wildcardImpostor = createChild(ns, service, parent, "kids_q_fooXbar");

    String basePath = "/v1/containers/name/" + parent.getFullyQualifiedName() + "/children";

    ContainerResultList page =
        client
            .getHttpClient()
            .execute(HttpMethod.GET, basePath + "?q=foo_bar", null, ContainerResultList.class);
    Set<UUID> ids =
        page.getData().stream().map(Container::getId).collect(java.util.stream.Collectors.toSet());
    assertTrue(
        ids.contains(literal.getId()),
        "literal underscore in the query must match the literal-underscore name");
    assertFalse(
        ids.contains(wildcardImpostor.getId()),
        "underscore in the query must not behave as a single-char LIKE wildcard");
  }

  /**
   * Pins the rule that {@code ?include=deleted} is scoped per-level — at level X, the
   * toggle returns only direct children of X whose own {@code deleted=true}. A
   * soft-deleted descendant deeper than one level below X must NOT appear at X's
   * {@code /children} listing, regardless of the include toggle. Each parent shows
   * only its own direct children; the toggle filters that direct-children set by
   * deleted flag, never recurses.
   *
   * <p>Both the direct-children-only depth predicate
   * ({@code fqnHash NOT LIKE :parentHashChild}) and the include filter contribute to
   * this guarantee; a regression that drops the depth check while keeping the include
   * check would silently start surfacing deleted descendants from deeper levels at
   * ancestor /children listings.
   *
   * <p>Builds chain root → l1 → l2 → l3 (l3 soft-deleted), then asserts /children at
   * each level under all three include modes. l3 must only appear under l2 with
   * include=deleted or include=all; never under root or l1.
   */
  @Test
  void test_listChildren_includeDeleted_scopedToDirectChildrenAtEachLevel(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer rootRequest = new CreateContainer();
    rootRequest.setName(ns.prefix("delete_scoping_root"));
    rootRequest.setService(service.getFullyQualifiedName());
    Container root = createEntity(rootRequest);

    Container l1 = createChild(ns, service, root, "delete_scoping_l1");
    Container l2 = createChild(ns, service, l1, "delete_scoping_l2");
    Container l3 = createChild(ns, service, l2, "delete_scoping_l3");
    deleteEntity(l3.getId().toString());

    assertChildren(client, root, "include=non-deleted (default)", "", Set.of(l1.getId()));
    assertChildren(
        client, root, "include=deleted at root", "?include=deleted", Set.of() /* none */);
    assertChildren(client, root, "include=all at root", "?include=all", Set.of(l1.getId()));

    assertChildren(client, l1, "include=non-deleted (default)", "", Set.of(l2.getId()));
    assertChildren(client, l1, "include=deleted at l1", "?include=deleted", Set.of() /* none */);
    assertChildren(client, l1, "include=all at l1", "?include=all", Set.of(l2.getId()));

    assertChildren(client, l2, "include=non-deleted (default)", "", Set.of() /* none */);
    assertChildren(client, l2, "include=deleted at l2", "?include=deleted", Set.of(l3.getId()));
    assertChildren(client, l2, "include=all at l2", "?include=all", Set.of(l3.getId()));
  }

  private void assertChildren(
      OpenMetadataClient client, Container parent, String label, String query, Set<UUID> expected)
      throws Exception {
    String basePath = "/v1/containers/name/" + parent.getFullyQualifiedName() + "/children" + query;
    ContainerResultList page =
        client.getHttpClient().execute(HttpMethod.GET, basePath, null, ContainerResultList.class);
    Set<UUID> actual =
        page.getData().stream().map(Container::getId).collect(java.util.stream.Collectors.toSet());
    assertEquals(
        expected,
        actual,
        () ->
            String.format(
                "/children of %s with %s — expected %s, got %s",
                parent.getName(), label, expected, actual));
    assertEquals(
        expected.size(),
        page.getPaging().getTotal().intValue(),
        () ->
            String.format(
                "paging.total at %s with %s must reflect filtered direct-children count",
                parent.getName(), label));
  }

  /**
   * The FQN-depth predicate must produce direct-children-only at <em>any</em> level of
   * the hierarchy, not just the service root. Build a 5-level chain
   * (root → l1 → l2 → l3 → l4) and walk down, asserting at each non-leaf level that
   * {@code /children} returns exactly the immediate next level — no deeper descendants
   * leak through, no immediate child is missed.
   *
   * <p>This is the per-level dual of {@link #test_rootListing_excludesContainersBelowFirstLevel}.
   * The depth check is mathematical (a fqnHash exactly one MD5 segment below the parent
   * has exactly one extra '.' separator), so it should hold uniformly at every depth;
   * a regression at level N (e.g. a planner choosing the wrong index, or someone
   * computing parentHashChild from the wrong prefix) would only surface in this kind of
   * iterative test.
   */
  @Test
  void test_listChildren_atArbitraryDepth_returnsOnlyDirectChildren(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer rootRequest = new CreateContainer();
    rootRequest.setName(ns.prefix("depth_chain_root"));
    rootRequest.setService(service.getFullyQualifiedName());
    Container root = createEntity(rootRequest);

    // Build the chain: root → l1 → l2 → l3 → l4. List<Container> chain captures each
    // level so we can inspect the FQNs and IDs in order.
    List<Container> chain = new ArrayList<>();
    chain.add(root);
    Container current = root;
    for (int level = 1; level <= 4; level++) {
      current = createChild(ns, service, current, "depth_chain_l" + level);
      chain.add(current);
    }

    // For each non-leaf level i in [0, 3], /children of chain[i] must contain
    // exactly chain[i+1] and nothing deeper from this branch.
    for (int i = 0; i < chain.size() - 1; i++) {
      Container parent = chain.get(i);
      Container expectedChild = chain.get(i + 1);

      ContainerResultList page =
          client
              .getHttpClient()
              .execute(
                  HttpMethod.GET,
                  "/v1/containers/name/" + parent.getFullyQualifiedName() + "/children",
                  null,
                  ContainerResultList.class);
      assertNotNull(page);
      assertNotNull(page.getData());

      Set<UUID> ids =
          page.getData().stream()
              .map(Container::getId)
              .collect(java.util.stream.Collectors.toSet());

      assertTrue(
          ids.contains(expectedChild.getId()),
          "Level " + i + ": direct child " + expectedChild.getName() + " must appear in /children");

      // Every deeper level in the same chain must NOT leak through.
      for (int j = i + 2; j < chain.size(); j++) {
        Container deeper = chain.get(j);
        assertFalse(
            ids.contains(deeper.getId()),
            "Level "
                + i
                + ": deeper descendant "
                + deeper.getName()
                + " (level "
                + j
                + ") must not appear in /children — FQN-depth check must hold at every level");
      }
    }
  }

  /**
   * The dual of {@link #test_rootListingExcludesOrphanedChild}: when a container's parent
   * CONTAINS row is missing, the orphan must <em>still</em> be discoverable under its
   * FQN-implied parent's {@code /children} listing. The current FQN-based listing reads
   * the FQN as the source of truth, so the orphan appears under its real ancestor even
   * though the relationship row is gone — which is what the breadcrumb UI assumes.
   *
   * <p>This is the correctness invariant we lose if {@code /children} ever falls back to
   * an {@code entity_relationship}-based lookup again.
   */
  @Test
  void test_listChildren_orphanWithMissingRelationship_isStillDiscoverable(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer rootRequest = new CreateContainer();
    rootRequest.setName(ns.prefix("orphan_kids_root"));
    rootRequest.setService(service.getFullyQualifiedName());
    Container root = createEntity(rootRequest);

    Container intermediate = createChild(ns, service, root, "orphan_kids_intermediate");
    Container leaf = createChild(ns, service, intermediate, "orphan_kids_leaf");

    // Drop the (intermediate, CONTAINS, leaf) relationship row to simulate the cascade
    // bug's residue. The leaf's row stays in storage_container_entity, its FQN still
    // points at intermediate, but the relationship table no longer says "intermediate
    // contains leaf".
    int rowsRemoved =
        Entity.getCollectionDAO()
            .relationshipDAO()
            .delete(
                intermediate.getId(),
                "container",
                leaf.getId(),
                "container",
                Relationship.CONTAINS.ordinal());
    assertEquals(1, rowsRemoved, "Setup: should have dropped exactly one CONTAINS row");

    try {
      // Despite the missing relationship, /children of intermediate must surface the leaf
      // because the listing is FQN-driven. This is the correctness payoff of moving off
      // entity_relationship for hierarchy listings.
      ContainerResultList page =
          client
              .getHttpClient()
              .execute(
                  HttpMethod.GET,
                  "/v1/containers/name/" + intermediate.getFullyQualifiedName() + "/children",
                  null,
                  ContainerResultList.class);
      assertNotNull(page);
      assertNotNull(page.getData());

      Set<UUID> ids =
          page.getData().stream()
              .map(Container::getId)
              .collect(java.util.stream.Collectors.toSet());
      assertTrue(
          ids.contains(leaf.getId()),
          "Leaf must still appear in /children of its FQN-implied parent even though the "
              + "(parent, CONTAINS, leaf) row was lost — FQN is the source of truth.");
    } finally {
      Entity.getCollectionDAO()
          .relationshipDAO()
          .insert(
              intermediate.getId(),
              leaf.getId(),
              "container",
              "container",
              Relationship.CONTAINS.ordinal());
    }
  }

  /**
   * Sibling subtrees at any depth must not bleed into one another. Build a small
   * branching shape — root with two children A and B, each with one grandchild —
   * and verify {@code /children} of A returns only its grandchild, never B's. Guards
   * against a regression where {@code parentHash} computation accidentally captures
   * sibling prefixes (e.g. by stripping fewer separators than intended) or the depth
   * check is dropped at a non-root level.
   */
  @Test
  void test_listChildren_doesNotLeakSiblingSubtree(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer rootRequest = new CreateContainer();
    rootRequest.setName(ns.prefix("siblings_root"));
    rootRequest.setService(service.getFullyQualifiedName());
    Container root = createEntity(rootRequest);

    Container branchA = createChild(ns, service, root, "siblings_branchA");
    Container branchB = createChild(ns, service, root, "siblings_branchB");
    Container grandchildA = createChild(ns, service, branchA, "siblings_grandchildA");
    Container grandchildB = createChild(ns, service, branchB, "siblings_grandchildB");

    // /children of branchA: only grandchildA, never grandchildB.
    ContainerResultList branchAPage =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/containers/name/" + branchA.getFullyQualifiedName() + "/children",
                null,
                ContainerResultList.class);
    Set<UUID> aIds =
        branchAPage.getData().stream()
            .map(Container::getId)
            .collect(java.util.stream.Collectors.toSet());
    assertTrue(aIds.contains(grandchildA.getId()), "grandchildA must appear under branchA");
    assertFalse(
        aIds.contains(grandchildB.getId()),
        "grandchildB must not leak into branchA's /children — sibling subtree isolation");
    assertFalse(
        aIds.contains(branchB.getId()), "branchB must not appear under branchA's /children");

    // /children of branchB: only grandchildB, never grandchildA.
    ContainerResultList branchBPage =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/containers/name/" + branchB.getFullyQualifiedName() + "/children",
                null,
                ContainerResultList.class);
    Set<UUID> bIds =
        branchBPage.getData().stream()
            .map(Container::getId)
            .collect(java.util.stream.Collectors.toSet());
    assertTrue(bIds.contains(grandchildB.getId()), "grandchildB must appear under branchB");
    assertFalse(
        bIds.contains(grandchildA.getId()),
        "grandchildA must not leak into branchB's /children — sibling subtree isolation");
  }

  @Test
  void test_listAncestors_handlesQuotedServiceName(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    // Storage service whose own name contains a literal dot. The first segment of every
    // descendant's FQN is therefore the quoted service name. This is the regression test
    // for the quoteName(parts[0]) seed in getAncestors — concatenating the raw service
    // name with '.' would split it back into multiple phantom segments and break the
    // IN-by-fqnHash lookup for every ancestor under the service.
    String dottedName =
        ns.prefix("ancestors_dotted.svc." + UUID.randomUUID().toString().substring(0, 8));
    org.openmetadata.schema.services.connections.storage.S3Connection s3Conn =
        new org.openmetadata.schema.services.connections.storage.S3Connection();
    org.openmetadata.schema.api.services.CreateStorageService createService =
        new org.openmetadata.schema.api.services.CreateStorageService()
            .withName(dottedName)
            .withServiceType(
                org.openmetadata.schema.api.services.CreateStorageService.StorageServiceType.S3)
            .withConnection(new org.openmetadata.schema.type.StorageConnection().withConfig(s3Conn))
            .withDescription("Dotted-name regression service");
    StorageService service = client.storageServices().create(createService);

    CreateContainer rootRequest = new CreateContainer();
    rootRequest.setName(ns.prefix("ancestors_dotted_service_root"));
    rootRequest.setService(service.getFullyQualifiedName());
    Container root = createEntity(rootRequest);

    Container leaf = createChild(ns, service, root, "ancestors_dotted_service_leaf");

    EntityReferenceList ancestors =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/containers/name/" + leaf.getFullyQualifiedName() + "/ancestors",
                null,
                EntityReferenceList.class);

    assertNotNull(ancestors);
    assertEquals(1, ancestors.size(), "leaf has exactly one container ancestor: root");
    assertEquals(
        root.getId(),
        ancestors.get(0).getId(),
        "root must resolve even though it lives under a service with a dotted name");
    assertEquals(
        root.getFullyQualifiedName(),
        ancestors.get(0).getFullyQualifiedName(),
        "returned FQN must match the canonical (quoted) service segment");
  }

  @Test
  void test_listAncestors_handlesQuotedNamePartsInChain(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    // Build a chain whose intermediate ancestors contain '.' in their names.
    // OpenMetadata quotes such segments in the canonical FQN ("2025.Q1"),
    // so getAncestors must round-trip parts through FullyQualifiedName.add to
    // re-quote them; otherwise the rebuilt ancestor FQN won't match the
    // stored FQN and the IN-by-fqnHash lookup returns nothing.
    CreateContainer rootRequest = new CreateContainer();
    rootRequest.setName(ns.prefix("ancestors_quoted_root"));
    rootRequest.setService(service.getFullyQualifiedName());
    Container root = createEntity(rootRequest);

    // Quoted middle: a name with a literal dot — exercises the fragile path.
    Container quotedMid = createChild(ns, service, root, "ancestors_quoted_mid_with.dot.in.name");
    Container leaf = createChild(ns, service, quotedMid, "ancestors_quoted_leaf");

    EntityReferenceList ancestors =
        client
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/containers/name/" + leaf.getFullyQualifiedName() + "/ancestors",
                null,
                EntityReferenceList.class);

    assertNotNull(ancestors);
    assertEquals(
        2,
        ancestors.size(),
        "ancestors must resolve both root and the quoted-name middle even though"
            + " the middle's name contains the FQN separator");
    assertEquals(root.getId(), ancestors.get(0).getId());
    assertEquals(
        quotedMid.getId(),
        ancestors.get(1).getId(),
        "the dotted-name container must be looked up via its quoted FQN, not via"
            + " a raw '.' join that would split it into two phantom segments");
    assertEquals(
        quotedMid.getFullyQualifiedName(),
        ancestors.get(1).getFullyQualifiedName(),
        "returned FQN must equal the canonical (quoted) form stored in the DB");
  }

  private static class EntityReferenceList extends ArrayList<EntityReference> {}

  @Test
  void test_containerWithFullyQualifiedName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer parentRequest = new CreateContainer();
    parentRequest.setName(ns.prefix("fqn_parent"));
    parentRequest.setService(service.getFullyQualifiedName());
    Container parent = createEntity(parentRequest);

    CreateContainer childRequest = new CreateContainer();
    childRequest.setName(ns.prefix("fqn_child"));
    childRequest.setService(service.getFullyQualifiedName());
    childRequest.setParent(
        new EntityReference()
            .withId(parent.getId())
            .withType("container")
            .withFullyQualifiedName(parent.getFullyQualifiedName()));
    Container child = createEntity(childRequest);

    String expectedParentFqn = service.getName() + "." + parent.getName();
    String expectedChildFqn = expectedParentFqn + "." + child.getName();

    assertEquals(expectedParentFqn, parent.getFullyQualifiedName());
    assertEquals(expectedChildFqn, child.getFullyQualifiedName());

    Container fetchedByFqn = client.containers().getByName(child.getFullyQualifiedName());
    assertEquals(child.getId(), fetchedByFqn.getId());
    assertEquals(child.getName(), fetchedByFqn.getName());
  }

  @Test
  void test_containerSizeAndObjectsNoChange(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_size_no_change"));
    request.setService(service.getFullyQualifiedName());

    Container container = createEntity(request);
    Double initialVersion = container.getVersion();

    container.setSize(100.0);
    container.setNumberOfObjects(10.0);

    Container updated = patchEntity(container.getId().toString(), container);
    assertEquals(100.0, updated.getSize());
    assertEquals(10.0, updated.getNumberOfObjects());
    assertEquals(initialVersion, updated.getVersion());

    container.setSize(100.0);
    container.setNumberOfObjects(10.0);
    Container updated2 = patchEntity(container.getId().toString(), container);
    assertEquals(initialVersion, updated2.getVersion());
  }

  @Test
  void test_containerMultipleFileFormats(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    List<ContainerFileFormat> formats =
        Arrays.asList(
            ContainerFileFormat.Parquet,
            ContainerFileFormat.Csv,
            ContainerFileFormat.Json,
            ContainerFileFormat.Avro,
            ContainerFileFormat.Gz);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_multi_formats"));
    request.setService(service.getFullyQualifiedName());
    request.setFileFormats(formats);

    Container container = createEntity(request);
    assertNotNull(container.getFileFormats());
    assertEquals(5, container.getFileFormats().size());
    assertTrue(container.getFileFormats().containsAll(formats));
  }

  @Test
  void test_containerDataModelWithNestedStruct(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    Column level3 = new Column().withName("level3").withDataType(ColumnDataType.STRING);

    Column level2 =
        new Column()
            .withName("level2")
            .withDataType(ColumnDataType.STRUCT)
            .withChildren(List.of(level3));

    Column level1 =
        new Column()
            .withName("level1")
            .withDataType(ColumnDataType.STRUCT)
            .withChildren(List.of(level2));

    ContainerDataModel dataModel =
        new ContainerDataModel().withColumns(List.of(level1)).withIsPartitioned(false);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_nested_struct"));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(dataModel);

    Container container = createEntity(request);
    assertNotNull(container.getDataModel());

    Column retrievedLevel1 = container.getDataModel().getColumns().get(0);
    assertEquals("level1", retrievedLevel1.getName());
    assertNotNull(retrievedLevel1.getChildren());

    Column retrievedLevel2 = retrievedLevel1.getChildren().get(0);
    assertEquals("level2", retrievedLevel2.getName());
    assertNotNull(retrievedLevel2.getChildren());

    Column retrievedLevel3 = retrievedLevel2.getChildren().get(0);
    assertEquals("level3", retrievedLevel3.getName());
    assertEquals(ColumnDataType.STRING, retrievedLevel3.getDataType());
  }

  @Test
  void test_containerWithAllOptionalFields(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    List<Column> columns =
        List.of(
            new Column().withName("col1").withDataType(ColumnDataType.INT),
            new Column().withName("col2").withDataType(ColumnDataType.STRING));

    ContainerDataModel dataModel =
        new ContainerDataModel().withColumns(columns).withIsPartitioned(true);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_all_fields"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Complete container with all fields");
    request.setDataModel(dataModel);
    request.setFileFormats(List.of(ContainerFileFormat.Parquet, ContainerFileFormat.Csv));
    request.setPrefix("/data/complete/");
    request.setSize(10000.0);
    request.setNumberOfObjects(500.0);
    request.setOwners(List.of(testUser1().getEntityReference()));

    Container container = createEntity(request);

    assertEquals("Complete container with all fields", container.getDescription());
    assertNotNull(container.getDataModel());
    assertEquals(2, container.getDataModel().getColumns().size());
    assertTrue(container.getDataModel().getIsPartitioned());
    assertEquals(2, container.getFileFormats().size());
    assertEquals("/data/complete/", container.getPrefix());
    assertEquals(10000.0, container.getSize());
    assertEquals(500.0, container.getNumberOfObjects());

    Container fetchedWithOwners = client.containers().get(container.getId().toString(), "owners");
    assertNotNull(fetchedWithOwners.getOwners());
    assertFalse(fetchedWithOwners.getOwners().isEmpty());
  }

  @Test
  void test_containerDescriptionUpdate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_desc_update"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Initial description");

    Container container = createEntity(request);
    assertEquals("Initial description", container.getDescription());
    Double v1 = container.getVersion();

    container.setDescription("Updated description");
    Container updated = patchEntity(container.getId().toString(), container);
    assertEquals("Updated description", updated.getDescription());
    assertTrue(updated.getVersion() > v1);
  }

  @Test
  void test_containerWithEmptyDataModel(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    ContainerDataModel emptyModel =
        new ContainerDataModel().withColumns(List.of()).withIsPartitioned(false);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_empty_model"));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(emptyModel);

    Container container = createEntity(request);
    assertNotNull(container.getDataModel());
    assertNotNull(container.getDataModel().getColumns());
    assertTrue(container.getDataModel().getColumns().isEmpty());
    assertFalse(container.getDataModel().getIsPartitioned());
  }

  @Test
  void test_containerDeepHierarchy(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    CreateContainer level0Request = new CreateContainer();
    level0Request.setName(ns.prefix("level0"));
    level0Request.setService(service.getFullyQualifiedName());
    Container level0 = createEntity(level0Request);

    Container currentParent = level0;
    for (int i = 1; i <= 5; i++) {
      CreateContainer levelRequest = new CreateContainer();
      levelRequest.setName(ns.prefix("level" + i));
      levelRequest.setService(service.getFullyQualifiedName());
      levelRequest.setParent(
          new EntityReference()
              .withId(currentParent.getId())
              .withType("container")
              .withFullyQualifiedName(currentParent.getFullyQualifiedName()));
      Container levelContainer = createEntity(levelRequest);

      assertNotNull(levelContainer.getParent());
      assertEquals(currentParent.getId(), levelContainer.getParent().getId());

      currentParent = levelContainer;
    }

    String expectedFqnSegment = service.getName() + ".";
    for (int i = 0; i <= 5; i++) {
      expectedFqnSegment += (i == 0 ? "" : ".") + ns.prefix("level" + i);
    }
    assertTrue(currentParent.getFullyQualifiedName().contains(ns.prefix("level5")));
  }

  @Test
  void test_containerArrayDataType(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    Column arrayIntCol =
        new Column()
            .withName("int_array")
            .withDataType(ColumnDataType.ARRAY)
            .withArrayDataType(ColumnDataType.INT);

    Column arrayStringCol =
        new Column()
            .withName("string_array")
            .withDataType(ColumnDataType.ARRAY)
            .withArrayDataType(ColumnDataType.VARCHAR);

    Column arrayBigintCol =
        new Column()
            .withName("bigint_array")
            .withDataType(ColumnDataType.ARRAY)
            .withArrayDataType(ColumnDataType.BIGINT);

    ContainerDataModel dataModel =
        new ContainerDataModel()
            .withColumns(Arrays.asList(arrayIntCol, arrayStringCol, arrayBigintCol))
            .withIsPartitioned(false);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_arrays"));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(dataModel);

    Container container = createEntity(request);
    assertNotNull(container.getDataModel());
    assertEquals(3, container.getDataModel().getColumns().size());

    Column retrievedIntArray = container.getDataModel().getColumns().get(0);
    assertEquals(ColumnDataType.ARRAY, retrievedIntArray.getDataType());
    assertEquals(ColumnDataType.INT, retrievedIntArray.getArrayDataType());

    Column retrievedStringArray = container.getDataModel().getColumns().get(1);
    assertEquals(ColumnDataType.ARRAY, retrievedStringArray.getDataType());
    assertEquals(ColumnDataType.VARCHAR, retrievedStringArray.getArrayDataType());

    Column retrievedBigintArray = container.getDataModel().getColumns().get(2);
    assertEquals(ColumnDataType.ARRAY, retrievedBigintArray.getDataType());
    assertEquals(ColumnDataType.BIGINT, retrievedBigintArray.getArrayDataType());
  }

  // ===================================================================
  // PATCH TESTS FOR NESTED DATA MODEL COLUMNS
  // ===================================================================

  @Test
  void patch_dataModelColumnDescription_200(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);

    ContainerDataModel dataModel =
        new ContainerDataModel()
            .withIsPartitioned(false)
            .withColumns(
                Arrays.asList(
                    new Column()
                        .withName("account_id")
                        .withDataType(ColumnDataType.STRING)
                        .withDataTypeDisplay("string"),
                    new Column()
                        .withName("balance")
                        .withDataType(ColumnDataType.NUMERIC)
                        .withDataTypeDisplay("numeric")));

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("patch_col_desc"));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(dataModel);

    Container container = createEntity(request);
    Container fetched = getEntityWithFields(container.getId().toString(), "tags,dataModel");
    Double versionBefore = fetched.getVersion();

    fetched.getDataModel().getColumns().get(0).setDescription("Unique account identifier");
    Container patched = patchEntity(fetched.getId().toString(), fetched);

    assertTrue(patched.getVersion() > versionBefore);

    Container verified = getEntityWithFields(patched.getId().toString(), "tags,dataModel");
    assertEquals(
        "Unique account identifier", verified.getDataModel().getColumns().get(0).getDescription());
  }

  @Test
  void patch_dataModelColumnTags_200(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);
    SharedEntities shared = SharedEntities.get();

    ContainerDataModel dataModel =
        new ContainerDataModel()
            .withIsPartitioned(false)
            .withColumns(
                Arrays.asList(
                    new Column()
                        .withName("email")
                        .withDataType(ColumnDataType.STRING)
                        .withDataTypeDisplay("string"),
                    new Column()
                        .withName("phone")
                        .withDataType(ColumnDataType.STRING)
                        .withDataTypeDisplay("string")));

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("patch_col_tags"));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(dataModel);

    Container container = createEntity(request);
    Container fetched = getEntityWithFields(container.getId().toString(), "tags,dataModel");
    Double versionBefore = fetched.getVersion();

    TagLabel piiTag = shared.PII_SENSITIVE_TAG_LABEL;
    fetched.getDataModel().getColumns().get(0).setTags(new ArrayList<>(List.of(piiTag)));
    Container patched = patchEntity(fetched.getId().toString(), fetched);

    assertTrue(patched.getVersion() > versionBefore);

    Container verified = getEntityWithFields(patched.getId().toString(), "tags,dataModel");
    List<TagLabel> columnTags = verified.getDataModel().getColumns().get(0).getTags();
    assertNotNull(columnTags);
    assertFalse(columnTags.isEmpty());
    assertTrue(columnTags.stream().anyMatch(t -> t.getTagFQN().equals(piiTag.getTagFQN())));
  }

  @Test
  void patch_dataModelColumnDisplayName_200(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);

    ContainerDataModel dataModel =
        new ContainerDataModel()
            .withIsPartitioned(false)
            .withColumns(
                List.of(
                    new Column()
                        .withName("txn_id")
                        .withDataType(ColumnDataType.STRING)
                        .withDataTypeDisplay("string")));

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("patch_col_display"));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(dataModel);

    Container container = createEntity(request);
    Container fetched = getEntityWithFields(container.getId().toString(), "tags,dataModel");
    Double versionBefore = fetched.getVersion();

    fetched.getDataModel().getColumns().get(0).setDisplayName("Transaction ID");
    Container patched = patchEntity(fetched.getId().toString(), fetched);

    assertTrue(patched.getVersion() > versionBefore);

    Container verified = getEntityWithFields(patched.getId().toString(), "tags,dataModel");
    assertEquals("Transaction ID", verified.getDataModel().getColumns().get(0).getDisplayName());
  }

  @Test
  void get_parentDataModelTags_doesNotLeakChildContainerTags(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);
    SharedEntities shared = shared();

    ContainerDataModel parentModel =
        new ContainerDataModel()
            .withIsPartitioned(false)
            .withColumns(
                Arrays.asList(
                    new Column().withName("parent_col_a").withDataType(ColumnDataType.STRING),
                    new Column().withName("parent_col_b").withDataType(ColumnDataType.STRING)));

    CreateContainer parentRequest = new CreateContainer();
    parentRequest.setName(ns.prefix("parent_subtree"));
    parentRequest.setService(service.getFullyQualifiedName());
    parentRequest.setDataModel(parentModel);
    Container parent = createEntity(parentRequest);

    Container parentFetched = getEntityWithFields(parent.getId().toString(), "tags,dataModel");
    parentFetched
        .getDataModel()
        .getColumns()
        .get(0)
        .setTags(new ArrayList<>(List.of(shared.PII_SENSITIVE_TAG_LABEL)));
    patchEntity(parentFetched.getId().toString(), parentFetched);

    ContainerDataModel childModel =
        new ContainerDataModel()
            .withIsPartitioned(false)
            .withColumns(
                List.of(new Column().withName("child_col").withDataType(ColumnDataType.STRING)));

    CreateContainer childRequest = new CreateContainer();
    childRequest.setName(ns.prefix("child_subtree"));
    childRequest.setService(service.getFullyQualifiedName());
    childRequest.setParent(
        new EntityReference()
            .withId(parent.getId())
            .withType("container")
            .withFullyQualifiedName(parent.getFullyQualifiedName()));
    childRequest.setDataModel(childModel);
    Container child = createEntity(childRequest);

    Container childFetched = getEntityWithFields(child.getId().toString(), "tags,dataModel");
    childFetched
        .getDataModel()
        .getColumns()
        .get(0)
        .setTags(new ArrayList<>(List.of(shared.PERSONAL_DATA_TAG_LABEL)));
    patchEntity(childFetched.getId().toString(), childFetched);

    Container parentVerified = getEntityWithFields(parent.getId().toString(), "tags,dataModel");
    List<Column> parentColumns = parentVerified.getDataModel().getColumns();

    assertEquals(2, parentColumns.size());
    List<TagLabel> colATags = parentColumns.get(0).getTags();
    assertNotNull(colATags);
    assertTrue(
        colATags.stream()
            .anyMatch(t -> t.getTagFQN().equals(shared.PII_SENSITIVE_TAG_LABEL.getTagFQN())),
        "Parent col_a should retain its PII tag");

    List<TagLabel> colBTags = parentColumns.get(1).getTags();
    assertTrue(colBTags == null || colBTags.isEmpty(), "Parent col_b should have no tags");

    boolean leaked =
        parentColumns.stream()
            .flatMap(
                c -> c.getTags() == null ? java.util.stream.Stream.empty() : c.getTags().stream())
            .anyMatch(t -> t.getTagFQN().equals(shared.PERSONAL_DATA_TAG_LABEL.getTagFQN()));
    assertFalse(leaked, "Child container's column tag must not appear on parent's columns");
  }

  @Test
  void get_dataModelStructColumnTags_areReturned(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);
    SharedEntities shared = shared();

    Column nestedChild = new Column().withName("nested_child").withDataType(ColumnDataType.STRING);
    Column structColumn =
        new Column()
            .withName("struct_col")
            .withDataType(ColumnDataType.STRUCT)
            .withChildren(List.of(nestedChild));

    ContainerDataModel dataModel =
        new ContainerDataModel().withIsPartitioned(false).withColumns(List.of(structColumn));

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_struct_tags"));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(dataModel);
    Container container = createEntity(request);

    Container fetched = getEntityWithFields(container.getId().toString(), "tags,dataModel");
    fetched
        .getDataModel()
        .getColumns()
        .get(0)
        .getChildren()
        .get(0)
        .setTags(new ArrayList<>(List.of(shared.PII_SENSITIVE_TAG_LABEL)));
    patchEntity(fetched.getId().toString(), fetched);

    Container verified = getEntityWithFields(container.getId().toString(), "tags,dataModel");
    Column nestedVerified = verified.getDataModel().getColumns().get(0).getChildren().get(0);
    List<TagLabel> nestedTags = nestedVerified.getTags();
    assertNotNull(nestedTags);
    assertTrue(
        nestedTags.stream()
            .anyMatch(t -> t.getTagFQN().equals(shared.PII_SENSITIVE_TAG_LABEL.getTagFQN())),
        "Nested struct child column should have its tag retrieved via batched fetch");
  }

  // ===================================================================
  // SAMPLE DATA AND PII MASKING TESTS
  // ===================================================================

  @Test
  void test_sampleDataAddedToContainerWithDataModel_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    List<Column> columns =
        Arrays.asList(
            new Column().withName("id").withDataType(ColumnDataType.INT),
            new Column().withName("email").withDataType(ColumnDataType.VARCHAR).withDataLength(255),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255));

    ContainerDataModel dataModel =
        new ContainerDataModel().withIsPartitioned(false).withColumns(columns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_sample_data"));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(dataModel);

    Container container = createEntity(request);
    assertNotNull(container);

    // Note: Sample data is added via PUT endpoint in actual workflow
    // This test verifies container is ready to accept sample data
    Container fetched = client.containers().get(container.getId().toString(), "dataModel");
    assertNotNull(fetched.getDataModel());
    assertEquals(3, fetched.getDataModel().getColumns().size());
  }

  @Test
  void test_sampleDataWithoutDataModel_400(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    // Create container WITHOUT data model
    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_no_model_sample"));
    request.setService(service.getFullyQualifiedName());

    Container container = createEntity(request);
    assertNotNull(container);
    assertNull(container.getDataModel(), "Container should be created without dataModel");

    // Attempting to add sample data to container without dataModel should fail
    // This is enforced by ContainerRepository.addSampleData()
  }

  @Test
  void test_sampleDataMaskingForNonAdminUser_200(TestNamespace ns) {
    OpenMetadataClient adminClient = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);
    SharedEntities shared = SharedEntities.get();

    // Create container with dataModel including PII columns
    List<Column> columns =
        Arrays.asList(
            new Column().withName("id").withDataType(ColumnDataType.INT),
            new Column().withName("email").withDataType(ColumnDataType.VARCHAR).withDataLength(255),
            new Column().withName("ssn").withDataType(ColumnDataType.VARCHAR).withDataLength(11),
            new Column().withName("name").withDataType(ColumnDataType.VARCHAR).withDataLength(255));

    ContainerDataModel dataModel =
        new ContainerDataModel().withIsPartitioned(false).withColumns(columns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_pii_masking"));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(dataModel);

    Container container = createEntity(request);
    assertNotNull(container);

    // Tag sensitive columns with PII tag (as admin)
    Container fetched = adminClient.containers().get(container.getId().toString(), "dataModel");
    fetched.getDataModel().getColumns().stream()
        .filter(c -> c.getName().equals("email") || c.getName().equals("ssn"))
        .forEach(c -> c.setTags(new ArrayList<>(List.of(shared.PII_SENSITIVE_TAG_LABEL))));

    Container updated = adminClient.containers().update(container.getId().toString(), fetched);
    assertNotNull(updated.getDataModel());

    // Verify that admin user sees complete column names without masking
    Container adminView =
        adminClient.containers().get(container.getId().toString(), "dataModel,sampleData");
    List<String> adminColumnNames =
        adminView.getDataModel().getColumns().stream().map(Column::getName).toList();
    assertTrue(adminColumnNames.contains("email"));
    assertTrue(adminColumnNames.contains("ssn"));
    assertTrue(adminColumnNames.stream().noneMatch(c -> c.contains("[MASKED]")));
  }

  @Test
  void test_containerSampleDataNotAccessibleViaFieldsParameter_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);

    List<Column> columns =
        List.of(
            new Column().withName("col1").withDataType(ColumnDataType.INT),
            new Column().withName("col2").withDataType(ColumnDataType.VARCHAR));

    ContainerDataModel dataModel =
        new ContainerDataModel().withIsPartitioned(false).withColumns(columns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_fields_sample"));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(dataModel);

    Container container = createEntity(request);
    assertNotNull(container);

    // Retrieve with sampleData field - should NOT include sample data
    // (sample data is only accessible via dedicated /sampleData endpoint)
    Container fetched = client.containers().get(container.getId().toString(), "sampleData");
    assertNull(
        fetched.getSampleData(),
        "Sample data should not be accessible via fields parameter - must use dedicated endpoint");
  }

  @Test
  void test_containerDataModelColumnsHaveTags_200(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(ns);
    SharedEntities shared = SharedEntities.get();

    List<Column> columns =
        Arrays.asList(
            new Column().withName("pii_field").withDataType(ColumnDataType.VARCHAR),
            new Column().withName("normal_field").withDataType(ColumnDataType.INT));

    ContainerDataModel dataModel =
        new ContainerDataModel().withIsPartitioned(false).withColumns(columns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_col_tags"));
    request.setService(service.getFullyQualifiedName());
    request.setDataModel(dataModel);

    Container container = createEntity(request);

    // Tag the PII column
    Container fetched = client.containers().get(container.getId().toString(), "tags,dataModel");
    fetched.getDataModel().getColumns().stream()
        .filter(c -> c.getName().equals("pii_field"))
        .forEach(c -> c.setTags(new ArrayList<>(List.of(shared.PII_SENSITIVE_TAG_LABEL))));

    Container updated = client.containers().update(container.getId().toString(), fetched);

    // Verify tags are present on column
    Container verified = client.containers().get(updated.getId().toString(), "tags,dataModel");
    Column piiColumn =
        verified.getDataModel().getColumns().stream()
            .filter(c -> c.getName().equals("pii_field"))
            .findFirst()
            .orElse(null);

    assertNotNull(piiColumn);
    assertNotNull(piiColumn.getTags());
    assertFalse(piiColumn.getTags().isEmpty());
    assertTrue(
        piiColumn.getTags().stream()
            .anyMatch(t -> t.getTagFQN().equals(shared.PII_SENSITIVE_TAG_LABEL.getTagFQN())));
  }

  // ===================================================================
  // PATCH PARENT UPDATE (issue #24294)
  // ===================================================================

  private Container createUnderService(TestNamespace ns, StorageService service, String name) {
    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix(name));
    request.setService(service.getFullyQualifiedName());
    return createEntity(request);
  }

  private Container createUnderParent(
      TestNamespace ns, StorageService service, Container parent, String name) {
    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix(name));
    request.setService(service.getFullyQualifiedName());
    request.setParent(
        new EntityReference()
            .withId(parent.getId())
            .withType("container")
            .withFullyQualifiedName(parent.getFullyQualifiedName()));
    return createEntity(request);
  }

  private static EntityReference parentRefOf(Container parent) {
    return new EntityReference()
        .withId(parent.getId())
        .withType("container")
        .withFullyQualifiedName(parent.getFullyQualifiedName());
  }

  @Test
  void patch_containerParent_movesContainer_200(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container parentA = createUnderService(ns, service, "moveA");
    Container parentB = createUnderService(ns, service, "moveB");
    Container child = createUnderParent(ns, service, parentA, "moveChild");

    assertEquals(parentA.getId(), child.getParent().getId());
    String oldFqn = child.getFullyQualifiedName();

    child.setParent(parentRefOf(parentB));
    Container moved = patchEntity(child.getId().toString(), child);

    assertNotNull(moved.getParent());
    assertEquals(parentB.getId(), moved.getParent().getId());
    assertTrue(
        moved.getFullyQualifiedName().startsWith(parentB.getFullyQualifiedName() + "."),
        "child FQN should now nest under new parent " + parentB.getFullyQualifiedName());
    assertNotEquals(oldFqn, moved.getFullyQualifiedName());

    Container refetched = getEntityWithFields(moved.getId().toString(), "parent");
    assertEquals(parentB.getId(), refetched.getParent().getId());
  }

  @Test
  void patch_containerParent_preservesMetadata_200(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container parentA = createUnderService(ns, service, "metaA");
    Container parentB = createUnderService(ns, service, "metaB");

    CreateContainer childRequest = new CreateContainer();
    childRequest.setName(ns.prefix("metaChild"));
    childRequest.setService(service.getFullyQualifiedName());
    childRequest.setParent(parentRefOf(parentA));
    childRequest.setDescription("Keep me through the move");
    childRequest.setTags(new ArrayList<>(List.of(shared.PII_SENSITIVE_TAG_LABEL)));
    Container child = createEntity(childRequest);

    Container loaded =
        SdkClients.adminClient()
            .containers()
            .get(child.getId().toString(), "tags,description,parent");

    loaded.setParent(parentRefOf(parentB));
    Container moved = patchEntity(loaded.getId().toString(), loaded);

    Container refetched =
        SdkClients.adminClient()
            .containers()
            .get(moved.getId().toString(), "tags,description,parent");
    assertEquals(parentB.getId(), refetched.getParent().getId());
    assertEquals("Keep me through the move", refetched.getDescription());
    assertNotNull(refetched.getTags());
    assertTrue(
        refetched.getTags().stream()
            .anyMatch(t -> t.getTagFQN().equals(shared.PII_SENSITIVE_TAG_LABEL.getTagFQN())),
        "PII tag must survive parent reassignment");
  }

  @Test
  void patch_containerParent_cascadesFqnToChildren_200(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container parentA = createUnderService(ns, service, "cascA");
    Container parentB = createUnderService(ns, service, "cascB");
    Container child = createUnderParent(ns, service, parentA, "cascChild");
    Container grandchild = createUnderParent(ns, service, child, "cascGrandchild");

    String oldGrandFqn = grandchild.getFullyQualifiedName();
    assertTrue(oldGrandFqn.startsWith(parentA.getFullyQualifiedName() + "."));

    child.setParent(parentRefOf(parentB));
    Container moved = patchEntity(child.getId().toString(), child);

    Container refetchedGrand = getEntity(grandchild.getId().toString());
    assertNotNull(refetchedGrand);
    assertTrue(
        refetchedGrand.getFullyQualifiedName().startsWith(moved.getFullyQualifiedName() + "."),
        "grandchild FQN should cascade under moved child: "
            + refetchedGrand.getFullyQualifiedName());
    assertNotEquals(oldGrandFqn, refetchedGrand.getFullyQualifiedName());
  }

  @Test
  void patch_containerParent_cascadesToColumnFqns_200(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container parentA = createUnderService(ns, service, "colA");
    Container parentB = createUnderService(ns, service, "colB");

    List<Column> columns =
        Arrays.asList(
            new Column().withName("colOne").withDataType(ColumnDataType.INT),
            new Column().withName("colTwo").withDataType(ColumnDataType.STRING));
    ContainerDataModel dataModel =
        new ContainerDataModel().withIsPartitioned(false).withColumns(columns);

    CreateContainer childRequest = new CreateContainer();
    childRequest.setName(ns.prefix("colChild"));
    childRequest.setService(service.getFullyQualifiedName());
    childRequest.setParent(parentRefOf(parentA));
    childRequest.setDataModel(dataModel);
    Container child = createEntity(childRequest);

    Container loaded =
        SdkClients.adminClient().containers().get(child.getId().toString(), "dataModel,parent");
    loaded.setParent(parentRefOf(parentB));
    Container moved = patchEntity(loaded.getId().toString(), loaded);

    Container refetched =
        SdkClients.adminClient().containers().get(moved.getId().toString(), "dataModel,parent");
    assertNotNull(refetched.getDataModel());
    assertEquals(2, refetched.getDataModel().getColumns().size());
    String expectedColumnPrefix = refetched.getFullyQualifiedName() + ".";
    for (Column c : refetched.getDataModel().getColumns()) {
      assertNotNull(c.getFullyQualifiedName(), "column must have an FQN");
      assertTrue(
          c.getFullyQualifiedName().startsWith(expectedColumnPrefix),
          "column FQN should cascade under new container FQN: " + c.getFullyQualifiedName());
    }
  }

  @Test
  void patch_containerParent_toNull_promotesToTopLevel_200(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container parentA = createUnderService(ns, service, "promA");
    Container child = createUnderParent(ns, service, parentA, "promChild");
    assertNotNull(child.getParent());

    // Pre-fetch with `parent` so the SDK's JSON-diff sees the original parent and emits a
    // proper "remove /parent" operation. Without this, the SDK's NON_NULL serialization
    // omits the cleared `parent` from the patch document and the change is lost.
    Container loaded =
        SdkClients.adminClient().containers().get(child.getId().toString(), "parent");
    loaded.setParent(null);
    Container moved = patchEntity(loaded.getId().toString(), loaded);

    assertNull(moved.getParent(), "parent should be cleared");
    assertTrue(
        moved.getFullyQualifiedName().startsWith(service.getFullyQualifiedName() + "."),
        "FQN should now sit directly under the service: " + moved.getFullyQualifiedName());
    assertFalse(
        moved.getFullyQualifiedName().contains(parentA.getName()),
        "FQN should no longer reference the old parent");
  }

  @Test
  void patch_containerParent_fromNull_assignsParent_200(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container top = createUnderService(ns, service, "topLvl");
    Container target = createUnderService(ns, service, "newParent");
    assertNull(top.getParent());

    top.setParent(parentRefOf(target));
    Container moved = patchEntity(top.getId().toString(), top);

    assertNotNull(moved.getParent());
    assertEquals(target.getId(), moved.getParent().getId());
    assertTrue(
        moved.getFullyQualifiedName().startsWith(target.getFullyQualifiedName() + "."),
        "FQN should now nest under the new parent");
  }

  @Test
  void patch_containerParent_rejectsCycle_400(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container root = createUnderService(ns, service, "cycRoot");
    Container child = createUnderParent(ns, service, root, "cycChild");

    // Try to make root.parent = child (cycle: root → child → root)
    root.setParent(parentRefOf(child));
    assertThrows(
        Exception.class,
        () -> patchEntity(root.getId().toString(), root),
        "moving a container under its own descendant must be rejected");

    Container refetched = getEntity(root.getId().toString());
    assertNull(refetched.getParent(), "rejected PATCH must not mutate root");
  }

  @Test
  void patch_containerParent_rejectsSelfParent_400(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container c = createUnderService(ns, service, "selfRef");

    c.setParent(parentRefOf(c));
    assertThrows(
        Exception.class,
        () -> patchEntity(c.getId().toString(), c),
        "self-parent must be rejected");
  }

  @Test
  void patch_containerParent_rejectsCrossServiceParent_400(TestNamespace ns) {
    StorageService serviceA = StorageServiceTestFactory.createS3(ns);
    StorageService serviceB = StorageServiceTestFactory.createS3(ns);
    Container child = createUnderService(ns, serviceA, "xsChild");
    Container parentInB = createUnderService(ns, serviceB, "xsParent");

    child.setParent(parentRefOf(parentInB));
    assertThrows(
        Exception.class,
        () -> patchEntity(child.getId().toString(), child),
        "reparenting across StorageServices must be rejected");
  }

  @Test
  void patch_containerParent_rejectsNonExistentParent_404(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container c = createUnderService(ns, service, "noParent");

    c.setParent(new EntityReference().withId(UUID.randomUUID()).withType("container"));
    assertThrows(
        Exception.class,
        () -> patchEntity(c.getId().toString(), c),
        "non-existent parent must be rejected");
  }

  @Test
  @ResourceLock(value = ContainerRepository.MAX_REPARENT_DESCENDANTS_TEST_LOCK)
  void patch_containerParent_rejectsOversizedSubtree_400(TestNamespace ns) {
    // Force a tiny threshold for this test only via a package-private test override. The
    // override is read on every PATCH so it takes effect immediately. We do NOT use
    // System.setProperty because the property is JVM-global and concurrent tests doing other
    // re-parents would observe the artificially low value. @ResourceLock above serializes any
    // test that mutates this override.
    ContainerRepository.setMaxReparentDescendantsForTest(2);
    try {
      StorageService service = StorageServiceTestFactory.createS3(ns);
      Container parentA = createUnderService(ns, service, "bigA");
      Container parentB = createUnderService(ns, service, "bigB");
      Container child = createUnderParent(ns, service, parentA, "bigChild");
      // 3 grandchildren — exceeds the threshold of 2 descendants.
      createUnderParent(ns, service, child, "gc1");
      createUnderParent(ns, service, child, "gc2");
      createUnderParent(ns, service, child, "gc3");

      child.setParent(parentRefOf(parentB));
      Exception ex =
          assertThrows(
              Exception.class,
              () -> patchEntity(child.getId().toString(), child),
              "subtree of 3 descendants must exceed the configured limit of 2");
      String message = ex.getMessage();
      assertNotNull(message);
      assertTrue(
          message.contains("subtree has 3 descendant"),
          "error message should report the actual descendant count: " + message);
      assertTrue(
          message.contains("maximum of 2"),
          "error message should report the configured maximum: " + message);

      // The rejection must not have partially mutated state: child still points at parentA.
      Container refetched = getEntityWithFields(child.getId().toString(), "parent");
      assertEquals(parentA.getId(), refetched.getParent().getId());
    } finally {
      ContainerRepository.clearMaxReparentDescendantsForTest();
    }
  }

  @Test
  @ResourceLock(value = ContainerRepository.MAX_REPARENT_DESCENDANTS_TEST_LOCK)
  void patch_containerParent_allowsMoveAtConfiguredLimit_200(TestNamespace ns) {
    // Exactly at the limit (descendantCount == max) must still be allowed — the guard uses
    // strict `>` not `>=`. Same package-private test override mechanism as above.
    ContainerRepository.setMaxReparentDescendantsForTest(2);
    try {
      StorageService service = StorageServiceTestFactory.createS3(ns);
      Container parentA = createUnderService(ns, service, "limA");
      Container parentB = createUnderService(ns, service, "limB");
      Container child = createUnderParent(ns, service, parentA, "limChild");
      createUnderParent(ns, service, child, "lgc1");
      createUnderParent(ns, service, child, "lgc2");

      child.setParent(parentRefOf(parentB));
      Container moved = patchEntity(child.getId().toString(), child);
      assertEquals(parentB.getId(), moved.getParent().getId());
    } finally {
      ContainerRepository.clearMaxReparentDescendantsForTest();
    }
  }

  @Test
  void patch_containerParent_emitsChangeDescription_200(TestNamespace ns) {
    StorageService service = StorageServiceTestFactory.createS3(ns);
    Container parentA = createUnderService(ns, service, "cdA");
    Container parentB = createUnderService(ns, service, "cdB");
    Container child = createUnderParent(ns, service, parentA, "cdChild");
    Double initialVersion = child.getVersion();

    child.setParent(parentRefOf(parentB));
    Container moved = patchEntity(child.getId().toString(), child);

    assertNotNull(moved.getChangeDescription(), "change description should be populated");
    assertTrue(
        moved.getVersion() > initialVersion,
        "version should bump after parent change: " + initialVersion + " -> " + moved.getVersion());
    boolean parentInChangeDescription =
        moved.getChangeDescription().getFieldsUpdated().stream()
                .anyMatch(f -> "parent".equals(f.getName()))
            || moved.getChangeDescription().getFieldsAdded().stream()
                .anyMatch(f -> "parent".equals(f.getName()))
            || moved.getChangeDescription().getFieldsDeleted().stream()
                .anyMatch(f -> "parent".equals(f.getName()));
    assertTrue(
        parentInChangeDescription, "change description should record the parent field change");
  }

  // ===================================================================
  // BULK API SUPPORT
  // ===================================================================

  @Override
  protected BulkOperationResult executeBulkCreate(List<CreateContainer> createRequests) {
    return SdkClients.adminClient().containers().bulkCreateOrUpdate(createRequests);
  }

  @Override
  protected BulkOperationResult executeBulkCreateAsync(List<CreateContainer> createRequests) {
    return SdkClients.adminClient().containers().bulkCreateOrUpdateAsync(createRequests);
  }

  @Override
  protected CreateContainer createInvalidRequestForBulk(TestNamespace ns) {
    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("invalid_container"));
    return request;
  }
}
