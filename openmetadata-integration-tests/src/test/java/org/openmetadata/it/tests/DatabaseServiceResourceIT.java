package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.PostgresConnection;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * Integration tests for DatabaseService entity operations.
 *
 * <p>Extends BaseServiceIT to inherit common service tests.
 */
@Execution(ExecutionMode.CONCURRENT)
public class DatabaseServiceResourceIT
    extends BaseServiceIT<DatabaseService, CreateDatabaseService> {

  @Override
  protected CreateDatabaseService createMinimalRequest(TestNamespace ns) {
    PostgresConnection conn =
        new PostgresConnection().withHostPort("localhost:5432").withUsername("test");

    return new CreateDatabaseService()
        .withName(ns.prefix("dbservice"))
        .withServiceType(DatabaseServiceType.Postgres)
        .withConnection(new DatabaseConnection().withConfig(conn))
        .withDescription("Test database service");
  }

  @Override
  protected CreateDatabaseService createRequest(String name, TestNamespace ns) {
    PostgresConnection conn =
        new PostgresConnection().withHostPort("localhost:5432").withUsername("test");

    return new CreateDatabaseService()
        .withName(name)
        .withServiceType(DatabaseServiceType.Postgres)
        .withConnection(new DatabaseConnection().withConfig(conn));
  }

  @Override
  protected DatabaseService createEntity(CreateDatabaseService createRequest) {
    return SdkClients.adminClient().databaseServices().create(createRequest);
  }

  @Override
  protected DatabaseService getEntity(String id) {
    return SdkClients.adminClient().databaseServices().get(id);
  }

  @Override
  protected DatabaseService getEntityByName(String fqn) {
    return SdkClients.adminClient().databaseServices().getByName(fqn);
  }

  @Override
  protected DatabaseService patchEntity(String id, DatabaseService entity) {
    return SdkClients.adminClient().databaseServices().update(id, entity);
  }

  @Override
  protected void deleteEntity(String id) {
    SdkClients.adminClient().databaseServices().delete(id);
  }

  @Override
  protected void restoreEntity(String id) {
    SdkClients.adminClient().databaseServices().restore(id);
  }

  @Override
  protected void hardDeleteEntity(String id) {
    java.util.Map<String, String> params = new java.util.HashMap<>();
    params.put("hardDelete", "true");
    params.put("recursive", "true");
    SdkClients.adminClient().databaseServices().delete(id, params);
  }

  @Override
  protected String getEntityType() {
    return "databaseService";
  }

  @Override
  protected void validateCreatedEntity(
      DatabaseService entity, CreateDatabaseService createRequest) {
    assertEquals(createRequest.getName(), entity.getName());
    assertEquals(createRequest.getServiceType(), entity.getServiceType());

    if (createRequest.getDescription() != null) {
      assertEquals(createRequest.getDescription(), entity.getDescription());
    }
  }

  @Override
  protected ListResponse<DatabaseService> listEntities(ListParams params) {
    return SdkClients.adminClient().databaseServices().list(params);
  }

  @Override
  protected DatabaseService getEntityWithFields(String id, String fields) {
    return SdkClients.adminClient().databaseServices().get(id, fields);
  }

  @Override
  protected DatabaseService getEntityByNameWithFields(String fqn, String fields) {
    return SdkClients.adminClient().databaseServices().getByName(fqn, fields);
  }

  @Override
  protected DatabaseService getEntityIncludeDeleted(String id) {
    return SdkClients.adminClient().databaseServices().get(id, null, "deleted");
  }

  @Override
  protected EntityHistory getVersionHistory(UUID id) {
    return SdkClients.adminClient().databaseServices().getVersionList(id);
  }

  @Override
  protected DatabaseService getVersion(UUID id, Double version) {
    return SdkClients.adminClient().databaseServices().getVersion(id.toString(), version);
  }

  // ===================================================================
  // DATABASE SERVICE-SPECIFIC TESTS
  // ===================================================================

  @Test
  void post_databaseServiceWithPostgresConnection_200_OK(TestNamespace ns) {
    PostgresConnection conn =
        new PostgresConnection()
            .withHostPort("localhost:5432")
            .withUsername("test_user")
            .withAuthType(new basicAuth().withPassword("test_password"))
            .withDatabase("test_db");

    CreateDatabaseService request =
        new CreateDatabaseService()
            .withName(ns.prefix("postgres_service"))
            .withServiceType(DatabaseServiceType.Postgres)
            .withConnection(new DatabaseConnection().withConfig(conn))
            .withDescription("Test Postgres service");

    DatabaseService service = createEntity(request);
    assertNotNull(service);
    assertEquals(DatabaseServiceType.Postgres, service.getServiceType());
  }

  @Test
  void post_databaseServiceWithSnowflakeConnection_200_OK(TestNamespace ns) {
    SnowflakeConnection conn =
        new SnowflakeConnection()
            .withAccount("test-account")
            .withUsername("test_user")
            .withWarehouse("test_warehouse");

    CreateDatabaseService request =
        new CreateDatabaseService()
            .withName(ns.prefix("snowflake_service"))
            .withServiceType(DatabaseServiceType.Snowflake)
            .withConnection(new DatabaseConnection().withConfig(conn))
            .withDescription("Test Snowflake service");

    DatabaseService service = createEntity(request);
    assertNotNull(service);
    assertEquals(DatabaseServiceType.Snowflake, service.getServiceType());
  }

  @Test
  void post_databaseServiceWithMysqlConnection_200_OK(TestNamespace ns) {
    MysqlConnection conn =
        new MysqlConnection()
            .withHostPort("localhost:3306")
            .withUsername("test_user")
            .withAuthType(new basicAuth().withPassword("test_password"));

    CreateDatabaseService request =
        new CreateDatabaseService()
            .withName(ns.prefix("mysql_service"))
            .withServiceType(DatabaseServiceType.Mysql)
            .withConnection(new DatabaseConnection().withConfig(conn))
            .withDescription("Test MySQL service");

    DatabaseService service = createEntity(request);
    assertNotNull(service);
    assertEquals(DatabaseServiceType.Mysql, service.getServiceType());
  }

  @Test
  void put_databaseServiceDescription_200_OK(TestNamespace ns) {
    CreateDatabaseService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_update_desc"));
    request.setDescription("Initial description");

    DatabaseService service = createEntity(request);
    assertEquals("Initial description", service.getDescription());

    // Update description
    service.setDescription("Updated description");
    DatabaseService updated = patchEntity(service.getId().toString(), service);
    assertEquals("Updated description", updated.getDescription());
  }

  @Test
  void test_databaseServiceVersionHistory(TestNamespace ns) {
    CreateDatabaseService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_version"));
    request.setDescription("Initial description");

    DatabaseService service = createEntity(request);
    Double initialVersion = service.getVersion();

    // Update to create new version
    service.setDescription("Updated description");
    DatabaseService updated = patchEntity(service.getId().toString(), service);
    assertTrue(updated.getVersion() > initialVersion);

    // Check version history
    EntityHistory history = getVersionHistory(service.getId());
    assertNotNull(history);
    assertTrue(history.getVersions().size() >= 1);
  }

  @Test
  void test_databaseServiceSoftDeleteRestore(TestNamespace ns) {
    CreateDatabaseService request = createMinimalRequest(ns);
    request.setName(ns.prefix("service_delete"));

    DatabaseService service = createEntity(request);
    assertNotNull(service.getId());

    // Soft delete
    deleteEntity(service.getId().toString());

    // Should still be retrievable with include=deleted
    DatabaseService deleted = getEntityIncludeDeleted(service.getId().toString());
    assertTrue(deleted.getDeleted());

    // Restore
    restoreEntity(service.getId().toString());

    // Should be back to normal
    DatabaseService restored = getEntity(service.getId().toString());
    assertFalse(restored.getDeleted());
  }

  @Test
  void test_databaseServiceNameUniqueness(TestNamespace ns) {
    String serviceName = ns.prefix("unique_service");
    CreateDatabaseService request1 = createMinimalRequest(ns);
    request1.setName(serviceName);

    DatabaseService service1 = createEntity(request1);
    assertNotNull(service1);

    // Attempt to create duplicate
    CreateDatabaseService request2 = createMinimalRequest(ns);
    request2.setName(serviceName);

    assertThrows(
        Exception.class,
        () -> createEntity(request2),
        "Creating duplicate database service should fail");
  }

  @Test
  void test_listDatabaseServices(TestNamespace ns) {
    // Create multiple services
    for (int i = 0; i < 3; i++) {
      CreateDatabaseService request = createMinimalRequest(ns);
      request.setName(ns.prefix("list_service_" + i));
      createEntity(request);
    }

    // List and verify
    ListParams params = new ListParams();
    params.setLimit(10);
    ListResponse<DatabaseService> response = listEntities(params);
    assertNotNull(response);
    assertTrue(response.getData().size() >= 3);
  }
}
