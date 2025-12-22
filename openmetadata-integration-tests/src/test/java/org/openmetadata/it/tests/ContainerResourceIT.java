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
  protected CreateContainer createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    StorageService service = StorageServiceTestFactory.createS3(client, ns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Test container created by integration test");

    return request;
  }

  @Override
  protected CreateContainer createRequest(
      String name, TestNamespace ns, OpenMetadataClient client) {
    StorageService service = StorageServiceTestFactory.createS3(client, ns);

    CreateContainer request = new CreateContainer();
    request.setName(name);
    request.setService(service.getFullyQualifiedName());

    return request;
  }

  @Override
  protected Container createEntity(CreateContainer createRequest, OpenMetadataClient client) {
    return client.containers().create(createRequest);
  }

  @Override
  protected Container getEntity(String id, OpenMetadataClient client) {
    return client.containers().get(id);
  }

  @Override
  protected Container getEntityByName(String fqn, OpenMetadataClient client) {
    return client.containers().getByName(fqn);
  }

  @Override
  protected Container patchEntity(String id, Container entity, OpenMetadataClient client) {
    return client.containers().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.containers().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.containers().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.containers().delete(id, params);
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
  protected ListResponse<Container> listEntities(ListParams params, OpenMetadataClient client) {
    return client.containers().list(params);
  }

  @Override
  protected Container getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.containers().get(id, fields);
  }

  @Override
  protected Container getEntityByNameWithFields(
      String fqn, String fields, OpenMetadataClient client) {
    return client.containers().getByName(fqn, fields);
  }

  @Override
  protected Container getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.containers().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.containers().getVersionList(id);
  }

  @Override
  protected Container getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.containers().getVersion(id.toString(), version);
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
        () -> createEntity(request, client),
        "Creating container without service should fail");
  }

  @Test
  void post_containerWithDataModel_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(client, ns);

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

    Container container = createEntity(request, client);
    assertNotNull(container);
    assertNotNull(container.getDataModel());
    assertNotNull(container.getDataModel().getColumns());
    assertEquals(2, container.getDataModel().getColumns().size());
  }

  @Test
  void post_containerWithFileFormats_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(client, ns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_with_formats"));
    request.setService(service.getFullyQualifiedName());
    request.setFileFormats(List.of(ContainerFileFormat.Parquet, ContainerFileFormat.Csv));

    Container container = createEntity(request, client);
    assertNotNull(container);
    assertNotNull(container.getFileFormats());
    assertEquals(2, container.getFileFormats().size());
    assertTrue(container.getFileFormats().contains(ContainerFileFormat.Parquet));
    assertTrue(container.getFileFormats().contains(ContainerFileFormat.Csv));
  }

  @Test
  void post_containerWithPrefix_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(client, ns);

    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_with_prefix"));
    request.setService(service.getFullyQualifiedName());
    request.setPrefix("/data/raw/");

    Container container = createEntity(request, client);
    assertNotNull(container);
    assertEquals("/data/raw/", container.getPrefix());
  }

  @Test
  void post_containerWithParent_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(client, ns);

    // Create parent container
    CreateContainer parentRequest = new CreateContainer();
    parentRequest.setName(ns.prefix("parent_container"));
    parentRequest.setService(service.getFullyQualifiedName());

    Container parentContainer = createEntity(parentRequest, client);
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

    Container childContainer = createEntity(childRequest, client);
    assertNotNull(childContainer);
    assertNotNull(childContainer.getParent());
    assertEquals(parentContainer.getId(), childContainer.getParent().getId());
  }

  @Test
  void put_containerDataModel_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    StorageService service = StorageServiceTestFactory.createS3(client, ns);

    // Create container without data model
    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_add_model"));
    request.setService(service.getFullyQualifiedName());

    Container container = createEntity(request, client);
    assertNotNull(container);

    // Add data model via update
    List<Column> columns =
        Arrays.asList(
            new Column().withName("col1").withDataType(ColumnDataType.INT),
            new Column().withName("col2").withDataType(ColumnDataType.STRING));

    ContainerDataModel dataModel =
        new ContainerDataModel().withIsPartitioned(true).withColumns(columns);

    container.setDataModel(dataModel);
    Container updated = patchEntity(container.getId().toString(), container, client);
    assertNotNull(updated);
    assertNotNull(updated.getDataModel());
    assertEquals(2, updated.getDataModel().getColumns().size());
  }

  @Test
  void test_containerInheritsDomainFromService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a storage service
    StorageService service = StorageServiceTestFactory.createS3(client, ns);

    // Create a container under the service
    CreateContainer request = new CreateContainer();
    request.setName(ns.prefix("container_inherit_domain"));
    request.setService(service.getFullyQualifiedName());

    Container container = createEntity(request, client);
    assertNotNull(container);
    assertNotNull(container.getService());
    assertEquals(service.getFullyQualifiedName(), container.getService().getFullyQualifiedName());
  }
}
