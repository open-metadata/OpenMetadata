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
import org.openmetadata.schema.api.data.CreateDataModel;
import org.openmetadata.schema.entity.data.DataModel;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class DataModelResourceTest extends EntityResourceTest<DataModel, CreateDataModel> {

  public DataModelResourceTest() {
    super(
        Entity.DATA_MODEL,
        DataModel.class,
        DataModelResource.DataModelList.class,
        "datamodels",
        DataModelResource.FIELDS);
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
      ResultList<DataModel> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (DataModel dataModel : list.getData()) {
        assertEquals(service, dataModel.getService().getName());
      }
    }
  }

  @Override
  @Execution(ExecutionMode.CONCURRENT)
  public DataModel validateGetWithDifferentFields(DataModel dataModel, boolean byName) throws HttpResponseException {
    String fields = "";
    dataModel =
        byName
            ? getEntityByName(dataModel.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(dataModel.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(dataModel.getService(), dataModel.getServiceType());
    assertListNull(dataModel.getOwner(), dataModel.getFollowers(), dataModel.getTags());

    // .../datamodels?fields=owner
    fields = "owner,followers,tags";
    dataModel =
        byName
            ? getEntityByName(dataModel.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(dataModel.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(dataModel.getService(), dataModel.getServiceType());
    // Checks for other owner, tags, and followers is done in the base class
    return dataModel;
  }

  @Override
  public CreateDataModel createRequest(String name) {
    return new CreateDataModel()
        .withName(name)
        .withService(getContainer().getName())
        .withServiceType(CreateDataModel.DashboardServiceType.Metabase)
        .withSql("SELECT * FROM tab1;")
        .withDataModelType(DataModelType.MetabaseDataModel)
        .withColumns(COLUMNS);
  }

  @Override
  public EntityReference getContainer() {
    return METABASE_REFERENCE;
  }

  @Override
  public EntityReference getContainer(DataModel entity) {
    return entity.getService();
  }

  @Override
  public void validateCreatedEntity(
      DataModel dataModel, CreateDataModel createRequest, Map<String, String> authHeaders) {
    assertNotNull(dataModel.getServiceType());
    assertReference(createRequest.getService(), dataModel.getService());
    assertEquals(createRequest.getSql(), dataModel.getSql());
    assertEquals(createRequest.getDataModelType(), dataModel.getDataModelType());
    assertListNotEmpty(dataModel.getColumns());
  }

  @Override
  public void compareEntities(DataModel expected, DataModel patched, Map<String, String> authHeaders) {
    assertReference(expected.getService(), patched.getService());
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    assertCommonFieldChange(fieldName, expected, actual);
  }
}
