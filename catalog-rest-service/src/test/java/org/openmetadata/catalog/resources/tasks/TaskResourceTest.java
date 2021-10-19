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

package org.openmetadata.catalog.resources.tasks;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.http.client.HttpResponseException;
import org.joda.time.DateTime;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateTask;
import org.openmetadata.catalog.api.services.CreatePipelineService;
import org.openmetadata.catalog.api.services.CreatePipelineService.PipelineServiceType;
import org.openmetadata.catalog.entity.data.Task;
import org.openmetadata.catalog.entity.services.PipelineService;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.tasks.TaskResource.TaskList;
import org.openmetadata.catalog.resources.teams.TeamResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.catalog.util.TestUtils.UpdateType;
import org.openmetadata.common.utils.JsonSchemaUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.util.TestUtils.LONG_ENTITY_NAME;
import static org.openmetadata.catalog.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;


public class TaskResourceTest extends CatalogApplicationTest {
  private static final Logger LOG = LoggerFactory.getLogger(TaskResourceTest.class);
  public static User USER1;
  public static EntityReference USER_OWNER1;
  public static Team TEAM1;
  public static EntityReference TEAM_OWNER1;
  public static EntityReference AIRFLOW_REFERENCE;
  public static EntityReference PREFECT_REFERENCE;
  public static final TagLabel USER_ADDRESS_TAG_LABEL = new TagLabel().withTagFQN("User.Address");
  public static final TagLabel TIER_1 = new TagLabel().withTagFQN("Tier.Tier1");



  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException, URISyntaxException {
    USER1 = UserResourceTest.createUser(UserResourceTest.create(test), authHeaders("test@open-metadata.org"));
    USER_OWNER1 = new EntityReference().withId(USER1.getId()).withType("user");

    TEAM1 = TeamResourceTest.createTeam(TeamResourceTest.create(test), adminAuthHeaders());
    TEAM_OWNER1 = new EntityReference().withId(TEAM1.getId()).withType("team");

    CreatePipelineService createService = new CreatePipelineService().withName("airflow")
            .withServiceType(PipelineServiceType.Airflow).withPipelineUrl(new URI("http://localhost:0"));
    PipelineService service = createService(createService, adminAuthHeaders());
    AIRFLOW_REFERENCE = EntityUtil.getEntityReference(service);

    createService.withName("prefect").withServiceType(PipelineServiceType.Prefect)
            .withPipelineUrl(new URI("http://localhost:0"));
    service = createService(createService, adminAuthHeaders());
    PREFECT_REFERENCE = EntityUtil.getEntityReference(service);
  }

