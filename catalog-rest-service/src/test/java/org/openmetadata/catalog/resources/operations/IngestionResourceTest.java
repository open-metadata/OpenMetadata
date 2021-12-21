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
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Date;
import java.util.Map;
import javax.ws.rs.core.Response.Status;
import org.apache.http.client.HttpResponseException;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.operations.workflows.CreateIngestion;
import org.openmetadata.catalog.jdbi3.IngestionRepository;
import org.openmetadata.catalog.operations.workflows.ConnectorConfig;
import org.openmetadata.catalog.operations.workflows.Ingestion;
import org.openmetadata.catalog.resources.EntityOperationsResourceTest;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.TestUtils;

public class IngestionResourceTest extends EntityOperationsResourceTest<Ingestion> {
  public static ConnectorConfig INGESTION_CONFIG;

  public IngestionResourceTest() {
    super(
        Entity.INGESTION,
        Ingestion.class,
        IngestionResource.IngestionList.class,
        "ingestion",
        IngestionResource.FIELDS,
        false,
        true,
        true);
  }

  @BeforeAll
  public static void setup(TestInfo test) throws IOException, URISyntaxException {
    EntityResourceTest.setup(test);
    INGESTION_CONFIG =
        new ConnectorConfig()
            .withEnableDataProfiler(true)
            .withUsername("test")
            .withPassword("test")
            .withHost("localhost:9092");
  }

  @Override
  public Object createRequest(String name, String description, String displayName, EntityReference owner) {
    return create(name).withDescription(description).withDisplayName(displayName).withOwner(owner);
  }

  @Override
  public void validateCreatedEntity(Ingestion ingestion, Object request, Map<String, String> authHeaders)
      throws HttpResponseException {
    CreateIngestion createRequest = (CreateIngestion) request;
    validateCommonEntityFields(
        getEntityInterface(ingestion),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());
    assertEquals(createRequest.getDisplayName(), ingestion.getDisplayName());
    assertEquals(createRequest.getConcurrency(), ingestion.getConcurrency());
    assertEquals(createRequest.getConnectorConfig(), ingestion.getConnectorConfig());
    TestUtils.validateTags(createRequest.getTags(), ingestion.getTags());
  }

  @Override
  public void validateUpdatedEntity(Ingestion ingestion, Object request, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCreatedEntity(ingestion, request, authHeaders);
  }

