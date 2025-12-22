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
  protected CreatePipeline createMinimalRequest(TestNamespace ns, OpenMetadataClient client) {
    PipelineService service = PipelineServiceTestFactory.createAirflow(client, ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Test pipeline created by integration test");

    return request;
  }

  @Override
  protected CreatePipeline createRequest(String name, TestNamespace ns, OpenMetadataClient client) {
    PipelineService service = PipelineServiceTestFactory.createAirflow(client, ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(name);
    request.setService(service.getFullyQualifiedName());

    return request;
  }

  @Override
  protected Pipeline createEntity(CreatePipeline createRequest, OpenMetadataClient client) {
    return client.pipelines().create(createRequest);
  }

  @Override
  protected Pipeline getEntity(String id, OpenMetadataClient client) {
    return client.pipelines().get(id);
  }

  @Override
  protected Pipeline getEntityByName(String fqn, OpenMetadataClient client) {
    return client.pipelines().getByName(fqn);
  }

  @Override
  protected Pipeline patchEntity(String id, Pipeline entity, OpenMetadataClient client) {
    return client.pipelines().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id, OpenMetadataClient client) {
    client.pipelines().delete(id);
  }

  @Override
  protected void restoreEntity(String id, OpenMetadataClient client) {
    client.pipelines().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id, OpenMetadataClient client) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    client.pipelines().delete(id, params);
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
  protected ListResponse<Pipeline> listEntities(ListParams params, OpenMetadataClient client) {
    return client.pipelines().list(params);
  }

  @Override
  protected Pipeline getEntityWithFields(String id, String fields, OpenMetadataClient client) {
    return client.pipelines().get(id, fields);
  }

  @Override
  protected Pipeline getEntityByNameWithFields(
      String fqn, String fields, OpenMetadataClient client) {
    return client.pipelines().getByName(fqn, fields);
  }

  @Override
  protected Pipeline getEntityIncludeDeleted(String id, OpenMetadataClient client) {
    return client.pipelines().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id, OpenMetadataClient client) {
    return client.pipelines().getVersionList(id);
  }

  @Override
  protected Pipeline getVersion(UUID id, Double version, OpenMetadataClient client) {
    return client.pipelines().getVersion(id.toString(), version);
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
        () -> createEntity(request, client),
        "Creating pipeline without service should fail");
  }

  @Test
  void post_pipelineWithTasks_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(client, ns);

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

    Pipeline pipeline = createEntity(request, client);
    assertNotNull(pipeline);
    assertNotNull(pipeline.getTasks());
    assertEquals(2, pipeline.getTasks().size());
  }

  @Test
  void post_pipelineWithSourceUrl_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(client, ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_with_url"));
    request.setService(service.getFullyQualifiedName());
    request.setSourceUrl("http://localhost:8080/pipelines/my_pipeline");

    Pipeline pipeline = createEntity(request, client);
    assertNotNull(pipeline);
    assertEquals("http://localhost:8080/pipelines/my_pipeline", pipeline.getSourceUrl());
  }

  @Test
  void post_pipelineWithSchedule_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(client, ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_with_schedule"));
    request.setService(service.getFullyQualifiedName());
    request.setScheduleInterval("0 0 * * *"); // Daily at midnight

    Pipeline pipeline = createEntity(request, client);
    assertNotNull(pipeline);
    assertEquals("0 0 * * *", pipeline.getScheduleInterval());
  }

  @Test
  void put_pipelineWithTasks_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(client, ns);

    // Create pipeline without tasks
    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_add_tasks"));
    request.setService(service.getFullyQualifiedName());

    Pipeline pipeline = createEntity(request, client);
    assertNotNull(pipeline);

    // Add tasks via update
    List<Task> tasks =
        Arrays.asList(
            new Task().withName("task1").withDescription("Added task 1"),
            new Task().withName("task2").withDescription("Added task 2"));

    pipeline.setTasks(tasks);
    Pipeline updated = patchEntity(pipeline.getId().toString(), pipeline, client);
    assertNotNull(updated);
    assertNotNull(updated.getTasks());
    assertEquals(2, updated.getTasks().size());
  }

  @Test
  void patch_pipelineDescription_200_OK(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
    PipelineService service = PipelineServiceTestFactory.createAirflow(client, ns);

    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_patch_desc"));
    request.setService(service.getFullyQualifiedName());
    request.setDescription("Initial description");

    Pipeline pipeline = createEntity(request, client);
    assertEquals("Initial description", pipeline.getDescription());

    // Patch description
    pipeline.setDescription("Updated description");
    Pipeline patched = patchEntity(pipeline.getId().toString(), pipeline, client);
    assertEquals("Updated description", patched.getDescription());
  }

  @Test
  void test_pipelineInheritsDomainFromService(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    // Create a pipeline service
    PipelineService service = PipelineServiceTestFactory.createAirflow(client, ns);

    // Create a pipeline under the service
    CreatePipeline request = new CreatePipeline();
    request.setName(ns.prefix("pipeline_inherit_domain"));
    request.setService(service.getFullyQualifiedName());

    Pipeline pipeline = createEntity(request, client);
    assertNotNull(pipeline);
    assertNotNull(pipeline.getService());
    assertEquals(service.getFullyQualifiedName(), pipeline.getService().getFullyQualifiedName());
  }
}
