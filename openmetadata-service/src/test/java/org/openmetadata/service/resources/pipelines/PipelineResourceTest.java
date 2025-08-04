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

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.service.Entity.TAG;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.UpdateType.CHANGE_CONSOLIDATED;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.service.util.TestUtils.assertListNotNull;
import static org.openmetadata.service.util.TestUtils.assertListNull;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
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
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.services.CreatePipelineService;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Status;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Task;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.pipelines.PipelineResource.PipelineList;
import org.openmetadata.service.resources.services.PipelineServiceResourceTest;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class PipelineResourceTest extends EntityResourceTest<Pipeline, CreatePipeline> {
  public static List<Task> TASKS;

  public PipelineResourceTest() {
    super(
        Entity.PIPELINE, Pipeline.class, PipelineList.class, "pipelines", PipelineResource.FIELDS);
    supportedNameCharacters = "_'+#- .()$" + EntityResourceTest.RANDOM_STRING_GENERATOR.generate(1);
    supportsSearchIndex = true;
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
              .withSourceUrl("http://localhost:0");
      TASKS.add(task);
    }
  }

  @Override
  public CreatePipeline createRequest(String name) {
    return new CreatePipeline()
        .withName(name)
        .withService(getContainer().getFullyQualifiedName())
        .withTasks(TASKS);
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
  public void validateCreatedEntity(
      Pipeline pipeline, CreatePipeline createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    assertNotNull(pipeline.getServiceType());
    assertReference(createRequest.getService(), pipeline.getService());
    validateTasks(createRequest.getTasks(), pipeline.getTasks());
    TestUtils.validateTags(createRequest.getTags(), pipeline.getTags());
  }

  private void validateTasks(List<Task> expected, List<Task> actual) throws HttpResponseException {
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
      if (expectedTask.getTags() != null
          && !expectedTask.getTags().isEmpty()
          && actualTask.getTags() != null) {
        TestUtils.validateTags(expectedTask.getTags(), actualTask.getTags());
      }
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
  public void assertFieldChange(String fieldName, Object expected, Object actual)
      throws IOException {
    if (expected == null && actual == null) {
      return;
    }
    if (fieldName.contains("tasks") && !fieldName.contains(".")) {
      @SuppressWarnings("unchecked")
      List<Task> expectedTasks =
          expected instanceof List
              ? (List<Task>) expected
              : JsonUtils.readObjects(expected.toString(), Task.class);
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
    assertResponseContains(
        () -> createEntity(create, ADMIN_AUTH_HEADERS), BAD_REQUEST, "service must not be null");
  }

  @Test
  void post_PipelineWithDifferentService_200_ok(TestInfo test) throws IOException {
    String[] differentServices = {
      AIRFLOW_REFERENCE.getFullyQualifiedName(), GLUE_REFERENCE.getFullyQualifiedName()
    };

    // Create Pipeline for each service and test APIs
    for (String service : differentServices) {
      createAndCheckEntity(createRequest(test).withService(service), ADMIN_AUTH_HEADERS);

      // List Pipelines by filtering on service name and ensure right Pipelines in the response
      Map<String, String> queryParams = new HashMap<>();
      queryParams.put("service", service);

      ResultList<Pipeline> list = listEntities(queryParams, ADMIN_AUTH_HEADERS);
      for (Pipeline db : list.getData()) {
        assertEquals(service, db.getService().getFullyQualifiedName());
      }
    }
  }

  @Test
  void post_pipelineWithTasksWithDots(TestInfo test) throws IOException {
    CreatePipeline create = createRequest(test);
    Task task =
        new Task()
            .withName("ta.sk")
            .withDescription("description")
            .withSourceUrl("http://localhost:0");
    create.setTasks(List.of(task));
    Pipeline created = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    Task actualTask = created.getTasks().get(0);
    assertEquals("ta.sk", actualTask.getName());
  }

  @Test
  void post_pipelineWithTaskWithOwner(TestInfo test) throws IOException {
    CreatePipeline create = createRequest(test);
    Task task =
        new Task()
            .withName("task")
            .withDescription("description")
            .withSourceUrl("http://localhost:0")
            .withOwners(List.of(USER1_REF));
    create.setTasks(List.of(task));
    Pipeline entity = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    Task actualTask = entity.getTasks().get(0);
    assertReferenceList(List.of(USER1_REF), actualTask.getOwners());

    // We can GET the task retrieving the owner info
    Pipeline storedPipeline =
        getPipelineByName(entity.getFullyQualifiedName(), "owners,tasks", ADMIN_AUTH_HEADERS);
    Task storedTask = storedPipeline.getTasks().get(0);
    assertReferenceList(List.of(USER1_REF), storedTask.getOwners());
  }

  @Test
  void put_PipelineUrlUpdate_200(TestInfo test) throws IOException {
    CreatePipeline request =
        createRequest(test)
            .withService(AIRFLOW_REFERENCE.getFullyQualifiedName())
            .withDescription("description");
    createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    String pipelineURL = "https://airflow.open-metadata.org/tree?dag_id=airflow_redshift_usage";
    Integer pipelineConcurrency = 110;
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();

    // Updating description is ignored when backend already has description
    Pipeline pipeline =
        updateEntity(
            request
                .withSourceUrl(pipelineURL)
                .withConcurrency(pipelineConcurrency)
                .withStartDate(startDate),
            OK,
            ADMIN_AUTH_HEADERS);
    String expectedFQN =
        FullyQualifiedName.add(
            EntityInterfaceUtil.quoteName(AIRFLOW_REFERENCE.getName()),
            EntityInterfaceUtil.quoteName(pipeline.getName()));
    assertEquals(pipelineURL, pipeline.getSourceUrl());
    assertEquals(startDate, pipeline.getStartDate());
    assertEquals(pipelineConcurrency, pipeline.getConcurrency());
    assertEquals(expectedFQN, pipeline.getFullyQualifiedName());
  }

  @Test
  void put_PipelineTasksUpdate_200(TestInfo test) throws IOException {
    CreatePipeline request =
        createRequest(test)
            .withService(AIRFLOW_REFERENCE.getFullyQualifiedName())
            .withDescription(null)
            .withTasks(null);
    Pipeline pipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Add description and tasks
    ChangeDescription change = getChangeDescription(pipeline, MINOR_UPDATE);
    fieldAdded(change, "description", "newDescription");
    fieldAdded(change, "tasks", TASKS);

    pipeline =
        updateAndCheckEntity(
            request.withDescription("newDescription").withTasks(TASKS),
            OK,
            ADMIN_AUTH_HEADERS,
            MINOR_UPDATE,
            change);

    // Add a task without description
    change = getChangeDescription(pipeline, MINOR_UPDATE);
    List<Task> tasks = new ArrayList<>();
    Task taskEmptyDesc = new Task().withName("taskEmpty").withSourceUrl("http://localhost:0");
    tasks.add(taskEmptyDesc);
    fieldAdded(change, "tasks", tasks);
    // Create new request with all the Tasks
    List<Task> updatedTasks =
        Stream.concat(TASKS.stream(), tasks.stream()).collect(Collectors.toList());
    pipeline =
        updateAndCheckEntity(
            request.withTasks(updatedTasks), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    change = getChangeDescription(pipeline, NO_CHANGE);
    // create a request with same tasks we shouldn't see any change
    updateAndCheckEntity(
        request.withTasks(updatedTasks), OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);

    // create new request with few tasks removed
    updatedTasks.remove(taskEmptyDesc);
    change = getChangeDescription(pipeline, MINOR_UPDATE);
    fieldDeleted(change, "tasks", List.of(taskEmptyDesc));
    updateAndCheckEntity(
        request.withTasks(updatedTasks), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    pipeline = getPipeline(pipeline.getId(), "tasks", ADMIN_AUTH_HEADERS);
    validateTasks(pipeline.getTasks(), updatedTasks);
  }

  @Test
  void put_PipelineTasksOverride_200(TestInfo test) throws IOException {
    // A PUT operation with a new Task should override the current tasks in the Pipeline
    // This change will always be minor, both with deletes/adds
    CreatePipeline request =
        createRequest(test).withService(AIRFLOW_REFERENCE.getFullyQualifiedName());
    Pipeline pipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    List<Task> newTask =
        Collections.singletonList(
            new Task()
                .withName("newTask")
                .withDescription("description")
                .withDisplayName("displayName")
                .withSourceUrl("http://localhost:0"));

    ChangeDescription change = getChangeDescription(pipeline, MINOR_UPDATE);
    fieldAdded(change, "tasks", newTask);
    fieldDeleted(change, "tasks", TASKS);
    updateAndCheckEntity(request.withTasks(newTask), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_PipelineStatus_200(TestInfo test) throws IOException, ParseException {
    CreatePipeline request =
        createRequest(test).withService(AIRFLOW_REFERENCE.getFullyQualifiedName());
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

    Pipeline putResponse =
        putPipelineStatusData(pipeline.getFullyQualifiedName(), pipelineStatus, ADMIN_AUTH_HEADERS);
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

    putResponse =
        putPipelineStatusData(
            pipeline.getFullyQualifiedName(), newPipelineStatus, ADMIN_AUTH_HEADERS);
    // Validate put response
    verifyPipelineStatus(putResponse.getPipelineStatus(), newPipelineStatus);
    pipelineStatues =
        getPipelineStatues(
            pipeline.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2022-01-15"),
            TestUtils.dateToTimestamp("2022-01-16"),
            ADMIN_AUTH_HEADERS);
    verifyPipelineStatuses(pipelineStatues, List.of(pipelineStatus, newPipelineStatus), 2);

    // Validate put response
    verifyPipelineStatus(putResponse.getPipelineStatus(), newPipelineStatus);
    pipelineStatues =
        getPipelineStatues(
            pipeline.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2022-01-15"),
            TestUtils.dateToTimestamp("2022-01-16"),
            ADMIN_AUTH_HEADERS);
    verifyPipelineStatuses(pipelineStatues, List.of(pipelineStatus, newPipelineStatus), 2);

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
    Pipeline pipeline1 =
        createAndCheckEntity(
            createRequest(test).withName(getEntityName(test, 1)), ADMIN_AUTH_HEADERS);
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
        pipeline1.getFullyQualifiedName(),
        TestUtils.dateToTimestamp("2021-10-11"),
        ADMIN_AUTH_HEADERS);
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
    CreatePipeline request =
        createRequest(test).withService(AIRFLOW_REFERENCE.getFullyQualifiedName());
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
        () ->
            putPipelineStatusData(
                pipeline.getFullyQualifiedName(), pipelineStatus, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid task name invalidTask");
  }

  @Test
  void patch_PipelineTasksUpdate_200_ok(TestInfo test) throws IOException {
    CreatePipeline request =
        createRequest(test).withService(AIRFLOW_REFERENCE.getFullyQualifiedName());
    Pipeline pipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Add a new task without description or tags
    String origJson = JsonUtils.pojoToJson(pipeline);
    ChangeDescription change = getChangeDescription(pipeline, MINOR_UPDATE);
    List<Task> tasks = new ArrayList<>();
    Task taskEmptyDesc = new Task().withName("taskEmpty").withSourceUrl("http://localhost:0");
    tasks.add(taskEmptyDesc);
    fieldAdded(change, "tasks", tasks);
    fieldUpdated(change, "description", "", "newDescription");
    List<Task> updatedTasks =
        Stream.concat(TASKS.stream(), tasks.stream()).collect(Collectors.toList());
    pipeline.setTasks(updatedTasks);
    pipeline.setDescription("newDescription");
    pipeline = patchEntityAndCheck(pipeline, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    pipeline = getPipeline(pipeline.getId(), "*", ADMIN_AUTH_HEADERS);
    validateTasks(updatedTasks, pipeline.getTasks());

    // add description and tags to an existing task - taskEmpty
    // Changes from this PATCH is consolidated with the previous changes
    origJson = JsonUtils.pojoToJson(pipeline);
    change = getChangeDescription(pipeline, MINOR_UPDATE);
    List<Task> newTasks = new ArrayList<>();
    Task taskWithDesc =
        taskEmptyDesc
            .withDescription("taskDescription")
            .withTags(List.of(USER_ADDRESS_TAG_LABEL, PII_SENSITIVE_TAG_LABEL));
    newTasks.add(taskWithDesc);
    fieldAdded(change, "tasks.taskEmpty.description", "taskDescription");
    fieldAdded(
        change, "tasks.taskEmpty.tags", List.of(USER_ADDRESS_TAG_LABEL, PII_SENSITIVE_TAG_LABEL));
    List<Task> updatedNewTasks =
        Stream.concat(TASKS.stream(), newTasks.stream()).collect(Collectors.toList());
    pipeline.setTasks(updatedNewTasks);
    pipeline = patchEntityAndCheck(pipeline, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Update the descriptions of pipeline and task and add tags to tasks
    // Changes from this PATCH is consolidated with the previous changes
    origJson = JsonUtils.pojoToJson(pipeline);
    change = getChangeDescription(pipeline, MINOR_UPDATE);
    newTasks = new ArrayList<>();
    taskWithDesc = taskEmptyDesc.withDescription("newTaskDescription");
    newTasks.add(taskWithDesc);
    fieldUpdated(change, "description", "newDescription", "newDescription2");
    fieldUpdated(change, "tasks.taskEmpty.description", "taskDescription", "newTaskDescription");
    updatedNewTasks = Stream.concat(TASKS.stream(), newTasks.stream()).collect(Collectors.toList());
    pipeline.setTasks(updatedNewTasks);
    pipeline.setDescription("newDescription2");
    pipeline =
        patchEntityAndCheck(pipeline, origJson, ADMIN_AUTH_HEADERS, CHANGE_CONSOLIDATED, change);

    // Delete task and pipeline description by setting them to null
    // Changes from this PATCH is consolidated with the previous changes
    origJson = JsonUtils.pojoToJson(pipeline);
    change = getChangeDescription(pipeline, MINOR_UPDATE);
    newTasks = new ArrayList<>();
    Task taskWithoutDesc = taskEmptyDesc.withDescription(null);
    newTasks.add(taskWithoutDesc);
    updatedNewTasks = Stream.concat(TASKS.stream(), newTasks.stream()).collect(Collectors.toList());
    pipeline.setTasks(updatedNewTasks);
    pipeline.setDescription("");
    fieldUpdated(change, "description", "newDescription2", "");
    fieldDeleted(change, "tasks.taskEmpty.description", "newTaskDescription");
    patchEntityAndCheck(pipeline, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_AddRemovePipelineTasksUpdate_200(TestInfo test) throws IOException {
    CreatePipeline request =
        createRequest(test)
            .withService(AIRFLOW_REFERENCE.getFullyQualifiedName())
            .withDescription(null)
            .withTasks(null)
            .withConcurrency(null)
            .withSourceUrl("http://localhost:8080");
    Pipeline pipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Add tasks and description
    ChangeDescription change = getChangeDescription(pipeline, MINOR_UPDATE);
    fieldAdded(change, "description", "newDescription");
    fieldAdded(change, "tasks", TASKS);
    fieldAdded(change, "concurrency", 5);
    fieldUpdated(change, "sourceUrl", "http://localhost:8080", "https://airflow.open-metadata.org");
    pipeline =
        updateAndCheckEntity(
            request
                .withDescription("newDescription")
                .withTasks(TASKS)
                .withConcurrency(5)
                .withSourceUrl("https://airflow.open-metadata.org"),
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
              .withSourceUrl("http://localhost:0");
      new_tasks.add(task);
    }
    request.setTasks(new_tasks);
    pipeline = updateEntity(request, OK, ADMIN_AUTH_HEADERS);
    assertEquals(2, pipeline.getTasks().size());
  }

  @Test
  void test_inheritDomain(TestInfo test) throws IOException {
    // When domain is not set for a pipeline, carry it forward from the pipeline service
    PipelineServiceResourceTest serviceTest = new PipelineServiceResourceTest();
    CreatePipelineService createService =
        serviceTest.createRequest(test).withDomains(List.of(DOMAIN.getFullyQualifiedName()));
    PipelineService service = serviceTest.createEntity(createService, ADMIN_AUTH_HEADERS);

    // Create a pipeline without domain and ensure it inherits domain from the parent
    CreatePipeline create = createRequest("pipeline").withService(service.getFullyQualifiedName());
    assertSingleDomainInheritance(create, DOMAIN.getEntityReference());
  }

  @Test
  void patch_usingFqn_PipelineTasksUpdate_200_ok(TestInfo test) throws IOException {
    CreatePipeline request =
        createRequest(test).withService(AIRFLOW_REFERENCE.getFullyQualifiedName());
    Pipeline pipeline = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Add a new task without description or tags
    String origJson = JsonUtils.pojoToJson(pipeline);
    ChangeDescription change = getChangeDescription(pipeline, MINOR_UPDATE);
    List<Task> tasks = new ArrayList<>();
    Task taskEmptyDesc = new Task().withName("taskEmpty").withSourceUrl("http://localhost:0");
    tasks.add(taskEmptyDesc);
    fieldAdded(change, "tasks", tasks);
    fieldUpdated(change, "description", "", "newDescription");
    List<Task> updatedTasks =
        Stream.concat(TASKS.stream(), tasks.stream()).collect(Collectors.toList());
    pipeline.setTasks(updatedTasks);
    pipeline.setDescription("newDescription");
    pipeline =
        patchEntityUsingFqnAndCheck(pipeline, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    pipeline = getPipeline(pipeline.getId(), "*", ADMIN_AUTH_HEADERS);
    validateTasks(updatedTasks, pipeline.getTasks());

    // add description and tags to an existing task - taskEmpty
    // Changes from this PATCH is consolidated with the previous changes
    origJson = JsonUtils.pojoToJson(pipeline);
    change = getChangeDescription(pipeline, MINOR_UPDATE);
    List<Task> newTasks = new ArrayList<>();
    Task taskWithDesc =
        taskEmptyDesc
            .withDescription("taskDescription")
            .withTags(List.of(USER_ADDRESS_TAG_LABEL, PII_SENSITIVE_TAG_LABEL));
    newTasks.add(taskWithDesc);
    fieldAdded(change, "tasks.taskEmpty.description", "taskDescription");
    fieldAdded(
        change, "tasks.taskEmpty.tags", List.of(USER_ADDRESS_TAG_LABEL, PII_SENSITIVE_TAG_LABEL));
    List<Task> updatedNewTasks =
        Stream.concat(TASKS.stream(), newTasks.stream()).collect(Collectors.toList());
    pipeline.setTasks(updatedNewTasks);
    pipeline =
        patchEntityUsingFqnAndCheck(pipeline, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Update the descriptions of pipeline and task and add tags to tasks
    // Changes from this PATCH is consolidated with the previous changes
    origJson = JsonUtils.pojoToJson(pipeline);
    change = getChangeDescription(pipeline, MINOR_UPDATE);
    newTasks = new ArrayList<>();
    taskWithDesc = taskEmptyDesc.withDescription("newTaskDescription");
    newTasks.add(taskWithDesc);
    fieldUpdated(change, "description", "newDescription", "newDescription2");
    fieldUpdated(change, "tasks.taskEmpty.description", "taskDescription", "newTaskDescription");
    updatedNewTasks = Stream.concat(TASKS.stream(), newTasks.stream()).collect(Collectors.toList());
    pipeline.setTasks(updatedNewTasks);
    pipeline.setDescription("newDescription2");
    pipeline =
        patchEntityUsingFqnAndCheck(pipeline, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Delete task and pipeline description by setting them to null
    // Changes from this PATCH is consolidated with the previous changes
    origJson = JsonUtils.pojoToJson(pipeline);
    change = getChangeDescription(pipeline, MINOR_UPDATE);
    newTasks = new ArrayList<>();
    Task taskWithoutDesc = taskEmptyDesc.withDescription(null);
    newTasks.add(taskWithoutDesc);
    updatedNewTasks = Stream.concat(TASKS.stream(), newTasks.stream()).collect(Collectors.toList());
    fieldUpdated(change, "description", "newDescription2", "");
    fieldDeleted(change, "tasks.taskEmpty.description", "newTaskDescription");
    pipeline.setTasks(updatedNewTasks);
    pipeline.setDescription(
        ""); // Since description started out to be empty, during consolidation, no change
    patchEntityUsingFqnAndCheck(pipeline, origJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void testInheritedPermissionFromParent() throws IOException {
    // Create a pipeline service with owner data consumer
    PipelineServiceResourceTest serviceTest = new PipelineServiceResourceTest();
    CreatePipelineService createPipelineService =
        serviceTest
            .createRequest("testInheritedPermissions")
            .withOwners(List.of(DATA_CONSUMER.getEntityReference()));
    PipelineService service = serviceTest.createEntity(createPipelineService, ADMIN_AUTH_HEADERS);

    // Data consumer as an owner of the service can create pipeline under it
    createEntity(
        createRequest("pipeline").withService(service.getFullyQualifiedName()),
        authHeaders(DATA_CONSUMER.getName()));
  }

  @Test
  void test_TaskWithInvalidTag(TestInfo test) throws HttpResponseException {
    // Add an entity with invalid tag
    TagLabel invalidTag = new TagLabel().withTagFQN("invalidTag");
    List<Task> invalidTagTasks =
        List.of(new Task().withName("task").withDescription("desc").withTags(listOf(invalidTag)));
    CreatePipeline create = createRequest(getEntityName(test)).withTasks(invalidTagTasks);

    // Entity can't be created with PUT or POST
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    assertResponse(
        () -> updateEntity(create, Response.Status.CREATED, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    // Create an entity and update the columns with PUT and PATCH with an invalid tag
    List<Task> validTagTasks = List.of(new Task().withName("task").withDescription("desc"));
    create.withTasks(validTagTasks);
    Pipeline entity = createEntity(create, ADMIN_AUTH_HEADERS);
    String json = JsonUtils.pojoToJson(entity);

    create.setTasks(invalidTagTasks);
    assertResponse(
        () -> updateEntity(create, Response.Status.CREATED, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    entity.setTags(listOf(invalidTag));
    assertResponse(
        () -> patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    // No lingering relationships should cause error in listing the entity
    listEntities(null, ADMIN_AUTH_HEADERS);
  }

  @Override
  public Pipeline validateGetWithDifferentFields(Pipeline pipeline, boolean byName)
      throws HttpResponseException {
    String fields = "";
    pipeline =
        byName
            ? getPipelineByName(pipeline.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getPipeline(pipeline.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(pipeline.getService(), pipeline.getServiceType());
    assertListNull(
        pipeline.getOwners(),
        pipeline.getTasks(),
        pipeline.getPipelineStatus(),
        pipeline.getTags(),
        pipeline.getFollowers(),
        pipeline.getTags());

    fields = "owners,tasks,pipelineStatus,followers,tags,scheduleInterval";
    pipeline =
        byName
            ? getPipelineByName(pipeline.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getPipeline(pipeline.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(pipeline.getService(), pipeline.getServiceType());
    // Checks for other owner, tags, and followers is done in the base class
    return pipeline;
  }

  public Pipeline getPipeline(UUID id, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("pipelines/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Pipeline.class, authHeaders);
  }

  public Pipeline getPipelineByName(String fqn, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("pipelines/name/").path(fqn);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Pipeline.class, authHeaders);
  }

  // Prepare Pipeline status endpoint for PUT
  public Pipeline putPipelineStatusData(
      String fqn, PipelineStatus data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("pipelines/").path(fqn).path("/status");
    return TestUtils.put(target, data, Pipeline.class, OK, authHeaders);
  }

  public void deletePipelineStatus(String fqn, Long timestamp, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target =
        getResource("pipelines/").path(fqn).path("/status/").path(String.valueOf(timestamp));
    TestUtils.delete(target, Pipeline.class, authHeaders);
  }

  public ResultList<PipelineStatus> getPipelineStatues(
      String fqn, Long startTs, Long endTs, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("pipelines/").path(fqn).path("/status");
    target = target.queryParam("startTs", startTs).queryParam("endTs", endTs);
    return TestUtils.get(target, PipelineResource.PipelineStatusList.class, authHeaders);
  }

  // Check that the inserted status are properly stored
  private void verifyPipelineStatuses(
      ResultList<PipelineStatus> actualStatuses,
      List<PipelineStatus> expectedStatuses,
      int expectedCount) {
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

  @Order(1)
  @Test
  void test_paginationFetchesTagsAtBothEntityAndFieldLevels(TestInfo test) throws IOException {
    // Use existing tags that are already set up in the test environment
    TagLabel pipelineTagLabel = USER_ADDRESS_TAG_LABEL;
    TagLabel taskTagLabel = PERSONAL_DATA_TAG_LABEL;

    // Create multiple pipelines with tags at both pipeline and task levels
    List<Pipeline> createdPipelines = new ArrayList<>();
    for (int i = 0; i < 5; i++) {
      List<Task> tasks = new ArrayList<>();
      for (int j = 0; j < 3; j++) {
        Task task =
            new Task()
                .withName("task" + j + "_" + i)
                .withDescription("description")
                .withDisplayName("displayName")
                .withSourceUrl("http://localhost:0");

        if (j == 0) {
          // Add tag to first task only
          task.withTags(List.of(taskTagLabel));
        }
        tasks.add(task);
      }

      CreatePipeline createPipeline =
          createRequest(test.getDisplayName() + "_pagination_" + i)
              .withTasks(tasks)
              .withTags(List.of(pipelineTagLabel));

      Pipeline pipeline = createEntity(createPipeline, ADMIN_AUTH_HEADERS);
      createdPipelines.add(pipeline);
    }

    // Test pagination with fields=tags (should fetch pipeline-level tags only)
    WebTarget target =
        getResource("pipelines").queryParam("fields", "tags").queryParam("limit", "10");

    PipelineList pipelineList = TestUtils.get(target, PipelineList.class, ADMIN_AUTH_HEADERS);
    assertNotNull(pipelineList.getData());

    // Verify at least one of our created pipelines is in the response
    List<Pipeline> ourPipelines =
        pipelineList.getData().stream()
            .filter(p -> createdPipelines.stream().anyMatch(cp -> cp.getId().equals(p.getId())))
            .collect(Collectors.toList());

    assertFalse(
        ourPipelines.isEmpty(), "Should find at least one of our created pipelines in pagination");

    // Verify pipeline-level tags are fetched
    for (Pipeline pipeline : ourPipelines) {
      assertNotNull(
          pipeline.getTags(),
          "Pipeline-level tags should not be null when fields=tags in pagination");
      assertEquals(1, pipeline.getTags().size(), "Should have exactly one pipeline-level tag");
      assertEquals(pipelineTagLabel.getTagFQN(), pipeline.getTags().get(0).getTagFQN());

      // Tasks should not have tags when only fields=tags is specified
      if (pipeline.getTasks() != null) {
        for (Task task : pipeline.getTasks()) {
          assertTrue(
              task.getTags() == null || task.getTags().isEmpty(),
              "Task tags should not be populated when only fields=tags is specified in pagination");
        }
      }
    }

    // Test pagination with fields=tasks,tags (should fetch both pipeline and task tags)
    target = getResource("pipelines").queryParam("fields", "tasks,tags").queryParam("limit", "10");

    pipelineList = TestUtils.get(target, PipelineList.class, ADMIN_AUTH_HEADERS);
    assertNotNull(pipelineList.getData());

    // Verify at least one of our created pipelines is in the response
    ourPipelines =
        pipelineList.getData().stream()
            .filter(p -> createdPipelines.stream().anyMatch(cp -> cp.getId().equals(p.getId())))
            .collect(Collectors.toList());

    assertFalse(
        ourPipelines.isEmpty(), "Should find at least one of our created pipelines in pagination");

    // Verify both pipeline-level and task-level tags are fetched
    for (Pipeline pipeline : ourPipelines) {
      // Verify pipeline-level tags
      assertNotNull(
          pipeline.getTags(),
          "Pipeline-level tags should not be null in pagination with tasks,tags");
      assertEquals(1, pipeline.getTags().size(), "Should have exactly one pipeline-level tag");
      assertEquals(pipelineTagLabel.getTagFQN(), pipeline.getTags().get(0).getTagFQN());

      // Verify task-level tags
      assertNotNull(pipeline.getTasks(), "Tasks should not be null when fields includes tasks");
      assertFalse(pipeline.getTasks().isEmpty(), "Tasks should not be empty");

      // Find the first task which should have a tag
      Task task0 =
          pipeline.getTasks().stream()
              .filter(t -> t.getName().startsWith("task0_"))
              .findFirst()
              .orElseThrow(() -> new AssertionError("Should find task0 task"));

      assertNotNull(
          task0.getTags(), "Task tags should not be null when fields=tasks,tags in pagination");
      assertEquals(1, task0.getTags().size(), "Task should have exactly one tag");
      assertEquals(taskTagLabel.getTagFQN(), task0.getTags().get(0).getTagFQN());

      // Other tasks should not have tags
      for (Task task : pipeline.getTasks()) {
        if (!task.getName().startsWith("task0_")) {
          assertTrue(
              task.getTags() == null || task.getTags().isEmpty(),
              "Other tasks should not have tags");
        }
      }
    }
  }
}
