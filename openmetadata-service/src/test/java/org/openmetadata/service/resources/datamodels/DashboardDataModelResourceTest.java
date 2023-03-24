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

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertListNotEmpty;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class DashboardDataModelResourceTest extends EntityResourceTest<DashboardDataModel, CreateDashboardDataModel> {

  public DashboardDataModelResourceTest() {
    super(
        Entity.DASHBOARD_DATA_MODEL,
        DashboardDataModel.class,
        DashboardDataModelResource.DashboardDataModelList.class,
        "datamodels",
        DashboardDataModelResource.FIELDS);
  }

  @Test
  @Execution(ExecutionMode.CONCURRENT)
  void post_dataModelWithoutRequiredFields_4xx(TestInfo test) {
    // Service is required field
    assertResponse(
        () -> createEntity(createRequest(test).withService(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[service must not be null]");
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

  @Override
  @Execution(ExecutionMode.CONCURRENT)
  public DashboardDataModel validateGetWithDifferentFields(DashboardDataModel dashboardDataModel, boolean byName)
      throws HttpResponseException {
    String fields = "";
    dashboardDataModel =
        byName
            ? getEntityByName(dashboardDataModel.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(dashboardDataModel.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(dashboardDataModel.getService(), dashboardDataModel.getServiceType());
    assertListNull(dashboardDataModel.getOwner(), dashboardDataModel.getFollowers(), dashboardDataModel.getTags());

    // .../datamodels?fields=owner
    fields = "owner,followers,tags";
    dashboardDataModel =
        byName
            ? getEntityByName(dashboardDataModel.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
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
      DashboardDataModel dashboardDataModel, CreateDashboardDataModel createRequest, Map<String, String> authHeaders) {
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
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
