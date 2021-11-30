/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.pipelines;

import org.apache.http.client.HttpResponseException;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreatePipeline;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.PipelineRepository.PipelineEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.pipelines.PipelineResource.PipelineList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.Task;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;

public class PipelineResourceTest extends EntityResourceTest<Pipeline> {
  public static List<Task> TASKS;

  public PipelineResourceTest() {
    super(Entity.PIPELINE, Pipeline.class, PipelineList.class, "pipelines", PipelineResource.FIELDS,
            true, true, true);
  }


  @BeforeAll
  public static void setup(TestInfo test) throws IOException, URISyntaxException {
    EntityResourceTest.setup(test);
    TASKS = new ArrayList<>();
    for (int i=0; i < 3; i++) {
      Task task = new Task().withName("task" + i).withDescription("description")
              .withDisplayName("displayName").withTaskUrl(new URI("http://localhost:0"));
      TASKS.add(task);
    }
  }

  @Override
  public Object createRequest(String name, String description, String displayName, EntityReference owner) {
    return create(name).withDescription(description).withDisplayName(displayName).withOwner(owner);
  }

  @Override
  public void validateCreatedEntity(Pipeline pipeline, Object request, Map<String, String> authHeaders)
          throws HttpResponseException {
    CreatePipeline createRequest = (CreatePipeline) request;
    validateCommonEntityFields(getEntityInterface(pipeline), createRequest.getDescription(),
            TestUtils.getPrincipal(authHeaders), createRequest.getOwner());
    assertEquals(createRequest.getDisplayName(), pipeline.getDisplayName());
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
    validateCommonEntityFields(getEntityInterface(updated), expected.getDescription(),
            TestUtils.getPrincipal(authHeaders), expected.getOwner());
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
  public void post_PipelineAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    CreatePipeline create = create(test);
    createPipeline(create, adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPipeline(create, adminAuthHeaders()));
    assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validPipelines_as_admin_200_OK(TestInfo test) throws IOException {
    // Create team with different optional fields
    CreatePipeline create = create(test);
    createAndCheckEntity(create, adminAuthHeaders());

    create.withName(getEntityName(test, 1)).withDescription("description");
    createAndCheckEntity(create, adminAuthHeaders());
  }

  @Test
  public void post_PipelineWithUserOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_PipelineWithTeamOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(TEAM_OWNER1).withDisplayName("Pipeline1"), adminAuthHeaders());
  }

  @Test
  public void post_PipelineWithTasks_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withTasks(TASKS), adminAuthHeaders());
  }

  @Test
  public void post_Pipeline_as_non_admin_401(TestInfo test) {
    CreatePipeline create = create(test);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPipeline(create, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_PipelineWithoutRequiredService_4xx(TestInfo test) {
    CreatePipeline create = create(test).withService(null);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPipeline(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "service must not be null");
  }

  @Test
  public void post_PipelineWithInvalidOwnerType_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */

    CreatePipeline create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPipeline(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "type must not be null");
  }

  @Test
  public void post_PipelineWithNonExistentOwner_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TestUtils.NON_EXISTENT_ENTITY).withType("user");
    CreatePipeline create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createPipeline(create, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound("User", TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_PipelineWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {AIRFLOW_REFERENCE, PREFECT_REFERENCE};

    // Create Pipeline for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(create(test).withService(service), adminAuthHeaders());

      // List Pipelines by filtering on service name and ensure right Pipelines are returned in the response
      Map<String, String> queryParams = new HashMap<>(){{put("service", service.getName());}};
      ResultList<Pipeline> list = listEntities(queryParams, adminAuthHeaders());
      for (Pipeline db : list.getData()) {
        assertEquals(service.getName(), db.getService().getName());
      }
    }
  }

  @Test
  public void put_PipelineUrlUpdate_200(TestInfo test) throws IOException, URISyntaxException {
    CreatePipeline request = create(test).withService(new EntityReference().withId(AIRFLOW_REFERENCE.getId())
            .withType("pipelineService")).withDescription("description");
    createAndCheckEntity(request, adminAuthHeaders());
    URI pipelineURI = new URI("https://airflow.open-metadata.org/tree?dag_id=airflow_redshift_usage");
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();

    // Updating description is ignored when backend already has description
    Pipeline pipeline = updatePipeline(request.withPipelineUrl(pipelineURI)
            .withConcurrency(pipelineConcurrency)
            .withStartDate(startDate), OK, adminAuthHeaders());
    String expectedFQN = AIRFLOW_REFERENCE.getName()+"."+pipeline.getName();
    assertEquals(pipelineURI, pipeline.getPipelineUrl());
    assertEquals(startDate, pipeline.getStartDate());
    assertEquals(pipelineConcurrency, pipeline.getConcurrency());
    assertEquals(expectedFQN, pipeline.getFullyQualifiedName());
  }

  @Test
  public void put_PipelineTasksUpdate_200(TestInfo test) throws IOException {
    CreatePipeline request = create(test).withService(AIRFLOW_REFERENCE).withDescription(null);
    Pipeline pipeline = createAndCheckEntity(request, adminAuthHeaders());

    // Add description and tasks
    ChangeDescription change = getChangeDescription(pipeline.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("newDescription"));
    change.getFieldsAdded().add(new FieldChange().withName("tasks").withNewValue(TASKS));
    updateAndCheckEntity(request.withDescription("newDescription").withTasks(TASKS), OK, adminAuthHeaders(),
            MINOR_UPDATE, change);
  }

  @Test
  public void put_AddRemovePipelineTasksUpdate_200(TestInfo test) throws IOException, URISyntaxException {
    CreatePipeline request = create(test).withService(AIRFLOW_REFERENCE).withDescription(null)
        .withTasks(null).withConcurrency(null).withPipelineUrl(new URI("http://localhost:8080"));
    Pipeline pipeline = createAndCheckEntity(request, adminAuthHeaders());

    // Add tasks and description
    ChangeDescription change = getChangeDescription(pipeline.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("newDescription"));
    change.getFieldsAdded().add(new FieldChange().withName("tasks").withNewValue(TASKS));
    change.getFieldsAdded().add(new FieldChange().withName("concurrency")
        .withNewValue(5));
    change.getFieldsUpdated().add(new FieldChange().withName("pipelineUrl")
        .withNewValue("https://airflow.open-metadata.org").withOldValue("http://localhost:8080"));
    pipeline = updateAndCheckEntity(request.withDescription("newDescription").withTasks(TASKS)
            .withConcurrency(5).withPipelineUrl(new URI("https://airflow.open-metadata.org")),
        OK, adminAuthHeaders(), MINOR_UPDATE, change);
    // TODO update this once task removal is figured out
    // remove a task
    // TASKS.remove(0);
    // change = getChangeDescription(pipeline.getVersion()).withFieldsUpdated(singletonList("tasks"));
    //updateAndCheckEntity(request.withTasks(TASKS), OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  public void get_nonExistentPipeline_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getPipeline(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND,
            entityNotFound(Entity.PIPELINE, TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_PipelineWithDifferentFields_200_OK(TestInfo test) throws IOException {
    CreatePipeline create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(AIRFLOW_REFERENCE).withTasks(TASKS);
    Pipeline pipeline = createAndCheckEntity(create, adminAuthHeaders());
    validateGetWithDifferentFields(pipeline, false);
  }

  @Test
  public void get_PipelineByNameWithDifferentFields_200_OK(TestInfo test) throws IOException {
    CreatePipeline create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(AIRFLOW_REFERENCE).withTasks(TASKS);
    Pipeline pipeline = createAndCheckEntity(create, adminAuthHeaders());
    validateGetWithDifferentFields(pipeline, true);
  }

  @Test
  public void delete_emptyPipeline_200_ok(TestInfo test) throws HttpResponseException {
    Pipeline pipeline = createPipeline(create(test), adminAuthHeaders());
    deletePipeline(pipeline.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_nonEmptyPipeline_4xx() {
    // TODO
  }

  @Test
  public void delete_nonExistentPipeline_404() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deletePipeline(TestUtils.NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.PIPELINE, TestUtils.NON_EXISTENT_ENTITY));
  }

  public static Pipeline updatePipeline(CreatePipeline create,
                                        Status status,
                                        Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.put(getResource("pipelines"),
                          create, Pipeline.class, status, authHeaders);
  }

  public static Pipeline createPipeline(CreatePipeline create,
                                        Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(getResource("pipelines"), create, Pipeline.class, authHeaders);
  }

  /** Validate returned fields GET .../pipelines/{id}?fields="..." or GET .../pipelines/name/{fqn}?fields="..." */
  private void validateGetWithDifferentFields(Pipeline pipeline, boolean byName) throws HttpResponseException {
    // .../Pipelines?fields=owner
    String fields = "owner";
    pipeline = byName ? getPipelineByName(pipeline.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getPipeline(pipeline.getId(), fields, adminAuthHeaders());
    assertNotNull(pipeline.getOwner());
    assertNotNull(pipeline.getService()); // We always return the service
    assertNull(pipeline.getTasks());

    // .../Pipelines?fields=owner,service
    fields = "owner,service";
    pipeline = byName ? getPipelineByName(pipeline.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getPipeline(pipeline.getId(), fields, adminAuthHeaders());
    assertNotNull(pipeline.getOwner());
    assertNotNull(pipeline.getService());
    assertNull(pipeline.getTasks());

    // .../Pipelines?fields=owner,service,tables
    fields = "owner,service,tasks";
    pipeline = byName ? getPipelineByName(pipeline.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getPipeline(pipeline.getId(), fields, adminAuthHeaders());
    assertNotNull(pipeline.getOwner());
    assertNotNull(pipeline.getService());
    assertNotNull(pipeline.getTasks());
  }

  public static void getPipeline(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    getPipeline(id, null, authHeaders);
  }

  public static Pipeline getPipeline(UUID id, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("pipelines/" + id);
    target = fields != null ? target.queryParam("fields", fields): target;
    return TestUtils.get(target, Pipeline.class, authHeaders);
  }

  public static Pipeline getPipelineByName(String fqn, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("pipelines/name/" + fqn);
    target = fields != null ? target.queryParam("fields", fields): target;
    return TestUtils.get(target, Pipeline.class, authHeaders);
  }

  private void deletePipeline(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(getResource("pipelines/" + id), authHeaders);

    // Ensure deleted Pipeline does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getPipeline(id, authHeaders));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.PIPELINE, id));
  }

  private CreatePipeline create(TestInfo test) {
    return create(getEntityName(test));
  }

  private CreatePipeline create(String entityName) {
    return new CreatePipeline().withName(entityName).withService(AIRFLOW_REFERENCE);
  }
}
