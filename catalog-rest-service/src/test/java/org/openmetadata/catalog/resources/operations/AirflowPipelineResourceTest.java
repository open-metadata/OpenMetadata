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

package org.openmetadata.catalog.resources.operations;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.Date;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.airflow.AirflowConfiguration;
import org.openmetadata.catalog.api.operations.pipelines.CreateAirflowPipeline;
import org.openmetadata.catalog.api.operations.pipelines.PipelineConfig;
import org.openmetadata.catalog.jdbi3.AirflowPipelineRepository;
import org.openmetadata.catalog.operations.pipelines.AirflowPipeline;
import org.openmetadata.catalog.operations.pipelines.DatabaseServiceMetadataPipeline;
import org.openmetadata.catalog.operations.pipelines.FilterPattern;
import org.openmetadata.catalog.operations.pipelines.PipelineType;
import org.openmetadata.catalog.resources.EntityOperationsResourceTest;
import org.openmetadata.catalog.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
public class AirflowPipelineResourceTest extends EntityOperationsResourceTest<AirflowPipeline, CreateAirflowPipeline> {
  public static PipelineConfig INGESTION_CONFIG;
  public static AirflowConfiguration AIRFLOW_CONFIG;
  public static DatabaseServiceResourceTest DATABASE_SERVICE_RESOURCE_TEST;

  public AirflowPipelineResourceTest() {
    super(
        Entity.AIRFLOW_PIPELINE,
        AirflowPipeline.class,
        AirflowPipelineResource.AirflowPipelineList.class,
        "airflowPipeline",
        AirflowPipelineResource.FIELDS);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
    DatabaseServiceMetadataPipeline databaseServiceMetadataPipeline =
        new DatabaseServiceMetadataPipeline()
            .withMarkDeletedTables(true)
            .withIncludeViews(true)
            .withSchemaFilterPattern(new FilterPattern().withExcludes(Arrays.asList("information_schema.*", "test.*")))
            .withTableFilterPattern(new FilterPattern().withIncludes(Arrays.asList("sales.*", "users.*")));
    AIRFLOW_CONFIG = new AirflowConfiguration();
    AIRFLOW_CONFIG.setApiEndpoint("http://localhost:8080");
    AIRFLOW_CONFIG.setUsername("admin");
    AIRFLOW_CONFIG.setPassword("admin");
    DATABASE_SERVICE_RESOURCE_TEST = new DatabaseServiceResourceTest();
  }

  @Override
  public CreateAirflowPipeline createRequest(
      String name, String description, String displayName, EntityReference owner) {
    return new CreateAirflowPipeline()
        .withName(name)
        .withPipelineType(PipelineType.METADATA)
        .withService(getContainer())
        .withPipelineConfig(INGESTION_CONFIG)
        .withDescription(description)
        .withDisplayName(displayName)
        .withOwner(owner);
  }

  @Override
  public EntityReference getContainer() {
    return BIGQUERY_REFERENCE;
  }

  @Override
  public void validateCreatedEntity(
      AirflowPipeline ingestion, CreateAirflowPipeline createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(ingestion),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());
  }

  @Override
  public void compareEntities(AirflowPipeline expected, AirflowPipeline updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(updated),
        expected.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        expected.getOwner());
    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    assertService(expected.getService(), updated.getService());
    assertEquals(expected.getPipelineConfig(), updated.getPipelineConfig());
  }

  @Override
  public EntityInterface<AirflowPipeline> getEntityInterface(AirflowPipeline entity) {
    return new AirflowPipelineRepository.AirflowPipelineEntityInterface(entity);
  }

  @Override
  public void validateGetWithDifferentFields(AirflowPipeline entity, boolean byName) throws HttpResponseException {}

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == null && actual == null) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }

  @Test
  void post_validAirflowPipeline_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreateAirflowPipeline create = createRequest(test);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    create.withName(getEntityName(test, 1)).withDescription("description");
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_AirflowPipelineWithConfig_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(createRequest(test).withPipelineConfig(INGESTION_CONFIG), ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_AirflowPipelineWithoutRequiredService_4xx(TestInfo test) {
    CreateAirflowPipeline create = createRequest(test).withService(null);
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "service must not be null");
  }

  @Test
  void post_AirflowPipelineWithDeploy_4xx(TestInfo test) {
    CreateAirflowPipeline create = createRequest(test).withService(BIGQUERY_REFERENCE);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, ADMIN_AUTH_HEADERS));
    // TODO check for error
  }

  @Test
  void post_AirflowWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {REDSHIFT_REFERENCE, BIGQUERY_REFERENCE};

    // Create Ingestion for each service and test APIs
    for (EntityReference service : differentServices) {
      AirflowPipeline ingestion = createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);
      assertEquals(service.getName(), ingestion.getService().getName());
    }
  }

  @Test
  void post_AirflowWithDatabaseServiceMetadata_200_ok(TestInfo test) throws IOException {
    CreateAirflowPipeline request =
        createRequest(test)
            .withPipelineType(PipelineType.METADATA)
            .withService(new EntityReference().withId(BIGQUERY_REFERENCE.getId()).withType("databaseService"))
            .withDescription("description");
    createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();
    String expectedScheduleInterval = "7 * * * *";
  }
}
