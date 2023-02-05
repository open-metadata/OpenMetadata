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

package org.openmetadata.service.resources.pipelines;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
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
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Status;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.type.Task;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.pipelines.PipelineResource.PipelineList;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

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
              .withTaskUrl("http://localhost:0");
      TASKS.add(task);
    }
  }

  @Override
  public CreatePipeline createRequest(String name) {
    return new CreatePipeline().withName(name).withService(getContainer().getFullyQualifiedName()).withTasks(TASKS);
  }

  @Override
  public EntityReference getContainer() {
    return AIRFLOW_REFERENCE;
  }

  @Override
  public EntityReference getContainer(Pipeline entity) {
    return entity.getService();
  }

  @Override
  public void validateCreatedEntity(Pipeline pipeline, CreatePipeline createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
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
    assertEquals(expected.getDisplayName(), updated.getDisplayName());
    assertReference(expected.getService(), updated.getService());
    validateTasks(expected.getTasks(), updated.getTasks());
    TestUtils.validateTags(expected.getTags(), updated.getTags());
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
    String[] differentServices = {AIRFLOW_REFERENCE.getName(), GLUE_REFERENCE.getName()};

    // Create Pipeline for each service and test APIs
    for (String service : differentServices) {
      createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);

      // List Pipelines by filtering on service name and ensure right Pipelines in the response
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("service", service);

      ResultList<Pipeline> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (Pipeline db : list.getData()) {
        assertEquals(service, db.getService().getName());
      }
    }
  }

  @Test
  void post_pipelineWithTasksWithDots(TestInfo test) throws IOException {
    CreatePipeline create = createRequest(test);
    Task task = new Task().withName("ta.sk").withDescription("description").withTaskUrl("http://localhost:0");
    create.setTasks(List.of(task));
    Pipeline created = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    Task actualTask = created.getTasks().get(0);
    assertEquals("ta.sk", actualTask.getName());
  }

  @Test
  void put_PipelineUrlUpdate_200(TestInfo test) throws IOException {
    CreatePipeline request =
        createRequest(test).withService(AIRFLOW_REFERENCE.getName()).withDescription("description");
    createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    String pipelineURL = "https://airflow.open-metadata.org/tree?dag_id=airflow_redshift_usage";
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();

    // Updating description is ignored when backend already has description
    Pipeline pipeline =
        updateEntity(
            request.withPipelineUrl(pipelineURL).withConcurrency(pipelineConcurrency).withStartDate(startDate),
            OK,
            ADMIN_AUTH_HEADERS);
    String expectedFQN = FullyQualifiedName.add(AIRFLOW_REFERENCE.getFullyQualifiedName(), pipeline.getName());
    assertEquals(pipelineURL, pipeline.getPipelineUrl());
    assertEquals(startDate, pipeline.getStartDate());
    assertEquals(pipelineConcurrency, pipeline.getConcurrency());
    assertEquals(expectedFQN, pipeline.getFullyQualifiedName());
  }

  @Test
  void put_PipelineTasksUpdate_200(TestInfo test) throws IOException {
    CreatePipeline request =
        createRequest(test).withService(AIRFLOW_REFERENCE.getName()).withDescription(null).withTasks(null);
    Pipeline pipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Add description and tasks
    ChangeDescription change = getChangeDescription(pipeline.getVersion());
    fieldAdded(change, "description", "newDescription");
    fieldAdded(change, "tasks", TASKS);

    pipeline =
        updateAndCheckEntity(
            request.withDescription("newDescription").withTasks(TASKS), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Add a task without description
    change = getChangeDescription(pipeline.getVersion());
    List<Task> tasks = new ArrayList<>();
    Task taskEmptyDesc = new Task().withName("taskEmpty").withTaskUrl("http://localhost:0");
    tasks.add(taskEmptyDesc);
    fieldAdded(change, "tasks", tasks);
    // Create new request with all the Tasks
    List<Task> updatedTasks = Stream.concat(TASKS.stream(), tasks.stream()).collect(Collectors.toList());
    pipeline = updateAndCheckEntity(request.withTasks(updatedTasks), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    change = getChangeDescription(pipeline.getVersion());
    // create a request with same tasks we shouldn't see any change
    updateAndCheckEntity(request.withTasks(updatedTasks), OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);
    // create new request with few tasks removed
    updatedTasks.remove(taskEmptyDesc);
    change = getChangeDescription(pipeline.getVersion());
    fieldDeleted(change, "tasks", List.of(taskEmptyDesc));
    updateAndCheckEntity(request.withTasks(updatedTasks), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    pipeline = getPipeline(pipeline.getId(), "tasks", ADMIN_AUTH_HEADERS);
    validateTasks(pipeline.getTasks(), updatedTasks);
  }

  @Test
  void put_PipelineTasksOverride_200(TestInfo test) throws IOException {
    // A PUT operation with a new Task should override the current tasks in the Pipeline
    // This change will always be minor, both with deletes/adds
    CreatePipeline request = createRequest(test).withService(AIRFLOW_REFERENCE.getName());
    Pipeline pipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    List<Task> newTask =
        Collections.singletonList(
            new Task()
                .withName("newTask")
                .withDescription("description")
                .withDisplayName("displayName")
                .withTaskUrl("http://localhost:0"));

    ChangeDescription change = getChangeDescription(pipeline.getVersion());
    fieldAdded(change, "tasks", newTask);
    fieldDeleted(change, "tasks", TASKS);
    updateAndCheckEntity(request.withTasks(newTask), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_PipelineStatus_200(TestInfo test) throws IOException, ParseException {
    CreatePipeline request = createRequest(test).withService(AIRFLOW_REFERENCE.getName());
    Pipeline pipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // PUT one status and validate
    Status t1Status = new Status().withName("task1").withExecutionStatus(StatusType.Successful);
    Status t2Status = new Status().withName("task2").withExecutionStatus(StatusType.Failed);
    List<Status> taskStatus = List.of(t1Status, t2Status);

    PipelineStatus pipelineStatus =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2022-01-15"))
            .withTaskStatus(taskStatus);

    Pipeline putResponse = putPipelineStatusData(pipeline.getFullyQualifiedName(), pipelineStatus, ADMIN_AUTH_HEADERS);
    // Validate put response
    verifyPipelineStatus(putResponse.getPipelineStatus(), pipelineStatus);

    ResultList<PipelineStatus> pipelineStatues =
        getPipelineStatues(
            pipeline.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2022-01-15"),
            TestUtils.dateToTimestamp("2022-01-16"),
            ADMIN_AUTH_HEADERS);
    verifyPipelineStatuses(pipelineStatues, List.of(pipelineStatus), 1);

    // Validate that a new GET will come with the proper status
    pipeline = getEntity(pipeline.getId(), "pipelineStatus", ADMIN_AUTH_HEADERS);
    verifyPipelineStatus(pipeline.getPipelineStatus(), pipelineStatus);

    // PUT another status and validate
    PipelineStatus newPipelineStatus =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Failed)
            .withTimestamp(TestUtils.dateToTimestamp("2022-01-16"))
            .withTaskStatus(taskStatus);

    putResponse = putPipelineStatusData(pipeline.getFullyQualifiedName(), newPipelineStatus, ADMIN_AUTH_HEADERS);
    // Validate put response
    verifyPipelineStatus(putResponse.getPipelineStatus(), newPipelineStatus);
    pipelineStatues =
        getPipelineStatues(
            pipeline.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2022-01-15"),
            TestUtils.dateToTimestamp("2022-01-16"),
            ADMIN_AUTH_HEADERS);
    verifyPipelineStatuses(pipelineStatues, List.of(pipelineStatus, newPipelineStatus), 2);

    // Replace pipeline status for a date
    PipelineStatus newPipelineStatus1 =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Pending)
            .withTimestamp(TestUtils.dateToTimestamp("2022-01-16"))
            .withTaskStatus(taskStatus);
    putResponse = putPipelineStatusData(pipeline.getFullyQualifiedName(), newPipelineStatus1, ADMIN_AUTH_HEADERS);
    // Validate put response
    verifyPipelineStatus(putResponse.getPipelineStatus(), newPipelineStatus1);
    pipelineStatues =
        getPipelineStatues(
            pipeline.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2022-01-15"),
            TestUtils.dateToTimestamp("2022-01-16"),
            ADMIN_AUTH_HEADERS);
    verifyPipelineStatuses(pipelineStatues, List.of(pipelineStatus, newPipelineStatus1), 2);

    String dateStr = "2021-09-";
    List<PipelineStatus> pipelineStatusList = new ArrayList<>();
    for (int i = 11; i <= 20; i++) {
      pipelineStatus =
          new PipelineStatus()
              .withExecutionStatus(StatusType.Failed)
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + i))
              .withTaskStatus(taskStatus);
      putPipelineStatusData(pipeline.getFullyQualifiedName(), pipelineStatus, ADMIN_AUTH_HEADERS);
      pipelineStatusList.add(pipelineStatus);
    }
    pipelineStatues =
        getPipelineStatues(
            pipeline.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-11"),
            TestUtils.dateToTimestamp("2021-09-20"),
            ADMIN_AUTH_HEADERS);
    verifyPipelineStatuses(pipelineStatues, pipelineStatusList, 10);

    // create another table and add profiles
    Pipeline pipeline1 = createAndCheckEntity(createRequest(test).withName(getEntityName(test, 1)), ADMIN_AUTH_HEADERS);
    List<PipelineStatus> pipeline1StatusList = new ArrayList<>();
    dateStr = "2021-10-";
    for (int i = 11; i <= 15; i++) {
      pipelineStatus =
          new PipelineStatus()
              .withExecutionStatus(StatusType.Failed)
              .withTimestamp(TestUtils.dateToTimestamp(dateStr + i))
              .withTaskStatus(taskStatus);
      putPipelineStatusData(pipeline1.getFullyQualifiedName(), pipelineStatus, ADMIN_AUTH_HEADERS);
      pipeline1StatusList.add(pipelineStatus);
    }
    pipelineStatues =
        getPipelineStatues(
            pipeline1.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-10-11"),
            TestUtils.dateToTimestamp("2021-10-15"),
            ADMIN_AUTH_HEADERS);
    verifyPipelineStatuses(pipelineStatues, pipeline1StatusList, 5);
    deletePipelineStatus(
        pipeline1.getFullyQualifiedName(), TestUtils.dateToTimestamp("2021-10-11"), ADMIN_AUTH_HEADERS);
    pipeline1StatusList.remove(0);
    pipelineStatues =
        getPipelineStatues(
            pipeline1.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-10-11"),
            TestUtils.dateToTimestamp("2021-10-15"),
            ADMIN_AUTH_HEADERS);
    verifyPipelineStatuses(pipelineStatues, pipeline1StatusList, 4);
  }

  @Test
  void put_PipelineInvalidStatus_4xx(TestInfo test) throws IOException, ParseException {
    CreatePipeline request = createRequest(test).withService(AIRFLOW_REFERENCE.getName());
    Pipeline pipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd");

    // PUT one status and validate
    Status t1Status = new Status().withName("task1").withExecutionStatus(StatusType.Successful);
    Status t2Status = new Status().withName("invalidTask").withExecutionStatus(StatusType.Failed);
    List<Status> taskStatus = List.of(t1Status, t2Status);

    PipelineStatus pipelineStatus =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Failed)
            .withTimestamp(format.parse("2022-01-16").getTime())
            .withTaskStatus(taskStatus);

    assertResponseContains(
        () -> putPipelineStatusData(pipeline.getFullyQualifiedName(), pipelineStatus, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid task name invalidTask");
  }

  @Test
  void patch_PipelineTasksUpdate_200_ok(TestInfo test) throws IOException {
    CreatePipeline request = createRequest(test).withService(AIRFLOW_REFERENCE.getName());
    Pipeline pipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    String origJson = JsonUtils.pojoToJson(pipeline);
    // Add a task without description
    ChangeDescription change = getChangeDescription(pipeline.getVersion());
    List<Task> tasks = new ArrayList<>();
    Task taskEmptyDesc = new Task().withName("taskEmpty").withTaskUrl("http://localhost:0");
    tasks.add(taskEmptyDesc);
    fieldAdded(change, "tasks", tasks);
    fieldUpdated(change, "description", "", "newDescription");

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
    fieldAdded(change, "tasks.taskEmpty.description", "taskDescription");

    List<Task> updatedNewTasks = Stream.concat(TASKS.stream(), newTasks.stream()).collect(Collectors.toList());
    pipeline.setTasks(updatedNewTasks);
    pipeline = patchEntityAndCheck(pipeline, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // update the descriptions of pipeline and task
    origJson = JsonUtils.pojoToJson(pipeline);
    change = getChangeDescription(pipeline.getVersion());
    newTasks = new ArrayList<>();
    taskWithDesc = taskEmptyDesc.withDescription("newTaskDescription");
    newTasks.add(taskWithDesc);
    fieldUpdated(change, "tasks.taskEmpty.description", "taskDescription", "newTaskDescription");
    fieldUpdated(change, "description", "newDescription", "newDescription2");

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
    fieldDeleted(change, "tasks.taskEmpty.description", "newTaskDescription");
    fieldDeleted(change, "description", "newDescription2");

    updatedNewTasks = Stream.concat(TASKS.stream(), newTasks.stream()).collect(Collectors.toList());
    pipeline.setTasks(updatedNewTasks);
    pipeline.setDescription(null);
    patchEntityAndCheck(pipeline, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_AddRemovePipelineTasksUpdate_200(TestInfo test) throws IOException {
    CreatePipeline request =
        createRequest(test)
            .withService(AIRFLOW_REFERENCE.getName())
            .withDescription(null)
            .withTasks(null)
            .withConcurrency(null)
            .withPipelineUrl("http://localhost:8080");
    Pipeline pipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Add tasks and description
    ChangeDescription change = getChangeDescription(pipeline.getVersion());
    fieldAdded(change, "description", "newDescription");
    fieldAdded(change, "tasks", TASKS);
    fieldAdded(change, "concurrency", 5);
    fieldUpdated(change, "pipelineUrl", "http://localhost:8080", "https://airflow.open-metadata.org");
    pipeline =
        updateAndCheckEntity(
            request
                .withDescription("newDescription")
                .withTasks(TASKS)
                .withConcurrency(5)
                .withPipelineUrl("https://airflow.open-metadata.org"),
            OK,
            ADMIN_AUTH_HEADERS,
            MINOR_UPDATE,
            change);

    assertEquals(3, pipeline.getTasks().size());

    List<Task> new_tasks = new ArrayList<>();
    for (int i = 1; i < 3; i++) { // remove task0
      Task task =
          new Task()
              .withName("task" + i)
              .withDescription("description")
              .withDisplayName("displayName")
              .withTaskUrl("http://localhost:0");
      new_tasks.add(task);
    }
    request.setTasks(new_tasks);
    change = getChangeDescription(pipeline.getVersion());
    change.getFieldsUpdated().add(new FieldChange().withNewValue(new_tasks).withOldValue(TASKS));
    pipeline = updateEntity(request, OK, ADMIN_AUTH_HEADERS);
    assertEquals(2, pipeline.getTasks().size());
  }

  @Override
  public Pipeline validateGetWithDifferentFields(Pipeline pipeline, boolean byName) throws HttpResponseException {
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
    return pipeline;
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
  public static Pipeline putPipelineStatusData(String fqn, PipelineStatus data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("pipelines/" + fqn + "/status");
    return TestUtils.put(target, data, Pipeline.class, OK, authHeaders);
  }

  public static Pipeline deletePipelineStatus(String fqn, Long timestamp, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("pipelines/" + fqn + "/status/" + timestamp);
    return TestUtils.delete(target, Pipeline.class, authHeaders);
  }

  public static ResultList<PipelineStatus> getPipelineStatues(
      String fqn, Long startTs, Long endTs, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource("pipelines/" + fqn + "/status");
    target = target.queryParam("startTs", startTs).queryParam("endTs", endTs);
    return TestUtils.get(target, PipelineResource.PipelineStatusList.class, authHeaders);
  }

  // Check that the inserted status are properly stored
  private void verifyPipelineStatuses(
      ResultList<PipelineStatus> actualStatuses, List<PipelineStatus> expectedStatuses, int expectedCount) {
    assertEquals(expectedCount, actualStatuses.getPaging().getTotal());
    assertEquals(expectedStatuses.size(), actualStatuses.getData().size());
    Map<Long, PipelineStatus> pipelineStatusMap = new HashMap<>();
    for (PipelineStatus result : actualStatuses.getData()) {
      pipelineStatusMap.put(result.getTimestamp(), result);
    }
    for (PipelineStatus result : expectedStatuses) {
      PipelineStatus storedPipelineStatus = pipelineStatusMap.get(result.getTimestamp());
      verifyPipelineStatus(storedPipelineStatus, result);
    }
  }

  private void verifyPipelineStatus(PipelineStatus actualStatus, PipelineStatus expectedStatus) {
    assertEquals(actualStatus, expectedStatus);
  }
}