  @Test
  public void post_taskWithLongName_400_badRequest(TestInfo test) throws URISyntaxException {
    // Create task with mandatory name field empty
    CreateTask create = create(test).withName(LONG_ENTITY_NAME);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTask(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_taskAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException, URISyntaxException {
    CreateTask create = create(test);
    createTask(create, adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTask(create, adminAuthHeaders()));
    assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validTasks_as_admin_200_OK(TestInfo test) throws HttpResponseException, URISyntaxException {
    // Create team with different optional fields
    CreateTask create = create(test);
    createAndCheckTask(create, adminAuthHeaders());

    create.withName(getTaskName(test, 1)).withDescription("description");
    createAndCheckTask(create, adminAuthHeaders());
  }

  @Test
  public void post_taskWithUserOwner_200_ok(TestInfo test) throws HttpResponseException, URISyntaxException {
    createAndCheckTask(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_taskWithTeamOwner_200_ok(TestInfo test) throws HttpResponseException, URISyntaxException {
    createAndCheckTask(create(test).withOwner(TEAM_OWNER1).withDisplayName("chart1"), adminAuthHeaders());
  }

  @Test
  public void post_task_as_non_admin_401(TestInfo test) throws URISyntaxException {
    CreateTask create = create(test);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTask(create, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void post_taskWithoutRequiredFields_4xx(TestInfo test) {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTask(create(test).withName(null), adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name must not be null]");

    exception = assertThrows(HttpResponseException.class, () ->
            createTask(create(test).withName(LONG_ENTITY_NAME), adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");

    // Service is required field
    exception = assertThrows(HttpResponseException.class, () ->
            createTask(create(test).withService(null), adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[service must not be null]");

  }

  @Test
  public void post_taskWithInvalidOwnerType_4xx(TestInfo test) throws URISyntaxException {
    EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */

    CreateTask create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTask(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "type must not be null");
  }

  @Test
  public void post_taskWithNonExistentOwner_4xx(TestInfo test) throws URISyntaxException {
    EntityReference owner = new EntityReference().withId(NON_EXISTENT_ENTITY).withType("user");
    CreateTask create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTask(create, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound("User", NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_taskWithDifferentService_200_ok(TestInfo test) throws HttpResponseException, URISyntaxException {
    EntityReference[] differentServices = {AIRFLOW_REFERENCE, PREFECT_REFERENCE};

    // Create task for each service and test APIs
    for (EntityReference service : differentServices) {
      createAndCheckTask(create(test).withService(service), adminAuthHeaders());

      // List tasks by filtering on service name and ensure right tasks are returned in the response
      TaskList list = listTasks("service", service.getName(), adminAuthHeaders());
      for (Task task : list.getData()) {
        assertEquals(service.getName(), task.getService().getName());
      }
    }
  }

  @Test
  public void get_taskListWithInvalidLimitOffset_4xx() {
    // Limit must be >= 1 and <= 1000,000
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listTasks(null, null, -1, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listTasks(null, null, 0, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listTasks(null, null, 1000001, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  public void get_taskListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listTasks(null, null, 1, "", "", adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "Only one of before or after query parameter allowed");
  }

  @Test
  public void get_taskListWithValidLimitOffset_4xx(TestInfo test) throws HttpResponseException, URISyntaxException {
    // Create a large number of tasks
    int maxTasks = 40;
    for (int i = 0; i < maxTasks; i++) {
      createTask(create(test, i), adminAuthHeaders());
    }

    // List all tasks
    TaskList allTasks = listTasks(null, null, 1000000, null,
            null, adminAuthHeaders());
    int totalRecords = allTasks.getData().size();
    printTasks(allTasks);

    // List limit number tasks at a time at various offsets and ensure right results are returned
    for (int limit = 1; limit < maxTasks; limit++) {
      String after = null;
      String before;
      int pageCount = 0;
      int indexInAllTasks = 0;
      TaskList forwardPage;
      TaskList backwardPage;
      do { // For each limit (or page size) - forward scroll till the end
        LOG.info("Limit {} forward scrollCount {} afterCursor {}", limit, pageCount, after);
        forwardPage = listTasks(null, null, limit, null, after, adminAuthHeaders());
        printTasks(forwardPage);
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allTasks.getData(), forwardPage, limit, indexInAllTasks);

        if (pageCount == 0) {  // CASE 0 - First page is being returned. There is no before cursor
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage = listTasks(null, null, limit, before, null, adminAuthHeaders());
          assertEntityPagination(allTasks.getData(), backwardPage, limit, (indexInAllTasks - limit));
        }

        indexInAllTasks += forwardPage.getData().size();
        pageCount++;
      } while (after != null);

      // We have now reached the last page - test backward scroll till the beginning
      pageCount = 0;
      indexInAllTasks = totalRecords - limit - forwardPage.getData().size();
      do {
        LOG.info("Limit {} backward scrollCount {} beforeCursor {}", limit, pageCount, before);
        forwardPage = listTasks(null, null, limit, before, null, adminAuthHeaders());
        printTasks(forwardPage);
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allTasks.getData(), forwardPage, limit, indexInAllTasks);
        pageCount++;
        indexInAllTasks -= forwardPage.getData().size();
      } while (before != null);
    }
  }

  private void printTasks(TaskList list) {
    list.getData().forEach(task -> LOG.info("Task {}", task.getFullyQualifiedName()));
    LOG.info("before {} after {} ", list.getPaging().getBefore(), list.getPaging().getAfter());
  }

  @Test
  public void put_taskUpdateWithNoChange_200(TestInfo test) throws HttpResponseException, URISyntaxException {
    // Create a task with POST
    CreateTask request = create(test).withService(AIRFLOW_REFERENCE).withOwner(USER_OWNER1);
    Task task = createAndCheckTask(request, adminAuthHeaders());

    // Update task two times successfully with PUT requests
    task = updateAndCheckTask(task, request, OK, adminAuthHeaders(), NO_CHANGE);
    updateAndCheckTask(task, request, OK, adminAuthHeaders(), NO_CHANGE);
  }

  @Test
  public void put_taskCreate_200(TestInfo test) throws HttpResponseException, URISyntaxException {
    // Create a new task with PUT
    CreateTask request = create(test).withService(AIRFLOW_REFERENCE).withOwner(USER_OWNER1);
    updateAndCheckTask(null, request, CREATED, adminAuthHeaders(), NO_CHANGE);
  }

  @Test
  public void put_taskCreate_as_owner_200(TestInfo test) throws HttpResponseException, URISyntaxException {
    // Create a new task with put
    CreateTask request = create(test).withService(AIRFLOW_REFERENCE).withOwner(USER_OWNER1);
    // Add task as admin
    Task task = createAndCheckTask(request, adminAuthHeaders());
    // Update the task Owner and see if it is allowed
    updateAndCheckTask(task, request, OK, authHeaders(USER1.getEmail()), NO_CHANGE);
  }

  @Test
  public void put_taskNullDescriptionUpdate_200(TestInfo test) throws HttpResponseException, URISyntaxException {
    CreateTask request = create(test).withService(AIRFLOW_REFERENCE).withDescription(null);
    Task task = createAndCheckTask(request, adminAuthHeaders());

    // Update null description with a new description
    task = updateAndCheckTask(task, request.withDescription("newDescription").withDisplayName("newTask"), OK,
            adminAuthHeaders(), MINOR_UPDATE);
    assertEquals("newTask", task.getDisplayName()); // TODO move this to validate
  }

  @Test
  public void put_taskEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException, URISyntaxException {
    // Create task with empty description
    CreateTask request = create(test).withService(AIRFLOW_REFERENCE).withDescription("");
    Task task = createAndCheckTask(request, adminAuthHeaders());

    // Update empty description with a new description
    updateAndCheckTask(task, request.withDescription("newDescription"), OK, adminAuthHeaders(), MINOR_UPDATE);
  }

  @Test
  public void put_taskNonEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException, URISyntaxException {
    CreateTask request = create(test).withService(AIRFLOW_REFERENCE).withDescription("description");
    createAndCheckTask(request, adminAuthHeaders());

    // Updating description is ignored when backend already has description
    Task task = updateTask(request.withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("description", task.getDescription());
  }

  @Test
  public void put_taskUrlUpdate_200(TestInfo test) throws HttpResponseException, URISyntaxException {
    URI taskURI = new URI("http://localhost:8080/task_id=1");
    String taskSQL = "select * from test;";
    Date startDate = new DateTime("2021-11-13T20:20:39+00:00").toDate();
    Date endDate = new DateTime("2021-12-13T20:20:39+00:00").toDate();
    CreateTask request = create(test).withService(AIRFLOW_REFERENCE)
            .withDescription("description").withTaskUrl(taskURI);
    createAndCheckTask(request, adminAuthHeaders());

    // Updating description is ignored when backend already has description
    Task task = updateTask(request.withTaskUrl(taskURI).withTaskSQL(taskSQL)
                    .withTaskType("test").withStartDate(startDate).withEndDate(endDate),
            OK, adminAuthHeaders());
    assertEquals(taskURI, task.getTaskUrl());
    assertEquals(taskSQL, task.getTaskSQL());
    assertEquals("test", task.getTaskType());
    assertEquals(startDate, task.getStartDate());
    assertEquals(endDate, task.getEndDate());
  }

  @Test
  public void put_taskUpdateOwner_200(TestInfo test) throws HttpResponseException, URISyntaxException {
    CreateTask request = create(test).withService(AIRFLOW_REFERENCE).withDescription("");
    Task task = createAndCheckTask(request, adminAuthHeaders());

    // Change ownership from USER_OWNER1 to TEAM_OWNER1
    task = updateAndCheckTask(task, request.withOwner(TEAM_OWNER1), OK, adminAuthHeaders(), MINOR_UPDATE);

    // Remove ownership
    task = updateAndCheckTask(task, request.withOwner(null), OK, adminAuthHeaders(), MINOR_UPDATE);
    assertNull(task.getOwner());
  }

  @Test
  public void get_nonExistentTask_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getTask(NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND,
            entityNotFound(Entity.TASK, NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_taskWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException, URISyntaxException {
    CreateTask create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(AIRFLOW_REFERENCE);
    Task task = createAndCheckTask(create, adminAuthHeaders());
    validateGetWithDifferentFields(task, false);
  }

  @Test
  public void get_taskByNameWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException, URISyntaxException {
    CreateTask create = create(test).withDescription("description").withOwner(USER_OWNER1)
            .withService(AIRFLOW_REFERENCE);
    Task task = createAndCheckTask(create, adminAuthHeaders());
    validateGetWithDifferentFields(task, true);
  }

  @Test
  public void patch_taskAttributes_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException,
          URISyntaxException {
    // Create task without description, owner
    Task task = createTask(create(test), adminAuthHeaders());
    assertNull(task.getDescription());
    assertNull(task.getOwner());
    assertNotNull(task.getService());
    List<TagLabel> taskTags = List.of(USER_ADDRESS_TAG_LABEL);

    task = getTask(task.getId(), "service,owner,tags", adminAuthHeaders());
    task.getService().setHref(null); // href is readonly and not patchable

    // Add description, owner when previously they were null
    task = patchTaskAttributesAndCheck(task, "description", TEAM_OWNER1, taskTags,
            adminAuthHeaders(), MINOR_UPDATE);
    task.setOwner(TEAM_OWNER1); // Get rid of href and name returned in the response for owner
    task.setService(AIRFLOW_REFERENCE); // Get rid of href and name returned in the response for service
    taskTags = List.of(USER_ADDRESS_TAG_LABEL, TIER_1);

    // Replace description, tier, owner
    task = patchTaskAttributesAndCheck(task, "description1", USER_OWNER1, taskTags,
            adminAuthHeaders(), MINOR_UPDATE);
    task.setOwner(USER_OWNER1); // Get rid of href and name returned in the response for owner
    task.setService(AIRFLOW_REFERENCE); // Get rid of href and name returned in the response for service
    taskTags = List.of(TIER_1);

    // Remove description, tier, owner
    patchTaskAttributesAndCheck(task, null, null, taskTags, adminAuthHeaders(), MINOR_UPDATE);
  }

  @Test
  public void delete_emptyTask_200_ok(TestInfo test) throws HttpResponseException, URISyntaxException {
    Task task = createTask(create(test), adminAuthHeaders());
    deleteTask(task.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_nonExistentTask_404() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteTask(NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.TASK, NON_EXISTENT_ENTITY));
  }

  public static Task createAndCheckTask(CreateTask create,
                                        Map<String, String> authHeaders) throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    Task task = createTask(create, authHeaders);
    assertEquals(0.1, task.getVersion());
    validateTask(task, task.getDisplayName(), create.getDescription(), create.getOwner(), create.getService(),
            create.getTags(), create.getTaskUrl(), updatedBy);
    return getAndValidate(task.getId(), create, authHeaders, updatedBy);
  }

  public static Task updateAndCheckTask(Task before, CreateTask create, Status status,
                                        Map<String, String> authHeaders, UpdateType updateType)
          throws HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    Task updatedTask = updateTask(create, status, authHeaders);
    validateTask(updatedTask, create.getDescription(), create.getOwner(), create.getService(), create.getTags(),
            create.getTaskUrl(), updatedBy);
    if (before == null) {
      assertEquals(0.1, updatedTask.getVersion()); // First version created
    } else {
      TestUtils.validateUpdate(before.getVersion(), updatedTask.getVersion(), updateType);
    }

    // GET the newly updated task and validate
    return getAndValidate(updatedTask.getId(), create, authHeaders, updatedBy);
  }

  // Make sure in GET operations the returned task has all the required information passed during creation
  public static Task getAndValidate(UUID taskId,
                                    CreateTask create,
                                    Map<String, String> authHeaders,
                                    String expectedUpdatedBy) throws HttpResponseException {
    // GET the newly created task by ID and validate
    Task task = getTask(taskId, "service,owner", authHeaders);
    validateTask(task, create.getDescription(), create.getOwner(), create.getService(), create.getTags(),
            create.getTaskUrl(), expectedUpdatedBy);

    // GET the newly created task by name and validate
    String fqn = task.getFullyQualifiedName();
    task = getTaskByName(fqn, "service,owner", authHeaders);
    return validateTask(task, create.getDescription(), create.getOwner(), create.getService(), create.getTags(),
           create.getTaskUrl(), expectedUpdatedBy);
  }

  public static Task updateTask(CreateTask create,
                                Status status,
                                Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.put(getResource("tasks"), create, Task.class, status, authHeaders);
  }

  public static Task createTask(CreateTask create,
                                Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(getResource("tasks"), create, Task.class, authHeaders);
  }

  /**
   * Validate returned fields GET .../tasks/{id}?fields="..." or GET .../tasks/name/{fqn}?fields="..."
   */
  private void validateGetWithDifferentFields(Task task, boolean byName) throws HttpResponseException {
    // .../tasks?fields=owner
    String fields = "owner";
    task = byName ? getTaskByName(task.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getTask(task.getId(), fields, adminAuthHeaders());
    assertNotNull(task.getOwner());
    assertNull(task.getService());

    // .../tasks?fields=owner,service
    fields = "owner,service";
    task = byName ? getTaskByName(task.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getTask(task.getId(), fields, adminAuthHeaders());
    assertNotNull(task.getOwner());
    assertNotNull(task.getService());

    // .../tasks?fields=owner,service
    fields = "owner,service";
    task = byName ? getTaskByName(task.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getTask(task.getId(), fields, adminAuthHeaders());
    assertNotNull(task.getOwner());
    assertNotNull(task.getService());
  }

  private static Task validateTask(Task  task, String expectedDisplayName, String expectedDescription,
                                     EntityReference expectedOwner, EntityReference expectedService,
                                     List<TagLabel> expectedTags, URI expectedTaskUrl, String expectedUpdatedBy)
          throws HttpResponseException {
    Task newTask = validateTask(task, expectedDescription, expectedOwner, expectedService, expectedTags,
            expectedTaskUrl, expectedUpdatedBy);
    assertEquals(expectedDisplayName, newTask.getDisplayName());
    return task;
  }

  private static Task validateTask(Task task, String expectedDescription, EntityReference expectedOwner,
                                    EntityReference expectedService, List<TagLabel> expectedTags,
                                   URI expectedTaskUrl, String expectedUpdatedBy)
          throws HttpResponseException {
    assertNotNull(task.getId());
    assertNotNull(task.getHref());
    assertEquals(expectedDescription, task.getDescription());
    assertEquals(expectedUpdatedBy, task.getUpdatedBy());
    assertEquals(expectedTaskUrl, task.getTaskUrl());

    // Validate owner
    if (expectedOwner != null) {
      TestUtils.validateEntityReference(task.getOwner());
      assertEquals(expectedOwner.getId(), task.getOwner().getId());
      assertEquals(expectedOwner.getType(), task.getOwner().getType());
      assertNotNull(task.getOwner().getHref());
    }

    // Validate service
    if (expectedService != null) {
      TestUtils.validateEntityReference(task.getService());
      assertEquals(expectedService.getId(), task.getService().getId());
      assertEquals(expectedService.getType(), task.getService().getType());
    }
    TestUtils.validateTags(task.getFullyQualifiedName(), expectedTags, task.getTags());
    return task;
  }

  private Task patchTaskAttributesAndCheck(Task before, String newDescription, EntityReference newOwner,
                                           List<TagLabel> tags, Map<String, String> authHeaders, UpdateType updateType)
          throws JsonProcessingException, HttpResponseException {
    String updatedBy = TestUtils.getPrincipal(authHeaders);
    String taskJson = JsonUtils.pojoToJson(before);

    // Update the task attributes
    before.setDescription(newDescription);
    before.setOwner(newOwner);
    before.setTags(tags);

    // Validate information returned in patch response has the updates
    Task updateTask = patchTask(taskJson, before, authHeaders);
    validateTask(updateTask, before.getDescription(), newOwner, null, tags, before.getTaskUrl(),
            updatedBy);
    TestUtils.validateUpdate(before.getVersion(), updateTask.getVersion(), updateType);

    // GET the task and Validate information returned
    Task getTask = getTask(before.getId(), "service,owner,tags", authHeaders);
    validateTask(getTask, before.getDescription(), newOwner, null, tags, before.getTaskUrl(), updatedBy);
    return updateTask;
  }

  private Task patchTask(UUID taskId, String originalJson, Task updatedTask,
                           Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String updatedTaskJson = JsonUtils.pojoToJson(updatedTask);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updatedTaskJson);
    return TestUtils.patch(getResource("tasks/" + taskId), patch, Task.class, authHeaders);
  }

  private Task patchTask(String originalJson,
                         Task updatedTask,
                         Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    return patchTask(updatedTask.getId(), originalJson, updatedTask, authHeaders);
  }

  public static void getTask(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    getTask(id, null, authHeaders);
  }

  public static Task getTask(UUID id, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("tasks/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Task.class, authHeaders);
  }

  public static Task getTaskByName(String fqn, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("tasks/name/" + fqn);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Task.class, authHeaders);
  }

  public static TaskList listTasks(String fields, String serviceParam, Map<String, String> authHeaders)
          throws HttpResponseException {
    return listTasks(fields, serviceParam, null, null, null, authHeaders);
  }

  public static TaskList listTasks(String fields, String serviceParam, Integer limitParam,
                                     String before, String after, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("tasks");
    target = fields != null ? target.queryParam("fields", fields) : target;
    target = serviceParam != null ? target.queryParam("service", serviceParam) : target;
    target = limitParam != null ? target.queryParam("limit", limitParam) : target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, TaskResource.TaskList.class, authHeaders);
  }

  private void deleteTask(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(getResource("tasks/" + id), authHeaders);

    // Ensure deleted task does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getTask(id, authHeaders));
    assertResponse(exception, NOT_FOUND, entityNotFound(Entity.TASK, id));
  }

  public static String getTaskName(TestInfo test) {
    return String.format("task_%s", test.getDisplayName());
  }

  public static String getTaskName(TestInfo test, int index) {
    return String.format("task%d_%s", index, test.getDisplayName());
  }

  public static CreateTask create(TestInfo test) throws URISyntaxException {
    return new CreateTask().withName(getTaskName(test)).withService(AIRFLOW_REFERENCE)
            .withTaskUrl(new URI("http://localhost:0"));
  }

  public static CreateTask create(TestInfo test, int index) throws URISyntaxException {
    return new CreateTask().withName(getTaskName(test, index)).withService(AIRFLOW_REFERENCE)
            .withTaskUrl(new URI("http://localhost:0"));
  }

  public static PipelineService createService(CreatePipelineService create,
                                               Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(CatalogApplicationTest.getResource("services/pipelineServices"),
            create, PipelineService.class, authHeaders);
  }
}
