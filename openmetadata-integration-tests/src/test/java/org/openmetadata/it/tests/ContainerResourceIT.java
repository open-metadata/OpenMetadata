package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

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
}
