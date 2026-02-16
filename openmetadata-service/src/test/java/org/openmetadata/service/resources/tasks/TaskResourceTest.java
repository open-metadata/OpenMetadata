/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.resources.tasks;

import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import java.net.URISyntaxException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.tasks.BulkTaskOperation;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.BulkTaskOperationParams;
import org.openmetadata.schema.type.BulkTaskOperationResult;
import org.openmetadata.schema.type.BulkTaskOperationType;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.SuggestionPayload;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.dashboards.DashboardResourceTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.pipelines.PipelineResourceTest;
import org.openmetadata.service.resources.storages.ContainerResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.resources.topics.TopicResourceTest;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class TaskResourceTest extends OpenMetadataApplicationTest {

  private static Table TABLE;
  private static Topic TOPIC;
  private static Dashboard DASHBOARD;
  private static Pipeline PIPELINE;
  private static Container CONTAINER;
  private static User USER;
  private static User USER2;
  private static Map<String, String> USER_AUTH_HEADERS;
  private static Map<String, String> USER2_AUTH_HEADERS;

  private static TableResourceTest tableResourceTest;
  private static TopicResourceTest topicResourceTest;
  private static DashboardResourceTest dashboardResourceTest;
  private static PipelineResourceTest pipelineResourceTest;
  private static ContainerResourceTest containerResourceTest;
  private static UserResourceTest userResourceTest;

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test);

    topicResourceTest = new TopicResourceTest();
    dashboardResourceTest = new DashboardResourceTest();
    pipelineResourceTest = new PipelineResourceTest();
    containerResourceTest = new ContainerResourceTest();
    userResourceTest = new UserResourceTest();

    USER = TableResourceTest.USER1;
    USER_AUTH_HEADERS = authHeaders(USER.getName());

    USER2 =
        userResourceTest.createEntity(
            userResourceTest.createRequest(test, 100), ADMIN_AUTH_HEADERS);
    USER2_AUTH_HEADERS = authHeaders(USER2.getName());

    CreateTable createTable =
        tableResourceTest
            .createRequest(test)
            .withName("task_test_table")
            .withOwners(List.of(USER.getEntityReference()));
    TABLE = tableResourceTest.createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);

    CreateTopic createTopic =
        topicResourceTest
            .createRequest(test)
            .withName("task_test_topic")
            .withOwners(List.of(USER.getEntityReference()));
    TOPIC = topicResourceTest.createAndCheckEntity(createTopic, ADMIN_AUTH_HEADERS);

    CreateDashboard createDashboard =
        dashboardResourceTest
            .createRequest(test)
            .withName("task_test_dashboard")
            .withOwners(List.of(USER.getEntityReference()));
    DASHBOARD = dashboardResourceTest.createAndCheckEntity(createDashboard, ADMIN_AUTH_HEADERS);

    CreatePipeline createPipeline =
        pipelineResourceTest
            .createRequest(test)
            .withName("task_test_pipeline")
            .withOwners(List.of(USER.getEntityReference()));
    PIPELINE = pipelineResourceTest.createAndCheckEntity(createPipeline, ADMIN_AUTH_HEADERS);

    CreateContainer createContainer =
        containerResourceTest
            .createRequest(test)
            .withName("task_test_container")
            .withOwners(List.of(USER.getEntityReference()));
    CONTAINER = containerResourceTest.createAndCheckEntity(createContainer, ADMIN_AUTH_HEADERS);
  }

  @Test
  @Order(1)
  void test_createTask_Table_DescriptionUpdate() throws HttpResponseException {
    String newDescription = "Updated table description via task";

    CreateTask createTask =
        new CreateTask()
            .withAbout(TABLE.getFullyQualifiedName())
            .withAboutType(Entity.TABLE)
            .withType(TaskEntityType.DescriptionUpdate)
            .withCategory(TaskCategory.MetadataUpdate)
            .withPriority(TaskPriority.Medium)
            .withAssignees(List.of(USER.getFullyQualifiedName()))
            .withPayload(
                new org.openmetadata.schema.type.DescriptionUpdatePayload()
                    .withFieldPath("description")
                    .withNewDescription(newDescription));

    Task task = createTask(createTask, ADMIN_AUTH_HEADERS);
    assertNotNull(task);
    assertNotNull(task.getId());
    assertEquals(TaskEntityType.DescriptionUpdate, task.getType());
    assertEquals(TaskEntityStatus.Open, task.getStatus());
    assertEquals(TABLE.getId(), task.getAbout().getId());

    ResolveTask resolveTask =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(newDescription);

    Task resolvedTask = resolveTask(task.getId(), resolveTask, USER_AUTH_HEADERS);
    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Table updatedTable =
        tableResourceTest.getEntity(TABLE.getId(), "description", ADMIN_AUTH_HEADERS);
    assertEquals(newDescription, updatedTable.getDescription());
  }

  @Test
  @Order(2)
  void test_createTask_Table_ColumnDescriptionUpdate() throws HttpResponseException {
    String columnName = TABLE.getColumns().get(0).getName();
    String newColumnDescription = "Updated column description via task";

    CreateTask createTask =
        new CreateTask()
            .withAbout(TABLE.getFullyQualifiedName())
            .withAboutType(Entity.TABLE)
            .withType(TaskEntityType.DescriptionUpdate)
            .withCategory(TaskCategory.MetadataUpdate)
            .withPriority(TaskPriority.Medium)
            .withAssignees(List.of(USER.getFullyQualifiedName()))
            .withPayload(
                new org.openmetadata.schema.type.DescriptionUpdatePayload()
                    .withFieldPath("columns::" + columnName + "::description")
                    .withNewDescription(newColumnDescription));

    Task task = createTask(createTask, ADMIN_AUTH_HEADERS);
    assertNotNull(task);
    assertEquals(TaskEntityType.DescriptionUpdate, task.getType());

    ResolveTask resolveTask =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(newColumnDescription);

    Task resolvedTask = resolveTask(task.getId(), resolveTask, USER_AUTH_HEADERS);
    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Table updatedTable = tableResourceTest.getEntity(TABLE.getId(), "columns", ADMIN_AUTH_HEADERS);
    Column updatedColumn =
        updatedTable.getColumns().stream()
            .filter(c -> c.getName().equals(columnName))
            .findFirst()
            .orElseThrow();
    assertEquals(newColumnDescription, updatedColumn.getDescription());
  }

  @Test
  @Order(3)
  void test_createTask_Topic_DescriptionUpdate() throws HttpResponseException {
    String newDescription = "Updated topic description via task";

    CreateTask createTask =
        new CreateTask()
            .withAbout(TOPIC.getFullyQualifiedName())
            .withAboutType(Entity.TOPIC)
            .withType(TaskEntityType.DescriptionUpdate)
            .withCategory(TaskCategory.MetadataUpdate)
            .withPriority(TaskPriority.Medium)
            .withAssignees(List.of(USER.getFullyQualifiedName()))
            .withPayload(
                new org.openmetadata.schema.type.DescriptionUpdatePayload()
                    .withFieldPath("description")
                    .withNewDescription(newDescription));

    Task task = createTask(createTask, ADMIN_AUTH_HEADERS);
    assertNotNull(task);

    ResolveTask resolveTask =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(newDescription);

    resolveTask(task.getId(), resolveTask, USER_AUTH_HEADERS);

    Topic updatedTopic =
        topicResourceTest.getEntity(TOPIC.getId(), "description", ADMIN_AUTH_HEADERS);
    assertEquals(newDescription, updatedTopic.getDescription());
  }

  @Test
  @Order(4)
  void test_createTask_Dashboard_DescriptionUpdate() throws HttpResponseException {
    String newDescription = "Updated dashboard description via task";

    CreateTask createTask =
        new CreateTask()
            .withAbout(DASHBOARD.getFullyQualifiedName())
            .withAboutType(Entity.DASHBOARD)
            .withType(TaskEntityType.DescriptionUpdate)
            .withCategory(TaskCategory.MetadataUpdate)
            .withPriority(TaskPriority.Medium)
            .withAssignees(List.of(USER.getFullyQualifiedName()))
            .withPayload(
                new org.openmetadata.schema.type.DescriptionUpdatePayload()
                    .withFieldPath("description")
                    .withNewDescription(newDescription));

    Task task = createTask(createTask, ADMIN_AUTH_HEADERS);
    assertNotNull(task);

    ResolveTask resolveTask =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(newDescription);

    resolveTask(task.getId(), resolveTask, USER_AUTH_HEADERS);

    Dashboard updatedDashboard =
        dashboardResourceTest.getEntity(DASHBOARD.getId(), "description", ADMIN_AUTH_HEADERS);
    assertEquals(newDescription, updatedDashboard.getDescription());
  }

  @Test
  @Order(5)
  void test_createTask_Pipeline_DescriptionUpdate() throws HttpResponseException {
    String newDescription = "Updated pipeline description via task";

    CreateTask createTask =
        new CreateTask()
            .withAbout(PIPELINE.getFullyQualifiedName())
            .withAboutType(Entity.PIPELINE)
            .withType(TaskEntityType.DescriptionUpdate)
            .withCategory(TaskCategory.MetadataUpdate)
            .withPriority(TaskPriority.Medium)
            .withAssignees(List.of(USER.getFullyQualifiedName()))
            .withPayload(
                new org.openmetadata.schema.type.DescriptionUpdatePayload()
                    .withFieldPath("description")
                    .withNewDescription(newDescription));

    Task task = createTask(createTask, ADMIN_AUTH_HEADERS);
    assertNotNull(task);

    ResolveTask resolveTask =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(newDescription);

    resolveTask(task.getId(), resolveTask, USER_AUTH_HEADERS);

    Pipeline updatedPipeline =
        pipelineResourceTest.getEntity(PIPELINE.getId(), "description", ADMIN_AUTH_HEADERS);
    assertEquals(newDescription, updatedPipeline.getDescription());
  }

  @Test
  @Order(6)
  void test_createTask_Container_DescriptionUpdate() throws HttpResponseException {
    String newDescription = "Updated container description via task";

    CreateTask createTask =
        new CreateTask()
            .withAbout(CONTAINER.getFullyQualifiedName())
            .withAboutType(Entity.CONTAINER)
            .withType(TaskEntityType.DescriptionUpdate)
            .withCategory(TaskCategory.MetadataUpdate)
            .withPriority(TaskPriority.Medium)
            .withAssignees(List.of(USER.getFullyQualifiedName()))
            .withPayload(
                new org.openmetadata.schema.type.DescriptionUpdatePayload()
                    .withFieldPath("description")
                    .withNewDescription(newDescription));

    Task task = createTask(createTask, ADMIN_AUTH_HEADERS);
    assertNotNull(task);

    ResolveTask resolveTask =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(newDescription);

    resolveTask(task.getId(), resolveTask, USER_AUTH_HEADERS);

    Container updatedContainer =
        containerResourceTest.getEntity(CONTAINER.getId(), "description", ADMIN_AUTH_HEADERS);
    assertEquals(newDescription, updatedContainer.getDescription());
  }

  @Test
  @Order(7)
  void test_createTask_OwnershipUpdate() throws HttpResponseException {
    CreateTask createTask =
        new CreateTask()
            .withAbout(TABLE.getFullyQualifiedName())
            .withAboutType(Entity.TABLE)
            .withType(TaskEntityType.OwnershipUpdate)
            .withCategory(TaskCategory.MetadataUpdate)
            .withPriority(TaskPriority.Medium)
            .withAssignees(List.of(USER.getFullyQualifiedName()))
            .withPayload(
                new org.openmetadata.schema.type.OwnershipUpdatePayload()
                    .withCurrentOwners(List.of(USER.getEntityReference()))
                    .withNewOwners(List.of(USER2.getEntityReference())));

    Task task = createTask(createTask, ADMIN_AUTH_HEADERS);
    assertNotNull(task);
    assertEquals(TaskEntityType.OwnershipUpdate, task.getType());

    ResolveTask resolveTask = new ResolveTask().withResolutionType(TaskResolutionType.Approved);

    resolveTask(task.getId(), resolveTask, USER_AUTH_HEADERS);

    Table updatedTable = tableResourceTest.getEntity(TABLE.getId(), "owners", ADMIN_AUTH_HEADERS);
    assertTrue(updatedTable.getOwners().stream().anyMatch(o -> o.getId().equals(USER2.getId())));
  }

  @Test
  @Order(8)
  void test_createTask_Suggestion() throws HttpResponseException {
    String suggestedDescription = "AI-generated description for testing";

    SuggestionPayload suggestionPayload =
        new SuggestionPayload()
            .withSuggestionType(SuggestionPayload.SuggestionType.DESCRIPTION)
            .withFieldPath("description")
            .withSuggestedValue(suggestedDescription)
            .withSource(SuggestionPayload.Source.AGENT)
            .withConfidence(85.0)
            .withReasoning("Generated from table statistics");

    CreateTask createTask =
        new CreateTask()
            .withAbout(TABLE.getFullyQualifiedName())
            .withAboutType(Entity.TABLE)
            .withType(TaskEntityType.Suggestion)
            .withCategory(TaskCategory.MetadataUpdate)
            .withPriority(TaskPriority.Low)
            .withAssignees(List.of(USER.getFullyQualifiedName()))
            .withPayload(suggestionPayload);

    Task task = createTask(createTask, ADMIN_AUTH_HEADERS);
    assertNotNull(task);
    assertEquals(TaskEntityType.Suggestion, task.getType());

    Task appliedTask = applySuggestion(task.getId(), null, USER_AUTH_HEADERS);
    assertEquals(TaskEntityStatus.Approved, appliedTask.getStatus());

    Table updatedTable =
        tableResourceTest.getEntity(TABLE.getId(), "description", ADMIN_AUTH_HEADERS);
    assertEquals(suggestedDescription, updatedTable.getDescription());
  }

  @Test
  @Order(9)
  void test_rejectTask() throws HttpResponseException {
    String newDescription = "Description that will be rejected";

    CreateTask createTask =
        new CreateTask()
            .withAbout(TABLE.getFullyQualifiedName())
            .withAboutType(Entity.TABLE)
            .withType(TaskEntityType.DescriptionUpdate)
            .withCategory(TaskCategory.MetadataUpdate)
            .withPriority(TaskPriority.Medium)
            .withAssignees(List.of(USER.getFullyQualifiedName()))
            .withPayload(
                new org.openmetadata.schema.type.DescriptionUpdatePayload()
                    .withFieldPath("description")
                    .withNewDescription(newDescription));

    Task task = createTask(createTask, ADMIN_AUTH_HEADERS);

    String originalDescription =
        tableResourceTest
            .getEntity(TABLE.getId(), "description", ADMIN_AUTH_HEADERS)
            .getDescription();

    ResolveTask resolveTask = new ResolveTask().withResolutionType(TaskResolutionType.Rejected);

    Task resolvedTask = resolveTask(task.getId(), resolveTask, USER_AUTH_HEADERS);
    assertEquals(TaskEntityStatus.Rejected, resolvedTask.getStatus());

    Table updatedTable =
        tableResourceTest.getEntity(TABLE.getId(), "description", ADMIN_AUTH_HEADERS);
    assertEquals(originalDescription, updatedTable.getDescription());
  }

  @Test
  @Order(10)
  void test_closeTask() throws HttpResponseException {
    CreateTask createTask =
        new CreateTask()
            .withAbout(TABLE.getFullyQualifiedName())
            .withAboutType(Entity.TABLE)
            .withType(TaskEntityType.DescriptionUpdate)
            .withCategory(TaskCategory.MetadataUpdate)
            .withPriority(TaskPriority.Medium)
            .withAssignees(List.of(USER.getFullyQualifiedName()))
            .withPayload(
                new org.openmetadata.schema.type.DescriptionUpdatePayload()
                    .withFieldPath("description")
                    .withNewDescription("Will be closed"));

    Task task = createTask(createTask, ADMIN_AUTH_HEADERS);

    Task closedTask = closeTask(task.getId(), "No longer needed", ADMIN_AUTH_HEADERS);
    assertEquals(TaskEntityStatus.Cancelled, closedTask.getStatus());
  }

  @Test
  @Order(11)
  void test_listTasks() throws HttpResponseException {
    ResultList<Task> tasks = listTasks(null, 10, ADMIN_AUTH_HEADERS);
    assertNotNull(tasks);
    assertTrue(tasks.getData().size() > 0);
  }

  @Test
  @Order(12)
  void test_listTasksByStatus() throws HttpResponseException {
    ResultList<Task> openTasks = listTasks(TaskEntityStatus.Open, 10, ADMIN_AUTH_HEADERS);
    assertNotNull(openTasks);
    for (Task task : openTasks.getData()) {
      assertEquals(TaskEntityStatus.Open, task.getStatus());
    }
  }

  @Test
  @Order(13)
  void test_bulkApprove() throws HttpResponseException {
    Task task1 =
        createTask(
            new CreateTask()
                .withAbout(TABLE.getFullyQualifiedName())
                .withAboutType(Entity.TABLE)
                .withType(TaskEntityType.DescriptionUpdate)
                .withCategory(TaskCategory.MetadataUpdate)
                .withPriority(TaskPriority.Medium)
                .withAssignees(List.of(USER.getFullyQualifiedName()))
                .withPayload(
                    new org.openmetadata.schema.type.DescriptionUpdatePayload()
                        .withFieldPath("description")
                        .withNewDescription("Bulk approve test 1")),
            ADMIN_AUTH_HEADERS);

    Task task2 =
        createTask(
            new CreateTask()
                .withAbout(TABLE.getFullyQualifiedName())
                .withAboutType(Entity.TABLE)
                .withType(TaskEntityType.DescriptionUpdate)
                .withCategory(TaskCategory.MetadataUpdate)
                .withPriority(TaskPriority.Medium)
                .withAssignees(List.of(USER.getFullyQualifiedName()))
                .withPayload(
                    new org.openmetadata.schema.type.DescriptionUpdatePayload()
                        .withFieldPath("description")
                        .withNewDescription("Bulk approve test 2")),
            ADMIN_AUTH_HEADERS);

    BulkTaskOperation bulkOp =
        new BulkTaskOperation()
            .withTaskIds(List.of(task1.getId().toString(), task2.getId().toString()))
            .withOperation(BulkTaskOperationType.Approve)
            .withParams(new BulkTaskOperationParams().withComment("Bulk approved"));

    BulkTaskOperationResult result = bulkOperation(bulkOp, USER_AUTH_HEADERS);
    assertEquals(2, result.getTotalRequested());
    assertEquals(2, result.getSuccessful());
    assertEquals(0, result.getFailed());
  }

  @Test
  @Order(14)
  void test_bulkReject() throws HttpResponseException {
    Task task1 =
        createTask(
            new CreateTask()
                .withAbout(TABLE.getFullyQualifiedName())
                .withAboutType(Entity.TABLE)
                .withType(TaskEntityType.DescriptionUpdate)
                .withCategory(TaskCategory.MetadataUpdate)
                .withPriority(TaskPriority.Medium)
                .withAssignees(List.of(USER.getFullyQualifiedName()))
                .withPayload(
                    new org.openmetadata.schema.type.DescriptionUpdatePayload()
                        .withFieldPath("description")
                        .withNewDescription("Bulk reject test 1")),
            ADMIN_AUTH_HEADERS);

    Task task2 =
        createTask(
            new CreateTask()
                .withAbout(TABLE.getFullyQualifiedName())
                .withAboutType(Entity.TABLE)
                .withType(TaskEntityType.DescriptionUpdate)
                .withCategory(TaskCategory.MetadataUpdate)
                .withPriority(TaskPriority.Medium)
                .withAssignees(List.of(USER.getFullyQualifiedName()))
                .withPayload(
                    new org.openmetadata.schema.type.DescriptionUpdatePayload()
                        .withFieldPath("description")
                        .withNewDescription("Bulk reject test 2")),
            ADMIN_AUTH_HEADERS);

    BulkTaskOperation bulkOp =
        new BulkTaskOperation()
            .withTaskIds(List.of(task1.getId().toString(), task2.getId().toString()))
            .withOperation(BulkTaskOperationType.Reject)
            .withParams(new BulkTaskOperationParams().withComment("Bulk rejected"));

    BulkTaskOperationResult result = bulkOperation(bulkOp, USER_AUTH_HEADERS);
    assertEquals(2, result.getTotalRequested());
    assertEquals(2, result.getSuccessful());
  }

  @Test
  @Order(15)
  void test_bulkCancel() throws HttpResponseException {
    Task task1 =
        createTask(
            new CreateTask()
                .withAbout(TABLE.getFullyQualifiedName())
                .withAboutType(Entity.TABLE)
                .withType(TaskEntityType.DescriptionUpdate)
                .withCategory(TaskCategory.MetadataUpdate)
                .withPriority(TaskPriority.Medium)
                .withAssignees(List.of(USER.getFullyQualifiedName()))
                .withPayload(
                    new org.openmetadata.schema.type.DescriptionUpdatePayload()
                        .withFieldPath("description")
                        .withNewDescription("Bulk cancel test")),
            ADMIN_AUTH_HEADERS);

    BulkTaskOperation bulkOp =
        new BulkTaskOperation()
            .withTaskIds(List.of(task1.getId().toString()))
            .withOperation(BulkTaskOperationType.Cancel)
            .withParams(new BulkTaskOperationParams().withComment("Bulk cancelled"));

    BulkTaskOperationResult result = bulkOperation(bulkOp, ADMIN_AUTH_HEADERS);
    assertEquals(1, result.getTotalRequested());
    assertEquals(1, result.getSuccessful());
  }

  @Test
  @Order(16)
  void test_bulkAssign() throws HttpResponseException {
    Task task =
        createTask(
            new CreateTask()
                .withAbout(TABLE.getFullyQualifiedName())
                .withAboutType(Entity.TABLE)
                .withType(TaskEntityType.DescriptionUpdate)
                .withCategory(TaskCategory.MetadataUpdate)
                .withPriority(TaskPriority.Medium)
                .withAssignees(List.of(USER.getFullyQualifiedName()))
                .withPayload(
                    new org.openmetadata.schema.type.DescriptionUpdatePayload()
                        .withFieldPath("description")
                        .withNewDescription("Bulk assign test")),
            ADMIN_AUTH_HEADERS);

    BulkTaskOperation bulkOp =
        new BulkTaskOperation()
            .withTaskIds(List.of(task.getId().toString()))
            .withOperation(BulkTaskOperationType.Assign)
            .withParams(
                new BulkTaskOperationParams()
                    .withAssignees(List.of(USER2.getFullyQualifiedName())));

    BulkTaskOperationResult result = bulkOperation(bulkOp, ADMIN_AUTH_HEADERS);
    assertEquals(1, result.getTotalRequested());
    assertEquals(1, result.getSuccessful());
    assertEquals(0, result.getFailed());

    // Verify the task was reassigned
    Task updated = getTaskWithFields(task.getId(), "assignees", ADMIN_AUTH_HEADERS);
    assertNotNull(updated.getAssignees());
    assertTrue(
        updated.getAssignees().stream()
            .anyMatch(a -> a.getFullyQualifiedName().equals(USER2.getFullyQualifiedName())));
  }

  @Test
  @Order(17)
  void test_getTaskById() throws HttpResponseException {
    CreateTask createTask =
        new CreateTask()
            .withAbout(TABLE.getFullyQualifiedName())
            .withAboutType(Entity.TABLE)
            .withType(TaskEntityType.DescriptionUpdate)
            .withCategory(TaskCategory.MetadataUpdate)
            .withPriority(TaskPriority.Medium)
            .withAssignees(List.of(USER.getFullyQualifiedName()))
            .withPayload(
                new org.openmetadata.schema.type.DescriptionUpdatePayload()
                    .withFieldPath("description")
                    .withNewDescription("Get by ID test"));

    Task created = createTask(createTask, ADMIN_AUTH_HEADERS);

    Task retrieved = getTask(created.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(created.getId(), retrieved.getId());
    assertEquals(created.getType(), retrieved.getType());
  }

  @Test
  @Order(17)
  void test_getTaskNotFound() {
    UUID nonExistentId = UUID.randomUUID();
    assertResponse(
        () -> getTask(nonExistentId, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        "task instance for " + nonExistentId + " not found");
  }

  @Test
  @Order(18)
  void test_addComment() throws HttpResponseException {
    CreateTask createTask =
        new CreateTask()
            .withAbout(TABLE.getFullyQualifiedName())
            .withAboutType(Entity.TABLE)
            .withType(TaskEntityType.DescriptionUpdate)
            .withCategory(TaskCategory.MetadataUpdate)
            .withPriority(TaskPriority.Medium)
            .withAssignees(List.of(USER.getFullyQualifiedName()))
            .withPayload(
                new org.openmetadata.schema.type.DescriptionUpdatePayload()
                    .withFieldPath("description")
                    .withNewDescription("Comment test"));

    Task task = createTask(createTask, ADMIN_AUTH_HEADERS);

    Task taskWithComment = addComment(task.getId(), "This is a test comment", USER_AUTH_HEADERS);
    assertNotNull(taskWithComment.getComments());
    assertTrue(taskWithComment.getComments().size() > 0);
  }

  private Task createTask(CreateTask create, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("tasks");
    return TestUtils.post(target, create, Task.class, authHeaders);
  }

  private Task getTask(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource("tasks/" + id);
    return TestUtils.get(target, Task.class, authHeaders);
  }

  private Task getTaskWithFields(UUID id, String fields, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("tasks/" + id).queryParam("fields", fields);
    return TestUtils.get(target, Task.class, authHeaders);
  }

  private ResultList<Task> listTasks(
      TaskEntityStatus status, int limit, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("tasks");
    if (status != null) {
      target = target.queryParam("status", status.value());
    }
    target = target.queryParam("limit", limit);
    return TestUtils.get(target, TaskResourceTest.TaskList.class, authHeaders);
  }

  private Task resolveTask(UUID taskId, ResolveTask resolve, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("tasks/" + taskId + "/resolve");
    return TestUtils.post(target, resolve, Task.class, 200, authHeaders);
  }

  private Task closeTask(UUID taskId, String comment, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("tasks/" + taskId + "/close");
    if (comment != null) {
      target = target.queryParam("comment", comment);
    }
    return TestUtils.post(target, null, Task.class, 200, authHeaders);
  }

  private Task applySuggestion(UUID taskId, String comment, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("tasks/" + taskId + "/suggestion/apply");
    if (comment != null) {
      target = target.queryParam("comment", comment);
    }
    return TestUtils.put(target, null, Task.class, OK, authHeaders);
  }

  private BulkTaskOperationResult bulkOperation(
      BulkTaskOperation bulkOp, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource("tasks/bulk");
    return TestUtils.post(target, bulkOp, BulkTaskOperationResult.class, 200, authHeaders);
  }

  private Task addComment(UUID taskId, String comment, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("tasks/" + taskId + "/comments");
    org.openmetadata.schema.api.tasks.CreateTaskComment createComment =
        new org.openmetadata.schema.api.tasks.CreateTaskComment().withMessage(comment);
    return TestUtils.post(target, createComment, Task.class, 200, authHeaders);
  }

  public static class TaskList extends ResultList<Task> {
    /* Required for serde */
  }
}
