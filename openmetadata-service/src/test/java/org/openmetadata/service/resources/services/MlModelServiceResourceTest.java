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

package org.openmetadata.service.resources.services;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.schema.api.services.CreateMlModelService.MlModelServiceType;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.entity.services.connections.TestConnectionResultStatus;
import org.openmetadata.schema.services.connections.mlmodel.MlflowConnection;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.MlModelConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.mlmodel.MlModelServiceResource;
import org.openmetadata.service.resources.services.mlmodel.MlModelServiceResource.MlModelServiceList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class MlModelServiceResourceTest
    extends ServiceResourceTest<MlModelService, CreateMlModelService> {
  public MlModelServiceResourceTest() {
    super(
        Entity.MLMODEL_SERVICE,
        MlModelService.class,
        MlModelServiceList.class,
        "services/mlmodelServices",
        MlModelServiceResource.FIELDS);
    this.supportsPatch = false;
    supportsSearchIndex = true;
  }

  public void setupMlModelServices(TestInfo test) throws HttpResponseException {
    MlModelServiceResourceTest mlModelResourceTest = new MlModelServiceResourceTest();
    CreateMlModelService createMlModelService =
        mlModelResourceTest
            .createRequest(test, 1)
            .withName("mlflow")
            .withServiceType(MlModelServiceType.Mlflow)
            .withConnection(TestUtils.MLFLOW_CONNECTION);

    MlModelService MlModelService =
        new MlModelServiceResourceTest().createEntity(createMlModelService, ADMIN_AUTH_HEADERS);
    MLFLOW_REFERENCE = MlModelService.getEntityReference();
  }

  @Test
  void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    // Create MlModel with mandatory serviceType field empty
    assertResponse(
        () -> createEntity(createRequest(test).withServiceType(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param serviceType must not be null]");
  }

  @Test
  void post_validService_as_admin_200_ok(TestInfo test) throws IOException {
    // Create MlModel service with different optional fields
    Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;
    createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);
    MlflowConnection mlflowConnection =
        new MlflowConnection()
            .withRegistryUri("http://localhost:8080")
            .withTrackingUri("http://localhost:5000");
    createAndCheckEntity(
        createRequest(test, 3).withConnection(new MlModelConnection().withConfig(mlflowConnection)),
        authHeaders);

    // We can create the service without connection
    createAndCheckEntity(createRequest(test).withConnection(null), ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_updateService_as_admin_2xx(TestInfo test) throws IOException {
    MlModelConnection MlModelConnection =
        new MlModelConnection()
            .withConfig(
                new MlflowConnection()
                    .withRegistryUri("http://localhost:8080")
                    .withTrackingUri("http://localhost:5000"));
    MlModelService service =
        createAndCheckEntity(
            createRequest(test).withDescription(null).withConnection(MlModelConnection),
            ADMIN_AUTH_HEADERS);

    // Update MlModel description and ingestion service that are null
    MlModelConnection MlModelConnection1 =
        new MlModelConnection()
            .withConfig(
                new MlflowConnection()
                    .withRegistryUri("http://localhost:8081")
                    .withTrackingUri("http://localhost:5001"));

    CreateMlModelService update =
        createRequest(test)
            .withDescription("description1")
            .withConnection(MlModelConnection1)
            .withName(service.getName());

    ChangeDescription change = getChangeDescription(service, MINOR_UPDATE);
    fieldAdded(change, "description", "description1");
    fieldUpdated(change, "connection", MlModelConnection, MlModelConnection1);
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_testConnectionResult_200(TestInfo test) throws IOException {
    MlModelService service = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    // By default, we have no result logged in
    assertNull(service.getTestConnectionResult());
    MlModelService updatedService =
        putTestConnectionResult(service.getId(), TEST_CONNECTION_RESULT, ADMIN_AUTH_HEADERS);
    // Validate that the data got properly stored
    assertNotNull(updatedService.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL,
        updatedService.getTestConnectionResult().getStatus());
    assertEquals(updatedService.getConnection(), service.getConnection());
    // Check that the stored data is also correct
    MlModelService stored = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
    assertNotNull(stored.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL, stored.getTestConnectionResult().getStatus());
    assertEquals(stored.getConnection(), service.getConnection());
  }

  public MlModelService putTestConnectionResult(
      UUID serviceId, TestConnectionResult testConnectionResult, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(serviceId).path("/testConnectionResult");
    return TestUtils.put(target, testConnectionResult, MlModelService.class, OK, authHeaders);
  }

  @Override
  public CreateMlModelService createRequest(String name) {
    return new CreateMlModelService()
        .withName(name)
        .withServiceType(MlModelServiceType.Mlflow)
        .withConnection(
            new MlModelConnection()
                .withConfig(
                    new MlflowConnection()
                        .withRegistryUri("http://localhost:8080")
                        .withTrackingUri("http://localhost:5000")));
  }

  @Override
  public void validateCreatedEntity(
      MlModelService service, CreateMlModelService createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getName(), service.getName());
    MlModelConnection expectedConnection = createRequest.getConnection();
    MlModelConnection actualConnection = service.getConnection();
    validateConnection(expectedConnection, actualConnection, service.getServiceType());
  }

  @Override
  public void compareEntities(
      MlModelService expected, MlModelService updated, Map<String, String> authHeaders) {
    // PATCH operation is not supported by this entity
  }

  @Override
  public MlModelService validateGetWithDifferentFields(MlModelService service, boolean byName)
      throws HttpResponseException {
    String fields = "";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    TestUtils.assertListNull(service.getOwners());

    fields = "owners,tags,followers";
    service =
        byName
            ? getEntityByName(service.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(service.getId(), fields, ADMIN_AUTH_HEADERS);
    // Checks for other owner, tags, and followers is done in the base class
    return service;
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) {
    if (expected == actual) {
      return;
    }
    if (fieldName.equals("connection")) {
      assertTrue(((String) actual).contains("-encrypted-value"));
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  private void validateConnection(
      MlModelConnection expectedMlModelConnection,
      MlModelConnection actualMlModelConnection,
      MlModelServiceType MlModelServiceType) {
    if (expectedMlModelConnection != null && actualMlModelConnection != null) {
      if (MlModelServiceType == CreateMlModelService.MlModelServiceType.Mlflow) {
        MlflowConnection expectedMlflowConnection =
            (MlflowConnection) expectedMlModelConnection.getConfig();
        MlflowConnection actualMlflowConnection;
        if (actualMlModelConnection.getConfig() instanceof MlflowConnection) {
          actualMlflowConnection = (MlflowConnection) actualMlModelConnection.getConfig();
        } else {
          actualMlflowConnection =
              JsonUtils.convertValue(actualMlModelConnection.getConfig(), MlflowConnection.class);
        }
        assertEquals(
            expectedMlflowConnection.getRegistryUri(), actualMlflowConnection.getRegistryUri());
        assertEquals(
            expectedMlflowConnection.getTrackingUri(), actualMlflowConnection.getTrackingUri());
      }
    }
  }
}
