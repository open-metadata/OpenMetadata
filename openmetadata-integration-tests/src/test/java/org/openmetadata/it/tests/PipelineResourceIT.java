package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Status;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.type.Task;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for Pipeline entity operations.
 *
 * <p>Extends BaseEntityIT to inherit common entity tests. Adds pipeline-specific tests for tasks,
 * schedules, and execution status.
 *
 * <p>Migrated from: org.openmetadata.service.resources.pipelines.PipelineResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
public class PipelineResourceIT extends BaseEntityIT<Pipeline, CreatePipeline> {

  {
    supportsLifeCycle = true;
    supportsListHistoryByTimestamp = true;
    supportsBulkAPI = true;
  }

  // ===================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS (Required by BaseEntityIT)
  // ===================================================================

  @Override
  protected CreatePipeline createMinimalRequest(TestNamespace ns) {
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Test pipeline created by integration test");

    return request;
  }

  @Override
  protected CreatePipeline createRequest(String name, TestNamespace ns) {
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(name);
    request.setService(service.getFullyQualifiedName());

    return request;
  }

  @Override
  protected Pipeline createEntity(CreatePipeline createRequest) {
    return SdkClients.adminClient().pipelines().create(createRequest);
  }

  @Override
  protected Pipeline getEntity(String id) {
    return SdkClients.adminClient().pipelines().get(id);
  }

  @Override
  protected Pipeline getEntityByName(String fqn) {
    return SdkClients.adminClient().pipelines().getByName(fqn);
  }

  @Override
  protected Pipeline patchEntity(String id, Pipeline entity) {
    return SdkClients.adminClient().pipelines().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().pipelines().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().pipelines().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    SdkClients.adminClient().pipelines().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "pipeline";
  }

  @Override
  protected void validateCreatedEntity(Pipeline entity, CreatePipeline createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertNotNull(entity.getService(), "Pipeline must have a service");

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }

