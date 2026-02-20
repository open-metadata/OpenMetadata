package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
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
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

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

  {
    supportsLifeCycle = true;
    supportsListHistoryByTimestamp = true;
    supportsBulkAPI = true;
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
    return SdkClients.adminClient().containers().create(createRequest);
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
  }

  @Test
  void test_containerChildrenPagination(TestNamespace ns) {
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

    Container fetchedParent = client.containers().get(parent.getId().toString(), "children");
    assertNotNull(fetchedParent.getChildren());
    assertEquals(5, fetchedParent.getChildren().size());
  }

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
