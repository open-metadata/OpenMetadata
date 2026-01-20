package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreatePipelineService;
import org.openmetadata.schema.api.services.CreatePipelineService.PipelineServiceType;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.services.connections.pipeline.AirflowConnection;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.PipelineConnection;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for PipelineService entity operations.
 *
 * <p>Extends BaseServiceIT to inherit common service tests.
 */
@Execution(ExecutionMode.CONCURRENT)
public class PipelineServiceResourceIT
    extends BaseServiceIT<PipelineService, CreatePipelineService> {

  {
    supportsListHistoryByTimestamp = true;
  }

  @Override
  protected CreatePipelineService createMinimalRequest(TestNamespace ns) {
    AirflowConnection conn =
        new AirflowConnection().withHostPort(URI.create("http://localhost:8080"));

    return new CreatePipelineService()
        .withName(ns.prefix("pipelineservice"))
        .withServiceType(PipelineServiceType.Airflow)
        .withConnection(new PipelineConnection().withConfig(conn))
        .withDescription("Test pipeline service");
  }

  @Override
  protected CreatePipelineService createRequest(String name, TestNamespace ns) {
    AirflowConnection conn =
        new AirflowConnection().withHostPort(URI.create("http://localhost:8080"));

    return new CreatePipelineService()
        .withName(name)
        .withServiceType(PipelineServiceType.Airflow)
        .withConnection(new PipelineConnection().withConfig(conn));
  }

  @Override
  protected PipelineService createEntity(CreatePipelineService createRequest) {
    return SdkClients.adminClient().pipelineServices().create(createRequest);
  }

  @Override
  protected PipelineService getEntity(String id) {
    return SdkClients.adminClient().pipelineServices().get(id);
  }

  @Override
  protected PipelineService getEntityByName(String fqn) {
    return SdkClients.adminClient().pipelineServices().getByName(fqn);
  }

  @Override
  protected PipelineService patchEntity(String id, PipelineService entity) {
    return SdkClients.adminClient().pipelineServices().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().pipelineServices().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().pipelineServices().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    SdkClients.adminClient().pipelineServices().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "pipelineService";
  }

  @Override
  protected void validateCreatedEntity(
      PipelineService entity, CreatePipelineService createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertEquals(createRequest.getServiceType(), entity.getServiceType());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected ListResponse<PipelineService> listEntities(ListParams params) {
    return SdkClients.adminClient().pipelineServices().list(params);
  }

  @Override
  protected PipelineService getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().pipelineServices().get(id, fields);
  }

  @Override
  protected PipelineService getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().pipelineServices().getByName(fqn, fields);
  }

  @Override
  protected PipelineService getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().pipelineServices().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().pipelineServices().getVersionList(id);
  }

  @Override
  protected PipelineService getVersion(UUID id, Double version) {
    return SdkClients.adminClient().pipelineServices().getVersion(id.toString(), version);
  }

  // ===================================================================
  // PIPELINE SERVICE-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_pipelineServiceWithAirflowConnection_200_OK(TestNamespace ns) {
    AirflowConnection conn =
        new AirflowConnection().withHostPort(URI.create("http://localhost:8080"));

    CreatePipelineService request =
        new CreatePipelineService()
            .withName(ns.prefix("airflow_service"))
            .withServiceType(PipelineServiceType.Airflow)
            .withConnection(new PipelineConnection().withConfig(conn))
            .withDescription("Test Airflow service");

    PipelineService service = createEntity(request);
    assertNotNull(service);
    assertEquals(PipelineServiceType.Airflow, service.getServiceType());
  }

  @Test
  void put_pipelineServiceDescription_200_OK(TestNamespace ns) {
    CreatePipelineService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_update_desc"));
    request.setDescription("Initial description");

    PipelineService service = createEntity(request);
    assertEquals("Initial description", service.getDescription());

    service.setDescription("Updated description");
    PipelineService updated = patchEntity(service.getId().toString(), service);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_pipelineServiceVersionHistory(TestNamespace ns) {
    CreatePipelineService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_version"));
    request.setDescription("Initial description");

    PipelineService service = createEntity(request);
    Double initialVersion = service.getVersion();

    service.setDescription("Updated description");
    PipelineService updated = patchEntity(service.getId().toString(), service);
    assertTrue(updated.getVersion() > initialVersion);

    EntityHistory history = getVersionHistory(service.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_pipelineServiceSoftDeleteRestore(TestNamespace ns) {
    CreatePipelineService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_delete"));

    PipelineService service = createEntity(request);
    assertNotNull(service.getId());

    deleteEntity(service.getId().toString());

    PipelineService deleted = getEntityIncludeDeleted(service.getId().toString());
    assertTrue(deleted.getDeleted());

    restoreEntity(service.getId().toString());

    PipelineService restored = getEntity(service.getId().toString());
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_pipelineServiceNameUniqueness(TestNamespace ns) {
    String serviceName = ns.prefix("unique_service");
    CreatePipelineService request1 = createMinimalRequest(ns);
    request1.setName(serviceName);

    PipelineService service1 = createEntity(request1);
    assertNotNull(service1);

    CreatePipelineService request2 = createMinimalRequest(ns);
    request2.setName(serviceName);

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate pipeline service should fail");
  }

  @Test
  void test_listPipelineServices(TestNamespace ns) {
    for (int i = 0; i < 3; i++) {
      CreatePipelineService request = createMinimalRequest(ns);
      request.setName(ns.prefix("list_service_" + i));
      createEntity(request);
    }

    ListParams params = new ListParams().setLimit(10);
    ListResponse<PipelineService> response = listEntities(params);
    assertNotNull(response);
    assertTrue(response.getData().size() >= 3);
  }
}