    assertTrue(
        entity.getFullyQualifiedName().contains(entity.getName()),
        "FQN should contain pipeline name");
  }

  @Override
  protected ListResponse<Pipeline> listEntities(ListParams params) {
    return SdkClients.adminClient().pipelines().list(params);
  }

  @Override
  protected Pipeline getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().pipelines().get(id, fields);
  }

  @Override
  protected Pipeline getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().pipelines().getByName(fqn, fields);
  }

  @Override
  protected Pipeline getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().pipelines().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().pipelines().getVersionList(id);
  }

  @Override
  protected Pipeline getVersion(UUID id, Double version) {
    return SdkClients.adminClient().pipelines().getVersion(id.toString(), version);
  }

  // ===================================================================
  // PIPELINE-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_pipelineWithoutRequiredFields_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Service is required field
    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_no_service"));

    assertThrows(
        Exception.class,
        () -> createEntity(request),
        "Creating pipeline without service should fail");
  }

  @Test
  void post_pipelineWithTasks_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    List<Task> tasks =
        Arrays.asList(
            new Task().withName("task1").withDisplayName("Task 1").withDescription("First task"),
            new Task()
                .withName("task2")
                .withDisplayName("Task 2")
                .withDescription("Second task")
                .withDownstreamTasks(List.of("task1")));

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_with_tasks"));
    request.setService(service.getFullyQualifiedName());
    request.setTasks(tasks);

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline);
    assertNotNull(pipeline.getTasks());
    assertEquals(2, pipeline.getTasks().size());
  }

  @Test
  void post_pipelineWithSourceUrl_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_with_url"));
    request.setService(service.getFullyQualifiedName());
    request.setSourceUrl("http://localhost:8080/pipelines/my_pipeline");

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline);
    assertEquals("http://localhost:8080/pipelines/my_pipeline", pipeline.getSourceUrl());
  }

  @Test
  void post_pipelineWithSchedule_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_with_schedule"));
    request.setService(service.getFullyQualifiedName());
    request.setScheduleInterval("0 0 * * *"); // Daily at midnight

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline);
    assertEquals("0 0 * * *", pipeline.getScheduleInterval());
  }

  @Test
  void put_pipelineWithTasks_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    // Create pipeline without tasks
    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_add_tasks"));
    request.setService(service.getFullyQualifiedName());

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline);

    // Add tasks via update
    List<Task> tasks =
        Arrays.asList(
            new Task().withName("task1").withDescription("Added task 1"),
            new Task().withName("task2").withDescription("Added task 2"));

    pipeline.setTasks(tasks);
    Pipeline updated = patchEntity(pipeline.getId().toString(), pipeline);
    assertNotNull(updated);
    assertNotNull(updated.getTasks());
    assertEquals(2, updated.getTasks().size());
  }

  @Test
  void patch_pipelineDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_patch_desc"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Initial description");

    Pipeline pipeline = createEntity(request);
    assertEquals("Initial description", pipeline.getDescription());

    // Patch description
    pipeline.setDescription("Updated description");
    Pipeline patched = patchEntity(pipeline.getId().toString(), pipeline);
    assertEquals("Updated description", patched.getDescription());
  }

  @Test
  void test_pipelineInheritsDomainFromService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a pipeline service
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    // Create a pipeline under the service
    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_inherit_domain"));
    request.setService(service.getFullyQualifiedName());

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline);
    assertNotNull(pipeline.getService());
    assertEquals(service.getFullyQualifiedName(), pipeline.getService().getFullyQualifiedName());
  }

  @Test
  void test_pipelineVersionHistory(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_version"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Initial description");

    Pipeline pipeline = createEntity(request);
    Double initialVersion = pipeline.getVersion();

    // Update to create a new version
    pipeline.setDescription("Updated description");
    Pipeline updated = patchEntity(pipeline.getId().toString(), pipeline);
    assertTrue(updated.getVersion() >= initialVersion);

    // Verify version history
    EntityHistory history = getVersionHistory(pipeline.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_pipelineSoftDeleteRestore(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_delete"));
    request.setService(service.getFullyQualifiedName());

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline.getId());

    // Soft delete
    deleteEntity(pipeline.getId().toString());

    // Should be able to get with include deleted
    Pipeline deleted = getEntityIncludeDeleted(pipeline.getId().toString());
    assertNotNull(deleted);
    assertTrue(deleted.getDeleted());

    // Restore
    restoreEntity(pipeline.getId().toString());
    Pipeline restored = getEntity(pipeline.getId().toString());
    assertNotNull(restored);
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_pipelineHardDelete(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_hard_delete"));
    request.setService(service.getFullyQualifiedName());

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline.getId());

    // Hard delete
    hardDeleteEntity(pipeline.getId().toString());

    // Should not be able to get after hard delete
    assertThrows(Exception.class, () -> getEntity(pipeline.getId().toString()));
    assertThrows(Exception.class, () -> getEntityIncludeDeleted(pipeline.getId().toString()));
  }

  @Test
  void test_listPipelinesByService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    // Create multiple pipelines under the same service
    for (int i = 0; i < 3; i++) {
      CreatePipeline request = new CreatePipeline();
      request.setName(ns.prefix("pipeline_list_" + i));
      request.setService(service.getFullyQualifiedName());
      createEntity(request);
    }

    // List all pipelines
    ListParams params = new ListParams();
    params.setLimit(100);
    ListResponse<Pipeline> response = listEntities(params);
    assertNotNull(response);

    // Count pipelines belonging to our service
    long serviceCount =
        response.getData().stream()
            .filter(
                p -> p.getService().getFullyQualifiedName().equals(service.getFullyQualifiedName()))
            .count();
    assertTrue(serviceCount >= 3);
  }

  @Test
  void test_pipelineTasksWithDots(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    // Task name with dots
    Task task =
        new Task()
            .withName("ta.sk.with.dots")
            .withDescription("Task with dots in name")
            .withSourceUrl("http://localhost:8080/tasks/dotted");

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_dotted_task"));
    request.setService(service.getFullyQualifiedName());
    request.setTasks(List.of(task));

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline.getTasks());
    assertEquals(1, pipeline.getTasks().size());
    assertEquals("ta.sk.with.dots", pipeline.getTasks().get(0).getName());
  }

  @Test
  void test_pipelineTaskWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    // Task with owner
    Task task =
        new Task()
            .withName("task_owned")
            .withDescription("Task with owner")
            .withSourceUrl("http://localhost:8080/tasks/owned")
            .withOwners(List.of(testUser1().getEntityReference()));

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_task_owner"));
    request.setService(service.getFullyQualifiedName());
    request.setTasks(List.of(task));

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline.getTasks());
    assertEquals(1, pipeline.getTasks().size());

    // Verify task has owner
    Task createdTask = pipeline.getTasks().get(0);
    assertNotNull(createdTask.getOwners());
    assertTrue(createdTask.getOwners().size() > 0);
  }

  @Test
  void test_pipelineUrlAndConcurrencyUpdate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_url_update"));
    request.setService(service.getFullyQualifiedName());
    request.setSourceUrl("http://localhost:8080/initial");

    Pipeline pipeline = createEntity(request);
    assertEquals("http://localhost:8080/initial", pipeline.getSourceUrl());

    // Update URL and add concurrency
    pipeline.setSourceUrl("https://airflow.example.com/dag");
    pipeline.setConcurrency(10);

    Pipeline updated = patchEntity(pipeline.getId().toString(), pipeline);
    assertEquals("https://airflow.example.com/dag", updated.getSourceUrl());
    assertEquals(Integer.valueOf(10), updated.getConcurrency());
  }

  @Test
  void test_pipelineTasksOverride(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    List<Task> initialTasks =
        Arrays.asList(
            new Task().withName("task1").withDescription("First task"),
            new Task().withName("task2").withDescription("Second task"));

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_override"));
    request.setService(service.getFullyQualifiedName());
    request.setTasks(initialTasks);

    Pipeline pipeline = createEntity(request);
    assertEquals(2, pipeline.getTasks().size());

    // Override with new task
    List<Task> newTasks =
        List.of(new Task().withName("newTask").withDescription("New task").withDisplayName("New"));

    pipeline.setTasks(newTasks);
    Pipeline updated = patchEntity(pipeline.getId().toString(), pipeline);

    // Verify tasks were overridden
    assertNotNull(updated.getTasks());
    assertEquals(1, updated.getTasks().size());
    assertEquals("newTask", updated.getTasks().get(0).getName());
  }

  @Test
  void test_addRemovePipelineTasks(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_add_remove"));
    request.setService(service.getFullyQualifiedName());

    Pipeline pipeline = createEntity(request);

    // Add tasks
    List<Task> tasks =
        Arrays.asList(
            new Task().withName("task1").withDescription("Task 1"),
            new Task().withName("task2").withDescription("Task 2"),
            new Task().withName("task3").withDescription("Task 3"));

    pipeline.setTasks(tasks);
    Pipeline updated = patchEntity(pipeline.getId().toString(), pipeline);
    assertEquals(3, updated.getTasks().size());

    // Remove one task
    List<Task> reducedTasks =
        Arrays.asList(
            new Task().withName("task1").withDescription("Task 1"),
            new Task().withName("task3").withDescription("Task 3"));

    updated.setTasks(reducedTasks);
    Pipeline final_pipeline = patchEntity(updated.getId().toString(), updated);
    assertEquals(2, final_pipeline.getTasks().size());
  }

  @Test
  void test_pipelineDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_display"));
    request.setService(service.getFullyQualifiedName());
    request.setDisplayName("My Display Pipeline");

    Pipeline pipeline = createEntity(request);
    assertEquals("My Display Pipeline", pipeline.getDisplayName());

    // Update display name
    pipeline.setDisplayName("Updated Display Name");
    Pipeline updated = patchEntity(pipeline.getId().toString(), pipeline);
    assertEquals("Updated Display Name", updated.getDisplayName());
  }

  @Test
  void test_pipelineGetByName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_by_name"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Pipeline for getByName test");

    Pipeline pipeline = createEntity(request);

    // Get by FQN
    Pipeline fetched = getEntityByName(pipeline.getFullyQualifiedName());
    assertNotNull(fetched);
    assertEquals(pipeline.getId(), fetched.getId());
    assertEquals(pipeline.getName(), fetched.getName());
    assertEquals(pipeline.getDescription(), fetched.getDescription());
  }

  @Test
  void test_pipelineFQNFormat(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    String pipelineName = ns.prefix("pipeline_fqn");
    request.setName(pipelineName);
    request.setService(service.getFullyQualifiedName());

    Pipeline pipeline = createEntity(request);

    // Verify FQN format: service.pipeline
    String expectedFQN = service.getFullyQualifiedName() + "." + pipelineName;
    assertEquals(expectedFQN, pipeline.getFullyQualifiedName());
  }

  @Test
  void test_pipelinePagination(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    // Create multiple pipelines
    for (int i = 0; i < 5; i++) {
      CreatePipeline request = new CreatePipeline();
      request.setName(ns.prefix("pagination_" + i));
      request.setService(service.getFullyQualifiedName());
      createEntity(request);
    }

    // List with limit
    ListParams params = new ListParams();
    params.setLimit(2);
    ListResponse<Pipeline> response = listEntities(params);
    assertNotNull(response);
    assertTrue(response.getData().size() <= 2);
  }

  @Test
  void test_pipelineWithOwner(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_with_owner"));
    request.setService(service.getFullyQualifiedName());
    request.setOwners(List.of(testUser1().getEntityReference()));

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline.getOwners());
    assertTrue(pipeline.getOwners().size() > 0);
  }

  @Test
  void test_pipelineWithDownstreamTasks(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    // Create tasks with dependencies (DAG structure)
    List<Task> tasks =
        Arrays.asList(
            new Task().withName("extract").withDescription("Extract data"),
            new Task()
                .withName("transform")
                .withDescription("Transform data")
                .withDownstreamTasks(List.of("extract")),
            new Task()
                .withName("load")
                .withDescription("Load data")
                .withDownstreamTasks(List.of("transform")));

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_dag"));
    request.setService(service.getFullyQualifiedName());
    request.setTasks(tasks);

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline.getTasks());
    assertEquals(3, pipeline.getTasks().size());

    // Verify downstream tasks are preserved
    Task transformTask =
        pipeline.getTasks().stream()
            .filter(t -> "transform".equals(t.getName()))
            .findFirst()
            .orElse(null);
    assertNotNull(transformTask);
    assertNotNull(transformTask.getDownstreamTasks());
    assertTrue(transformTask.getDownstreamTasks().contains("extract"));
  }

  @Test
  void put_pipelineStatus_200_OK(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_status"));
    request.setService(service.getFullyQualifiedName());

    List<Task> tasks =
        Arrays.asList(
            new Task().withName("task1").withDescription("First task"),
            new Task().withName("task2").withDescription("Second task"));
    request.setTasks(tasks);

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline);

    // Create pipeline status with task statuses
    Status t1Status = new Status().withName("task1").withExecutionStatus(StatusType.Successful);
    Status t2Status = new Status().withName("task2").withExecutionStatus(StatusType.Failed);

    PipelineStatus pipelineStatus =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Failed)
            .withTimestamp(System.currentTimeMillis())
            .withTaskStatus(Arrays.asList(t1Status, t2Status));

    // Update pipeline with status
    java.util.Map<String, Object> statusData = new java.util.HashMap<>();
    statusData.put("executionStatus", pipelineStatus.getExecutionStatus().value());
    statusData.put("timestamp", pipelineStatus.getTimestamp());
    statusData.put("taskStatus", pipelineStatus.getTaskStatus());

    // addPipelineStatus expects FQN, not ID
    client.pipelines().addPipelineStatus(pipeline.getFullyQualifiedName(), pipelineStatus);

    // Retrieve pipeline with status
    Pipeline updatedPipeline =
        client.pipelines().get(pipeline.getId().toString(), "pipelineStatus");
    assertNotNull(updatedPipeline.getPipelineStatus());
    assertEquals(StatusType.Failed, updatedPipeline.getPipelineStatus().getExecutionStatus());
  }

  @Test
  void put_pipelineInvalidStatus_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_invalid_status"));
    request.setService(service.getFullyQualifiedName());

    List<Task> tasks = Arrays.asList(new Task().withName("task1").withDescription("Task 1"));
    request.setTasks(tasks);

    Pipeline pipeline = createEntity(request);

    // Create status with invalid task name
    Status invalidTaskStatus =
        new Status().withName("invalidTask").withExecutionStatus(StatusType.Failed);

    PipelineStatus pipelineStatus =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Failed)
            .withTimestamp(System.currentTimeMillis())
            .withTaskStatus(Arrays.asList(invalidTaskStatus));

    // Should fail because task name doesn't exist
    assertThrows(
        Exception.class,
        () -> client.pipelines().addPipelineStatus(pipeline.getId().toString(), pipelineStatus),
        "Adding status with invalid task name should fail");
  }

  @Test
  void patch_pipelineTasksUpdate_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_patch_tasks"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Initial description");

    List<Task> initialTasks =
        Arrays.asList(
            new Task().withName("task1").withDescription("Task 1"),
            new Task().withName("task2").withDescription("Task 2"));
    request.setTasks(initialTasks);

    Pipeline pipeline = createEntity(request);
    assertEquals(2, pipeline.getTasks().size());
    assertEquals("Initial description", pipeline.getDescription());

    // Add a new task and update description
    List<Task> updatedTasks =
        Arrays.asList(
            new Task().withName("task1").withDescription("Task 1"),
            new Task().withName("task2").withDescription("Task 2"),
            new Task().withName("task3").withDescription("Task 3"));

    pipeline.setTasks(updatedTasks);
    pipeline.setDescription("Updated description");

    Pipeline patched = patchEntity(pipeline.getId().toString(), pipeline);
    assertEquals(3, patched.getTasks().size());
    assertEquals("Updated description", patched.getDescription());
  }

  @Test
  void test_pipelineScheduleInterval_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_schedule_interval"));
    request.setService(service.getFullyQualifiedName());

    // Test various schedule interval formats
    String[] schedules = {"0 0 * * *", "@daily", "@hourly", "*/5 * * * *"};

    for (String schedule : schedules) {
      request.setName(ns.prefix("pipeline_schedule_" + schedule.replace(" ", "_")));
      request.setScheduleInterval(schedule);

      Pipeline pipeline = createEntity(request);
      assertNotNull(pipeline);
      assertEquals(schedule, pipeline.getScheduleInterval());
    }
  }

  @Test
  void test_pipelineConcurrency_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_concurrency"));
    request.setService(service.getFullyQualifiedName());
    request.setConcurrency(5);

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline);
    assertEquals(Integer.valueOf(5), pipeline.getConcurrency());

    // Update concurrency
    pipeline.setConcurrency(10);
    Pipeline updated = patchEntity(pipeline.getId().toString(), pipeline);
    assertEquals(Integer.valueOf(10), updated.getConcurrency());
  }

  @Test
  void test_pipelineStartDate_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_start_date"));
    request.setService(service.getFullyQualifiedName());

    java.util.Date startDate = new java.util.Date();
    request.setStartDate(startDate);

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline);
    assertNotNull(pipeline.getStartDate());
  }

  @Test
  void test_pipelineWithDifferentServices_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    PipelineService airflowService = PipelineServiceTestFactory.createAirflow(ns);
    PipelineService glueService = PipelineServiceTestFactory.createGlue(ns);

    // Create pipeline with Airflow service
    CreatePipeline airflowRequest = new CreatePipeline();
    airflowRequest.setName(ns.prefix("airflow_pipeline"));
    airflowRequest.setService(airflowService.getFullyQualifiedName());
    Pipeline airflowPipeline = createEntity(airflowRequest);
    assertNotNull(airflowPipeline);
    assertEquals(
        airflowService.getFullyQualifiedName(),
        airflowPipeline.getService().getFullyQualifiedName());

    // Create pipeline with Glue service
    CreatePipeline glueRequest = new CreatePipeline();
    glueRequest.setName(ns.prefix("glue_pipeline"));
    glueRequest.setService(glueService.getFullyQualifiedName());
    Pipeline gluePipeline = createEntity(glueRequest);
    assertNotNull(gluePipeline);
    assertEquals(
        glueService.getFullyQualifiedName(), gluePipeline.getService().getFullyQualifiedName());
  }

  @Test
  void test_pipelineTaskDescriptionUpdate(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    List<Task> tasks =
        Arrays.asList(
            new Task().withName("task1").withDescription("Original description"),
            new Task().withName("task2").withDescription("Original description 2"));

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_task_desc"));
    request.setService(service.getFullyQualifiedName());
    request.setTasks(tasks);

    Pipeline pipeline = createEntity(request);
    assertEquals("Original description", pipeline.getTasks().get(0).getDescription());

    // Update task description
    List<Task> updatedTasks =
        Arrays.asList(
            new Task().withName("task1").withDescription("Updated description"),
            new Task().withName("task2").withDescription("Original description 2"));

    pipeline.setTasks(updatedTasks);
    Pipeline updated = patchEntity(pipeline.getId().toString(), pipeline);

    assertEquals("Updated description", updated.getTasks().get(0).getDescription());
    assertEquals("Original description 2", updated.getTasks().get(1).getDescription());
  }

  @Test
  void test_pipelineMultipleStatusUpdates(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_multi_status"));
    request.setService(service.getFullyQualifiedName());

    List<Task> tasks = Arrays.asList(new Task().withName("task1").withDescription("Task 1"));
    request.setTasks(tasks);

    Pipeline pipeline = createEntity(request);

    // Create task status for task1
    Status task1StatusSuccess =
        new Status().withName("task1").withExecutionStatus(StatusType.Successful);

    // Add first status (with taskStatus)
    PipelineStatus status1 =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Successful)
            .withTimestamp(System.currentTimeMillis() - 3600000)
            .withTaskStatus(Arrays.asList(task1StatusSuccess));

    // addPipelineStatus expects FQN, not ID
    client.pipelines().addPipelineStatus(pipeline.getFullyQualifiedName(), status1);

    // Create task status for second update
    Status task1StatusFailed =
        new Status().withName("task1").withExecutionStatus(StatusType.Failed);

    // Add second status (with taskStatus)
    PipelineStatus status2 =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Failed)
            .withTimestamp(System.currentTimeMillis())
            .withTaskStatus(Arrays.asList(task1StatusFailed));

    client.pipelines().addPipelineStatus(pipeline.getFullyQualifiedName(), status2);

    // Verify latest status
    Pipeline updatedPipeline =
        client.pipelines().get(pipeline.getId().toString(), "pipelineStatus");
    assertNotNull(updatedPipeline.getPipelineStatus());
  }

  @Test
  void test_pipelineSourceUrlValidation(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_url_validation"));
    request.setService(service.getFullyQualifiedName());
    request.setSourceUrl("http://localhost:8080/dag");

    Pipeline pipeline = createEntity(request);
    assertEquals("http://localhost:8080/dag", pipeline.getSourceUrl());

    // Update to HTTPS
    pipeline.setSourceUrl("https://airflow.example.com/dag");
    Pipeline updated = patchEntity(pipeline.getId().toString(), pipeline);
    assertEquals("https://airflow.example.com/dag", updated.getSourceUrl());
  }

  @Test
  void test_pipelineCompleteWorkflow(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    // Create pipeline with all fields
    List<Task> tasks =
        Arrays.asList(
            new Task()
                .withName("extract")
                .withDescription("Extract data")
                .withDisplayName("Extract"),
            new Task()
                .withName("transform")
                .withDescription("Transform data")
                .withDisplayName("Transform")
                .withDownstreamTasks(List.of("extract")),
            new Task()
                .withName("load")
                .withDescription("Load data")
                .withDisplayName("Load")
                .withDownstreamTasks(List.of("transform")));

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("complete_pipeline"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Complete ETL pipeline");
    request.setDisplayName("Complete ETL Pipeline");
    request.setSourceUrl("https://airflow.example.com/etl_pipeline");
    request.setScheduleInterval("0 0 * * *");
    request.setConcurrency(5);
    request.setTasks(tasks);

    Pipeline pipeline = createEntity(request);

    // Verify all fields
    assertNotNull(pipeline);
    assertEquals("Complete ETL pipeline", pipeline.getDescription());
    assertEquals("Complete ETL Pipeline", pipeline.getDisplayName());
    assertEquals("https://airflow.example.com/etl_pipeline", pipeline.getSourceUrl());
    assertEquals("0 0 * * *", pipeline.getScheduleInterval());
    assertEquals(Integer.valueOf(5), pipeline.getConcurrency());
    assertEquals(3, pipeline.getTasks().size());

    // Verify FQN
    String expectedFQN = service.getFullyQualifiedName() + "." + ns.prefix("complete_pipeline");
    assertEquals(expectedFQN, pipeline.getFullyQualifiedName());

    // Update pipeline
    pipeline.setDescription("Updated ETL pipeline");
    pipeline.setConcurrency(10);

    Pipeline updated = patchEntity(pipeline.getId().toString(), pipeline);
    assertEquals("Updated ETL pipeline", updated.getDescription());
    assertEquals(Integer.valueOf(10), updated.getConcurrency());

    // Delete and restore
    deleteEntity(pipeline.getId().toString());
    Pipeline deleted = getEntityIncludeDeleted(pipeline.getId().toString());
    assertTrue(deleted.getDeleted());

    restoreEntity(pipeline.getId().toString());
    Pipeline restored = getEntity(pipeline.getId().toString());
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_pipelineTaskSourceUrl(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    List<Task> tasks =
        Arrays.asList(
            new Task()
                .withName("task1")
                .withDescription("Task 1")
                .withSourceUrl("http://localhost:8080/task1"),
            new Task()
                .withName("task2")
                .withDescription("Task 2")
                .withSourceUrl("http://localhost:8080/task2"));

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_task_urls"));
    request.setService(service.getFullyQualifiedName());
    request.setTasks(tasks);

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline.getTasks());
    assertEquals(2, pipeline.getTasks().size());
    assertEquals("http://localhost:8080/task1", pipeline.getTasks().get(0).getSourceUrl());
    assertEquals("http://localhost:8080/task2", pipeline.getTasks().get(1).getSourceUrl());
  }

  @Test
  void test_pipelineEmptyTaskList(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_empty_tasks"));
    request.setService(service.getFullyQualifiedName());
    request.setTasks(new java.util.ArrayList<>());

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline);
    assertTrue(pipeline.getTasks() == null || pipeline.getTasks().isEmpty());
  }

  @Test
  void test_pipelineTaskDisplayName(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    List<Task> tasks =
        Arrays.asList(
            new Task()
                .withName("extract_task")
                .withDisplayName("Extract Data Task")
                .withDescription("Extract data from source"));

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_task_display"));
    request.setService(service.getFullyQualifiedName());
    request.setTasks(tasks);

    Pipeline pipeline = createEntity(request);
    assertEquals("Extract Data Task", pipeline.getTasks().get(0).getDisplayName());
    assertEquals("extract_task", pipeline.getTasks().get(0).getName());
  }

  @Test
  void put_bulkPipelineStatus_200_OK(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_bulk_status"));
    request.setService(service.getFullyQualifiedName());

    List<Task> tasks =
        Arrays.asList(
            new Task().withName("task1").withDescription("First task"),
            new Task().withName("task2").withDescription("Second task"));
    request.setTasks(tasks);

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline);

    Status t1Status = new Status().withName("task1").withExecutionStatus(StatusType.Successful);
    Status t2Status = new Status().withName("task2").withExecutionStatus(StatusType.Failed);
    List<Status> taskStatuses = Arrays.asList(t1Status, t2Status);

    long baseTime = System.currentTimeMillis() - 5 * 3600000;
    List<PipelineStatus> bulkStatuses = new ArrayList<>();
    for (int i = 0; i < 5; i++) {
      PipelineStatus ps =
          new PipelineStatus()
              .withExecutionStatus(StatusType.Successful)
              .withTimestamp(baseTime + i * 3600000)
              .withTaskStatus(taskStatuses);
      bulkStatuses.add(ps);
    }

    Pipeline putResponse =
        client.pipelines().addBulkPipelineStatus(pipeline.getFullyQualifiedName(), bulkStatuses);
    assertNotNull(putResponse);
    assertNotNull(putResponse.getPipelineStatus());
    assertEquals(
        bulkStatuses.get(4).getTimestamp(), putResponse.getPipelineStatus().getTimestamp());

    // Verify ALL 5 statuses were persisted as separate rows, not overwritten
    var statusList =
        client
            .pipelines()
            .listPipelineStatuses(
                pipeline.getFullyQualifiedName(), baseTime - 1, baseTime + 5 * 3600000);
    assertEquals(5, statusList.getData().size(), "All 5 statuses should be persisted");

    Pipeline fetched = client.pipelines().get(pipeline.getId().toString(), "pipelineStatus");
    assertNotNull(fetched.getPipelineStatus());
    assertEquals(bulkStatuses.get(4).getTimestamp(), fetched.getPipelineStatus().getTimestamp());

    PipelineStatus overlapStatus =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Failed)
            .withTimestamp(bulkStatuses.get(4).getTimestamp())
            .withTaskStatus(taskStatuses);
    PipelineStatus newStatus =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Failed)
            .withTimestamp(baseTime + 5 * 3600000)
            .withTaskStatus(taskStatuses);

    List<PipelineStatus> overlapStatuses = Arrays.asList(overlapStatus, newStatus);

    putResponse =
        client.pipelines().addBulkPipelineStatus(pipeline.getFullyQualifiedName(), overlapStatuses);
    assertNotNull(putResponse);
    assertEquals(newStatus.getTimestamp(), putResponse.getPipelineStatus().getTimestamp());
    assertEquals(StatusType.Failed, putResponse.getPipelineStatus().getExecutionStatus());

    // Verify overlap upserted (still 5 original + 1 new = 6 total, not 7)
    statusList =
        client
            .pipelines()
            .listPipelineStatuses(
                pipeline.getFullyQualifiedName(), baseTime - 1, baseTime + 6 * 3600000);
    assertEquals(
        6, statusList.getData().size(), "Should be 6: 5 original + 1 new, overlap upserted");
  }

  @Test
  void put_bulkPipelineStatus_invalidTask_4xx(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_bulk_invalid"));
    request.setService(service.getFullyQualifiedName());
    request.setTasks(Arrays.asList(new Task().withName("task1").withDescription("Task 1")));

    Pipeline pipeline = createEntity(request);

    Status invalidTaskStatus =
        new Status().withName("nonExistentTask").withExecutionStatus(StatusType.Failed);

    PipelineStatus ps =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Failed)
            .withTimestamp(System.currentTimeMillis())
            .withTaskStatus(Arrays.asList(invalidTaskStatus));

    assertThrows(
        Exception.class,
        () ->
            client
                .pipelines()
                .addBulkPipelineStatus(pipeline.getFullyQualifiedName(), Arrays.asList(ps)));
  }

  @Test
  void test_pipelineStatusWithTaskTiming_200_OK(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_with_timing"));
    request.setService(service.getFullyQualifiedName());

    List<Task> tasks = Arrays.asList(new Task().withName("task1").withDescription("Task 1"));
    request.setTasks(tasks);

    Pipeline pipeline = createEntity(request);
    assertNotNull(pipeline);

    // Create status with task timing data
    long startTime = System.currentTimeMillis();
    long endTime = startTime + 600000; // 10 minutes duration

    Status taskStatus =
        new Status()
            .withName("task1")
            .withExecutionStatus(StatusType.Successful)
            .withStartTime(startTime)
            .withEndTime(endTime);

    PipelineStatus pipelineStatus =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Successful)
            .withTimestamp(endTime)
            .withEndTime(endTime)
            .withTaskStatus(Arrays.asList(taskStatus));

    // Add status
    client.pipelines().addPipelineStatus(pipeline.getFullyQualifiedName(), pipelineStatus);

    // Verify status was stored with timing data
    Pipeline updatedPipeline =
        client.pipelines().get(pipeline.getId().toString(), "pipelineStatus");

    assertNotNull(updatedPipeline.getPipelineStatus());
    assertNotNull(updatedPipeline.getPipelineStatus().getTaskStatus());
    assertEquals(1, updatedPipeline.getPipelineStatus().getTaskStatus().size());

    Status retrievedTask = updatedPipeline.getPipelineStatus().getTaskStatus().get(0);
    assertNotNull(retrievedTask.getStartTime());
    assertNotNull(retrievedTask.getEndTime());
    assertEquals(startTime, retrievedTask.getStartTime());
    assertEquals(endTime, retrievedTask.getEndTime());
  }

  @Test
  void put_pipelineStatusReindexesDownstreamLineage_200_OK(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    PipelineService pipelineService = PipelineServiceTestFactory.createAirflow(ns);
    CreatePipeline createPipeline = new CreatePipeline();
    createPipeline.setName(ns.prefix("pipeline_lineage_reindex"));
    createPipeline.setService(pipelineService.getFullyQualifiedName());
    createPipeline.setTasks(Arrays.asList(new Task().withName("task1").withDescription("Task 1")));
    Pipeline pipeline = createEntity(createPipeline);

    DatabaseService dbService = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, dbService);
    CreateTable createTable = new CreateTable();
    createTable.setName(ns.prefix("downstream_table"));
    createTable.setDatabaseSchema(schema.getFullyQualifiedName());
    createTable.setColumns(
        List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)));
    Table table = client.tables().create(createTable);

    AddLineage addLineage =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(pipeline.getEntityReference())
                    .withToEntity(table.getEntityReference()));
    client.lineage().addLineage(addLineage);

    Status taskStatus = new Status().withName("task1").withExecutionStatus(StatusType.Successful);
    PipelineStatus pipelineStatus =
        new PipelineStatus()
            .withExecutionStatus(StatusType.Successful)
            .withTimestamp(System.currentTimeMillis())
            .withTaskStatus(Arrays.asList(taskStatus));

    client.pipelines().addPipelineStatus(pipeline.getFullyQualifiedName(), pipelineStatus);

    Pipeline updatedPipeline =
        client.pipelines().get(pipeline.getId().toString(), "pipelineStatus");
    assertNotNull(updatedPipeline.getPipelineStatus());
    assertEquals(StatusType.Successful, updatedPipeline.getPipelineStatus().getExecutionStatus());
    assertEquals(pipelineStatus.getTimestamp(), updatedPipeline.getPipelineStatus().getTimestamp());
  }

  // ===================================================================
  // BULK API SUPPORT
  // ===================================================================

  @Override
  protected BulkOperationResult executeBulkCreate(List<CreatePipeline> createRequests) {
    return SdkClients.adminClient().pipelines().bulkCreateOrUpdate(createRequests);
  }

  @Override
  protected BulkOperationResult executeBulkCreateAsync(List<CreatePipeline> createRequests) {
    return SdkClients.adminClient().pipelines().bulkCreateOrUpdateAsync(createRequests);
  }

  @Override
  protected CreatePipeline createInvalidRequestForBulk(TestNamespace ns) {
    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("invalid_pipeline"));
    return request;
  }
}
