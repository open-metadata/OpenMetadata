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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.ContainerServiceTestFactory;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.api.tasks.ResolveTask;
import org.openmetadata.schema.api.tasks.TaskCount;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.entity.services.StorageService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.SchemaType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.sdk.exceptions.ForbiddenException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for Task entity operations.
 *
 * <p>Tests the new Task entity system that provides first-class task management for governance
 * workflows including approvals, metadata updates, and suggestions.
 */
@Execution(ExecutionMode.CONCURRENT)
public class TaskResourceIT extends BaseEntityIT<Task, CreateTask> {

  public TaskResourceIT() {
    supportsFollowers = false;
    supportsTags = true;
    supportsDomains = false;
    supportsDataProducts = false;
    supportsSoftDelete = true;
    supportsPatch = true;
    supportsOwners = false;
    supportsSearchIndex = true;
  }

  @Override
  @org.junit.jupiter.api.Disabled(
      "Tasks allow duplicate names - multiple tasks can have the same name")
  public void post_duplicateEntity_409(TestNamespace ns) {}

  @Override
  @org.junit.jupiter.api.Disabled(
      "Tasks allow duplicate names - multiple tasks can have the same name")
  public void post_entityAlreadyExists_409_conflict(TestNamespace ns) {}

  @Override
  @org.junit.jupiter.api.Disabled("Task entity does not support restore operation")
  public void test_sdkOnlyAsyncOperations(TestNamespace ns) {}

  @Override
  @org.junit.jupiter.api.Disabled("Task FQN uses sequential ID format (TASK-00001)")
  public void post_entityWithDots_200(TestNamespace ns) {}

  @Override
  @org.junit.jupiter.api.Disabled("Task entity version increments differently on delete")
  public void get_deletedVersion(TestNamespace ns) {}

  @Override
  @org.junit.jupiter.api.Disabled("Task search index may have timing issues in parallel tests")
  public void checkIndexCreated(TestNamespace ns) {}

  @Override
  @org.junit.jupiter.api.Disabled("Task search index may have timing issues in parallel tests")
  public void checkCreatedEntity(TestNamespace ns) {}

  @Override
  @org.junit.jupiter.api.Disabled("Task search index may have timing issues in parallel tests")
  public void checkDeletedEntity(TestNamespace ns) {}

  @Override
  @org.junit.jupiter.api.Disabled("Task search index may have timing issues in parallel tests")
  public void updateDescriptionAndCheckInSearch(TestNamespace ns) {}

  @Override
  protected CreateTask createMinimalRequest(TestNamespace ns) {
    return new CreateTask()
        .withName(ns.prefix("task"))
        .withDescription("Test task created by integration test")
        .withCategory(TaskCategory.Approval)
        .withType(TaskEntityType.GlossaryApproval);
  }

  @Override
  protected CreateTask createRequest(String name, TestNamespace ns) {
    return new CreateTask()
        .withName(name)
        .withDescription("Test task")
        .withCategory(TaskCategory.Approval)
        .withType(TaskEntityType.GlossaryApproval);
  }

  @Override
  protected Task createEntity(CreateTask createRequest) {
    return SdkClients.adminClient().tasks().create(createRequest);
  }

  @Override
  protected Task getEntity(String id) {
    return SdkClients.adminClient().tasks().get(id);
  }

  @Override
  protected Task getEntityByName(String fqn) {
    return SdkClients.adminClient().tasks().getByName(fqn);
  }

  @Override
  protected Task patchEntity(String id, Task entity) {
    return SdkClients.adminClient().tasks().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().tasks().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().tasks().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    SdkClients.adminClient()
        .tasks()
        .delete(id, java.util.Map.of("hardDelete", "true", "recursive", "true"));
  }

  @Override
  protected String getEntityType() {
    return "task";
  }

  @Override
  protected ListResponse<Task> listEntities(ListParams params) {
    return SdkClients.adminClient().tasks().list(params);
  }

