package org.openmetadata.service.resources.storages;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.CREATED;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static java.util.Collections.singletonList;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.schema.type.ColumnDataType.ARRAY;
import static org.openmetadata.schema.type.ColumnDataType.BIGINT;
import static org.openmetadata.schema.type.ColumnDataType.CHAR;
import static org.openmetadata.schema.type.ColumnDataType.INT;
import static org.openmetadata.schema.type.ColumnDataType.STRUCT;
import static org.openmetadata.service.Entity.TAG;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.resources.databases.TableResourceTest.assertColumns;
import static org.openmetadata.service.resources.databases.TableResourceTest.getColumn;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.FullyQualifiedName.build;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.CHANGE_CONSOLIDATED;
import static org.openmetadata.service.util.TestUtils.UpdateType.MAJOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.services.CreateStorageService;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.ContainerFileFormat;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.StorageServiceResourceTest;
import org.openmetadata.service.resources.storages.ContainerResource.ContainerList;
import org.openmetadata.service.util.FullyQualifiedName;
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
    super(
        Entity.CONTAINER,
        Container.class,
        ContainerList.class,
        "containers",
        ContainerResource.FIELDS);
    supportsSearchIndex = true;
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
  void post_ContainerWithoutStorageService_400(TestInfo test) {
    CreateContainer create = createRequest(test).withService(null);
    assertResponse(
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param service must not be null]");
  }

  @Test
  void post_ContainerWithInvalidStorageReference_404(TestInfo test) {
    String serviceFQN = UUID.randomUUID().toString();
    CreateContainer create = createRequest(test).withService(serviceFQN);
    assertResponse(
        () -> createAndCheckEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        String.format("storageService instance for %s not found", serviceFQN));
  }

  @Test
  void post_ContainerWithInvalidParentContainerReference_404(TestInfo test) {
    UUID randomUUID = UUID.randomUUID();
    EntityReference randomContainerReference =
        new EntityReference().withId(randomUUID).withType(Entity.CONTAINER);
    CreateContainer create = createRequest(test).withParent(randomContainerReference);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.CONTAINER, randomUUID.toString()));
  }

  @Test
  void put_ContainerUpdateWithNoChange_200(TestInfo test) throws IOException {
    // Create a Model with POST
    CreateContainer request = createRequest(test).withOwners(List.of(USER1_REF));
    Container container = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(container, NO_CHANGE);

    // Update Container two times successfully with PUT requests
    updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);
  }

  @Test
  void put_ContainerFields_200(TestInfo test) throws IOException {
    CreateContainer request =
        createRequest(test)
            .withDataModel(null)
            .withPrefix(null)
            .withFileFormats(null)
            .withNumberOfObjects(null);
    Container container = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    ChangeDescription change = getChangeDescription(container, MINOR_UPDATE);
    fieldAdded(change, "dataModel", PARTITIONED_DATA_MODEL);
    fieldAdded(change, "prefix", "prefix2");
    fieldAdded(change, "fileFormats", FILE_FORMATS);

    container =
        updateAndCheckEntity(
            request
                .withDataModel(PARTITIONED_DATA_MODEL)
                .withPrefix("prefix2")
                .withNumberOfObjects(10.0)
                .withSize(1.0)
                .withFileFormats(FILE_FORMATS),
            OK,
            ADMIN_AUTH_HEADERS,
            MINOR_UPDATE,
            change);
    assertEquals(1.0, container.getSize());
    assertEquals(10.0, container.getNumberOfObjects());

    change = getChangeDescription(container, MINOR_UPDATE);
    fieldUpdated(change, "prefix", "prefix2", "prefix3");
    container =
        updateAndCheckEntity(
            request.withPrefix("prefix3").withSize(5.0).withNumberOfObjects(15.0),
            OK,
            ADMIN_AUTH_HEADERS,
            MINOR_UPDATE,
            change);

    assertEquals(5.0, container.getSize());
    assertEquals(15.0, container.getNumberOfObjects());

    change = getChangeDescription(container, NO_CHANGE);
    container =
        updateAndCheckEntity(
            request.withPrefix("prefix3").withNumberOfObjects(3.0).withSize(2.0),
            OK,
            ADMIN_AUTH_HEADERS,
            NO_CHANGE,
            change);
    assertEquals(2.0, container.getSize());
    assertEquals(3.0, container.getNumberOfObjects());
  }

  @Test
  void patch_ContainerFields_200(TestInfo test) throws IOException {
    CreateContainer request =
        createRequest(test)
            .withDataModel(null)
            .withPrefix(null)
            .withFileFormats(null)
            .withNumberOfObjects(null);
    Container container = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Add dataModel, prefix, fileFormats
    String originalJson = JsonUtils.pojoToJson(container);
    ChangeDescription change = getChangeDescription(container, MINOR_UPDATE);
    container
        .withDataModel(PARTITIONED_DATA_MODEL)
        .withPrefix("prefix1")
        .withFileFormats(FILE_FORMATS)
        .withSize(1.0)
        .withNumberOfObjects(2.0);
    fieldAdded(change, "dataModel", PARTITIONED_DATA_MODEL);
    fieldAdded(change, "prefix", "prefix1");
    fieldAdded(change, "fileFormats", FILE_FORMATS);
    container =
        patchEntityAndCheck(container, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(1.0, container.getSize());
    assertEquals(2.0, container.getNumberOfObjects());

    // Update description, chartType and chart url and verify patch
    // Changes from this PATCH is consolidated with the previous changes
    originalJson = JsonUtils.pojoToJson(container);
    change = getChangeDescription(container, CHANGE_CONSOLIDATED);
    change.setPreviousVersion(container.getVersion());
    ContainerDataModel newModel =
        new ContainerDataModel()
            .withIsPartitioned(false)
            .withColumns(PARTITIONED_DATA_MODEL.getColumns());
    List<ContainerFileFormat> newFileFormats =
        List.of(ContainerFileFormat.Gz, ContainerFileFormat.Csv);
    container.withPrefix("prefix2").withDataModel(newModel).withFileFormats(newFileFormats);

    fieldUpdated(change, "prefix", "prefix1", "prefix2");
    fieldUpdated(change, "dataModel.partition", true, false);
    fieldDeleted(change, "fileFormats", FILE_FORMATS);
    fieldAdded(change, "fileFormats", newFileFormats);
    patchEntityAndCheck(container, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Update the container size and number of objects
    // Changes from this PATCH is consolidated with the previous changes
    originalJson = JsonUtils.pojoToJson(container);
    change = getChangeDescription(container, MINOR_UPDATE);
    container.withSize(2.0).withNumberOfObjects(3.0);
    container =
        patchEntityAndCheck(container, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(2.0, container.getSize());
    assertEquals(3.0, container.getNumberOfObjects());
  }

  @Test
  void noChangeForSomeFields(TestInfo test) throws IOException {
    CreateContainer request = createRequest(test).withDataModel(null).withSize(null);
    Container container = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(container, NO_CHANGE);

    container =
        updateAndCheckEntity(
            request.withSize(30.0).withNumberOfObjects(20.0),
            OK,
            ADMIN_AUTH_HEADERS,
            NO_CHANGE,
            change);
    assertEquals(30.0, container.getSize());
    assertEquals(20.0, container.getNumberOfObjects());
  }

  @Test
  void put_ContainerUpdateDataModel_200(TestInfo test) throws IOException {
    CreateContainer request = createRequest(test);
    Container container = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(container, MINOR_UPDATE);

    // We are removing the columns here. This is a major change
    ContainerDataModel newDataModel = PARTITIONED_DATA_MODEL.withIsPartitioned(false);
    fieldUpdated(change, "dataModel.partition", true, false);
    updateAndCheckEntity(
        request.withDataModel(newDataModel), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    PARTITIONED_DATA_MODEL.withIsPartitioned(true);
  }

  @Test
  void patch_usingFqn_ContainerFields_200(TestInfo test) throws IOException {
    CreateContainer request =
        createRequest(test)
            .withDataModel(null)
            .withPrefix(null)
            .withFileFormats(null)
            .withNumberOfObjects(null);
    Container container = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Add dataModel, prefix, fileFormats
    String originalJson = JsonUtils.pojoToJson(container);
    ChangeDescription change = getChangeDescription(container, MINOR_UPDATE);
    container
        .withDataModel(PARTITIONED_DATA_MODEL)
        .withPrefix("prefix1")
        .withFileFormats(FILE_FORMATS)
        .withSize(1.0)
        .withNumberOfObjects(2.0);
    fieldAdded(change, "dataModel", PARTITIONED_DATA_MODEL);
    fieldAdded(change, "prefix", "prefix1");
    fieldAdded(change, "fileFormats", FILE_FORMATS);
    container =
        patchEntityUsingFqnAndCheck(
            container, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(1.0, container.getSize());
    assertEquals(2.0, container.getNumberOfObjects());

    // Update description, chartType and chart url and verify patch
    // Changes from this PATCH is consolidated with the previous changes
    originalJson = JsonUtils.pojoToJson(container);
    change = getChangeDescription(container, MINOR_UPDATE);
    ContainerDataModel newModel =
        new ContainerDataModel()
            .withIsPartitioned(false)
            .withColumns(PARTITIONED_DATA_MODEL.getColumns());
    List<ContainerFileFormat> newFileFormats =
        List.of(ContainerFileFormat.Gz, ContainerFileFormat.Csv);
    container.withPrefix("prefix2").withDataModel(newModel).withFileFormats(newFileFormats);

    fieldUpdated(change, "prefix", "prefix1", "prefix2");
    fieldUpdated(change, "dataModel.partition", true, false);
    fieldDeleted(change, "fileFormats", FILE_FORMATS);
    fieldAdded(change, "fileFormats", newFileFormats);
    patchEntityUsingFqnAndCheck(container, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Update the container size and number of objects
    // Changes from this PATCH is consolidated with the previous changes
    originalJson = JsonUtils.pojoToJson(container);
    change = getChangeDescription(container, MINOR_UPDATE);
    container.withSize(2.0).withNumberOfObjects(3.0);
    container =
        patchEntityUsingFqnAndCheck(
            container, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertEquals(2.0, container.getSize());
    assertEquals(3.0, container.getNumberOfObjects());
  }

  @Test
  @Order(
      1) // Run this test first as other tables created in other tests will interfere with listing
  void get_ContainerListWithDifferentFields_200() throws IOException {
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
            .withOwners(List.of(DATA_CONSUMER.getEntityReference()))
            .withSize(0.0);
    Container rootContainer = createAndCheckEntity(createRootContainer, ADMIN_AUTH_HEADERS);
    String rootContainerFQN = rootContainer.getFullyQualifiedName();

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
    Container childThreeContainer =
        createAndCheckEntity(createChildThreeContainer, ADMIN_AUTH_HEADERS);

    // GET .../containers?fields=parent,children
    // filter by owner to get only the root container and make sure only the first level children
    // are returned
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

    // Test paginated child container list
    ResultList<Container> children = getContainerChildren(rootContainerFQN, null, null);
    assertEquals(2, children.getData().size());

    ResultList<Container> childrenWithLimit = getContainerChildren(rootContainerFQN, 5, 0);
    assertEquals(2, childrenWithLimit.getData().size());

    ResultList<Container> childrenWithOffset = getContainerChildren(rootContainerFQN, 1, 1);
    assertEquals(1, childrenWithOffset.getData().size());

    ResultList<Container> childrenWithLargeOffset = getContainerChildren(rootContainerFQN, 1, 3);
    assertTrue(childrenWithLargeOffset.getData().isEmpty());
  }

  @Test
  void test_mutuallyExclusiveTags() {
    // Apply mutually exclusive tags to a Container
    CreateContainer create =
        new CreateContainer()
            .withName("test")
            .withService(S3_OBJECT_STORE_SERVICE_REFERENCE.getName())
            .withNumberOfObjects(0.0)
            .withOwners(List.of(DATA_CONSUMER.getEntityReference()))
            .withSize(0.0)
            .withTags(List.of(TIER1_TAG_LABEL, TIER2_TAG_LABEL));
    // Apply mutually exclusive tags to a table
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));

    // Apply mutually exclusive tags to a topic field

    Column dataModelColumn =
        getColumn(C1, BIGINT, null).withTags(List.of(TIER1_TAG_LABEL, TIER2_TAG_LABEL));
    ContainerDataModel dataModel = new ContainerDataModel().withColumns(List.of(dataModelColumn));
    CreateContainer create1 =
        new CreateContainer()
            .withName("test")
            .withService(S3_OBJECT_STORE_SERVICE_REFERENCE.getName())
            .withNumberOfObjects(0.0)
            .withOwners(List.of(DATA_CONSUMER.getEntityReference()))
            .withSize(0.0)
            .withDataModel(dataModel);

    assertResponse(
        () -> createEntity(create1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));

    // Apply mutually exclusive tags to a topic's nested field
    Column nestedColumn =
        getColumn(C2, INT, null).withTags(List.of(TIER1_TAG_LABEL, TIER2_TAG_LABEL));
    Column dataModelColumn1 = getColumn(C1, STRUCT, null).withChildren(List.of(nestedColumn));
    ContainerDataModel dataModel1 = new ContainerDataModel().withColumns(List.of(dataModelColumn1));
    CreateContainer create2 =
        new CreateContainer()
            .withName("test")
            .withService(S3_OBJECT_STORE_SERVICE_REFERENCE.getName())
            .withNumberOfObjects(0.0)
            .withOwners(List.of(DATA_CONSUMER.getEntityReference()))
            .withSize(0.0)
            .withDataModel(dataModel1);
    assertResponse(
        () -> createEntity(create2, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));
  }

  @Test
  void post_put_patch_complexDataModelColumnTypes() throws IOException {
    Column c1 =
        getColumn(C1, ARRAY, USER_ADDRESS_TAG_LABEL)
            .withArrayDataType(INT)
            .withDataTypeDisplay("array<int>");
    Column c2_a = getColumn("a", INT, USER_ADDRESS_TAG_LABEL);
    Column c2_b = getColumn("b", CHAR, USER_ADDRESS_TAG_LABEL);
    Column c2_c_d = getColumn("d", INT, USER_ADDRESS_TAG_LABEL);
    Column c2_c =
        getColumn("c", STRUCT, USER_ADDRESS_TAG_LABEL)
            .withDataTypeDisplay("struct<int: d>>")
            .withChildren(new ArrayList<>(singletonList(c2_c_d)));

    // Column struct<a: int, b:char, c: struct<int: d>>>
    Column c2 =
        getColumn(C2, STRUCT, GLOSSARY1_TERM1_LABEL)
            .withDataTypeDisplay("struct<a: int, b:string, c: struct<int: d>>")
            .withChildren(new ArrayList<>(Arrays.asList(c2_a, c2_b, c2_c)));

    // Test POST operation can create complex types
    // c1 array<int>
    // c2 struct<a: int, b:string, c: struct<int:d>>
    //   c2.a int
    //   c2.b char
    //   c2.c struct<int: d>>
    //     c2.c.d int
    ContainerDataModel dataModel = new ContainerDataModel().withColumns(Arrays.asList(c1, c2));
    CreateContainer create1 =
        new CreateContainer()
            .withName("test")
            .withService(S3_OBJECT_STORE_SERVICE_REFERENCE.getName())
            .withNumberOfObjects(0.0)
            .withOwners(List.of(DATA_CONSUMER.getEntityReference()))
            .withSize(0.0)
            .withDataModel(dataModel);
    Container container1 = createAndCheckEntity(create1, ADMIN_AUTH_HEADERS);

    // Test PUT operation - put operation to create
    CreateContainer create2 =
        new CreateContainer()
            .withName("put_complexColumnType")
            .withService(S3_OBJECT_STORE_SERVICE_REFERENCE.getName())
            .withNumberOfObjects(0.0)
            .withOwners(List.of(DATA_CONSUMER.getEntityReference()))
            .withSize(0.0)
            .withDataModel(dataModel);
    Container container2 =
        updateAndCheckEntity(
            create2, CREATED, ADMIN_AUTH_HEADERS, TestUtils.UpdateType.CREATED, null);

    // Test PUT operation again without any change
    ChangeDescription change = getChangeDescription(container2, NO_CHANGE);
    updateAndCheckEntity(create2, Response.Status.OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);

    //
    // Update the complex columns
    //
    // c1 from array<int> to array<char> - Data type change means old c1 deleted, and new c1 added
    change = getChangeDescription(container2, MAJOR_UPDATE);
    fieldDeleted(change, "dataModel.columns", List.of(c1));
    Column c1_new =
        getColumn(C1, ARRAY, USER_ADDRESS_TAG_LABEL)
            .withArrayDataType(CHAR)
            .withDataTypeDisplay("array<int>");
    fieldAdded(change, "dataModel.columns", List.of(c1_new));

    // c2 from
    // struct<a:int, b:char, c:struct<d:int>>>
    // to
    // struct<-----, b:char, c:struct<d:int, e:char>, f:char>
    c2_b.withTags(
        List.of(USER_ADDRESS_TAG_LABEL, GLOSSARY1_TERM1_LABEL)); // Add new tag to c2.b tag
    fieldAdded(change, build("dataModel.columns", C2, "b", "tags"), List.of(GLOSSARY1_TERM1_LABEL));
    Column c2_c_e = getColumn("e", INT, USER_ADDRESS_TAG_LABEL);
    c2_c.getChildren().add(c2_c_e); // Add c2.c.e
    fieldAdded(change, build("dataModel.columns", C2, "c"), List.of(c2_c_e));
    fieldDeleted(change, build("dataModel.columns", C2), List.of(c2.getChildren().get(0)));
    c2.getChildren().remove(0); // Remove c2.a from struct

    Column c2_f = getColumn("f", CHAR, USER_ADDRESS_TAG_LABEL);
    c2.getChildren().add(c2_f); // Add c2.f
    create2.withDataModel(new ContainerDataModel().withColumns(Arrays.asList(c1_new, c2)));
    fieldAdded(change, build("dataModel.columns", C2), List.of(c2_f));

    //
    // Patch operations on table1 created by POST operation. Columns can't be added or deleted. Only
    // tags and description can be changed
    //
    String containerJson = JsonUtils.pojoToJson(container1);
    c1 = container1.getDataModel().getColumns().get(0);
    c1.withTags(singletonList(GLOSSARY1_TERM1_LABEL)); // c1 tag changed

    c2 = container1.getDataModel().getColumns().get(1);
    c2.getTags().add(USER_ADDRESS_TAG_LABEL); // c2 new tag added

    c2_a = c2.getChildren().get(0);
    c2_a.withTags(singletonList(GLOSSARY1_TERM1_LABEL)); // c2.a tag changed

    c2_b = c2.getChildren().get(1);
    c2_b.withTags(new ArrayList<>()); // c2.b tag removed

    c2_c = c2.getChildren().get(2);
    c2_c.withTags(new ArrayList<>()); // c2.c tag removed

    c2_c_d = c2_c.getChildren().get(0);
    c2_c_d.setTags(singletonList(GLOSSARY1_TERM1_LABEL)); // c2.c.d new tag added
    container1 = patchEntity(container1.getId(), containerJson, container1, ADMIN_AUTH_HEADERS);
    assertColumns(Arrays.asList(c1, c2), container1.getDataModel().getColumns());
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
      assertEquals(
          createRequest.getDataModel().getIsPartitioned(),
          createdEntity.getDataModel().getIsPartitioned());
      assertColumns(
          createRequest.getDataModel().getColumns(), createdEntity.getDataModel().getColumns());
    }
    assertListProperty(
        createRequest.getFileFormats(),
        createdEntity.getFileFormats(),
        (c1, c2) -> assertEquals(c1.name(), c2.name()));
    assertEquals(createRequest.getNumberOfObjects(), createdEntity.getNumberOfObjects());
    assertEquals(createRequest.getSize(), createdEntity.getSize());

    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
    TestUtils.validateEntityReferences(createdEntity.getFollowers());

    assertEquals(
        createdEntity.getParent() != null
            ? FullyQualifiedName.add(
                createdEntity.getParent().getFullyQualifiedName(), createdEntity.getName())
            : FullyQualifiedName.add(
                createdEntity.getService().getFullyQualifiedName(), createdEntity.getName()),
        createdEntity.getFullyQualifiedName());
  }

  private ResultList<Container> getContainerChildren(String fqn, Integer limit, Integer offset)
      throws HttpResponseException {
    WebTarget target = getResource(String.format("containers/name/%s/children", fqn));
    target = limit != null ? target.queryParam("limit", limit) : target;
    target = offset != null ? target.queryParam("offset", offset) : target;
    return TestUtils.get(target, ContainerList.class, ADMIN_AUTH_HEADERS);
  }

  @Test
  void testInheritedPermissionFromParent(TestInfo test) throws IOException {
    // Create a storage service with owner data consumer
    StorageServiceResourceTest serviceTest = new StorageServiceResourceTest();
    CreateStorageService createStorageService =
        serviceTest
            .createRequest(getEntityName(test))
            .withOwners(List.of(DATA_CONSUMER.getEntityReference()));
    StorageService service = serviceTest.createEntity(createStorageService, ADMIN_AUTH_HEADERS);

    // Data consumer as an owner of the service can create container under it
    createEntity(
        createRequest("container").withService(service.getFullyQualifiedName()),
        authHeaders(DATA_CONSUMER.getName()));
  }

  @Test
  void test_columnWithInvalidTag(TestInfo test) throws HttpResponseException {
    // Add an entity with invalid tag
    TagLabel invalidTag = new TagLabel().withTagFQN("invalidTag");
    List<Column> invalidTagColumns = List.of(getColumn(C1, BIGINT, invalidTag));
    ContainerDataModel invalidTagModel =
        new ContainerDataModel().withIsPartitioned(true).withColumns(invalidTagColumns);
    CreateContainer create = createRequest(getEntityName(test)).withDataModel(invalidTagModel);

    // Entity can't be created with PUT or POST
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    assertResponse(
        () -> updateEntity(create, Status.CREATED, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    // Create an entity and update the columns with PUT and PATCH with an invalid tag
    List<Column> validColumns = List.of(getColumn(C1, BIGINT, TIER1_TAG_LABEL));
    ContainerDataModel validTagModel =
        new ContainerDataModel().withIsPartitioned(true).withColumns(validColumns);
    create.setDataModel(validTagModel);
    Container entity = createEntity(create, ADMIN_AUTH_HEADERS);
    String json = JsonUtils.pojoToJson(entity);

    create.setDataModel(invalidTagModel);
    assertResponse(
        () -> updateEntity(create, Status.CREATED, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    entity.setTags(listOf(invalidTag));
    assertResponse(
        () -> patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    // No lingering relationships should cause error in listing the entity
    listEntities(null, ADMIN_AUTH_HEADERS);
  }

  @Override
  public void compareEntities(
      Container expected, Container patched, Map<String, String> authHeaders)
      throws HttpResponseException {
    TestUtils.validateEntityReference(patched.getService());
    assertEquals(expected.getService().getId(), patched.getService().getId());
    if (expected.getDataModel() != null) {
      assertEquals(
          expected.getDataModel().getIsPartitioned(), patched.getDataModel().getIsPartitioned());
      assertColumns(expected.getDataModel().getColumns(), patched.getDataModel().getColumns());
    }
    assertListProperty(
        expected.getFileFormats(),
        patched.getFileFormats(),
        (c1, c2) -> assertEquals(c1.name(), c2.name()));
    assertEquals(expected.getNumberOfObjects(), patched.getNumberOfObjects());
    assertEquals(expected.getSize(), patched.getSize());

    TestUtils.validateTags(expected.getTags(), patched.getTags());
    TestUtils.validateEntityReferences(patched.getFollowers());

    /* parent of container can't be updated, so don't check it here */
  }

  @Override
  public Container validateGetWithDifferentFields(Container container, boolean byName)
      throws HttpResponseException {
    container =
        byName
            ? getEntityByName(container.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS)
            : getEntity(container.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNotNull(container.getService());
    assertListNull(
        container.getParent(),
        container.getChildren(),
        container.getDataModel(),
        container.getOwners(),
        container.getFollowers(),
        container.getExtension());
    assertTrue(container.getTags().isEmpty());

    // .../models?fields=dataModel - parent,children are not set in createEntity - these are tested
    // separately
    String fields = "dataModel,owners,tags,followers,extension";
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
  public void assertFieldChange(String fieldName, Object expected, Object actual)
      throws IOException {
    if (expected == actual) {
      return;
    }
    if (fieldName.contains("size")) {
      assertEquals((Integer) expected, (Integer) actual);
    } else if (fieldName.contains("fileFormats")) {
      assertFileFormats((List<ContainerFileFormat>) expected, actual.toString());
    } else if (fieldName.contains("dataModel")) {
      assertDataModel((ContainerDataModel) expected, (String) actual);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private void assertDataModel(ContainerDataModel expected, String actualJson) throws IOException {
    ContainerDataModel actualDataModel = JsonUtils.readValue(actualJson, ContainerDataModel.class);
    assertEquals(expected.getIsPartitioned(), actualDataModel.getIsPartitioned());
    assertColumns(expected.getColumns(), actualDataModel.getColumns());
  }

  private void assertFileFormats(List<ContainerFileFormat> expected, String actual) {
    List<ContainerFileFormat> actualFormats =
        JsonUtils.readObjects(actual, ContainerFileFormat.class);
    assertListProperty(expected, actualFormats, (c1, c2) -> assertEquals(c1.name(), c2.name()));
  }

  @Test
  void test_paginationFetchesTagsAtBothEntityAndFieldLevels(TestInfo test) throws IOException {
    // Use existing tags that are already set up in the test environment
    TagLabel containerTagLabel = USER_ADDRESS_TAG_LABEL;
    TagLabel columnTagLabel = GLOSSARY1_TERM1_LABEL;

    // Create multiple containers with tags at both container and column levels
    List<Container> createdContainers = new ArrayList<>();
    for (int i = 0; i < 5; i++) {
      List<Column> columns =
          Arrays.asList(
              getColumn("col1_" + i, BIGINT, null).withTags(List.of(columnTagLabel)),
              getColumn("col2_" + i, ColumnDataType.VARCHAR, null).withDataLength(50));

      ContainerDataModel dataModel =
          new ContainerDataModel().withIsPartitioned(false).withColumns(columns);

      CreateContainer createContainer =
          createRequest(test.getDisplayName() + "_pagination_" + i)
              .withDataModel(dataModel)
              .withTags(List.of(containerTagLabel));

      Container container = createEntity(createContainer, ADMIN_AUTH_HEADERS);
      createdContainers.add(container);
    }

    // Test pagination with fields=tags (should fetch container-level tags only)
    WebTarget target =
        getResource("containers").queryParam("fields", "tags").queryParam("limit", "50");

    ContainerList containerList = TestUtils.get(target, ContainerList.class, ADMIN_AUTH_HEADERS);
    assertNotNull(containerList.getData());

    // Verify at least one of our created containers is in the response
    List<Container> ourContainers =
        containerList.getData().stream()
            .filter(c -> createdContainers.stream().anyMatch(cc -> cc.getId().equals(c.getId())))
            .collect(Collectors.toList());

    assertFalse(
        ourContainers.isEmpty(),
        "Should find at least one of our created containers in pagination");

    // Verify container-level tags are fetched
    for (Container container : ourContainers) {
      assertNotNull(
          container.getTags(),
          "Container-level tags should not be null when fields=tags in pagination");
      assertEquals(1, container.getTags().size(), "Should have exactly one container-level tag");
      assertEquals(containerTagLabel.getTagFQN(), container.getTags().get(0).getTagFQN());

      // Columns should not have tags when only fields=tags is specified
      if (container.getDataModel() != null && container.getDataModel().getColumns() != null) {
        for (Column col : container.getDataModel().getColumns()) {
          assertTrue(
              col.getTags() == null || col.getTags().isEmpty(),
              "Column tags should not be populated when only fields=tags is specified in pagination");
        }
      }
    }

    // Test pagination with fields=dataModel,tags (should fetch both container and column tags)
    target =
        getResource("containers").queryParam("fields", "dataModel,tags").queryParam("limit", "50");

    containerList = TestUtils.get(target, ContainerList.class, ADMIN_AUTH_HEADERS);
    assertNotNull(containerList.getData());

    // Verify at least one of our created containers is in the response
    ourContainers =
        containerList.getData().stream()
            .filter(c -> createdContainers.stream().anyMatch(cc -> cc.getId().equals(c.getId())))
            .collect(Collectors.toList());

    assertFalse(
        ourContainers.isEmpty(),
        "Should find at least one of our created containers in pagination");

    // Verify both container-level and column-level tags are fetched
    for (Container container : ourContainers) {
      // Verify container-level tags
      assertNotNull(
          container.getTags(),
          "Container-level tags should not be null in pagination with dataModel,tags");
      assertEquals(1, container.getTags().size(), "Should have exactly one container-level tag");
      assertEquals(containerTagLabel.getTagFQN(), container.getTags().get(0).getTagFQN());

      // Verify column-level tags
      assertNotNull(
          container.getDataModel(), "DataModel should not be null when fields includes dataModel");
      assertNotNull(container.getDataModel().getColumns(), "Columns should not be null");

      Column col1 =
          container.getDataModel().getColumns().stream()
              .filter(c -> c.getName().startsWith("col1_"))
              .findFirst()
              .orElseThrow(() -> new AssertionError("Should find col1 column"));

      assertNotNull(
          col1.getTags(),
          "Column tags should not be null when fields=dataModel,tags in pagination");
      assertTrue(col1.getTags().size() >= 1, "Column should have at least one tag");
      // Check that our expected tag is present
      boolean hasExpectedTag =
          col1.getTags().stream()
              .anyMatch(tag -> tag.getTagFQN().equals(columnTagLabel.getTagFQN()));
      assertTrue(
          hasExpectedTag, "Column should have the expected tag: " + columnTagLabel.getTagFQN());

      // col2 should not have tags
      Column col2 =
          container.getDataModel().getColumns().stream()
              .filter(c -> c.getName().startsWith("col2_"))
              .findFirst()
              .orElseThrow(() -> new AssertionError("Should find col2 column"));

      assertTrue(col2.getTags() == null || col2.getTags().isEmpty(), "col2 should not have tags");
    }
  }
}
