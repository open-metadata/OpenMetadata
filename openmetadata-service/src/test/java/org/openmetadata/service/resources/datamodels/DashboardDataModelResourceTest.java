/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.datamodels;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.schema.type.ColumnDataType.BIGINT;
import static org.openmetadata.schema.type.ColumnDataType.INT;
import static org.openmetadata.schema.type.ColumnDataType.STRUCT;
import static org.openmetadata.service.Entity.TAG;
import static org.openmetadata.service.resources.databases.TableResourceTest.getColumn;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotEmpty;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.DashboardServiceResourceTest;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class DashboardDataModelResourceTest
    extends EntityResourceTest<DashboardDataModel, CreateDashboardDataModel> {

  public DashboardDataModelResourceTest() {
    super(
        Entity.DASHBOARD_DATA_MODEL,
        DashboardDataModel.class,
        DashboardDataModelResource.DashboardDataModelList.class,
        "dashboard/datamodels",
        DashboardDataModelResource.FIELDS);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void post_dataModelWithoutRequiredFields_4xx(TestInfo test) {
    // Service is required field
    assertResponse(
        () -> createEntity(createRequest(test).withService(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param service must not be null]");
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void post_dataModelWithDifferentService_200_ok(TestInfo test) throws IOException {
    String[] differentServices = {METABASE_REFERENCE.getName(), LOOKER_REFERENCE.getName()};

    // Create dataModel for each service and test APIs
    for (String service : differentServices) {
      createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);

      // List dataModels by filtering on service name and ensure right dataModels in the response
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("service", service);
      ResultList<DashboardDataModel> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (DashboardDataModel dashboardDataModel : list.getData()) {
        assertEquals(service, dashboardDataModel.getService().getName());
      }
    }
  }

  @Test
  void test_mutuallyExclusiveTags(TestInfo testInfo) {
    CreateDashboardDataModel create =
        createRequest(testInfo).withTags(List.of(TIER1_TAG_LABEL, TIER2_TAG_LABEL));
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));

    // Apply mutually exclusive tags to a dataModel column
    CreateDashboardDataModel createDashboardDataModel = createRequest(testInfo, 1);
    Column column = getColumn("test", INT, null).withTags(listOf(TIER1_TAG_LABEL, TIER2_TAG_LABEL));
    createDashboardDataModel.setColumns(listOf(column));
    assertResponse(
        () -> createEntity(createDashboardDataModel, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));

    // Apply mutually exclusive tags to a dataModel's nested column
    CreateDashboardDataModel createDashboardDataModel1 = createRequest(testInfo, 1);
    Column nestedColumns =
        getColumn("testNested", INT, null).withTags(listOf(TIER1_TAG_LABEL, TIER2_TAG_LABEL));
    Column column1 = getColumn("test", STRUCT, null).withChildren(List.of(nestedColumns));
    createDashboardDataModel1.setColumns(listOf(column1));
    assertResponse(
        () -> createEntity(createDashboardDataModel1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));
  }

  @Test
  void test_columnWithInvalidTag(TestInfo test) throws HttpResponseException {
    // Add an entity with invalid tag
    TagLabel invalidTag = new TagLabel().withTagFQN("invalidTag");
    List<Column> invalidTagColumns = List.of(getColumn(C1, BIGINT, invalidTag));
    CreateDashboardDataModel create =
        createRequest(getEntityName(test)).withColumns(invalidTagColumns);

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
    create.setColumns(validColumns);
    DashboardDataModel entity = createEntity(create, ADMIN_AUTH_HEADERS);
    String json = JsonUtils.pojoToJson(entity);

    create.setColumns(invalidTagColumns);
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

  @Test
  void testInheritedPermissionFromParent(TestInfo test) throws IOException {
    // Create a dashboard service with owner data consumer
    DashboardServiceResourceTest serviceTest = new DashboardServiceResourceTest();
    CreateDashboardService createDashboardService =
        serviceTest
            .createRequest(getEntityName(test))
            .withOwners(List.of(DATA_CONSUMER.getEntityReference()));
    DashboardService service = serviceTest.createEntity(createDashboardService, ADMIN_AUTH_HEADERS);

    // Data consumer as an owner of the service can create dashboard data model under it
    createEntity(
        createRequest("dashboardModel").withService(service.getFullyQualifiedName()),
        authHeaders(DATA_CONSUMER.getName()));
  }

  @Override
  @Execution(ExecutionMode.CONCURRENT)
  public DashboardDataModel validateGetWithDifferentFields(
      DashboardDataModel dashboardDataModel, boolean byName) throws HttpResponseException {
    String fields = "";
    dashboardDataModel =
        byName
            ? getEntityByName(
                dashboardDataModel.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(dashboardDataModel.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(dashboardDataModel.getService(), dashboardDataModel.getServiceType());
    assertListNull(dashboardDataModel.getOwners(), dashboardDataModel.getFollowers());
    assertTrue(dashboardDataModel.getTags().isEmpty());

    // .../datamodels?fields=owner
    fields = "owners,followers,tags";
    dashboardDataModel =
        byName
            ? getEntityByName(
                dashboardDataModel.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(dashboardDataModel.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(dashboardDataModel.getService(), dashboardDataModel.getServiceType());
    // Checks for other owner, tags, and followers is done in the base class
    return dashboardDataModel;
  }

  @Override
  public CreateDashboardDataModel createRequest(String name) {
    return new CreateDashboardDataModel()
        .withName(name)
        .withService(getContainer().getName())
        .withServiceType(CreateDashboardDataModel.DashboardServiceType.Metabase)
        .withSql("SELECT * FROM tab1;")
        .withDataModelType(DataModelType.MetabaseDataModel)
        .withColumns(COLUMNS);
  }

  @Override
  public EntityReference getContainer() {
    return METABASE_REFERENCE;
  }

  @Override
  public EntityReference getContainer(DashboardDataModel entity) {
    return entity.getService();
  }

  @Override
  public void validateCreatedEntity(
      DashboardDataModel dashboardDataModel,
      CreateDashboardDataModel createRequest,
      Map<String, String> authHeaders) {
    assertNotNull(dashboardDataModel.getServiceType());
    assertReference(createRequest.getService(), dashboardDataModel.getService());
    assertEquals(createRequest.getSql(), dashboardDataModel.getSql());
    assertEquals(createRequest.getDataModelType(), dashboardDataModel.getDataModelType());
    assertListNotEmpty(dashboardDataModel.getColumns());
  }

  @Override
  public void compareEntities(
      DashboardDataModel expected, DashboardDataModel patched, Map<String, String> authHeaders) {
    assertReference(expected.getService(), patched.getService());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    assertCommonFieldChange(fieldName, expected, actual);
  }

  @Test
  void test_getByNameColumnsPaginationConsistency_200_OK(TestInfo test) throws IOException {
    Column dateStruct =
        getColumn("date", STRUCT, null)
            .withChildren(
                listOf(
                    getColumn("year", INT, null),
                    getColumn("month", INT, null),
                    getColumn("day", INT, null)));

    List<Column> columns =
        listOf(
            getColumn("revenue", BIGINT, USER_ADDRESS_TAG_LABEL),
            getColumn("cost", BIGINT, null),
            getColumn("profit", BIGINT, null),
            getColumn("region", INT, GLOSSARY1_TERM1_LABEL),
            getColumn("product", INT, null),
            dateStruct,
            getColumn("customer_count", BIGINT, TIER1_TAG_LABEL),
            getColumn("order_count", BIGINT, null));

    CreateDashboardDataModel create = createRequest(test).withColumns(columns);
    DashboardDataModel dataModel = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    DashboardDataModel mixedFieldsDataModel =
        getEntityByName(
            dataModel.getFullyQualifiedName(), "columns,owners,description", ADMIN_AUTH_HEADERS);
    assertNotNull(
        mixedFieldsDataModel.getColumns(), "Mixed fields including columns should return columns");
    assertEquals(
        8, mixedFieldsDataModel.getColumns().size(), "Should return all columns in mixed request");
    assertNotNull(mixedFieldsDataModel.getOwners(), "Should also return other requested fields");
  }
}
