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
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertListNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import javax.ws.rs.client.WebTarget;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreatePipeline;
import org.openmetadata.catalog.entity.data.Pipeline;
import org.openmetadata.catalog.entity.data.PipelineStatus;
import org.openmetadata.catalog.jdbi3.PipelineRepository.PipelineEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.pipelines.PipelineResource.PipelineList;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.Status;
import org.openmetadata.catalog.type.StatusType;
import org.openmetadata.catalog.type.Task;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.FullyQualifiedName;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
public class PipelineResourceTest extends EntityResourceTest<Pipeline, CreatePipeline> {
  public static List<Task> TASKS;

  public PipelineResourceTest() {
    super(Entity.PIPELINE, Pipeline.class, PipelineList.class, "pipelines", PipelineResource.FIELDS);
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
  public CreatePipeline createRequest(String name, String description, String displayName, EntityReference owner) {
    return new CreatePipeline()
        .withName(name)
        .withService(getContainer())
        .withDescription(description)
        .withDisplayName(displayName)
        .withOwner(owner)
        .withTasks(TASKS);
  }

  @Override
  public EntityReference getContainer() {
    return AIRFLOW_REFERENCE;
  }

  @Override
  public void validateCreatedEntity(Pipeline pipeline, CreatePipeline createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(pipeline),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());
    assertNotNull(pipeline.getServiceType());
    assertReference(createRequest.getService(), pipeline.getService());
    validateTasks(createRequest.getTasks(), pipeline.getTasks());
    TestUtils.validateTags(createRequest.getTags(), pipeline.getTags());
  }

  private void validateTasks(List<Task> expected, List<Task> actual) {
    if (expected == null || actual == null) {
      assertEquals(expected, actual);
      return;
    }
    assertEquals(expected.size(), actual.size());
    int i = 0;
    for (Task expectedTask : expected) {
      Task actualTask = actual.get(i);
      assertTrue(
          expectedTask.getName().equals(actualTask.getName())
              || expectedTask.getName().equals(actualTask.getDisplayName()));
      i++;
    }
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
    assertReference(expected.getService(), updated.getService());
    validateTasks(expected.getTasks(), updated.getTasks());
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
    if (fieldName.contains("tasks") && !fieldName.contains(".")) {
      @SuppressWarnings("unchecked")
      List<Task> expectedTasks = (List<Task>) expected;
      List<Task> actualTasks = JsonUtils.readObjects(actual.toString(), Task.class);
      validateTasks(expectedTasks, actualTasks);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  @Test
  void post_PipelineWithTasks_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(createRequest(test).withTasks(TASKS), ADMIN_AUTH_HEADERS);
  }

  @Test
  void post_PipelineWithoutRequiredService_4xx(TestInfo test) {
    CreatePipeline create = createRequest(test).withService(null);
    assertResponseContains(() -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "service must not be null");
  }

  @Test
  void post_PipelineWithDifferentService_200_ok(TestInfo test) throws IOException {
    EntityReference[] differentServices = {AIRFLOW_REFERENCE, PREFECT_REFERENCE};

    // Create Pipeline for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);

      // List Pipelines by filtering on service name and ensure right Pipelines in the response
      Map<String, String> queryParams =
          new HashMap<>() {
            {
              put("service", service.getName());
            }
          };
      ResultList<Pipeline> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (Pipeline db : list.getData()) {
        assertEquals(service.getName(), db.getService().getName());
      }
    }
  }

  @Test
  void post_pipelineWithTasksWithDots(TestInfo test) throws IOException, URISyntaxException {
    CreatePipeline create = createRequest(test);
    Task task = new Task().withName("ta.sk").withDescription("description").withTaskUrl(new URI("http://localhost:0"));
    create.setTasks(List.of(task));
    Pipeline created = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    Task actualTask = created.getTasks().get(0);
    assertTrue(actualTask.getName().equals("ta.sk"));
  }

