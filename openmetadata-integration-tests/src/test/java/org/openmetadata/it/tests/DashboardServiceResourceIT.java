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
import org.openmetadata.schema.api.data.CreateDashboardDataModel.DashboardServiceType;
import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.services.connections.dashboard.LookerConnection;
import org.openmetadata.schema.services.connections.dashboard.MetabaseConnection;
import org.openmetadata.schema.services.connections.dashboard.SupersetConnection;
import org.openmetadata.schema.type.DashboardConnection;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for DashboardService entity operations.
 *
 * <p>Extends BaseServiceIT to inherit common service tests.
 */
@Execution(ExecutionMode.CONCURRENT)
public class DashboardServiceResourceIT
    extends BaseServiceIT<DashboardService, CreateDashboardService> {

  @Override
  protected CreateDashboardService createMinimalRequest(TestNamespace ns) {
    MetabaseConnection conn =
        new MetabaseConnection()
            .withHostPort(URI.create("http://localhost:3000"))
            .withUsername("test");

    return new CreateDashboardService()
        .withName(ns.prefix("dashboardservice"))
        .withServiceType(DashboardServiceType.Metabase)
        .withConnection(new DashboardConnection().withConfig(conn))
        .withDescription("Test dashboard service");
  }

  @Override
  protected CreateDashboardService createRequest(String name, TestNamespace ns) {
    MetabaseConnection conn =
        new MetabaseConnection()
            .withHostPort(URI.create("http://localhost:3000"))
            .withUsername("test");

    return new CreateDashboardService()
        .withName(name)
        .withServiceType(DashboardServiceType.Metabase)
        .withConnection(new DashboardConnection().withConfig(conn));
  }

  @Override
  protected DashboardService createEntity(CreateDashboardService createRequest) {
    return SdkClients.adminClient().dashboardServices().create(createRequest);
  }

  @Override
  protected DashboardService getEntity(String id) {
    return SdkClients.adminClient().dashboardServices().get(id);
  }

  @Override
  protected DashboardService getEntityByName(String fqn) {
    return SdkClients.adminClient().dashboardServices().getByName(fqn);
  }

  @Override
  protected DashboardService patchEntity(String id, DashboardService entity) {
    return SdkClients.adminClient().dashboardServices().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().dashboardServices().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().dashboardServices().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    SdkClients.adminClient().dashboardServices().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "dashboardService";
  }

  @Override
  protected void validateCreatedEntity(
      DashboardService entity, CreateDashboardService createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertEquals(createRequest.getServiceType(), entity.getServiceType());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected ListResponse<DashboardService> listEntities(ListParams params) {
    return SdkClients.adminClient().dashboardServices().list(params);
  }

  @Override
  protected DashboardService getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().dashboardServices().get(id, fields);
  }

  @Override
  protected DashboardService getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().dashboardServices().getByName(fqn, fields);
  }

  @Override
  protected DashboardService getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().dashboardServices().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().dashboardServices().getVersionList(id);
  }

  @Override
  protected DashboardService getVersion(UUID id, Double version) {
    return SdkClients.adminClient().dashboardServices().getVersion(id.toString(), version);
  }

  // ===================================================================
  // DASHBOARD SERVICE-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_dashboardServiceWithMetabaseConnection_200_OK(TestNamespace ns) {
    MetabaseConnection conn =
        new MetabaseConnection()
            .withHostPort(URI.create("http://localhost:3000"))
            .withUsername("test_user");

    CreateDashboardService request =
        new CreateDashboardService()
            .withName(ns.prefix("metabase_service"))
            .withServiceType(DashboardServiceType.Metabase)
            .withConnection(new DashboardConnection().withConfig(conn))
            .withDescription("Test Metabase service");

    DashboardService service = createEntity(request);
    assertNotNull(service);
    assertEquals(DashboardServiceType.Metabase, service.getServiceType());
  }

  @Test
  void post_dashboardServiceWithLookerConnection_200_OK(TestNamespace ns) {
    LookerConnection conn =
        new LookerConnection()
            .withHostPort(URI.create("http://localhost:9999"))
            .withClientId("test_client");

    CreateDashboardService request =
        new CreateDashboardService()
            .withName(ns.prefix("looker_service"))
            .withServiceType(DashboardServiceType.Looker)
            .withConnection(new DashboardConnection().withConfig(conn))
            .withDescription("Test Looker service");

    DashboardService service = createEntity(request);
    assertNotNull(service);
    assertEquals(DashboardServiceType.Looker, service.getServiceType());
  }

  @Test
  void post_dashboardServiceWithSupersetConnection_200_OK(TestNamespace ns) {
    SupersetConnection conn =
        new SupersetConnection().withHostPort(URI.create("http://localhost:8088"));

    CreateDashboardService request =
        new CreateDashboardService()
            .withName(ns.prefix("superset_service"))
            .withServiceType(DashboardServiceType.Superset)
            .withConnection(new DashboardConnection().withConfig(conn))
            .withDescription("Test Superset service");

    DashboardService service = createEntity(request);
    assertNotNull(service);
    assertEquals(DashboardServiceType.Superset, service.getServiceType());
  }

  @Test
  void put_dashboardServiceDescription_200_OK(TestNamespace ns) {
    CreateDashboardService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_update_desc"));
    request.setDescription("Initial description");

    DashboardService service = createEntity(request);
    assertEquals("Initial description", service.getDescription());

    service.setDescription("Updated description");
    DashboardService updated = patchEntity(service.getId().toString(), service);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_dashboardServiceVersionHistory(TestNamespace ns) {
    CreateDashboardService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_version"));
    request.setDescription("Initial description");

    DashboardService service = createEntity(request);
    Double initialVersion = service.getVersion();

    service.setDescription("Updated description");
    DashboardService updated = patchEntity(service.getId().toString(), service);
    assertTrue(updated.getVersion() > initialVersion);

    EntityHistory history = getVersionHistory(service.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_dashboardServiceSoftDeleteRestore(TestNamespace ns) {
    CreateDashboardService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_delete"));

    DashboardService service = createEntity(request);
    assertNotNull(service.getId());

    deleteEntity(service.getId().toString());

    DashboardService deleted = getEntityIncludeDeleted(service.getId().toString());
    assertTrue(deleted.getDeleted());

    restoreEntity(service.getId().toString());

    DashboardService restored = getEntity(service.getId().toString());
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_dashboardServiceNameUniqueness(TestNamespace ns) {
    String serviceName = ns.prefix("unique_service");
    CreateDashboardService request1 = createMinimalRequest(ns);
    request1.setName(serviceName);

    DashboardService service1 = createEntity(request1);
    assertNotNull(service1);

    CreateDashboardService request2 = createMinimalRequest(ns);
    request2.setName(serviceName);

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate dashboard service should fail");
  }

  @Test
  void test_listDashboardServices(TestNamespace ns) {
    for (int i = 0; i < 3; i++) {
      CreateDashboardService request = createMinimalRequest(ns);
      request.setName(ns.prefix("list_service_" + i));
      createEntity(request);
    }

    ListParams params = new ListParams();
    params.setLimit(10);
    ListResponse<DashboardService> response = listEntities(params);
    assertNotNull(response);
    assertTrue(response.getData().size() >= 3);
  }
}
