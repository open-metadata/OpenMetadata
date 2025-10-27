package org.openmetadata.sdk.entities;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.services.DatabaseServiceService;

/**
 * Mock tests for DatabaseService entity operations.
 * These tests verify the SDK behavior without requiring a running server.
 */
public class DatabaseServiceMockTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private DatabaseServiceService mockDatabaseServiceApi;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.databaseServices()).thenReturn(mockDatabaseServiceApi);
    org.openmetadata.sdk.entities.DatabaseService.setDefaultClient(mockClient);
  }

  @Test
  void testCreateDatabaseService() {
    // Arrange
    MysqlConnection mysqlConnection =
        new MysqlConnection()
            .withHostPort("localhost:3306")
            .withUsername("test_user")
            .withDatabaseName("test_database");

    DatabaseConnection connection = new DatabaseConnection().withConfig(mysqlConnection);

    CreateDatabaseService createRequest =
        new CreateDatabaseService()
            .withName("test_mysql_service")
            .withServiceType(DatabaseServiceType.Mysql)
            .withConnection(connection);

    DatabaseService expectedService = new DatabaseService();
    expectedService.setId(UUID.randomUUID());
    expectedService.setName("test_mysql_service");
    expectedService.setServiceType(CreateDatabaseService.DatabaseServiceType.Mysql);
    expectedService.setConnection(connection);

    when(mockDatabaseServiceApi.create(any(CreateDatabaseService.class)))
        .thenReturn(expectedService);

    // Act
    DatabaseService result = org.openmetadata.sdk.entities.DatabaseService.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("test_mysql_service", result.getName());
    assertEquals(CreateDatabaseService.DatabaseServiceType.Mysql, result.getServiceType());
    verify(mockDatabaseServiceApi).create(any(CreateDatabaseService.class));
  }

  @Test
  void testRetrieveDatabaseService() {
    // Arrange
    String serviceId = UUID.randomUUID().toString();
    DatabaseService expectedService = new DatabaseService();
    expectedService.setId(UUID.fromString(serviceId));
    expectedService.setName("test_service");
    expectedService.setServiceType(CreateDatabaseService.DatabaseServiceType.Postgres);

    when(mockDatabaseServiceApi.get(serviceId)).thenReturn(expectedService);

    // Act
    DatabaseService result = org.openmetadata.sdk.entities.DatabaseService.retrieve(serviceId);

    // Assert
    assertNotNull(result);
    assertEquals(serviceId, result.getId().toString());
    assertEquals("test_service", result.getName());
    assertEquals(CreateDatabaseService.DatabaseServiceType.Postgres, result.getServiceType());
    verify(mockDatabaseServiceApi).get(serviceId);
  }

  @Test
  void testUpdateDatabaseService() {
    // Arrange
    DatabaseService serviceToUpdate = new DatabaseService();
    serviceToUpdate.setId(UUID.randomUUID());
    serviceToUpdate.setName("updated_service");
    serviceToUpdate.setDescription("Updated description");

    DatabaseService expectedService = new DatabaseService();
    expectedService.setId(serviceToUpdate.getId());
    expectedService.setName(serviceToUpdate.getName());
    expectedService.setDescription(serviceToUpdate.getDescription());

    when(mockDatabaseServiceApi.update(serviceToUpdate.getId().toString(), serviceToUpdate))
        .thenReturn(expectedService);

    // Act
    DatabaseService result = org.openmetadata.sdk.entities.DatabaseService.update(serviceToUpdate);

    // Assert
    assertNotNull(result);
    assertEquals("Updated description", result.getDescription());
    verify(mockDatabaseServiceApi).update(serviceToUpdate.getId().toString(), serviceToUpdate);
  }

  @Test
  void testDeleteDatabaseService() {
    // Arrange
    String serviceId = UUID.randomUUID().toString();
    doNothing().when(mockDatabaseServiceApi).delete(eq(serviceId), any());

    // Act
    org.openmetadata.sdk.entities.DatabaseService.delete(serviceId);

    // Assert
    verify(mockDatabaseServiceApi).delete(eq(serviceId), any());
  }

  @Test
  void testDeleteDatabaseServiceWithOptions() {
    // Arrange
    String serviceId = UUID.randomUUID().toString();
    doNothing().when(mockDatabaseServiceApi).delete(eq(serviceId), any());

    // Act
    org.openmetadata.sdk.entities.DatabaseService.delete(serviceId, true, true);

    // Assert
    verify(mockDatabaseServiceApi)
        .delete(
            eq(serviceId),
            argThat(
                params ->
                    "true".equals(params.get("recursive"))
                        && "true".equals(params.get("hardDelete"))));
  }
}
