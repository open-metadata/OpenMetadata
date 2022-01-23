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

package org.openmetadata.catalog.resources.pipelines;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreatePipeline;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.jdbi3.PipelineRepository.PipelineEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.pipelines.PipelineResource.PipelineList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.Task;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
public class PipelineResourceTest extends EntityResourceTest<Pipeline> {
  public static List<Task> TASKS;

  public PipelineResourceTest() {
    super(
        Entity.PIPELINE,
        Pipeline.class,
        PipelineList.class,
        "pipelines",
        PipelineResource.FIELDS,
        true,
        true,
        true,
        true);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
    TASKS = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      Task task =
          new Task()
              .withName("task" + i)
              .withDescription("description")
              .withDisplayName("displayName")
              .withTaskUrl(new URI("http://localhost:0"));
      TASKS.add(task);
    }
  }

  @Override
  public Object createRequest(String name, String description, String displayName, EntityReference owner) {
    return create(name).withDescription(description).withDisplayName(displayName).withOwner(owner).withTasks(TASKS);
  }

  @Override
  public EntityReference getContainer(Object createRequest) throws URISyntaxException {
    CreatePipeline createPipeline = (CreatePipeline) createRequest;
    return createPipeline.getService();
  }

  @Override
  public void validateCreatedEntity(Pipeline pipeline, Object request, Map<String, String> authHeaders)
      throws HttpResponseException {
    CreatePipeline createRequest = (CreatePipeline) request;
    validateCommonEntityFields(
        getEntityInterface(pipeline),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());
    assertEquals(createRequest.getDisplayName(), pipeline.getDisplayName());
    assertNotNull(pipeline.getServiceType());
    assertService(createRequest.getService(), pipeline.getService());
    assertEquals(createRequest.getTasks(), pipeline.getTasks());
    TestUtils.validateTags(createRequest.getTags(), pipeline.getTags());
  }

  @Override
  public void validateUpdatedEntity(Pipeline pipeline, Object request, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCreatedEntity(pipeline, request, authHeaders);
  }

  @Override
  public void compareEntities(Pipeline expected, Pipeline updated, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(updated),
        expected.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        expected.getOwner());
    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    assertService(expected.getService(), updated.getService());
    assertEquals(expected.getTasks(), updated.getTasks());
    TestUtils.validateTags(expected.getTags(), updated.getTags());
  }

  @Override
  public EntityInterface<Pipeline> getEntityInterface(Pipeline entity) {
    return new PipelineEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == null && actual == null) {
      return;
    }
    if (fieldName.contains("tasks")) {
      List<Task> expectedTasks = (List<Task>) expected;
      List<Task> actualTasks = JsonUtils.readObjects(actual.toString(), Task.class);
      assertEquals(expectedTasks, actualTasks);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  @Test
  void post_validPipelines_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreatePipeline create = create(test);
    createAndCheckEntity(create, adminAuthHeaders());

    create.withName(getEntityName(test, 1)).withDescription("description");
    createAndCheckEntity(create, adminAuthHeaders());
  }

  @Test
  void post_PipelineWithUserOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  void post_PipelineWithTeamOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(TEAM_OWNER1).withDisplayName("Pipeline1"), adminAuthHeaders());
  }

  @Test
  void post_PipelineWithTasks_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withTasks(TASKS), adminAuthHeaders());
  }

  @Test
  void post_Pipeline_as_non_admin_401(TestInfo test) {
    CreatePipeline create = create(test);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createPipeline(create, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  void post_PipelineWithoutRequiredService_4xx(TestInfo test) {
    CreatePipeline create = create(test).withService(null);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createPipeline(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "service must not be null");
  }

  @Test
  void post_PipelineWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {AIRFLOW_REFERENCE, PREFECT_REFERENCE};

    // Create Pipeline for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(create(test).withService(service), adminAuthHeaders());

      // List Pipelines by filtering on service name and ensure right Pipelines in the response
      Map<String, String> queryParams =
          new HashMap<>() {
            {
              put("service", service.getName());
            }
          };
      ResultList<Pipeline> list = listEntities(queryParams, adminAuthHeaders());
      for (Pipeline db : list.getData()) {
        assertEquals(service.getName(), db.getService().getName());
      }
    }
  }

  @Test
  void put_PipelineUrlUpdate_200(TestInfo test) throws IOException, URISyntaxException {
    CreatePipeline request =
        create(test)
            .withService(new EntityReference().withId(AIRFLOW_REFERENCE.getId()).withType("pipelineService"))
            .withDescription("description");
    createAndCheckEntity(request, adminAuthHeaders());
    URI pipelineURI = new URI("https://airflow.open-metadata.org/tree?dag_id=airflow_redshift_usage");
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();

    // Updating description is ignored when backend already has description
    Pipeline pipeline =
        updatePipeline(
            request.withPipelineUrl(pipelineURI).withConcurrency(pipelineConcurrency).withStartDate(startDate),
            OK,
            adminAuthHeaders());
    String expectedFQN = AIRFLOW_REFERENCE.getName() + "." + pipeline.getName();
    assertEquals(pipelineURI, pipeline.getPipelineUrl());
    assertEquals(startDate, pipeline.getStartDate());
    assertEquals(pipelineConcurrency, pipeline.getConcurrency());
    assertEquals(expectedFQN, pipeline.getFullyQualifiedName());
  }

  @Test
  void put_PipelineTasksUpdate_200(TestInfo test) throws IOException {
    CreatePipeline request = create(test).withService(AIRFLOW_REFERENCE).withDescription(null);
    Pipeline pipeline = createAndCheckEntity(request, adminAuthHeaders());

    // Add description and tasks
    ChangeDescription change = getChangeDescription(pipeline.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("newDescription"));
    change.getFieldsAdded().add(new FieldChange().withName("tasks").withNewValue(TASKS));
    updateAndCheckEntity(
        request.withDescription("newDescription").withTasks(TASKS), OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  void put_AddRemovePipelineTasksUpdate_200(TestInfo test) throws IOException, URISyntaxException {
    CreatePipeline request =
        create(test)
            .withService(AIRFLOW_REFERENCE)
            .withDescription(null)
            .withTasks(null)
            .withConcurrency(null)
            .withPipelineUrl(new URI("http://localhost:8080"));
    Pipeline pipeline = createAndCheckEntity(request, adminAuthHeaders());

    // Add tasks and description
    ChangeDescription change = getChangeDescription(pipeline.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("newDescription"));
    change.getFieldsAdded().add(new FieldChange().withName("tasks").withNewValue(TASKS));
    change.getFieldsAdded().add(new FieldChange().withName("concurrency").withNewValue(5));
    change
        .getFieldsUpdated()
        .add(
            new FieldChange()
                .withName("pipelineUrl")
                .withNewValue("https://airflow.open-metadata.org")
                .withOldValue("http://localhost:8080"));
    pipeline =
        updateAndCheckEntity(
            request
                .withDescription("newDescription")
                .withTasks(TASKS)
                .withConcurrency(5)
                .withPipelineUrl(new URI("https://airflow.open-metadata.org")),
            OK,
            adminAuthHeaders(),
            MINOR_UPDATE,
            change);
    // TODO update this once task removal is figured out
    // remove a task
    // TASKS.remove(0);
    // change = getChangeDescription(pipeline.getVersion()).withFieldsUpdated(singletonList("tasks"));
    // updateAndCheckEntity(request.withTasks(TASKS), OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  void delete_emptyPipeline_200_ok(TestInfo test) throws IOException {
    Pipeline pipeline = createPipeline(create(test), adminAuthHeaders());
    deleteAndCheckEntity(pipeline, adminAuthHeaders());
  }

  @Test
  void delete_nonEmptyPipeline_4xx() {
    // TODO
  }

  @Test
  void delete_put_Pipeline_200(TestInfo test) throws IOException {
    CreatePipeline request = create(test).withService(AIRFLOW_REFERENCE).withDescription("");
    Pipeline pipeline = createEntity(request, adminAuthHeaders());

    // Delete
    deleteAndCheckEntity(pipeline, adminAuthHeaders());

    Double version = EntityUtil.nextVersion(pipeline.getVersion()); // Account for the version change during delete
    ChangeDescription change = getChangeDescription(version);
    change.setFieldsUpdated(
        Arrays.asList(
            new FieldChange().withName("deleted").withNewValue(false).withOldValue(true),
            new FieldChange().withName("description").withNewValue("updatedDescription").withOldValue("")));

    // PUT with updated description
    updateAndCheckEntity(
        request.withDescription("updatedDescription"), Response.Status.OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  public static Pipeline updatePipeline(CreatePipeline create, Status status, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.put(getResource("pipelines"), create, Pipeline.class, status, authHeaders);
  }

  public static Pipeline createPipeline(CreatePipeline create, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.post(getResource("pipelines"), create, Pipeline.class, authHeaders);
  }

  /** Validate returned fields GET .../pipelines/{id}?fields="..." or GET .../pipelines/name/{fqn}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(Pipeline pipeline, boolean byName) throws HttpResponseException {
    // .../Pipelines?fields=owner
    String fields = "owner";
    pipeline =
        byName
            ? getPipelineByName(pipeline.getFullyQualifiedName(), fields, adminAuthHeaders())
            : getPipeline(pipeline.getId(), fields, adminAuthHeaders());
    assertListNotNull(pipeline.getOwner(), pipeline.getService(), pipeline.getServiceType());
    assertNull(pipeline.getTasks());

    // .../Pipelines?fields=owner,service,tables
    fields = "owner,tasks";
    pipeline =
        byName
            ? getPipelineByName(pipeline.getFullyQualifiedName(), fields, adminAuthHeaders())
            : getPipeline(pipeline.getId(), fields, adminAuthHeaders());
    assertListNotNull(pipeline.getOwner(), pipeline.getService(), pipeline.getServiceType(), pipeline.getTasks());
  }

  public static Pipeline getPipeline(UUID id, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("pipelines/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Pipeline.class, authHeaders);
  }

  public static Pipeline getPipelineByName(String fqn, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("pipelines/name/" + fqn);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Pipeline.class, authHeaders);
  }

  private CreatePipeline create(TestInfo test) {
    return create(getEntityName(test));
  }

  private CreatePipeline create(String entityName) {
    return new CreatePipeline().withName(entityName).withService(AIRFLOW_REFERENCE);
  }
}
