package org.openmetadata.sdk;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.dataassets.TableService;
import org.openmetadata.sdk.services.services.DatabaseServiceService;

/**
 * Mock tests for OM wrapper following Stripe SDK pattern.
 * These tests verify the OM wrapper behavior without requiring a running server.
 */
public class OMMockTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private TableService mockTableService;
  @Mock private org.openmetadata.sdk.services.databases.DatabaseService mockDatabaseService;
  @Mock private DatabaseServiceService mockDatabaseServiceApi;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.tables()).thenReturn(mockTableService);
    when(mockClient.databases()).thenReturn(mockDatabaseService);
    when(mockClient.databaseServices()).thenReturn(mockDatabaseServiceApi);
    OM.init(mockClient);
  }

  @Test
  void testOMTableOperations() {
    // Arrange
    CreateTable createRequest = new CreateTable();
    createRequest.setName("test_table");
    createRequest.setDatabaseSchema("database.schema");

    Table expectedTable = new Table();
    expectedTable.setId(UUID.randomUUID());
    expectedTable.setName("test_table");
    expectedTable.setFullyQualifiedName("database.schema.test_table");

    when(mockTableService.create(any(CreateTable.class))).thenReturn(expectedTable);

    // Act
    Table result = OM.Table.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("test_table", result.getName());
    assertEquals("database.schema.test_table", result.getFullyQualifiedName());
  }

  @Test
  void testOMDatabaseOperations() {
    // Arrange
    String databaseId = UUID.randomUUID().toString();
    Database expectedDatabase = new Database();
    expectedDatabase.setId(UUID.fromString(databaseId));
    expectedDatabase.setName("test_database");

    when(mockDatabaseService.get(databaseId)).thenReturn(expectedDatabase);

    // Act
    Database result = OM.Database.retrieve(databaseId);

    // Assert
    assertNotNull(result);
    assertEquals(databaseId, result.getId().toString());
    assertEquals("test_database", result.getName());
  }

  @Test
  void testOMServiceOperations() {
    // Arrange
    CreateDatabaseService createRequest =
        new CreateDatabaseService()
            .withName("test_service")
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql);

    DatabaseService expectedService = new DatabaseService();
    expectedService.setId(UUID.randomUUID());
    expectedService.setName("test_service");
    expectedService.setServiceType(CreateDatabaseService.DatabaseServiceType.Mysql);

    when(mockDatabaseServiceApi.create(any(DatabaseService.class))).thenReturn(expectedService);

    // Act
    DatabaseService result = OM.DatabaseService.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("test_service", result.getName());
    assertEquals(CreateDatabaseService.DatabaseServiceType.Mysql, result.getServiceType());
  }

  @Test
  void testOMTableRetrieveByName() {
    // Arrange
    String fqn = "database.schema.test_table";
    Table expectedTable = new Table();
    expectedTable.setName("test_table");
    expectedTable.setFullyQualifiedName(fqn);

    when(mockTableService.getByName(fqn)).thenReturn(expectedTable);

    // Act
    Table result = OM.Table.retrieveByName(fqn);

    // Assert
    assertNotNull(result);
    assertEquals(fqn, result.getFullyQualifiedName());
    assertEquals("test_table", result.getName());
  }

  @Test
  void testOMTableUpdate() {
    // Arrange
    Table tableToUpdate = new Table();
    tableToUpdate.setId(UUID.randomUUID());
    tableToUpdate.setName("test_table");
    tableToUpdate.setDescription("Updated description");

    Table expectedTable = new Table();
    expectedTable.setId(tableToUpdate.getId());
    expectedTable.setName(tableToUpdate.getName());
    expectedTable.setDescription(tableToUpdate.getDescription());

    when(mockTableService.update(tableToUpdate.getId().toString(), tableToUpdate))
        .thenReturn(expectedTable);

    // Act
    Table result = OM.Table.update(tableToUpdate);

    // Assert
    assertNotNull(result);
    assertEquals("Updated description", result.getDescription());
  }

  @Test
  void testOMTableDelete() {
    // Arrange
    String tableId = UUID.randomUUID().toString();
    doNothing().when(mockTableService).delete(eq(tableId), any());

    // Act
    OM.Table.delete(tableId);

    // Assert
    verify(mockTableService).delete(eq(tableId), any());
  }

  @Test
  void testOMInitialization() {
    // Test that OM.init properly initializes all entity classes
    // This is implicitly tested by the successful execution of other tests
    // after OM.init is called in setUp()
    assertDoesNotThrow(
        () -> {
          OM.Table.retrieve("test-id");
          OM.Database.retrieve("test-id");
          OM.DatabaseService.retrieve("test-id");
        });
  }
}
