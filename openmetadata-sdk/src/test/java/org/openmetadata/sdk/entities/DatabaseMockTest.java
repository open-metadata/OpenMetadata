package org.openmetadata.sdk.entities;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.databases.DatabaseService;

/**
 * Mock tests for Database entity operations.
 */
public class DatabaseMockTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private DatabaseService mockDatabaseService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.databases()).thenReturn(mockDatabaseService);
    org.openmetadata.sdk.entities.Database.setDefaultClient(mockClient);
  }

  @Test
  void testCreateDatabase() {
    // Arrange
    CreateDatabase createRequest = new CreateDatabase();
    createRequest.setName("test_database");
    createRequest.setService("database_service_fqn");
    createRequest.setDescription("Test database for unit tests");

    Database expectedDatabase = new Database();
    expectedDatabase.setId(UUID.randomUUID());
    expectedDatabase.setName("test_database");
    expectedDatabase.setFullyQualifiedName("database_service_fqn.test_database");
    expectedDatabase.setDescription("Test database for unit tests");

    when(mockDatabaseService.create(any(CreateDatabase.class))).thenReturn(expectedDatabase);

    // Act
    Database result = org.openmetadata.sdk.entities.Database.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("test_database", result.getName());
    assertEquals("Test database for unit tests", result.getDescription());
    verify(mockDatabaseService).create(any(CreateDatabase.class));
  }

  @Test
  void testRetrieveDatabase() {
    // Arrange
    String databaseId = UUID.randomUUID().toString();
    Database expectedDatabase = new Database();
    expectedDatabase.setId(UUID.fromString(databaseId));
    expectedDatabase.setName("prod_database");
    expectedDatabase.setFullyQualifiedName("mysql.prod_database");

    when(mockDatabaseService.get(databaseId)).thenReturn(expectedDatabase);

    // Act
    Database result = org.openmetadata.sdk.entities.Database.retrieve(databaseId);

    // Assert
    assertNotNull(result);
    assertEquals(databaseId, result.getId().toString());
    assertEquals("prod_database", result.getName());
    verify(mockDatabaseService).get(databaseId);
  }

  @Test
  void testRetrieveDatabaseByName() {
    // Arrange
    String fqn = "mysql.prod_database";
    Database expectedDatabase = new Database();
    expectedDatabase.setName("prod_database");
    expectedDatabase.setFullyQualifiedName(fqn);

    when(mockDatabaseService.getByName(fqn)).thenReturn(expectedDatabase);

    // Act
    Database result = org.openmetadata.sdk.entities.Database.retrieveByName(fqn);

    // Assert
    assertNotNull(result);
    assertEquals(fqn, result.getFullyQualifiedName());
    assertEquals("prod_database", result.getName());
    verify(mockDatabaseService).getByName(fqn);
  }

  @Test
  void testUpdateDatabase() {
    // Arrange
    Database databaseToUpdate = new Database();
    databaseToUpdate.setId(UUID.randomUUID());
    databaseToUpdate.setName("test_database");
    databaseToUpdate.setDescription("Updated description");

    Database expectedDatabase = new Database();
    expectedDatabase.setId(databaseToUpdate.getId());
    expectedDatabase.setName(databaseToUpdate.getName());
    expectedDatabase.setDescription(databaseToUpdate.getDescription());

    when(mockDatabaseService.update(databaseToUpdate.getId().toString(), databaseToUpdate))
        .thenReturn(expectedDatabase);

    // Act
    Database result = org.openmetadata.sdk.entities.Database.update(databaseToUpdate);

    // Assert
    assertNotNull(result);
    assertEquals("Updated description", result.getDescription());
    verify(mockDatabaseService).update(databaseToUpdate.getId().toString(), databaseToUpdate);
  }

  @Test
  void testDeleteDatabase() {
    // Arrange
    String databaseId = UUID.randomUUID().toString();
    doNothing().when(mockDatabaseService).delete(eq(databaseId), any());

    // Act
    org.openmetadata.sdk.entities.Database.delete(databaseId);

    // Assert
    verify(mockDatabaseService).delete(eq(databaseId), any());
  }

  @Test
  void testDeleteDatabaseWithOptions() {
    // Arrange
    String databaseId = UUID.randomUUID().toString();
    doNothing().when(mockDatabaseService).delete(eq(databaseId), any());

    // Act
    org.openmetadata.sdk.entities.Database.delete(databaseId, true, true);

    // Assert
    verify(mockDatabaseService)
        .delete(
            eq(databaseId),
            argThat(
                params ->
                    "true".equals(params.get("recursive"))
                        && "true".equals(params.get("hardDelete"))));
  }
}
