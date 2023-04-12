package org.openmetadata.service.resources.objectstores;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.schema.type.ColumnDataType.BIGINT;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.resources.databases.TableResourceTest.assertColumns;
import static org.openmetadata.service.resources.databases.TableResourceTest.getColumn;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.ContainerFileFormat;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.objectstores.ContainerResource.ContainerList;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class ContainerResourceTest extends EntityResourceTest<Container, CreateContainer> {

  public static final List<Column> dataModelColumns =
      List.of(
          getColumn(C1, BIGINT, USER_ADDRESS_TAG_LABEL),
          getColumn(C2, ColumnDataType.VARCHAR, USER_ADDRESS_TAG_LABEL).withDataLength(10),
          getColumn(C3, BIGINT, GLOSSARY1_TERM1_LABEL));

  public static final ContainerDataModel PARTITIONED_DATA_MODEL =
      new ContainerDataModel().withIsPartitioned(true).withColumns(dataModelColumns);

  public static final List<ContainerFileFormat> FILE_FORMATS = List.of(ContainerFileFormat.Parquet);

  public ContainerResourceTest() {
    super(Entity.CONTAINER, Container.class, ContainerList.class, "containers", ContainerResource.FIELDS);
  }

  @Test
  void post_validContainers_200_OK(TestInfo test) throws IOException {
    // Create valid container
    CreateContainer create = createRequest(test);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create.withName(getEntityName(test, 1)).withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_validContainer_WithParentContainer_200_OK(TestInfo test) throws IOException {
    // Create valid container
    CreateContainer create = createRequest(test).withName("some_parent_container");
    Container parent = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create.withName("child_container").withParent(parent.getEntityReference());
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_ContainerWithoutDataModel_200_ok(TestInfo test) throws IOException {
    CreateContainer create = createRequest(test).withDataModel(null);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_ContainerWithoutFileFormats_200_ok(TestInfo test) throws IOException {
    CreateContainer create = createRequest(test).withFileFormats(null);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_ContainerWithoutObjectStoreService_400(TestInfo test) {
    CreateContainer create = createRequest(test).withService(null);
    assertResponse(() -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "[service must not be null]");
  }

  @Test
  void post_ContainerWithInvalidObjectStoreReference_404(TestInfo test) {
    String serviceFQN = UUID.randomUUID().toString();
    CreateContainer create = createRequest(test).withService(serviceFQN);
    assertResponse(
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        String.format("objectStoreService instance for %s not found", serviceFQN));
  }

  @Test
  void post_ContainerWithInvalidParentContainerReference_404(TestInfo test) {
    UUID randomUUID = UUID.randomUUID();
    EntityReference randomContainerReference = new EntityReference().withId(randomUUID).withType(Entity.CONTAINER);
    CreateContainer create = createRequest(test).withParent(randomContainerReference);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.CONTAINER, randomUUID.toString()));
  }

  @Test
  void put_ContainerUpdateWithNoChange_200(TestInfo test) throws IOException {
    // Create a Model with POST
    CreateContainer request = createRequest(test).withOwner(USER1_REF);
    Container container = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(container.getVersion());

    // Update Container two times successfully with PUT requests
    updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);
  }

  @Test
  void put_ContainerAddDataModel_200(TestInfo test) throws IOException {
    CreateContainer request = createRequest(test).withDataModel(null);
    Container container = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(container.getVersion());

    fieldAdded(change, "dataModel", PARTITIONED_DATA_MODEL);

    updateAndCheckEntity(request.withDataModel(PARTITIONED_DATA_MODEL), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_ContainerUpdateDataModel_200(TestInfo test) throws IOException {
    CreateContainer request = createRequest(test);
    Container container = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(container.getVersion());

    // We are removing the columns here. This is a major change
    ContainerDataModel newDataModel = PARTITIONED_DATA_MODEL.withIsPartitioned(false);
    fieldUpdated(change, "dataModel.partition", true, false);
    updateAndCheckEntity(request.withDataModel(newDataModel), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  @Order(1) // Run this test first as other tables created in other tests will interfere with listing
  void get_ContainerListWithDifferentFields_200(TestInfo testInfo) throws IOException {
    /*
     *                 root_container
     *                       |
     *                    /     \
     *                   /       \
     *                child_1  child_2
     *                  |
     *                /
     *               /
     *           child_3
     *
     */
    CreateContainer createRootContainer =
        new CreateContainer()
            .withName("0_root")
            .withService(S3_OBJECT_STORE_SERVICE_REFERENCE.getName())
            .withNumberOfObjects(0.0)
            .withOwner(USER_WITH_DATA_CONSUMER_ROLE.getEntityReference())
            .withSize(0.0);
    Container rootContainer = createAndCheckEntity(createRootContainer, ADMIN_AUTH_HEADERS);

    CreateContainer createChildOneContainer =
        new CreateContainer()
            .withName("1_child_1")
            .withService(S3_OBJECT_STORE_SERVICE_REFERENCE.getName())
            .withParent(rootContainer.getEntityReference())
            .withNumberOfObjects(0.0)
            .withSize(0.0);
    Container childOneContainer = createAndCheckEntity(createChildOneContainer, ADMIN_AUTH_HEADERS);

    CreateContainer createChildTwoContainer =
        new CreateContainer()
            .withName("2_child_2")
            .withService(S3_OBJECT_STORE_SERVICE_REFERENCE.getName())
            .withParent(rootContainer.getEntityReference())
            .withNumberOfObjects(0.0)
            .withSize(0.0);
    Container childTwoContainer = createAndCheckEntity(createChildTwoContainer, ADMIN_AUTH_HEADERS);

    CreateContainer createChildThreeContainer =
        new CreateContainer()
            .withName("3_child_3")
            .withService(S3_OBJECT_STORE_SERVICE_REFERENCE.getName())
            .withParent(childOneContainer.getEntityReference())
            .withNumberOfObjects(0.0)
            .withSize(0.0);
    Container childThreeContainer = createAndCheckEntity(createChildThreeContainer, ADMIN_AUTH_HEADERS);

    // GET .../containers?fields=parent,children
    // filter by owner to get only the root container and make sure only the first level children are returned
    final String fields = "parent,children";
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("fields", fields);
    ResultList<Container> containerList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    // ensure order by using the string prefix in name
    List<Container> containers = containerList.getData();
    containers.sort(Comparator.comparing(Container::getName));
    assertEquals(4, containerList.getData().size());

    // root container checks
    Container returnedRootContainer = containers.get(0);
    assertEquals(returnedRootContainer.getName(), rootContainer.getName());
    assertEquals("s3.0_root", returnedRootContainer.getFullyQualifiedName());
    assertNull(returnedRootContainer.getParent());

    List<EntityReference> rootContainerChildren = returnedRootContainer.getChildren();
    rootContainerChildren.sort(Comparator.comparing(EntityReference::getName));
    // should return only first level children and not grand-children
    assertEquals(2, rootContainerChildren.size());
    EntityReference childOneReference = rootContainerChildren.get(0);
    EntityReference childTwoReference = rootContainerChildren.get(1);
    assertEquals(childOneReference.getName(), childOneContainer.getName());
    assertEquals("s3.0_root.1_child_1", childOneReference.getFullyQualifiedName());
    assertEquals(childTwoReference.getName(), childTwoContainer.getName());
    assertEquals("s3.0_root.2_child_2", childTwoReference.getFullyQualifiedName());

    // child one container checks
    Container returnedChildOneContainer = containers.get(1);
    assertEquals(returnedChildOneContainer.getName(), childOneContainer.getName());
    assertEquals("s3.0_root.1_child_1", returnedChildOneContainer.getFullyQualifiedName());
    assertEquals(returnedChildOneContainer.getParent().getId(), rootContainer.getId());

    List<EntityReference> childOneContainerChildren = returnedChildOneContainer.getChildren();
    childOneContainerChildren.sort(Comparator.comparing(EntityReference::getName));
    // should return only first level children and not grand-children
    assertEquals(1, childOneContainerChildren.size());
    EntityReference childOneChildReference = childOneContainerChildren.get(0);
    assertEquals(childOneChildReference.getName(), childThreeContainer.getName());
    assertEquals("s3.0_root.1_child_1.3_child_3", childOneChildReference.getFullyQualifiedName());

    // child two container checks
    Container returnedChildTwoContainer = containers.get(2);
    assertEquals(returnedChildTwoContainer.getName(), childTwoContainer.getName());
    assertEquals("s3.0_root.2_child_2", returnedChildTwoContainer.getFullyQualifiedName());
    assertEquals(returnedChildTwoContainer.getParent().getId(), rootContainer.getId());
    assertEquals(0, returnedChildTwoContainer.getChildren().size());

    // child three container checks
    Container returnedChildThreeContainer = containers.get(3);
    assertEquals(returnedChildThreeContainer.getName(), childThreeContainer.getName());
    assertEquals("s3.0_root.1_child_1.3_child_3", childThreeContainer.getFullyQualifiedName());
    assertEquals(returnedChildThreeContainer.getParent().getId(), childOneContainer.getId());
    assertEquals(0, returnedChildThreeContainer.getChildren().size());

    // Test that we can list only the root level containers (no parents)
    queryParams.put("root", "true");
    ResultList<Container> rootContainerList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(1, rootContainerList.getData().size());
    assertEquals("s3.0_root", rootContainerList.getData().get(0).getFullyQualifiedName());
  }

  @Override
  public CreateContainer createRequest(String name) {
    return new CreateContainer()
        .withName(name)
        .withService(S3_OBJECT_STORE_SERVICE_REFERENCE.getFullyQualifiedName())
        .withDataModel(PARTITIONED_DATA_MODEL)
        .withFileFormats(FILE_FORMATS)
        .withNumberOfObjects(3.0)
        .withSize(4096.0);
  }

  @Override
  public void validateCreatedEntity(
      Container createdEntity, CreateContainer createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertReference(createRequest.getService(), createdEntity.getService());
    assertReference(createRequest.getParent(), createdEntity.getParent());
    if (createRequest.getDataModel() != null) {
      assertEquals(createRequest.getDataModel().getIsPartitioned(), createdEntity.getDataModel().getIsPartitioned());
      assertColumns(createRequest.getDataModel().getColumns(), createdEntity.getDataModel().getColumns());
    }
    assertListProperty(
        createRequest.getFileFormats(), createdEntity.getFileFormats(), (c1, c2) -> assertEquals(c1.name(), c2.name()));
    assertEquals(createRequest.getNumberOfObjects(), createdEntity.getNumberOfObjects());
    assertEquals(createRequest.getSize(), createdEntity.getSize());

    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
    TestUtils.validateEntityReferences(createdEntity.getFollowers());

    assertEquals(
        createdEntity.getParent() != null
            ? FullyQualifiedName.add(createdEntity.getParent().getFullyQualifiedName(), createdEntity.getName())
            : FullyQualifiedName.add(createdEntity.getService().getFullyQualifiedName(), createdEntity.getName()),
        createdEntity.getFullyQualifiedName());
  }

  @Override
  public void compareEntities(Container expected, Container patched, Map<String, String> authHeaders)
      throws HttpResponseException {
    TestUtils.validateEntityReference(patched.getService());
    assertEquals(expected.getService().getId(), patched.getService().getId());
    if (expected.getDataModel() != null) {
      assertEquals(expected.getDataModel().getIsPartitioned(), patched.getDataModel().getIsPartitioned());
      assertColumns(expected.getDataModel().getColumns(), patched.getDataModel().getColumns());
    }
    assertListProperty(
        expected.getFileFormats(), patched.getFileFormats(), (c1, c2) -> assertEquals(c1.name(), c2.name()));
    assertEquals(expected.getNumberOfObjects(), patched.getNumberOfObjects());
    assertEquals(expected.getSize(), patched.getSize());

    TestUtils.validateTags(expected.getTags(), patched.getTags());
    TestUtils.validateEntityReferences(patched.getFollowers());

    /* parent of container can't be updated, so don't check it here */
  }

  @Override
  public Container validateGetWithDifferentFields(Container container, boolean byName) throws HttpResponseException {
    container =
        byName
            ? getEntityByName(container.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS)
            : getEntity(container.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNotNull(container.getService());
    assertListNull(
        container.getParent(),
        container.getChildren(),
        container.getDataModel(),
        container.getOwner(),
        container.getTags(),
        container.getFollowers(),
        container.getExtension());

    // .../models?fields=dataModel - parent,children are not set in createEntity - these are tested separately
    String fields = "dataModel,owner,tags,followers,extension";
    container =
        byName
            ? getEntityByName(container.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(container.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(container.getService());
    assertListNotNull(container.getDataModel());

    // Checks for other owner, tags, and followers is done in the base class
    return container;
  }

  @Override
  @SuppressWarnings("unchecked")
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    if (fieldName.contains("numberOfObjects")) {
      assertEquals((Integer) expected, (Integer) actual);
    } else if (fieldName.contains("size")) {
      assertEquals((Integer) expected, (Integer) actual);
    } else if (fieldName.contains("fileFormats")) {
      assertFileFormats((List<ContainerFileFormat>) expected, (List<ContainerFileFormat>) actual);
    } else if (fieldName.contains("dataModel")) {
      assertDataModel((ContainerDataModel) expected, (String) actual);
    }
  }

  private void assertDataModel(ContainerDataModel expected, String actualJson) throws IOException {
    ContainerDataModel actualDataModel = JsonUtils.readValue(actualJson, ContainerDataModel.class);
    assertEquals(expected.getIsPartitioned(), actualDataModel.getIsPartitioned());
    assertColumns(expected.getColumns(), actualDataModel.getColumns());
  }

  private void assertFileFormats(List<ContainerFileFormat> expected, List<ContainerFileFormat> actual)
      throws IOException {
    List<ContainerFileFormat> actualFeatures = JsonUtils.readObjects(actual.toString(), ContainerFileFormat.class);
    assertListProperty(expected, actualFeatures, (c1, c2) -> assertEquals(c1.name(), c2.name()));
  }
}
