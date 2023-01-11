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

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.OK;
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
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.schema.api.services.CreatePipelineService;
import org.openmetadata.schema.api.services.CreatePipelineService.PipelineServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.metadataIngestion.FilterPattern;
import org.openmetadata.schema.metadataIngestion.PipelineServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.RedshiftConnection;
import org.openmetadata.schema.services.connections.pipeline.AirflowConnection;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.PipelineConnection;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineResourceTest;
import org.openmetadata.service.resources.services.pipeline.PipelineServiceResource.PipelineServiceList;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.TestUtils;

@Slf4j
public class PipelineServiceResourceTest extends EntityResourceTest<PipelineService, CreatePipelineService> {
  public PipelineServiceResourceTest() {
    super(
        Entity.PIPELINE_SERVICE,
        PipelineService.class,
        PipelineServiceList.class,
        "services/pipelineServices",
        "owner");
    this.supportsPatch = false;
  }

  public void setupPipelineServices(TestInfo test) throws HttpResponseException {
    PipelineServiceResourceTest pipelineServiceResourceTest = new PipelineServiceResourceTest();
    CreatePipelineService createPipeline =
        pipelineServiceResourceTest
            .createRequest(test, 1)
            .withServiceType(PipelineServiceType.Airflow)
            .withConnection(TestUtils.AIRFLOW_CONNECTION);
    PipelineService pipelineService = pipelineServiceResourceTest.createEntity(createPipeline, ADMIN_AUTH_HEADERS);
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
        "[serviceType must not be null]");

    // Create pipeline with mandatory `connection` field empty
    assertResponse(
        () -> createEntity(createRequest(test).withConnection(null), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "[connection must not be null]");
  }

  @Test
  void post_validPipelineService_as_admin_200_ok(TestInfo test) throws IOException {
    // Create database service with different optional fields
    Map<String, String> authHeaders = ADMIN_AUTH_HEADERS;
    createAndCheckEntity(createRequest(test, 1).withDescription(null), authHeaders);
    createAndCheckEntity(createRequest(test, 2).withDescription("description"), authHeaders);
  }

  @Test
  void put_updatePipelineService_as_admin_2xx(TestInfo test) throws IOException, URISyntaxException {
    PipelineService service = createAndCheckEntity(createRequest(test).withDescription(null), ADMIN_AUTH_HEADERS);

    // Update pipeline description and ingestino service that are null
    CreatePipelineService update = createRequest(test).withDescription("description1");

    ChangeDescription change = getChangeDescription(service.getVersion());
    fieldAdded(change, "description", "description1");
    updateAndCheckEntity(update, OK, ADMIN_AUTH_HEADERS, TestUtils.UpdateType.MINOR_UPDATE, change);

    PipelineConnection updatedConnection =
        new PipelineConnection()
            .withConfig(
                new AirflowConnection()
                    .withHostPort(new URI("http://my-server:1234"))
                    .withConnection(MYSQL_DATABASE_CONNECTION));

    update.withConnection(updatedConnection);
    service = updateEntity(update, OK, ADMIN_AUTH_HEADERS);
    validatePipelineConnection(
        updatedConnection, service.getConnection(), service.getServiceType(), ADMIN_AUTH_HEADERS);
    service = getEntity(service.getId(), TEST_AUTH_HEADERS);
    assertNotNull(service.getConnection());
    assertNotNull(
        JsonUtils.readValue(JsonUtils.pojoToJson(service.getConnection().getConfig()), AirflowConnection.class)
            .getHostPort());
    assertNull(
        JsonUtils.readValue(JsonUtils.pojoToJson(service.getConnection().getConfig()), AirflowConnection.class)
            .getConnection());
  }

  @Test
  void post_put_invalidConnection_as_admin_4xx(TestInfo test) {
    RedshiftConnection redshiftConnection = new RedshiftConnection();
    PipelineConnection pipelineConnection = new PipelineConnection().withConfig(redshiftConnection);
    assertResponseContains(
        () ->
            createEntity(
                createRequest(test).withDescription(null).withConnection(pipelineConnection), ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "InvalidServiceConnectionException for service [Airflow] due to [Failed to encrypt connection instance of Airflow]");
  }

  @Test
  void put_addIngestion_as_admin_2xx(TestInfo test) throws IOException {
    // Create Pipeline Service
    CreatePipelineService create = createRequest(test);
    PipelineService service = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    EntityReference serviceRef = service.getEntityReference();

    // Add an IngestionPipeline to the service
    IngestionPipelineResourceTest ingestionPipelineResourceTest = new IngestionPipelineResourceTest();
    CreateIngestionPipeline createIngestionPipeline =
        ingestionPipelineResourceTest.createRequest(test).withService(serviceRef);

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

  @Override
  public CreatePipelineService createRequest(String name) {
    return new CreatePipelineService()
        .withName(name)
        .withServiceType(PipelineServiceType.Airflow)
        .withConnection(AIRFLOW_CONNECTION);
  }

  @Override
  public void validateCreatedEntity(
      PipelineService service, CreatePipelineService createRequest, Map<String, String> authHeaders) {
    assertEquals(createRequest.getName(), service.getName());
    validatePipelineConnection(
        createRequest.getConnection(), service.getConnection(), service.getServiceType(), authHeaders);
  }

  @Override
  public void compareEntities(PipelineService expected, PipelineService updated, Map<String, String> authHeaders) {
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
    TestUtils.assertListNull(service.getOwner());

    fields = "owner,tags";
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
        AirflowConnection expectedAirflowConnection = (AirflowConnection) expectedPipelineConnection.getConfig();
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
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (fieldName.equals("connection")) {
      assertTrue(((String) actual).contains("-encrypted-value"));
    } else {
      super.assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  public static void validateAirflowConnection(
      AirflowConnection expectedAirflowConnection,
      AirflowConnection actualAirflowConnection,
      Map<String, String> authHeaders) {
    assertEquals(expectedAirflowConnection.getHostPort(), actualAirflowConnection.getHostPort());
    // Currently, just checking for MySQL as metadata db for Airflow
    // We need to get inside the general DatabaseConnection and fetch the MysqlConnection
    DatabaseConnection expectedDatabaseConnection = (DatabaseConnection) expectedAirflowConnection.getConnection();
    MysqlConnection expectedMysqlConnection = (MysqlConnection) expectedDatabaseConnection.getConfig();
    // Use the database service tests utilities for the comparison
    // only admin can see all connection parameters
    if (ADMIN_AUTH_HEADERS.equals(authHeaders) || INGESTION_BOT_AUTH_HEADERS.equals(authHeaders)) {
      DatabaseConnection actualDatabaseConnection =
          JsonUtils.convertValue(actualAirflowConnection.getConnection(), DatabaseConnection.class);
      MysqlConnection actualMysqlConnection =
          JsonUtils.convertValue(actualDatabaseConnection.getConfig(), MysqlConnection.class);
      validateMysqlConnection(expectedMysqlConnection, actualMysqlConnection);
    } else {
      assertNotNull(actualAirflowConnection);
      assertNotNull(actualAirflowConnection.getHostPort());
      assertNull(actualAirflowConnection.getConnection());
    }
  }
}
