package org.openmetadata.sdk.entities;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.services.dataassets.TableService;

/**
 * Tests for Table entity CRUD operations.
 * These tests verify both the static API and fluent API behavior without requiring a running server.
 */
public class TableEntityOperationsTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private TableService mockTableService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.tables()).thenReturn(mockTableService);
    // Set default client for both static and fluent APIs
    org.openmetadata.sdk.entities.Table.setDefaultClient(mockClient);
    Tables.setDefaultClient(mockClient);
  }

  @Test
  void testCreateTableStaticAPI() {
    // Arrange
    CreateTable createRequest = new CreateTable();
    createRequest.setName("test_table");
    createRequest.setDatabaseSchema("database.schema");

    Column column = new Column();
    column.setName("id");
    column.setDataType(ColumnDataType.INT);
    createRequest.setColumns(java.util.List.of(column));

    Table expectedTable = new Table();
    expectedTable.setId(UUID.randomUUID());
    expectedTable.setName("test_table");
    expectedTable.setFullyQualifiedName("database.schema.test_table");
    expectedTable.setColumns(createRequest.getColumns());

    when(mockTableService.create(any(CreateTable.class))).thenReturn(expectedTable);

    // Act - Static API
    Table result = org.openmetadata.sdk.entities.Table.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("test_table", result.getName());
    assertEquals("database.schema.test_table", result.getFullyQualifiedName());
    verify(mockTableService).create(any(CreateTable.class));
  }

  @Test
  void testCreateTableFluentAPI() {
    // Arrange
    CreateTable createRequest = new CreateTable();
    createRequest.setName("test_table");
    createRequest.setDatabaseSchema("database.schema");

    Column column = new Column();
    column.setName("id");
    column.setDataType(ColumnDataType.INT);
    createRequest.setColumns(java.util.List.of(column));

    Table expectedTable = new Table();
    expectedTable.setId(UUID.randomUUID());
    expectedTable.setName("test_table");
    expectedTable.setFullyQualifiedName("database.schema.test_table");
    expectedTable.setColumns(createRequest.getColumns());

    when(mockTableService.create(any(CreateTable.class))).thenReturn(expectedTable);

    // Act - Fluent API
    Table result = Tables.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("test_table", result.getName());
    assertEquals("database.schema.test_table", result.getFullyQualifiedName());
    verify(mockTableService).create(any(CreateTable.class));
  }

  @Test
  void testRetrieveTableStaticAPI() {
    // Arrange
    String tableId = UUID.randomUUID().toString();
    Table expectedTable = new Table();
    expectedTable.setId(UUID.fromString(tableId));
    expectedTable.setName("test_table");
    expectedTable.setDescription("Test table description");

    when(mockTableService.get(tableId)).thenReturn(expectedTable);

    // Act - Static API
    Table result = org.openmetadata.sdk.entities.Table.retrieve(tableId);

    // Assert
    assertNotNull(result);
    assertEquals(tableId, result.getId().toString());
    assertEquals("test_table", result.getName());
    assertEquals("Test table description", result.getDescription());
    verify(mockTableService).get(tableId);
  }

  @Test
  void testRetrieveTableFluentAPI() {
    // Arrange
    String tableId = UUID.randomUUID().toString();
    Table expectedTable = new Table();
    expectedTable.setId(UUID.fromString(tableId));
    expectedTable.setName("test_table");
    expectedTable.setDescription("Test table description");

    when(mockTableService.get(tableId)).thenReturn(expectedTable);

    // Act - Fluent API
    Table result = Tables.find(tableId).fetch().get();

    // Assert
    assertNotNull(result);
    assertEquals(tableId, result.getId().toString());
    assertEquals("test_table", result.getName());
    assertEquals("Test table description", result.getDescription());
    verify(mockTableService).get(tableId);
  }

  @Test
  void testRetrieveTableWithFields() {
    // Arrange
    String tableId = UUID.randomUUID().toString();
    String fields = "owner,tags,columns";
    Table expectedTable = new Table();
    expectedTable.setId(UUID.fromString(tableId));
    expectedTable.setName("test_table");

    when(mockTableService.get(tableId, fields)).thenReturn(expectedTable);

    // Act - Static API
    Table result = org.openmetadata.sdk.entities.Table.retrieve(tableId, fields);

    // Assert
    assertNotNull(result);
    assertEquals(tableId, result.getId().toString());
    verify(mockTableService).get(tableId, fields);
  }

  @Test
  void testRetrieveTableWithFieldsFluentAPI() {
    // Arrange
    String tableId = UUID.randomUUID().toString();
    String fields = "owner,tags,columns";
    Table expectedTable = new Table();
    expectedTable.setId(UUID.fromString(tableId));
    expectedTable.setName("test_table");

    when(mockTableService.get(eq(tableId), anyString())).thenReturn(expectedTable);

    // Act - Fluent API
    Table result = Tables.find(tableId).includeOwners().includeTags().fetch().get();

    // Assert
    assertNotNull(result);
    assertEquals(tableId, result.getId().toString());
    verify(mockTableService).get(eq(tableId), anyString());
  }

  @Test
  void testRetrieveTableByName() {
    // Arrange
    String fqn = "database.schema.test_table";
    Table expectedTable = new Table();
    expectedTable.setName("test_table");
    expectedTable.setFullyQualifiedName(fqn);

    when(mockTableService.getByName(fqn)).thenReturn(expectedTable);

    // Act - Static API
    Table result = org.openmetadata.sdk.entities.Table.retrieveByName(fqn);

    // Assert
    assertNotNull(result);
    assertEquals(fqn, result.getFullyQualifiedName());
    assertEquals("test_table", result.getName());
    verify(mockTableService).getByName(fqn);
  }

  @Test
  void testRetrieveTableByNameFluentAPI() {
    // Arrange
    String fqn = "database.schema.test_table";
    Table expectedTable = new Table();
    expectedTable.setName("test_table");
    expectedTable.setFullyQualifiedName(fqn);

    when(mockTableService.getByName(fqn)).thenReturn(expectedTable);

    // Act - Fluent API
    Table result = Tables.findByName(fqn).fetch().get();

    // Assert
    assertNotNull(result);
    assertEquals(fqn, result.getFullyQualifiedName());
    assertEquals("test_table", result.getName());
    verify(mockTableService).getByName(fqn);
  }

  @Test
  void testUpdateTable() {
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
    Table result = org.openmetadata.sdk.entities.Table.update(tableToUpdate);

    // Assert
    assertNotNull(result);
    assertEquals("Updated description", result.getDescription());
    verify(mockTableService).update(tableToUpdate.getId().toString(), tableToUpdate);
  }

  @Test
  void testDeleteTable() {
    // Arrange
    String tableId = UUID.randomUUID().toString();
    doNothing().when(mockTableService).delete(eq(tableId), any());

    // Act
    org.openmetadata.sdk.entities.Table.delete(tableId);

    // Assert
    verify(mockTableService).delete(eq(tableId), any());
  }

  @Test
  void testDeleteTableWithOptions() {
    // Arrange
    String tableId = UUID.randomUUID().toString();
    doNothing().when(mockTableService).delete(eq(tableId), any());

    // Act
    org.openmetadata.sdk.entities.Table.delete(tableId, true, true);

    // Assert
    verify(mockTableService)
        .delete(
            eq(tableId),
            argThat(
                params ->
                    "true".equals(params.get("recursive"))
                        && "true".equals(params.get("hardDelete"))));
  }

  @Test
  void testAsyncOperations() throws Exception {
    // Arrange
    String tableId = UUID.randomUUID().toString();
    Table expectedTable = new Table();
    expectedTable.setId(UUID.fromString(tableId));
    expectedTable.setName("async_test_table");

    when(mockTableService.get(tableId)).thenReturn(expectedTable);

    // Act
    var future = org.openmetadata.sdk.entities.Table.retrieveAsync(tableId);
    Table result = future.get();

    // Assert
    assertNotNull(result);
    assertEquals("async_test_table", result.getName());
    verify(mockTableService).get(tableId);
  }
}
