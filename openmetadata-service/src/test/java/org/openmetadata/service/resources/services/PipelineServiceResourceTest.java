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
import static org.openmetadata.service.resources.services.DatabaseServiceResourceTest.validateMysqlConnection;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.AIRFLOW_CONNECTION;
import static org.openmetadata.service.util.TestUtils.INGESTION_BOT_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.MYSQL_DATABASE_CONNECTION;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.services.CreatePipelineService;
import org.openmetadata.schema.api.services.CreatePipelineService.PipelineServiceType;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
import org.openmetadata.schema.entity.services.connections.TestConnectionResultStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.FilterPattern;
import org.openmetadata.schema.metadataIngestion.PipelineServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.RedshiftConnection;
import org.openmetadata.schema.services.connections.pipeline.AirflowConnection;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.PipelineConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResourceTest;
import org.openmetadata.service.resources.services.pipeline.PipelineServiceResource;
import org.openmetadata.service.resources.services.pipeline.PipelineServiceResource.PipelineServiceList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class PipelineServiceResourceTest
    extends ServiceResourceTest<PipelineService, CreatePipelineService> {
  public PipelineServiceResourceTest() {
    super(
        Entity.PIPELINE_SERVICE,
        PipelineService.class,
        PipelineServiceList.class,
        "services/pipelineServices",
        PipelineServiceResource.FIELDS);
    this.supportsPatch = false;
  }

  public void setupPipelineServices(TestInfo test) throws HttpResponseException {
    PipelineServiceResourceTest pipelineServiceResourceTest = new PipelineServiceResourceTest();
    CreatePipelineService createPipeline =
        pipelineServiceResourceTest
            .createRequest(test, 1)
            .withServiceType(PipelineServiceType.Airflow)
            .withConnection(TestUtils.AIRFLOW_CONNECTION);
    PipelineService pipelineService =
        pipelineServiceResourceTest.createEntity(createPipeline, ADMIN_AUTH_HEADERS);
    AIRFLOW_REFERENCE = pipelineService.getEntityReference();

    createPipeline =
        pipelineServiceResourceTest
            .createRequest(test, 2)
            .withServiceType(PipelineServiceType.GluePipeline)
            .withConnection(TestUtils.GLUE_CONNECTION);

    pipelineService = pipelineServiceResourceTest.createEntity(createPipeline, ADMIN_AUTH_HEADERS);
    GLUE_REFERENCE = pipelineService.getEntityReference();
  }

  @Test
  void post_withoutRequiredFields_400_badRequest(TestInfo test) {
    // Create pipeline with mandatory serviceType field empty
    assertResponse(
        () -> createEntity(createRequest(test).withServiceType(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[query param serviceType must not be null]");
  }

  @Test
  void post_validPipelineService_as_admin_200_ok(TestInfo test) throws IOException {
    // Create database service with different optional fields
    Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;
    createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);

    // We can create the service without connection
    createAndCheckEntity(createRequest(test).withConnection(null), ADMIN_AUTH_HEADERS);
  }

  @Test
  void put_updatePipelineService_as_admin_2xx(TestInfo test)
      throws IOException, URISyntaxException {
    PipelineService service =
        createAndCheckEntity(createRequest(test).withDescription(null), ADMIN_AUTH_HEADERS);

    // Update pipeline description and ingestion service that are null
    CreatePipelineService update =
        createRequest(test).withDescription("description1").withName(service.getName());

    ChangeDescription change = getChangeDescription(service, MINOR_UPDATE);
    fieldAdded(change, "description", "description1");
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    PipelineConnection updatedConnection =
        new PipelineConnection()
            .withConfig(
                new AirflowConnection()
                    .withHostPort(new URI("http://my-server:1234"))
                    .withConnection(MYSQL_DATABASE_CONNECTION.getConfig()));

    update.withConnection(updatedConnection);
    service = updateEntity(update, OK, ADMIN_AUTH_HEADERS);
    validatePipelineConnection(
        updatedConnection, service.getConnection(), service.getServiceType(), ADMIN_AUTH_HEADERS);
    service = getEntity(service.getId(), TEST_AUTH_HEADERS);
    assertNotNull(service.getConnection());
    assertNotNull(
        JsonUtils.readValue(
                JsonUtils.pojoToJson(service.getConnection().getConfig()), AirflowConnection.class)
            .getHostPort());
    assertNotNull(
        JsonUtils.readValue(
                JsonUtils.pojoToJson(service.getConnection().getConfig()), AirflowConnection.class)
            .getConnection());
  }

  @Test
  void post_put_invalidConnection_as_admin_4xx(TestInfo test) {
    RedshiftConnection redshiftConnection = new RedshiftConnection();
    PipelineConnection pipelineConnection = new PipelineConnection().withConfig(redshiftConnection);
    CreatePipelineService create = createRequest(test).withConnection(pipelineConnection);
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        String.format(
            "Failed to convert [%s] to type [Airflow]. Review the connection.", create.getName()));
  }

  @Test
  void put_addIngestion_as_admin_2xx(TestInfo test) throws IOException {
    // Create Pipeline Service
    CreatePipelineService create = createRequest(test);
    PipelineService service = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add an IngestionPipeline to the service
    IngestionPipelineResourceTest ingestionPipelineResourceTest =
        new IngestionPipelineResourceTest();
    CreateIngestionPipeline createIngestionPipeline =
        ingestionPipelineResourceTest.createRequest(test).withService(service.getEntityReference());

    PipelineServiceMetadataPipeline pipelineServiceMetadataPipeline =
        new PipelineServiceMetadataPipeline()
            .withIncludeLineage(true)
            .withPipelineFilterPattern(new FilterPattern().withExcludes(List.of("private_dag_*")));

    SourceConfig sourceConfig = new SourceConfig().withConfig(pipelineServiceMetadataPipeline);
    createIngestionPipeline.withSourceConfig(sourceConfig);
    IngestionPipeline ingestionPipeline =
        ingestionPipelineResourceTest.createEntity(createIngestionPipeline, ADMIN_AUTH_HEADERS);

    PipelineService updatedService = getEntity(service.getId(), "pipelines", ADMIN_AUTH_HEADERS);
    assertEquals(1, updatedService.getPipelines().size());
    assertReference(ingestionPipeline.getEntityReference(), updatedService.getPipelines().get(0));

    // Delete the pipeline service and ensure ingestion pipeline is deleted
    deleteEntity(updatedService.getId(), true, true, ADMIN_AUTH_HEADERS);
    ingestionPipelineResourceTest.assertEntityDeleted(ingestionPipeline.getId(), true);
  }

  @Test
  void put_testConnectionResult_200(TestInfo test) throws IOException {
    PipelineService service = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    // By default, we have no result logged in
    assertNull(service.getTestConnectionResult());
    PipelineService updatedService =
        putTestConnectionResult(service.getId(), TEST_CONNECTION_RESULT, ADMIN_AUTH_HEADERS);
    // Validate that the data got properly stored
    assertNotNull(updatedService.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL,
        updatedService.getTestConnectionResult().getStatus());
    assertEquals(updatedService.getConnection(), service.getConnection());
    // Check that the stored data is also correct
    PipelineService stored = getEntity(service.getId(), ADMIN_AUTH_HEADERS);
    assertNotNull(stored.getTestConnectionResult());
    assertEquals(
        TestConnectionResultStatus.SUCCESSFUL, stored.getTestConnectionResult().getStatus());
    assertEquals(stored.getConnection(), service.getConnection());
  }

  public PipelineService putTestConnectionResult(
      UUID serviceId, TestConnectionResult testConnectionResult, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(serviceId).path("/testConnectionResult");
    return TestUtils.put(target, testConnectionResult, PipelineService.class, OK, authHeaders);
  }

  @Override
  public CreatePipelineService createRequest(String name) {
    return new CreatePipelineService()
        .withName(name)
        .withServiceType(PipelineServiceType.Airflow)
        .withConnection(AIRFLOW_CONNECTION);
  }

  @Override
  public void validateCreatedEntity(
      PipelineService service,
      CreatePipelineService createRequest,
      Map<String, String> authHeaders) {
    assertEquals(createRequest.getName(), service.getName());
    validatePipelineConnection(
        createRequest.getConnection(),
        service.getConnection(),
        service.getServiceType(),
        authHeaders);
  }

  @Override
  public void compareEntities(
      PipelineService expected, PipelineService updated, Map<String, String> authHeaders) {
    // PATCH operation is not supported by this entity
  }

  @Override
  public PipelineService validateGetWithDifferentFields(PipelineService service, boolean byName)
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

  private void validatePipelineConnection(
      PipelineConnection expectedPipelineConnection,
      PipelineConnection actualPipelineConnection,
      PipelineServiceType pipelineServiceType,
      Map<String, String> authHeaders) {
    if (expectedPipelineConnection != null && actualPipelineConnection != null) {
      if (pipelineServiceType == PipelineServiceType.Airflow) {
        AirflowConnection expectedAirflowConnection =
            (AirflowConnection) expectedPipelineConnection.getConfig();
        AirflowConnection actualAirflowConnection;
        if (actualPipelineConnection.getConfig() instanceof AirflowConnection) {
          actualAirflowConnection = (AirflowConnection) actualPipelineConnection.getConfig();
        } else {
          actualAirflowConnection =
              JsonUtils.convertValue(actualPipelineConnection.getConfig(), AirflowConnection.class);
        }
        validateAirflowConnection(expectedAirflowConnection, actualAirflowConnection, authHeaders);
      }
    }
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

  public void validateAirflowConnection(
      AirflowConnection expectedAirflowConnection,
      AirflowConnection actualAirflowConnection,
      Map<String, String> authHeaders) {
    assertEquals(expectedAirflowConnection.getHostPort(), actualAirflowConnection.getHostPort());
    // Currently, just checking for MySQL as metadata db for Airflow
    // We need to get inside the general DatabaseConnection and fetch the MysqlConnection
    MysqlConnection expectedMysqlConnection =
        (MysqlConnection) expectedAirflowConnection.getConnection();
    // Use the database service tests utilities for the comparison
    // only bot can see all connection parameters unmasked. Non bot users can see the connection
    // but passwords will be masked
    if (INGESTION_BOT_AUTH_HEADERS.equals(authHeaders)) {
      MysqlConnection actualMysqlConnection =
          JsonUtils.convertValue(actualAirflowConnection.getConnection(), MysqlConnection.class);
      validateMysqlConnection(expectedMysqlConnection, actualMysqlConnection, false);
    } else {
      assertNotNull(actualAirflowConnection);
      assertNotNull(actualAirflowConnection.getHostPort());
      MysqlConnection actualMysqlConnection =
          JsonUtils.convertValue(actualAirflowConnection.getConnection(), MysqlConnection.class);
      validateMysqlConnection(expectedMysqlConnection, actualMysqlConnection, true);
    }
  }
}
