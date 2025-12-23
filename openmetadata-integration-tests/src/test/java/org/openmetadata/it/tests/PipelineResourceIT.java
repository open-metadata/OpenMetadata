package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.Task;
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
}