  @Test
  void put_PipelineUrlUpdate_200(TestInfo test) throws IOException, URISyntaxException {
    CreatePipeline request =
        createRequest(test)
            .withService(new EntityReference().withId(AIRFLOW_REFERENCE.getId()).withType("pipelineService"))
            .withDescription("description");
    createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    URI pipelineURI = new URI("https://airflow.open-metadata.org/tree?dag_id=airflow_redshift_usage");
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();

    // Updating description is ignored when backend already has description
    Pipeline pipeline =
        updateEntity(
            request.withPipelineUrl(pipelineURI).withConcurrency(pipelineConcurrency).withStartDate(startDate),
            OK,
            ADMIN_AUTH_HEADERS);
    String expectedFQN = FullyQualifiedName.add(AIRFLOW_REFERENCE.getFullyQualifiedName(), pipeline.getName());
    assertEquals(pipelineURI, pipeline.getPipelineUrl());
    assertEquals(startDate, pipeline.getStartDate());
    assertEquals(pipelineConcurrency, pipeline.getConcurrency());
    assertEquals(expectedFQN, pipeline.getFullyQualifiedName());
  }

  @Test
  void put_PipelineTasksUpdate_200(TestInfo test) throws IOException, URISyntaxException {
    CreatePipeline request = createRequest(test).withService(AIRFLOW_REFERENCE).withDescription(null).withTasks(null);
    Pipeline pipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Add description and tasks
    ChangeDescription change = getChangeDescription(pipeline.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("newDescription"));
    change.getFieldsAdded().add(new FieldChange().withName("tasks").withNewValue(TASKS));
    pipeline =
        updateAndCheckEntity(
            request.withDescription("newDescription").withTasks(TASKS), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Add a task without description
    change = getChangeDescription(pipeline.getVersion());
    List<Task> tasks = new ArrayList<>();
    Task taskEmptyDesc = new Task().withName("taskEmpty").withTaskUrl(new URI("http://localhost:0"));
    tasks.add(taskEmptyDesc);
    change.getFieldsAdded().add(new FieldChange().withName("tasks").withNewValue(tasks));

    // Create new request with all the Tasks
    List<Task> updatedTasks = Stream.concat(TASKS.stream(), tasks.stream()).collect(Collectors.toList());
    updateAndCheckEntity(request.withTasks(updatedTasks), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_PipelineTasksOverride_200(TestInfo test) throws IOException, URISyntaxException {
    // A PUT operation with a new Task should override the current tasks in the Pipeline
    // This change will always be minor, both with deletes/adds
    CreatePipeline request = createRequest(test).withService(AIRFLOW_REFERENCE);
    Pipeline pipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    List<Task> newTask =
        Collections.singletonList(
            new Task()
                .withName("newTask")
                .withDescription("description")
                .withDisplayName("displayName")
                .withTaskUrl(new URI("http://localhost:0")));

    ChangeDescription change = getChangeDescription(pipeline.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("tasks").withNewValue(newTask));
    change.getFieldsDeleted().add(new FieldChange().withName("tasks").withOldValue(TASKS));

    updateAndCheckEntity(request.withTasks(newTask), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_PipelineStatus_200(TestInfo test) throws IOException, ParseException {
    CreatePipeline request = createRequest(test).withService(AIRFLOW_REFERENCE);
    Pipeline pipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd");

    // PUT one status and validate
    Status t1Status = new Status().withName("task1").withExecutionStatus(StatusType.Successful);
    Status t2Status = new Status().withName("task2").withExecutionStatus(StatusType.Failed);
    List<Status> taskStatus = List.of(t1Status, t2Status);

    PipelineStatus pipelineStatus =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Failed)
            .withExecutionDate(format.parse("2022-01-15").getTime())
            .withTaskStatus(taskStatus);

    Pipeline putResponse = putPipelineStatusData(pipeline.getId(), pipelineStatus, ADMIN_AUTH_HEADERS);
    // Validate put response
    verifyPipelineStatusData(putResponse.getPipelineStatus(), List.of(pipelineStatus));

    // Validate that a new GET will come with the proper status
    pipeline = getEntity(pipeline.getId(), "pipelineStatus", ADMIN_AUTH_HEADERS);
    verifyPipelineStatusData(pipeline.getPipelineStatus(), List.of(pipelineStatus));

    // PUT another status and validate
    PipelineStatus newPipelineStatus =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Failed)
            .withExecutionDate(format.parse("2022-01-16").getTime())
            .withTaskStatus(taskStatus);

    putResponse = putPipelineStatusData(pipeline.getId(), newPipelineStatus, ADMIN_AUTH_HEADERS);
    // Validate put response
    verifyPipelineStatusData(putResponse.getPipelineStatus(), List.of(pipelineStatus, newPipelineStatus));

    // Validate that a new GET will come with the proper status
    pipeline = getEntity(pipeline.getId(), "pipelineStatus", ADMIN_AUTH_HEADERS);
    verifyPipelineStatusData(pipeline.getPipelineStatus(), List.of(pipelineStatus, newPipelineStatus));

    // Replace status data for a date
    Status t3Status = new Status().withName("task0").withExecutionStatus(StatusType.Successful);
    List<Status> newTaskStatus = List.of(t1Status, t2Status, t3Status);
    PipelineStatus anotherStatus =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Successful)
            .withExecutionDate(format.parse("2022-01-16").getTime())
            .withTaskStatus(newTaskStatus);

    putResponse = putPipelineStatusData(pipeline.getId(), anotherStatus, ADMIN_AUTH_HEADERS);
    // As the results come sorted, check the first status, as we are updating the newest one,
    // ordering with reverseOrder
    assertEquals(anotherStatus.getExecutionDate(), putResponse.getPipelineStatus().get(0).getExecutionDate());
    // Validate put response
    verifyPipelineStatusData(putResponse.getPipelineStatus(), List.of(pipelineStatus, anotherStatus));

    // Validate that a new GET will come with the proper status
    pipeline = getEntity(pipeline.getId(), "pipelineStatus", ADMIN_AUTH_HEADERS);
    verifyPipelineStatusData(pipeline.getPipelineStatus(), List.of(pipelineStatus, anotherStatus));
  }

  @Test
  void put_PipelineInvalidStatus_4xx(TestInfo test) throws IOException, ParseException {
    CreatePipeline request = createRequest(test).withService(AIRFLOW_REFERENCE);
    Pipeline pipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd");

    // PUT one status and validate
    Status t1Status = new Status().withName("task1").withExecutionStatus(StatusType.Successful);
    Status t2Status = new Status().withName("invalidTask").withExecutionStatus(StatusType.Failed);
    List<Status> taskStatus = List.of(t1Status, t2Status);

    PipelineStatus pipelineStatus =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Failed)
            .withExecutionDate(format.parse("2022-01-16").getTime())
            .withTaskStatus(taskStatus);

    assertResponseContains(
        () -> putPipelineStatusData(pipeline.getId(), pipelineStatus, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid task name invalidTask");
  }

  @Test
  void patch_PipelineTasksUpdate_200_ok(TestInfo test) throws IOException, URISyntaxException {
    CreatePipeline request = createRequest(test).withService(AIRFLOW_REFERENCE);
    Pipeline pipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    String origJson = JsonUtils.pojoToJson(pipeline);
    // Add a task without description
    ChangeDescription change = getChangeDescription(pipeline.getVersion());
    List<Task> tasks = new ArrayList<>();
    Task taskEmptyDesc = new Task().withName("taskEmpty").withTaskUrl(new URI("http://localhost:0"));
    tasks.add(taskEmptyDesc);
    change.getFieldsAdded().add(new FieldChange().withName("tasks").withNewValue(tasks));
    change.getFieldsAdded().add(new FieldChange().withName("description").withNewValue("newDescription"));

    // Create new request with all the Tasks
    List<Task> updatedTasks = Stream.concat(TASKS.stream(), tasks.stream()).collect(Collectors.toList());
    pipeline.setTasks(updatedTasks);
    pipeline.setDescription("newDescription");
    pipeline = patchEntityAndCheck(pipeline, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // add a description to an existing task
    origJson = JsonUtils.pojoToJson(pipeline);
    change = getChangeDescription(pipeline.getVersion());
    List<Task> newTasks = new ArrayList<>();
    Task taskWithDesc = taskEmptyDesc.withDescription("taskDescription");
    newTasks.add(taskWithDesc);
    change
        .getFieldsAdded()
        .add(new FieldChange().withName("tasks.taskEmpty.description").withNewValue("taskDescription"));

    List<Task> updatedNewTasks = Stream.concat(TASKS.stream(), newTasks.stream()).collect(Collectors.toList());
    pipeline.setTasks(updatedNewTasks);
    pipeline = patchEntityAndCheck(pipeline, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // update the descriptions of pipeline and task
    origJson = JsonUtils.pojoToJson(pipeline);
    change = getChangeDescription(pipeline.getVersion());
    newTasks = new ArrayList<>();
    taskWithDesc = taskEmptyDesc.withDescription("newTaskDescription");
    newTasks.add(taskWithDesc);
    change
        .getFieldsUpdated()
        .add(
            new FieldChange()
                .withName("tasks.taskEmpty.description")
                .withOldValue("taskDescription")
                .withNewValue("newTaskDescription"));
    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("description").withOldValue("newDescription").withNewValue("newDescription2"));

    updatedNewTasks = Stream.concat(TASKS.stream(), newTasks.stream()).collect(Collectors.toList());
    pipeline.setTasks(updatedNewTasks);
    pipeline.setDescription("newDescription2");
    pipeline = patchEntityAndCheck(pipeline, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // delete task and pipeline description by setting them to null
    origJson = JsonUtils.pojoToJson(pipeline);
    change = getChangeDescription(pipeline.getVersion());
    newTasks = new ArrayList<>();
    Task taskWithoutDesc = taskEmptyDesc.withDescription(null);
    newTasks.add(taskWithoutDesc);
    change
        .getFieldsDeleted()
        .add(
            new FieldChange()
                .withName("tasks.taskEmpty.description")
                .withOldValue("newTaskDescription")
                .withNewValue(null));
    change
        .getFieldsDeleted()
        .add(new FieldChange().withName("description").withOldValue("newDescription2").withNewValue(null));

    updatedNewTasks = Stream.concat(TASKS.stream(), newTasks.stream()).collect(Collectors.toList());
    pipeline.setTasks(updatedNewTasks);
    pipeline.setDescription(null);
    patchEntityAndCheck(pipeline, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_AddRemovePipelineTasksUpdate_200(TestInfo test) throws IOException, URISyntaxException {
    CreatePipeline request =
        createRequest(test)
            .withService(AIRFLOW_REFERENCE)
            .withDescription(null)
            .withTasks(null)
            .withConcurrency(null)
            .withPipelineUrl(new URI("http://localhost:8080"));
    Pipeline pipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

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
            ADMIN_AUTH_HEADERS,
            MINOR_UPDATE,
            change);
    // TODO update this once task removal is figured out
    // remove a task
    // TASKS.remove(0);
    // change = getChangeDescription(pipeline.getVersion()).withFieldsUpdated(singletonList("tasks"));
    // updateAndCheckEntity(request.withTasks(TASKS), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void delete_nonEmptyPipeline_4xx() {
    // TODO
  }

  @Override
  public EntityInterface<Pipeline> validateGetWithDifferentFields(Pipeline pipeline, boolean byName)
      throws HttpResponseException {
    String fields = "";
    pipeline =
        byName
            ? getPipelineByName(pipeline.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getPipeline(pipeline.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(pipeline.getService(), pipeline.getServiceType());
    assertListNull(
        pipeline.getOwner(),
        pipeline.getTasks(),
        pipeline.getPipelineStatus(),
        pipeline.getTags(),
        pipeline.getFollowers(),
        pipeline.getTags());

    fields = "owner,tasks,pipelineStatus,followers,tags";
    pipeline =
        byName
            ? getPipelineByName(pipeline.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getPipeline(pipeline.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(pipeline.getService(), pipeline.getServiceType());
    // Checks for other owner, tags, and followers is done in the base class
    return getEntityInterface(pipeline);
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

  // Prepare Pipeline status endpoint for PUT
  public static Pipeline putPipelineStatusData(UUID pipelineId, PipelineStatus data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("pipelines/" + pipelineId + "/status");
    return TestUtils.put(target, data, Pipeline.class, OK, authHeaders);
  }

  // Check that the inserted status are properly stored
  private void verifyPipelineStatusData(List<PipelineStatus> actualStatus, List<PipelineStatus> expectedStatus) {
    assertEquals(actualStatus.size(), expectedStatus.size());
    Map<Long, PipelineStatus> statusMap = new HashMap<>();
    for (PipelineStatus status : actualStatus) {
      statusMap.put(status.getExecutionDate(), status);
    }
    for (PipelineStatus status : expectedStatus) {
      PipelineStatus storedStatus = statusMap.get(status.getExecutionDate());
      assertNotNull(storedStatus);
      assertEquals(status, storedStatus);
    }
  }
}