  @Override
  public void compareEntities(Ingestion expected, Ingestion updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(updated),
        expected.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        expected.getOwner());
    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    assertService(expected.getService(), updated.getService());
    assertEquals(expected.getConnectorConfig(), updated.getConnectorConfig());
    TestUtils.validateTags(expected.getTags(), updated.getTags());
  }

  @Override
  public EntityInterface<Ingestion> getEntityInterface(Ingestion entity) {
    return new IngestionRepository.IngestionEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == null && actual == null) {
      return;
    }
    assertCommonFieldChange(fieldName, expected, actual);
  }

  @Test
  public void post_validIngestion_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreateIngestion create = create(test);
    createAndCheckEntity(create, adminAuthHeaders());

    create.withName(getEntityName(test, 1)).withDescription("description");
    createAndCheckEntity(create, adminAuthHeaders());
  }

  @Test
  public void post_IngestionWithUserOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_IngestionWithTeamOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(TEAM_OWNER1).withDisplayName("Ingestion1"), adminAuthHeaders());
  }

  @Test
  public void post_IngestionWithConfig_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withConnectorConfig(INGESTION_CONFIG), adminAuthHeaders());
  }

  @Test
  public void post_Ingestion_as_non_admin_401(TestInfo test) {
    CreateIngestion create = create(test);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_IngestionWithoutRequiredService_4xx(TestInfo test) {
    CreateIngestion create = create(test).withService(null);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "service must not be null");
  }

  @Test
  public void post_IngestionWithDeploy_4xx(TestInfo test) {
    CreateIngestion create = create(test).withService(BIGQUERY_REFERENCE).withForceDeploy(true);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    // TODO check for error
  }

  @Test
  public void post_IngestionWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {REDSHIFT_REFERENCE, BIGQUERY_REFERENCE};

    // Create Ingestion for each service and test APIs
    for (EntityReference service : differentServices) {
      Ingestion ingestion = createAndCheckEntity(create(test).withService(service), adminAuthHeaders());
      assertEquals(service.getName(), ingestion.getService().getName());
    }
  }

  @Test
  public void put_IngestionUrlUpdate_200(TestInfo test) throws IOException {
    CreateIngestion request =
        create(test)
            .withService(new EntityReference().withId(BIGQUERY_REFERENCE.getId()).withType("databaseService"))
            .withDescription("description")
            .withScheduleInterval("5 * * * *");
    createAndCheckEntity(request, adminAuthHeaders());
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();
    String expectedScheduleInterval = "7 * * * *";
    // Updating description is ignored when backend already has description
    Ingestion ingestion =
        updateIngestion(
            request
                .withConnectorConfig(INGESTION_CONFIG)
                .withConcurrency(pipelineConcurrency)
                .withScheduleInterval(expectedScheduleInterval)
                .withStartDate(startDate.toString()),
            OK,
            adminAuthHeaders());
    String expectedFQN = BIGQUERY_REFERENCE.getName() + "." + ingestion.getName();
    assertEquals(startDate.toString(), ingestion.getStartDate());
    assertEquals(pipelineConcurrency, ingestion.getConcurrency());
    assertEquals(expectedFQN, ingestion.getFullyQualifiedName());
    assertEquals(expectedScheduleInterval, ingestion.getScheduleInterval());
    ingestion = getEntity(ingestion.getId(), "owner", adminAuthHeaders());
    assertEquals(expectedScheduleInterval, ingestion.getScheduleInterval());
  }

  @Test
  public void put_IngestionUpdate_200(TestInfo test) throws IOException {
    CreateIngestion request = create(test).withService(BIGQUERY_REFERENCE).withDescription(null).withOwner(null);
    Ingestion ingestion = createAndCheckEntity(request, adminAuthHeaders());

    // Add description and tasks
    ChangeDescription change = getChangeDescription(ingestion.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("newDescription"));
    change.getFieldsAdded().add(new FieldChange().withName("owner").withNewValue(USER_OWNER1));
    updateAndCheckEntity(
        request.withDescription("newDescription").withOwner(USER_OWNER1), OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  public void delete_ingestion_200_ok(TestInfo test) throws HttpResponseException {
    Ingestion ingestion = createEntity(create(test), adminAuthHeaders());
    deleteEntity(ingestion.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_nonEmptyPipeline_4xx() {
    // TODO
  }

  private Ingestion updateIngestion(CreateIngestion create, Status status, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.put(getCollection(), create, Ingestion.class, status, authHeaders);
  }

  /**
   * Validate returned fields GET .../operations/ingestion/{id}?fields="..." or GET
   * .../operations/ingestion/name/{fqn}?fields="..."
   */
  @Override
  public void validateGetWithDifferentFields(Ingestion ingestion, boolean byName) throws HttpResponseException {
    // .../Pipelines?fields=owner
    String fields = "owner";
    ingestion =
        byName
            ? getEntityByName(ingestion.getFullyQualifiedName(), fields, adminAuthHeaders())
            : getEntity(ingestion.getId(), fields, adminAuthHeaders());
    assertListNotNull(ingestion.getOwner(), ingestion.getService());
  }

  private CreateIngestion create(TestInfo test) {
    return create(getEntityName(test));
  }

  private CreateIngestion create(String entityName) {
    return new CreateIngestion()
        .withName(entityName)
        .withService(BIGQUERY_REFERENCE)
        .withConnectorConfig(INGESTION_CONFIG)
        .withStartDate("2021-11-21")
        .withOwner(TEAM_OWNER1);
  }
}