  @Override
  protected Task getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().tasks().get(id, fields);
  }

  @Override
  protected Task getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().tasks().getByName(fqn, fields);
  }

  @Override
  protected Task getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().tasks().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().tasks().getVersionList(id);
  }

  @Override
  protected Task getVersion(UUID id, Double version) {
    return SdkClients.adminClient().tasks().getVersion(id.toString(), version);
  }

  @Override
  protected void validateCreatedEntity(Task created, CreateTask request) {
    assertEquals(request.getName(), created.getName());
    assertEquals(request.getDescription(), created.getDescription());
    assertEquals(request.getCategory(), created.getCategory());
    assertEquals(request.getType(), created.getType());
    assertEquals(TaskEntityStatus.Open, created.getStatus());
    assertNotNull(created.getTaskId());
    assertTrue(created.getTaskId().startsWith("TASK-"));
  }

  // ==================== Task-Specific Tests ====================

  @Test
  void testCreateTaskWithPriority(TestNamespace ns) {
    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("priority-task"))
            .withDescription("High priority task")
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval)
            .withPriority(TaskPriority.High);

    Task task = createEntity(request);

    assertNotNull(task);
    assertEquals(TaskPriority.High, task.getPriority());
  }

  @Test
  void testCreateMetadataUpdateTask(TestNamespace ns) {
    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("metadata-task"))
            .withDescription("Metadata update task")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate);

    Task task = createEntity(request);

    assertEquals(TaskCategory.MetadataUpdate, task.getCategory());
    assertEquals(TaskEntityType.DescriptionUpdate, task.getType());
  }

  @Test
  void testResolveTaskWithApproval(TestNamespace ns) {
    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("resolve-approve-task"))
            .withDescription("Task to be approved")
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval);

    Task task = createEntity(request);
    assertEquals(TaskEntityStatus.Open, task.getStatus());

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withComment("Approved by integration test");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());
    assertNotNull(resolvedTask.getResolution());
    assertEquals(TaskResolutionType.Approved, resolvedTask.getResolution().getType());
  }

  @Test
  void testResolveTaskWithRejection(TestNamespace ns) {
    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("resolve-reject-task"))
            .withDescription("Task to be rejected")
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval);

    Task task = createEntity(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Rejected)
            .withComment("Rejected by integration test");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Rejected, resolvedTask.getStatus());
    assertEquals(TaskResolutionType.Rejected, resolvedTask.getResolution().getType());
  }

  @Test
  void testListTasksByStatus(TestNamespace ns) {
    CreateTask request1 =
        new CreateTask()
            .withName(ns.prefix("status-task-1"))
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval);

    CreateTask request2 =
        new CreateTask()
            .withName(ns.prefix("status-task-2"))
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval);

    createEntity(request1);
    createEntity(request2);

    ListResponse<Task> openTasks =
        SdkClients.adminClient().tasks().listByStatus(TaskEntityStatus.Open);

    assertNotNull(openTasks);
    assertFalse(openTasks.getData().isEmpty());
    for (Task task : openTasks.getData()) {
      assertEquals(TaskEntityStatus.Open, task.getStatus());
    }
  }

  @Test
  void testTaskIdAutoGeneration(TestNamespace ns) {
    CreateTask request1 =
        new CreateTask()
            .withName(ns.prefix("autogen-task-1"))
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval);

    CreateTask request2 =
        new CreateTask()
            .withName(ns.prefix("autogen-task-2"))
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval);

    Task task1 = createEntity(request1);
    Task task2 = createEntity(request2);

    assertNotEquals(task1.getTaskId(), task2.getTaskId());
    assertTrue(task1.getTaskId().matches("TASK-\\d{5}"));
    assertTrue(task2.getTaskId().matches("TASK-\\d{5}"));
  }

  @Test
  void testGetTaskByTaskId(TestNamespace ns) {
    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("get-by-taskid"))
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.OwnershipUpdate);

    Task createdTask = createEntity(request);
    Task fetchedTask = getEntityByName(createdTask.getTaskId());

    assertEquals(createdTask.getId(), fetchedTask.getId());
    assertEquals(createdTask.getTaskId(), fetchedTask.getTaskId());
  }

  // ==================== Permission Tests ====================

  @Test
  void testAssigneeCanResolveTask(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("assignee-resolve"))
            .withDescription("Task assigned to user1")
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval)
            .withAssignees(List.of(shared.USER1.getFullyQualifiedName()));

    Task task = SdkClients.adminClient().tasks().create(request);
    assertEquals(TaskEntityStatus.Open, task.getStatus());

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withComment("Approved by assignee");

    Task resolvedTask =
        SdkClients.user1Client().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());
  }

  @Test
  void testTeamMemberCanResolveTask(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("team-resolve"))
            .withDescription("Task assigned to team")
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval)
            .withAssignees(List.of(shared.TEAM1.getFullyQualifiedName()));

    Task task = SdkClients.adminClient().tasks().create(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withComment("Approved by team member");

    Task resolvedTask =
        SdkClients.user1Client().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());
  }

  @Test
  void testCreatorCanCloseTask(TestNamespace ns) {
    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("creator-close"))
            .withDescription("Task to be closed by creator")
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval);

    Task task = SdkClients.user1Client().tasks().create(request);
    assertEquals(TaskEntityStatus.Open, task.getStatus());

    Task closedTask = SdkClients.user1Client().tasks().close(task.getId().toString());

    assertEquals(TaskEntityStatus.Cancelled, closedTask.getStatus());
  }

  @Test
  void testNonAssigneeCannotResolveTask(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("non-assignee-resolve"))
            .withDescription("Task assigned to user1 only")
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval)
            .withAssignees(List.of(shared.USER1.getFullyQualifiedName()));

    Task task = SdkClients.adminClient().tasks().create(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withComment("Attempting to approve without permission");

    assertThrows(
        ForbiddenException.class,
        () -> SdkClients.user2Client().tasks().resolve(task.getId().toString(), resolveRequest));
  }

  @Test
  void testNonAssigneeCannotCloseTask(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("non-assignee-close"))
            .withDescription("Task assigned to user1, created by admin")
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval)
            .withAssignees(List.of(shared.USER1.getFullyQualifiedName()));

    Task task = SdkClients.adminClient().tasks().create(request);

    assertThrows(
        ForbiddenException.class,
        () -> SdkClients.user2Client().tasks().close(task.getId().toString()));
  }

  @Test
  void testAssignedEndpointReturnsUserTasks(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();

    CreateTask request1 =
        new CreateTask()
            .withName(ns.prefix("assigned-test-1"))
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval)
            .withAssignees(List.of(shared.USER1.getFullyQualifiedName()));

    CreateTask request2 =
        new CreateTask()
            .withName(ns.prefix("assigned-test-2"))
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval)
            .withAssignees(List.of(shared.USER2.getFullyQualifiedName()));

    Task task1 = SdkClients.adminClient().tasks().create(request1);
    SdkClients.adminClient().tasks().create(request2);

    ListResponse<Task> user1Tasks = SdkClients.user1Client().tasks().listAssigned();

    assertNotNull(user1Tasks);
    assertTrue(
        user1Tasks.getData().stream().anyMatch(t -> t.getId().equals(task1.getId())),
        "User1's assigned tasks should include task1");
  }

  @Test
  void testCreatedEndpointReturnsUserTasks(TestNamespace ns) {
    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("created-test"))
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval);

    Task createdTask = SdkClients.user1Client().tasks().create(request);

    ListResponse<Task> user1CreatedTasks = SdkClients.user1Client().tasks().listCreated();

    assertNotNull(user1CreatedTasks);
    assertTrue(
        user1CreatedTasks.getData().stream().anyMatch(t -> t.getId().equals(createdTask.getId())),
        "User1's created tasks should include the task they created");
  }

  @Test
  void testCloseEndpointWithComment(TestNamespace ns) {
    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("close-with-comment"))
            .withDescription("Task to close with comment")
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval);

    Task task = SdkClients.adminClient().tasks().create(request);

    Task closedTask =
        SdkClients.adminClient().tasks().close(task.getId().toString(), "Closing this task");

    assertEquals(TaskEntityStatus.Cancelled, closedTask.getStatus());
  }

  @Test
  void testDefaultAssigneeFromEntityOwners(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("default-assignee"))
            .withDescription("Task with about entity that has owners")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(shared.GLOSSARY1.getFullyQualifiedName())
            .withAboutType("glossary");

    Task task = SdkClients.adminClient().tasks().create(request);

    assertNotNull(task.getAssignees(), "Task should have assignees from entity owners");
    assertFalse(task.getAssignees().isEmpty(), "Assignees should not be empty");
  }

  @Test
  void testAssigneeCanCloseTask(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("assignee-close"))
            .withDescription("Task that assignee can close")
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval)
            .withAssignees(List.of(shared.USER1.getFullyQualifiedName()));

    Task task = SdkClients.adminClient().tasks().create(request);

    Task closedTask = SdkClients.user1Client().tasks().close(task.getId().toString());

    assertEquals(TaskEntityStatus.Cancelled, closedTask.getStatus());
  }

  @Test
  void testAdminCanResolveAnyTask(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("admin-resolve"))
            .withDescription("Task assigned to user1, admin should resolve")
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval)
            .withAssignees(List.of(shared.USER1.getFullyQualifiedName()));

    Task task = SdkClients.user1Client().tasks().create(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withComment("Admin approving task");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());
  }

  @Test
  void testAdminCanCloseAnyTask(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("admin-close"))
            .withDescription("Task assigned to user1, admin should close")
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval)
            .withAssignees(List.of(shared.USER1.getFullyQualifiedName()));

    Task task = SdkClients.user1Client().tasks().create(request);

    Task closedTask = SdkClients.adminClient().tasks().close(task.getId().toString());

    assertEquals(TaskEntityStatus.Cancelled, closedTask.getStatus());
  }

  // ==================== Count API Tests ====================

  @Test
  void testGetCountReturnsCorrectTotals(TestNamespace ns) {
    TaskCount initialCount = SdkClients.adminClient().tasks().getCount();
    int initialTotal = initialCount.getTotal();
    int initialOpen = initialCount.getOpen();

    CreateTask request1 =
        new CreateTask()
            .withName(ns.prefix("count-test-1"))
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval);

    CreateTask request2 =
        new CreateTask()
            .withName(ns.prefix("count-test-2"))
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate);

    createEntity(request1);
    createEntity(request2);

    TaskCount afterCount = SdkClients.adminClient().tasks().getCount();

    assertTrue(
        afterCount.getTotal() >= initialTotal + 2,
        "Total count should increase by at least 2 (parallel tests may add more)");
    assertTrue(
        afterCount.getOpen() >= initialOpen + 2,
        "Open count should increase by at least 2 (parallel tests may add more)");
  }

  @Test
  void testGetCountByAboutEntity(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    TaskCount initialCount =
        SdkClients.adminClient().tasks().getCountByAboutEntity(table.getFullyQualifiedName());
    assertEquals(0, initialCount.getTotal(), "Initially there should be no tasks about the table");

    CreateTask request1 =
        new CreateTask()
            .withName(ns.prefix("about-entity-task-1"))
            .withDescription("Task about table")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table");

    CreateTask request2 =
        new CreateTask()
            .withName(ns.prefix("about-entity-task-2"))
            .withDescription("Another task about table")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.OwnershipUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table");

    Task task1 = createEntity(request1);
    Task task2 = createEntity(request2);

    assertNotNull(task1.getAbout(), "Task should have about reference set");
    assertEquals(
        table.getFullyQualifiedName(),
        task1.getAbout().getFullyQualifiedName(),
        "About FQN should match table FQN");

    TaskCount countByAbout =
        SdkClients.adminClient().tasks().getCountByAboutEntity(table.getFullyQualifiedName());

    assertEquals(2, countByAbout.getTotal(), "Should have 2 tasks about the table");
    assertEquals(2, countByAbout.getOpen(), "Both tasks should be open");
    assertEquals(0, countByAbout.getCompleted(), "No tasks should be completed yet");
  }

  @Test
  void testGetCountByAboutEntityWithResolvedTasks(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    CreateTask request1 =
        new CreateTask()
            .withName(ns.prefix("resolved-count-1"))
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table");

    CreateTask request2 =
        new CreateTask()
            .withName(ns.prefix("resolved-count-2"))
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table");

    Task task1 = createEntity(request1);
    Task task2 = createEntity(request2);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withComment("Approved for count test");

    SdkClients.adminClient().tasks().resolve(task1.getId().toString(), resolveRequest);

    TaskCount countByAbout =
        SdkClients.adminClient().tasks().getCountByAboutEntity(table.getFullyQualifiedName());

    assertEquals(2, countByAbout.getTotal(), "Should have 2 tasks about the table");
    assertEquals(1, countByAbout.getOpen(), "One task should still be open");
  }

  @Test
  void testTaskAboutFqnHashIsStoredCorrectly(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("fqn-hash-test"))
            .withDescription("Test aboutFqnHash storage")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table");

    Task created = createEntity(request);

    assertNotNull(created.getAbout(), "Created task should have about reference");
    assertEquals(
        table.getFullyQualifiedName(),
        created.getAbout().getFullyQualifiedName(),
        "About FQN should match");

    Task fetched = SdkClients.adminClient().tasks().get(created.getId().toString(), "about");
    assertNotNull(fetched.getAbout(), "Fetched task should have about reference");
    assertEquals(
        table.getFullyQualifiedName(),
        fetched.getAbout().getFullyQualifiedName(),
        "Fetched about FQN should match");

    ListParams params = new ListParams();
    params.addFilter("aboutEntity", table.getFullyQualifiedName());
    ListResponse<Task> filtered = SdkClients.adminClient().tasks().list(params);

    assertNotNull(filtered.getData(), "Filter results should not be null");
    assertTrue(
        filtered.getData().stream().anyMatch(t -> t.getId().equals(created.getId())),
        "Filtered tasks should include the task about the table");
  }

  @Test
  void testGetCountByCreatedBy(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("createdby-count"))
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval);

    SdkClients.user1Client().tasks().create(request);

    TaskCount count =
        SdkClients.adminClient().tasks().getCount(null, shared.USER1.getFullyQualifiedName(), null);

    assertTrue(count.getTotal() >= 1, "Should have at least 1 task created by user1");
  }

  @Test
  void testGetCountByAssignee(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("assignee-count"))
            .withCategory(TaskCategory.Approval)
            .withType(TaskEntityType.GlossaryApproval)
            .withAssignees(List.of(shared.USER2.getFullyQualifiedName()));

    SdkClients.adminClient().tasks().create(request);

    TaskCount count =
        SdkClients.adminClient().tasks().getCount(shared.USER2.getFullyQualifiedName(), null, null);

    assertTrue(count.getTotal() >= 1, "Should have at least 1 task assigned to user2");
  }

  // ==================== Entity Change Application Tests ====================

  @Test
  void testResolveTagUpdateTaskAppliesTags(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    // Verify table has no tags initially
    Table initialTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "tags");
    assertTrue(
        initialTable.getTags() == null || initialTable.getTags().isEmpty(),
        "Table should have no tags initially");

    // Create a TagUpdate task with tags to add
    List<TagLabel> tagsToAdd =
        List.of(
            new TagLabel()
                .withTagFQN("PersonalData.Personal")
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.MANUAL)
                .withState(TagLabel.State.CONFIRMED)
                .withName("Personal"));

    Map<String, Object> payload =
        Map.of("tagsToAdd", tagsToAdd, "operation", "Add", "currentTags", List.of());

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("tag-update-apply"))
            .withDescription("Add PersonalData.Personal tag to table")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.TagUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);
    assertEquals(TaskEntityStatus.Open, task.getStatus());

    // Resolve the task with approval
    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withComment("Approved - apply tags");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    // Verify tags were applied to the table
    Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "tags");

    assertNotNull(updatedTable.getTags(), "Table should have tags after task resolution");
    assertTrue(
        updatedTable.getTags().stream()
            .anyMatch(tag -> "PersonalData.Personal".equals(tag.getTagFQN())),
        "Table should have PersonalData.Personal tag");
  }

  @Test
  void testResolveDescriptionUpdateTaskAppliesDescription(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    String newDescription = "Updated description from task resolution - " + ns.shortPrefix();

    org.openmetadata.schema.type.DescriptionUpdatePayload payload =
        new org.openmetadata.schema.type.DescriptionUpdatePayload()
            .withFieldPath("description")
            .withCurrentDescription(table.getDescription())
            .withNewDescription(newDescription);

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("desc-update-apply"))
            .withDescription("Update table description")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);
    assertEquals(TaskEntityStatus.Open, task.getStatus());

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(newDescription)
            .withComment("Approved - apply description");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Table updatedTable = SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName());

    assertEquals(
        newDescription,
        updatedTable.getDescription(),
        "Table description should be updated after task resolution");
  }

  @Test
  void testResolveColumnDescriptionUpdateTaskAppliesDescription(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createWithColumns(ns, schema.getFullyQualifiedName());

    String columnName = table.getColumns().get(0).getName();
    String newDescription = "Updated column description - " + ns.shortPrefix();

    org.openmetadata.schema.type.DescriptionUpdatePayload payload =
        new org.openmetadata.schema.type.DescriptionUpdatePayload()
            .withFieldPath("columns::" + columnName + "::description")
            .withCurrentDescription(table.getColumns().get(0).getDescription())
            .withNewDescription(newDescription);

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("col-desc-update"))
            .withDescription("Update column description")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);
    assertEquals(TaskEntityStatus.Open, task.getStatus());

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(newDescription)
            .withComment("Approved - apply column description");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "columns");

    String updatedColumnDesc =
        updatedTable.getColumns().stream()
            .filter(c -> c.getName().equals(columnName))
            .findFirst()
            .map(c -> c.getDescription())
            .orElse(null);

    assertEquals(
        newDescription,
        updatedColumnDesc,
        "Column description should be updated after task resolution");
  }

  @Test
  void testRejectDescriptionUpdateTaskDoesNotApplyChanges(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    String originalDescription = table.getDescription();
    String newDescription = "This description should not be applied - " + ns.shortPrefix();

    org.openmetadata.schema.type.DescriptionUpdatePayload payload =
        new org.openmetadata.schema.type.DescriptionUpdatePayload()
            .withFieldPath("description")
            .withCurrentDescription(originalDescription)
            .withNewDescription(newDescription);

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("desc-update-reject"))
            .withDescription("Update table description - to be rejected")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Rejected)
            .withComment("Rejected - do not apply description");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Rejected, resolvedTask.getStatus());

    Table updatedTable = SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName());

    assertEquals(
        originalDescription,
        updatedTable.getDescription(),
        "Table description should remain unchanged after task rejection");
  }

  @Test
  void testRejectingTaskDoesNotApplyChanges(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    // Create a TagUpdate task
    List<TagLabel> tagsToAdd =
        List.of(
            new TagLabel()
                .withTagFQN("PersonalData.Personal")
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.MANUAL)
                .withState(TagLabel.State.CONFIRMED)
                .withName("Personal"));

    Map<String, Object> payload =
        Map.of("tagsToAdd", tagsToAdd, "operation", "Add", "currentTags", List.of());

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("tag-update-reject"))
            .withDescription("Tag update to be rejected")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.TagUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);

    // Reject the task
    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Rejected)
            .withComment("Rejected - do not apply");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Rejected, resolvedTask.getStatus());

    // Verify tags were NOT applied
    Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "tags");

    assertTrue(
        updatedTable.getTags() == null || updatedTable.getTags().isEmpty(),
        "Table should have no tags after task rejection");
  }

  // ==================== OwnershipUpdate Task Tests ====================

  @Test
  void testResolveOwnershipUpdateTaskAppliesOwners(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    org.openmetadata.schema.type.OwnershipUpdatePayload payload =
        new org.openmetadata.schema.type.OwnershipUpdatePayload()
            .withCurrentOwners(table.getOwners())
            .withNewOwners(List.of(shared.USER2_REF))
            .withReason("Transferring ownership for project handover");

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("ownership-update-apply"))
            .withDescription("Transfer ownership to user2")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.OwnershipUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);
    assertEquals(TaskEntityStatus.Open, task.getStatus());

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withComment("Approved - transfer ownership");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "owners");

    assertNotNull(updatedTable.getOwners(), "Table should have owners after task resolution");
    assertTrue(
        updatedTable.getOwners().stream().anyMatch(o -> o.getName().equals(shared.USER2.getName())),
        "Table should have USER2 as owner after ownership update");
  }

  @Test
  void testRejectOwnershipUpdateTaskDoesNotApplyChanges(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    List<org.openmetadata.schema.type.EntityReference> originalOwners = table.getOwners();

    org.openmetadata.schema.type.OwnershipUpdatePayload payload =
        new org.openmetadata.schema.type.OwnershipUpdatePayload()
            .withCurrentOwners(originalOwners)
            .withNewOwners(List.of(shared.USER3_REF))
            .withReason("Should not be applied");

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("ownership-update-reject"))
            .withDescription("Ownership update to be rejected")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.OwnershipUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Rejected)
            .withComment("Rejected - do not transfer ownership");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Rejected, resolvedTask.getStatus());

    Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "owners");

    assertFalse(
        updatedTable.getOwners() != null
            && updatedTable.getOwners().stream()
                .anyMatch(o -> o.getName().equals(shared.USER3.getName())),
        "Table should NOT have USER3 as owner after rejection");
  }

  // ==================== TierUpdate Task Tests ====================

  @Test
  void testResolveTierUpdateTaskAppliesTier(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    TagLabel newTier =
        new TagLabel()
            .withTagFQN("Tier.Tier1")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL)
            .withState(TagLabel.State.CONFIRMED)
            .withName("Tier1");

    org.openmetadata.schema.type.TierUpdatePayload payload =
        new org.openmetadata.schema.type.TierUpdatePayload()
            .withCurrentTier(null)
            .withNewTier(newTier)
            .withReason("Promoting table to Tier1 for critical business data");

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("tier-update-apply"))
            .withDescription("Update table tier to Tier1")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.TierUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);
    assertEquals(TaskEntityStatus.Open, task.getStatus());

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withComment("Approved - set tier to Tier1");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "tags");

    assertNotNull(updatedTable.getTags(), "Table should have tags (including tier) after update");
    assertTrue(
        updatedTable.getTags().stream().anyMatch(t -> t.getTagFQN().startsWith("Tier.")),
        "Table should have tier tag after tier update");
  }

  // ==================== DomainUpdate Task Tests ====================

  @Test
  void testResolveDomainUpdateTaskAppliesDomain(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    org.openmetadata.schema.type.EntityReference currentDomain =
        (table.getDomains() != null && !table.getDomains().isEmpty())
            ? table.getDomains().get(0)
            : null;

    org.openmetadata.schema.type.DomainUpdatePayload payload =
        new org.openmetadata.schema.type.DomainUpdatePayload()
            .withCurrentDomain(currentDomain)
            .withNewDomain(shared.DOMAIN.getEntityReference())
            .withReason("Assigning table to Engineering domain");

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("domain-update-apply"))
            .withDescription("Assign table to domain")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DomainUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);
    assertEquals(TaskEntityStatus.Open, task.getStatus());

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withComment("Approved - assign to domain");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "domains");

    assertNotNull(updatedTable.getDomains(), "Table should have domains after task resolution");
    assertFalse(updatedTable.getDomains().isEmpty(), "Table domains should not be empty");
    assertTrue(
        updatedTable.getDomains().stream()
            .anyMatch(d -> d.getFullyQualifiedName().equals(shared.DOMAIN.getFullyQualifiedName())),
        "Table domains should include the assigned domain");
  }

  @Test
  void testRejectDomainUpdateTaskDoesNotApplyChanges(TestNamespace ns) {
    SharedEntities shared = SharedEntities.get();
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    org.openmetadata.schema.type.EntityReference originalDomain =
        (table.getDomains() != null && !table.getDomains().isEmpty())
            ? table.getDomains().get(0)
            : null;

    org.openmetadata.schema.type.DomainUpdatePayload payload =
        new org.openmetadata.schema.type.DomainUpdatePayload()
            .withCurrentDomain(originalDomain)
            .withNewDomain(shared.SUB_DOMAIN.getEntityReference())
            .withReason("Should not be applied");

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("domain-update-reject"))
            .withDescription("Domain update to be rejected")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DomainUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Rejected)
            .withComment("Rejected - do not change domain");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Rejected, resolvedTask.getStatus());

    Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "domains");

    if (originalDomain == null) {
      assertTrue(
          updatedTable.getDomains() == null
              || updatedTable.getDomains().isEmpty()
              || updatedTable.getDomains().stream()
                  .noneMatch(
                      d ->
                          d.getFullyQualifiedName()
                              .equals(shared.SUB_DOMAIN.getFullyQualifiedName())),
          "Table should NOT have SUB_DOMAIN after rejection");
    }
  }

  // ==================== Topic Entity Tests ====================

  @Test
  void testResolveTopicDescriptionUpdateTask(TestNamespace ns) {
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic topicRequest = new CreateTopic();
    topicRequest.setName(ns.prefix("topic_desc_task"));
    topicRequest.setService(service.getFullyQualifiedName());
    topicRequest.setPartitions(1);
    topicRequest.setDescription("Original topic description");

    Topic topic = SdkClients.adminClient().topics().create(topicRequest);

    String newDescription = "Updated topic description from task - " + ns.shortPrefix();

    org.openmetadata.schema.type.DescriptionUpdatePayload payload =
        new org.openmetadata.schema.type.DescriptionUpdatePayload()
            .withFieldPath("description")
            .withCurrentDescription(topic.getDescription())
            .withNewDescription(newDescription);

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("topic-desc-update"))
            .withDescription("Update topic description")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(topic.getFullyQualifiedName())
            .withAboutType("topic")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(newDescription)
            .withComment("Approved");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Topic updatedTopic = SdkClients.adminClient().topics().getByName(topic.getFullyQualifiedName());

    assertEquals(newDescription, updatedTopic.getDescription());
  }

  @Test
  void testResolveTopicSchemaFieldDescriptionUpdateTask(TestNamespace ns) {
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    List<Field> schemaFields =
        Arrays.asList(
            new Field()
                .withName("user_id")
                .withDataType(FieldDataType.STRING)
                .withDescription("Original user ID description"),
            new Field()
                .withName("event_type")
                .withDataType(FieldDataType.STRING)
                .withDescription("Event type field"));

    MessageSchema schema =
        new MessageSchema()
            .withSchemaText("{\"type\":\"record\",\"name\":\"Event\"}")
            .withSchemaType(SchemaType.Avro)
            .withSchemaFields(schemaFields);

    CreateTopic topicRequest = new CreateTopic();
    topicRequest.setName(ns.prefix("topic_schema_task"));
    topicRequest.setService(service.getFullyQualifiedName());
    topicRequest.setPartitions(1);
    topicRequest.setMessageSchema(schema);

    Topic topic = SdkClients.adminClient().topics().create(topicRequest);

    String newDescription = "Updated user_id field description - " + ns.shortPrefix();

    org.openmetadata.schema.type.DescriptionUpdatePayload payload =
        new org.openmetadata.schema.type.DescriptionUpdatePayload()
            .withFieldPath("messageSchema::user_id::description")
            .withCurrentDescription("Original user ID description")
            .withNewDescription(newDescription);

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("topic-field-desc"))
            .withDescription("Update topic schema field description")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(topic.getFullyQualifiedName())
            .withAboutType("topic")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(newDescription)
            .withComment("Approved schema field update");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Topic updatedTopic =
        SdkClients.adminClient().topics().getByName(topic.getFullyQualifiedName(), "messageSchema");

    assertNotNull(updatedTopic.getMessageSchema());
    assertNotNull(updatedTopic.getMessageSchema().getSchemaFields());

    String updatedFieldDesc =
        updatedTopic.getMessageSchema().getSchemaFields().stream()
            .filter(f -> "user_id".equals(f.getName()))
            .findFirst()
            .map(Field::getDescription)
            .orElse(null);

    assertEquals(newDescription, updatedFieldDesc);
  }

  // ==================== Nested Column Tests ====================

  @Test
  void testResolveNestedColumnDescriptionUpdateTask(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column childColumn =
        new Column()
            .withName("street")
            .withDataType(ColumnDataType.VARCHAR)
            .withDataLength(255)
            .withDescription("Original street description");

    Column parentColumn =
        new Column()
            .withName("address")
            .withDataType(ColumnDataType.STRUCT)
            .withDescription("Address struct")
            .withChildren(List.of(childColumn));

    List<Column> columns =
        List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT), parentColumn);

    Table table =
        org.openmetadata.sdk.fluent.Tables.create()
            .name(ns.prefix("nested_col_table"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(columns)
            .execute();

    String newDescription = "Updated nested street description - " + ns.shortPrefix();

    org.openmetadata.schema.type.DescriptionUpdatePayload payload =
        new org.openmetadata.schema.type.DescriptionUpdatePayload()
            .withFieldPath("columns::address.street::description")
            .withCurrentDescription("Original street description")
            .withNewDescription(newDescription);

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("nested-col-desc"))
            .withDescription("Update nested column description")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(newDescription)
            .withComment("Approved nested column update");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "columns");

    Column addressCol =
        updatedTable.getColumns().stream()
            .filter(c -> "address".equals(c.getName()))
            .findFirst()
            .orElse(null);

    assertNotNull(addressCol, "Address column should exist");
    assertNotNull(addressCol.getChildren(), "Address should have children");

    String updatedChildDesc =
        addressCol.getChildren().stream()
            .filter(c -> "street".equals(c.getName()))
            .findFirst()
            .map(Column::getDescription)
            .orElse(null);

    assertEquals(newDescription, updatedChildDesc);
  }

  // ==================== Multiple Columns Same Task ====================

  @Test
  void testMultipleColumnDescriptionTasksOnSameTable(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createWithColumns(ns, schema.getFullyQualifiedName());

    String col1Name = table.getColumns().get(0).getName();
    String col2Name = table.getColumns().get(1).getName();

    String newDesc1 = "First column updated - " + ns.shortPrefix();
    String newDesc2 = "Second column updated - " + ns.shortPrefix();

    org.openmetadata.schema.type.DescriptionUpdatePayload payload1 =
        new org.openmetadata.schema.type.DescriptionUpdatePayload()
            .withFieldPath("columns::" + col1Name + "::description")
            .withNewDescription(newDesc1);

    CreateTask request1 =
        new CreateTask()
            .withName(ns.prefix("multi-col-task-1"))
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table")
            .withPayload(payload1);

    org.openmetadata.schema.type.DescriptionUpdatePayload payload2 =
        new org.openmetadata.schema.type.DescriptionUpdatePayload()
            .withFieldPath("columns::" + col2Name + "::description")
            .withNewDescription(newDesc2);

    CreateTask request2 =
        new CreateTask()
            .withName(ns.prefix("multi-col-task-2"))
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table")
            .withPayload(payload2);

    Task task1 = SdkClients.adminClient().tasks().create(request1);
    Task task2 = SdkClients.adminClient().tasks().create(request2);

    ResolveTask resolve =
        new ResolveTask().withResolutionType(TaskResolutionType.Approved).withComment("Approved");

    SdkClients.adminClient()
        .tasks()
        .resolve(task1.getId().toString(), resolve.withNewValue(newDesc1));
    SdkClients.adminClient()
        .tasks()
        .resolve(task2.getId().toString(), resolve.withNewValue(newDesc2));

    Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "columns");

    String col1Desc =
        updatedTable.getColumns().stream()
            .filter(c -> c.getName().equals(col1Name))
            .findFirst()
            .map(Column::getDescription)
            .orElse(null);

    String col2Desc =
        updatedTable.getColumns().stream()
            .filter(c -> c.getName().equals(col2Name))
            .findFirst()
            .map(Column::getDescription)
            .orElse(null);

    assertEquals(newDesc1, col1Desc, "First column should have updated description");
    assertEquals(newDesc2, col2Desc, "Second column should have updated description");
  }

  // ==================== Dashboard Entity Tests ====================

  @Test
  void testResolveDashboardDescriptionUpdateTask(TestNamespace ns) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateDashboard dashboardRequest =
        new CreateDashboard()
            .withName(ns.prefix("dashboard_task"))
            .withService(service.getFullyQualifiedName())
            .withDescription("Original dashboard description");

    Dashboard dashboard = SdkClients.adminClient().dashboards().create(dashboardRequest);

    String newDescription = "Updated dashboard description - " + ns.shortPrefix();

    org.openmetadata.schema.type.DescriptionUpdatePayload payload =
        new org.openmetadata.schema.type.DescriptionUpdatePayload()
            .withFieldPath("description")
            .withCurrentDescription(dashboard.getDescription())
            .withNewDescription(newDescription);

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("dashboard-desc-task"))
            .withDescription("Update dashboard description")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(dashboard.getFullyQualifiedName())
            .withAboutType("dashboard")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(newDescription)
            .withComment("Approved");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Dashboard updatedDashboard =
        SdkClients.adminClient().dashboards().getByName(dashboard.getFullyQualifiedName());

    assertEquals(newDescription, updatedDashboard.getDescription());
  }

  @Test
  void testResolveDashboardTagUpdateTask(TestNamespace ns) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateDashboard dashboardRequest =
        new CreateDashboard()
            .withName(ns.prefix("dashboard_tag_task"))
            .withService(service.getFullyQualifiedName())
            .withDescription("Dashboard for tag update");

    Dashboard dashboard = SdkClients.adminClient().dashboards().create(dashboardRequest);

    List<TagLabel> tagsToAdd =
        List.of(
            new TagLabel()
                .withTagFQN("PersonalData.Personal")
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.MANUAL)
                .withState(TagLabel.State.CONFIRMED)
                .withName("Personal"));

    Map<String, Object> tagPayload =
        Map.of("tagsToAdd", tagsToAdd, "operation", "Add", "currentTags", List.of());

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("dashboard-tag-task"))
            .withDescription("Add tags to dashboard")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.TagUpdate)
            .withAbout(dashboard.getFullyQualifiedName())
            .withAboutType("dashboard")
            .withPayload(tagPayload);

    Task task = SdkClients.adminClient().tasks().create(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withComment("Approved tags");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Dashboard updatedDashboard =
        SdkClients.adminClient().dashboards().getByName(dashboard.getFullyQualifiedName(), "tags");

    assertNotNull(updatedDashboard.getTags());
    assertTrue(
        updatedDashboard.getTags().stream()
            .anyMatch(t -> "PersonalData.Personal".equals(t.getTagFQN())));
  }

  // ==================== Pipeline Entity Tests ====================

  @Test
  void testResolvePipelineDescriptionUpdateTask(TestNamespace ns) {
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline pipelineRequest =
        new CreatePipeline()
            .withName(ns.prefix("pipeline_task"))
            .withService(service.getFullyQualifiedName())
            .withDescription("Original pipeline description");

    Pipeline pipeline = SdkClients.adminClient().pipelines().create(pipelineRequest);

    String newDescription = "Updated pipeline description - " + ns.shortPrefix();

    org.openmetadata.schema.type.DescriptionUpdatePayload payload =
        new org.openmetadata.schema.type.DescriptionUpdatePayload()
            .withFieldPath("description")
            .withCurrentDescription(pipeline.getDescription())
            .withNewDescription(newDescription);

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("pipeline-desc-task"))
            .withDescription("Update pipeline description")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(pipeline.getFullyQualifiedName())
            .withAboutType("pipeline")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(newDescription)
            .withComment("Approved");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Pipeline updatedPipeline =
        SdkClients.adminClient().pipelines().getByName(pipeline.getFullyQualifiedName());

    assertEquals(newDescription, updatedPipeline.getDescription());
  }

  @Test
  void testResolvePipelineTaskDescriptionUpdate(TestNamespace ns) {
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    org.openmetadata.schema.type.Task pipelineTask =
        new org.openmetadata.schema.type.Task()
            .withName("extract_data")
            .withDescription("Original extract task description");

    CreatePipeline pipelineRequest =
        new CreatePipeline()
            .withName(ns.prefix("pipeline_with_tasks"))
            .withService(service.getFullyQualifiedName())
            .withDescription("Pipeline with tasks")
            .withTasks(List.of(pipelineTask));

    Pipeline pipeline = SdkClients.adminClient().pipelines().create(pipelineRequest);

    String newDescription = "Updated extract task description - " + ns.shortPrefix();

    org.openmetadata.schema.type.DescriptionUpdatePayload payload =
        new org.openmetadata.schema.type.DescriptionUpdatePayload()
            .withFieldPath("tasks::extract_data::description")
            .withCurrentDescription("Original extract task description")
            .withNewDescription(newDescription);

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("pipeline-task-desc"))
            .withDescription("Update pipeline task description")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(pipeline.getFullyQualifiedName())
            .withAboutType("pipeline")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(newDescription)
            .withComment("Approved task description");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Pipeline updatedPipeline =
        SdkClients.adminClient().pipelines().getByName(pipeline.getFullyQualifiedName(), "tasks");

    assertNotNull(updatedPipeline.getTasks());

    String updatedTaskDesc =
        updatedPipeline.getTasks().stream()
            .filter(t -> "extract_data".equals(t.getName()))
            .findFirst()
            .map(org.openmetadata.schema.type.Task::getDescription)
            .orElse(null);

    assertEquals(newDescription, updatedTaskDesc);
  }

  // ==================== Container Entity Tests ====================

  @Test
  void testResolveContainerDescriptionUpdateTask(TestNamespace ns) {
    StorageService service = ContainerServiceTestFactory.createS3(ns);

    CreateContainer containerRequest =
        new CreateContainer()
            .withName(ns.prefix("container_task"))
            .withService(service.getFullyQualifiedName())
            .withDescription("Original container description");

    Container container = SdkClients.adminClient().containers().create(containerRequest);

    String newDescription = "Updated container description - " + ns.shortPrefix();

    org.openmetadata.schema.type.DescriptionUpdatePayload payload =
        new org.openmetadata.schema.type.DescriptionUpdatePayload()
            .withFieldPath("description")
            .withCurrentDescription(container.getDescription())
            .withNewDescription(newDescription);

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("container-desc-task"))
            .withDescription("Update container description")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(container.getFullyQualifiedName())
            .withAboutType("container")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(newDescription)
            .withComment("Approved");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Container updatedContainer =
        SdkClients.adminClient().containers().getByName(container.getFullyQualifiedName());

    assertEquals(newDescription, updatedContainer.getDescription());
  }

  @Test
  void testResolveContainerDataModelColumnDescriptionUpdate(TestNamespace ns) {
    StorageService service = ContainerServiceTestFactory.createS3(ns);

    List<Column> dataModelColumns =
        List.of(
            new Column()
                .withName("customer_id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Original customer ID description"),
            new Column()
                .withName("customer_name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(255)
                .withDescription("Customer name"));

    ContainerDataModel dataModel =
        new ContainerDataModel().withColumns(dataModelColumns).withIsPartitioned(false);

    CreateContainer containerRequest =
        new CreateContainer()
            .withName(ns.prefix("container_datamodel"))
            .withService(service.getFullyQualifiedName())
            .withDescription("Container with data model")
            .withDataModel(dataModel);

    Container container = SdkClients.adminClient().containers().create(containerRequest);

    String newDescription = "Updated customer_id column description - " + ns.shortPrefix();

    org.openmetadata.schema.type.DescriptionUpdatePayload payload =
        new org.openmetadata.schema.type.DescriptionUpdatePayload()
            .withFieldPath("dataModel::customer_id::description")
            .withCurrentDescription("Original customer ID description")
            .withNewDescription(newDescription);

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("container-col-desc"))
            .withDescription("Update container dataModel column description")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.DescriptionUpdate)
            .withAbout(container.getFullyQualifiedName())
            .withAboutType("container")
            .withPayload(payload);

    Task task = SdkClients.adminClient().tasks().create(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withNewValue(newDescription)
            .withComment("Approved column description");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Container updatedContainer =
        SdkClients.adminClient()
            .containers()
            .getByName(container.getFullyQualifiedName(), "dataModel");

    assertNotNull(updatedContainer.getDataModel());
    assertNotNull(updatedContainer.getDataModel().getColumns());

    String updatedColDesc =
        updatedContainer.getDataModel().getColumns().stream()
            .filter(c -> "customer_id".equals(c.getName()))
            .findFirst()
            .map(Column::getDescription)
            .orElse(null);

    assertEquals(newDescription, updatedColDesc);
  }

  // ==================== Cross-Entity Tag Update Tests ====================

  @Test
  void testResolveTableTagUpdateTask(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Table table = TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());

    List<TagLabel> tagsToAdd =
        List.of(
            new TagLabel()
                .withTagFQN("PII.Sensitive")
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.MANUAL)
                .withState(TagLabel.State.CONFIRMED)
                .withName("Sensitive"));

    Map<String, Object> tagPayload =
        Map.of("tagsToAdd", tagsToAdd, "operation", "Add", "currentTags", List.of());

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("table-pii-tag"))
            .withDescription("Add PII tag to table")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.TagUpdate)
            .withAbout(table.getFullyQualifiedName())
            .withAboutType("table")
            .withPayload(tagPayload);

    Task task = SdkClients.adminClient().tasks().create(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withComment("Approved PII tag");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Table updatedTable =
        SdkClients.adminClient().tables().getByName(table.getFullyQualifiedName(), "tags");

    assertNotNull(updatedTable.getTags());
    assertTrue(
        updatedTable.getTags().stream().anyMatch(t -> "PII.Sensitive".equals(t.getTagFQN())));
  }

  @Test
  void testResolveTopicTagUpdateTask(TestNamespace ns) {
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic topicRequest = new CreateTopic();
    topicRequest.setName(ns.prefix("topic_tag_task"));
    topicRequest.setService(service.getFullyQualifiedName());
    topicRequest.setPartitions(1);
    topicRequest.setDescription("Topic for tag update");

    Topic topic = SdkClients.adminClient().topics().create(topicRequest);

    List<TagLabel> tagsToAdd =
        List.of(
            new TagLabel()
                .withTagFQN("PersonalData.Personal")
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.MANUAL)
                .withState(TagLabel.State.CONFIRMED)
                .withName("Personal"));

    Map<String, Object> tagPayload =
        Map.of("tagsToAdd", tagsToAdd, "operation", "Add", "currentTags", List.of());

    CreateTask request =
        new CreateTask()
            .withName(ns.prefix("topic-tag-task"))
            .withDescription("Add tag to topic")
            .withCategory(TaskCategory.MetadataUpdate)
            .withType(TaskEntityType.TagUpdate)
            .withAbout(topic.getFullyQualifiedName())
            .withAboutType("topic")
            .withPayload(tagPayload);

    Task task = SdkClients.adminClient().tasks().create(request);

    ResolveTask resolveRequest =
        new ResolveTask()
            .withResolutionType(TaskResolutionType.Approved)
            .withComment("Approved topic tag");

    Task resolvedTask =
        SdkClients.adminClient().tasks().resolve(task.getId().toString(), resolveRequest);

    assertEquals(TaskEntityStatus.Approved, resolvedTask.getStatus());

    Topic updatedTopic =
        SdkClients.adminClient().topics().getByName(topic.getFullyQualifiedName(), "tags");

    assertNotNull(updatedTopic.getTags());
    assertTrue(
        updatedTopic.getTags().stream()
            .anyMatch(t -> "PersonalData.Personal".equals(t.getTagFQN())));
  }
}
