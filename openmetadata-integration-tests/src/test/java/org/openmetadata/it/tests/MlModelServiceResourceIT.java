package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.schema.api.services.CreateMlModelService.MlModelServiceType;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.services.connections.mlmodel.MlflowConnection;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.MlModelConnection;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.service.resources.services.mlmodel.MlModelServiceResource;

/**
 * Integration tests for MlModelService entity operations.
 *
 * <p>Extends BaseServiceIT to inherit common service tests.
 */
@Execution(ExecutionMode.CONCURRENT)
public class MlModelServiceResourceIT extends BaseServiceIT<MlModelService, CreateMlModelService> {

  {
    supportsListHistoryByTimestamp = true;
  }

  @Override
  protected String getResourcePath() {
    return MlModelServiceResource.COLLECTION_PATH;
  }

  @Override
  protected CreateMlModelService createMinimalRequest(TestNamespace ns) {
    MlflowConnection conn =
        new MlflowConnection()
            .withTrackingUri("http://localhost:5000")
            .withRegistryUri("http://localhost:5000");

    return new CreateMlModelService()
        .withName(ns.prefix("mlmodelservice"))
        .withServiceType(MlModelServiceType.Mlflow)
        .withConnection(new MlModelConnection().withConfig(conn))
        .withDescription("Test ML model service");
  }

  @Override
  protected CreateMlModelService createRequest(String name, TestNamespace ns) {
    MlflowConnection conn =
        new MlflowConnection()
            .withTrackingUri("http://localhost:5000")
            .withRegistryUri("http://localhost:5000");

    return new CreateMlModelService()
        .withName(name)
        .withServiceType(MlModelServiceType.Mlflow)
        .withConnection(new MlModelConnection().withConfig(conn));
  }

  @Override
  protected MlModelService createEntity(CreateMlModelService createRequest) {
    return SdkClients.adminClient().mlModelServices().create(createRequest);
  }

  @Override
  protected MlModelService getEntity(String id) {
    return SdkClients.adminClient().mlModelServices().get(id);
  }

  @Override
  protected MlModelService getEntityByName(String fqn) {
    return SdkClients.adminClient().mlModelServices().getByName(fqn);
  }

  @Override
  protected MlModelService patchEntity(String id, MlModelService entity) {
    return SdkClients.adminClient().mlModelServices().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().mlModelServices().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().mlModelServices().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    SdkClients.adminClient().mlModelServices().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "mlModelService";
  }

  @Override
  protected void validateCreatedEntity(MlModelService entity, CreateMlModelService createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertEquals(createRequest.getServiceType(), entity.getServiceType());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected ListResponse<MlModelService> listEntities(ListParams params) {
    return SdkClients.adminClient().mlModelServices().list(params);
  }

  @Override
  protected MlModelService getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().mlModelServices().get(id, fields);
  }

  @Override
  protected MlModelService getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().mlModelServices().getByName(fqn, fields);
  }

  @Override
  protected MlModelService getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().mlModelServices().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().mlModelServices().getVersionList(id);
  }

  @Override
  protected MlModelService getVersion(UUID id, Double version) {
    return SdkClients.adminClient().mlModelServices().getVersion(id.toString(), version);
  }

  // ===================================================================
  // ML MODEL SERVICE-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_mlModelServiceWithMlflowConnection_200_OK(TestNamespace ns) {
    MlflowConnection conn =
        new MlflowConnection()
            .withTrackingUri("http://localhost:5000")
            .withRegistryUri("http://localhost:5000");

    CreateMlModelService request =
        new CreateMlModelService()
            .withName(ns.prefix("mlflow_service"))
            .withServiceType(MlModelServiceType.Mlflow)
            .withConnection(new MlModelConnection().withConfig(conn))
            .withDescription("Test MLflow service");

    MlModelService service = createEntity(request);
    assertNotNull(service);
    assertEquals(MlModelServiceType.Mlflow, service.getServiceType());
  }

  @Test
  void put_mlModelServiceDescription_200_OK(TestNamespace ns) {
    CreateMlModelService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_update_desc"));
    request.setDescription("Initial description");

    MlModelService service = createEntity(request);
    assertEquals("Initial description", service.getDescription());

    service.setDescription("Updated description");
    MlModelService updated = patchEntity(service.getId().toString(), service);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_mlModelServiceVersionHistory(TestNamespace ns) {
    CreateMlModelService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_version"));
    request.setDescription("Initial description");

    MlModelService service = createEntity(request);
    Double initialVersion = service.getVersion();

    service.setDescription("Updated description");
    MlModelService updated = patchEntity(service.getId().toString(), service);
    assertTrue(updated.getVersion() > initialVersion);

    EntityHistory history = getVersionHistory(service.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_mlModelServiceSoftDeleteRestore(TestNamespace ns) {
    CreateMlModelService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_delete"));

    MlModelService service = createEntity(request);
    assertNotNull(service.getId());

    deleteEntity(service.getId().toString());

    MlModelService deleted = getEntityIncludeDeleted(service.getId().toString());
    assertTrue(deleted.getDeleted());

    restoreEntity(service.getId().toString());

    MlModelService restored = getEntity(service.getId().toString());
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_mlModelServiceNameUniqueness(TestNamespace ns) {
    String serviceName = ns.prefix("unique_service");
    CreateMlModelService request1 = createMinimalRequest(ns);
    request1.setName(serviceName);

    MlModelService service1 = createEntity(request1);
    assertNotNull(service1);

    CreateMlModelService request2 = createMinimalRequest(ns);
    request2.setName(serviceName);

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate ML model service should fail");
  }

  @Test
  void test_listMlModelServices(TestNamespace ns) {
    for (int i = 0; i < 3; i++) {
      CreateMlModelService request = createMinimalRequest(ns);
      request.setName(ns.prefix("list_service_" + i));
      createEntity(request);
    }

    ListParams params = new ListParams();
    params.setLimit(10);
    ListResponse<MlModelService> response = listEntities(params);
    assertNotNull(response);
    assertTrue(response.getData().size() >= 3);
  }
}
