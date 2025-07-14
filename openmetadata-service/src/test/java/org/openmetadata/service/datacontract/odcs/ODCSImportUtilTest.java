package org.openmetadata.service.datacontract.odcs;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ContractStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

@ExtendWith(MockitoExtension.class)
class ODCSImportUtilTest {
  
  @Test
  void testImportValidYamlContract() {
    String yamlContent = """
        apiVersion: v3.0.2
        kind: DataContract
        id: "12345678-1234-1234-1234-123456789012"
        name: "Customer Orders Contract"
        version: "1.0.0"
        status: "active"
        domain: "sales"
        dataProduct: "customer_analytics"
        description:
          purpose: "Define structure and quality for customer orders"
          limitations: "Historical data only"
        schema:
          - name: "orders"
            properties:
              - name: "order_id"
                logicalType: "string"
                primaryKey: true
                required: true
              - name: "customer_id"
                logicalType: "string"
                required: true
              - name: "amount"
                logicalType: "decimal"
                required: true
        quality:
          - type: "text"
            description: "Orders must have positive amounts"
            rule: "amount > 0"
        slaProperties:
          - property: "refreshFrequency"
            value: "24"
            unit: "hours"
        team:
          - username: "john.doe"
            role: "Data Owner"
        """;
    
    UUID entityId = UUID.randomUUID();
    
    // Mock the entity lookup
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      Table mockTable = mock(Table.class);
      EntityReference tableRef = new EntityReference();
      tableRef.setId(entityId);
      tableRef.setName("orders");
      tableRef.setType("table");
      
      when(mockTable.getEntityReference()).thenReturn(tableRef);
      entityMock.when(() -> Entity.getEntity(Entity.TABLE, entityId, "", Include.NON_DELETED))
          .thenReturn(mockTable);
      
      // Import the contract
      ODCSImportResponse response = ODCSImportUtil.importContract(yamlContent, "yaml", entityId);
      
      // Verify response
      assertNotNull(response);
      assertNotNull(response.getContract());
      assertNotNull(response.getImportReport());
      
      // Verify contract
      DataContract contract = response.getContract();
      assertEquals("Customer Orders Contract", contract.getName());
      assertEquals(ContractStatus.Active, contract.getStatus());
      assertEquals(tableRef, contract.getEntity());
      assertNotNull(contract.getSchema());
      assertEquals(3, contract.getSchema().size());
      
      // Verify import report
      ODCSImportReport report = response.getImportReport();
      assertEquals("v3.0.2", report.getOdcsVersion());
      assertTrue(report.getMappedFields().contains("name"));
      assertTrue(report.getMappedFields().contains("version"));
      assertTrue(report.getMappedFields().contains("status"));
      assertTrue(report.getMappedFields().contains("description"));
      assertTrue(report.getMappedFields().contains("schema"));
      assertTrue(report.getMappedFields().contains("quality"));
      assertTrue(report.getMappedFields().contains("slaProperties"));
      assertTrue(report.getMappedFields().contains("team"));
      
      // Verify skipped fields
      assertTrue(report.getSkippedFields().contains("domain"));
      assertTrue(report.getSkippedFields().contains("dataProduct"));
      
      // Verify warnings
      assertTrue(report.getWarnings().stream()
          .anyMatch(w -> w.contains("Domain and data product")));
    }
  }
  
  @Test
  void testImportValidJsonContract() {
    String jsonContent = """
        {
          "apiVersion": "v3.0.0",
          "kind": "DataContract",
          "id": "test-id",
          "name": "Test Contract",
          "version": "1.0.0",
          "status": "draft",
          "schema": [{
            "name": "test_table",
            "properties": [{
              "name": "id",
              "logicalType": "integer",
              "primaryKey": true
            }]
          }]
        }
        """;
    
    UUID entityId = UUID.randomUUID();
    
    // Mock the entity lookup
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      Table mockTable = mock(Table.class);
      EntityReference tableRef = new EntityReference();
      tableRef.setId(entityId);
      tableRef.setName("test_table");
      tableRef.setType("table");
      
      when(mockTable.getEntityReference()).thenReturn(tableRef);
      entityMock.when(() -> Entity.getEntity(Entity.TABLE, entityId, "", Include.NON_DELETED))
          .thenReturn(mockTable);
      
      // Import the contract
      ODCSImportResponse response = ODCSImportUtil.importContract(jsonContent, "json", entityId);
      
      // Verify response
      assertNotNull(response);
      DataContract contract = response.getContract();
      assertEquals("Test Contract", contract.getName());
      assertEquals(ContractStatus.Draft, contract.getStatus());
      assertEquals("v3.0.0", response.getImportReport().getOdcsVersion());
    }
  }
  
  @Test
  void testImportInvalidYaml() {
    String invalidYaml = """
        apiVersion: v3.0.2
        kind: DataContract
        invalid yaml syntax here:::
        """;
    
    UUID entityId = UUID.randomUUID();
    
    // Should throw exception for invalid YAML
    assertThrows(IllegalStateException.class, () -> 
        ODCSImportUtil.importContract(invalidYaml, "yaml", entityId));
  }
  
  @Test
  void testImportUnsupportedVersion() {
    String yamlContent = """
        apiVersion: v2.0.0
        kind: DataContract
        id: "test-id"
        name: "Test Contract"
        version: "1.0.0"
        status: "active"
        """;
    
    UUID entityId = UUID.randomUUID();
    
    // Mock the entity lookup
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      Table mockTable = mock(Table.class);
      EntityReference tableRef = new EntityReference();
      tableRef.setId(entityId);
      tableRef.setName("test_table");
      tableRef.setType("table");
      
      when(mockTable.getEntityReference()).thenReturn(tableRef);
      entityMock.when(() -> Entity.getEntity(Entity.TABLE, entityId, "", Include.NON_DELETED))
          .thenReturn(mockTable);
      
      // Should throw exception for unsupported version
      assertThrows(IllegalStateException.class, () -> 
          ODCSImportUtil.importContract(yamlContent, "yaml", entityId));
    }
  }
  
  @Test
  void testImportEntityNotFound() {
    String yamlContent = """
        apiVersion: v3.0.1
        kind: DataContract
        id: "test-id"
        name: "Test Contract"
        version: "1.0.0"
        status: "active"
        """;
    
    UUID entityId = UUID.randomUUID();
    
    // Mock entity not found
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntity(eq(Entity.TABLE), eq(entityId), anyString(), any()))
          .thenThrow(new RuntimeException("Entity not found"));
      entityMock.when(() -> Entity.getEntity(eq(Entity.TOPIC), eq(entityId), anyString(), any()))
          .thenThrow(new RuntimeException("Entity not found"));
      
      // Should throw exception for entity not found
      Exception exception = assertThrows(IllegalStateException.class, () -> 
          ODCSImportUtil.importContract(yamlContent, "yaml", entityId));
      
      assertTrue(exception.getCause().getMessage().contains("Entity with id"));
      assertTrue(exception.getCause().getMessage().contains("not found"));
    }
  }
  
  @Test
  void testImportWithServersIgnored() {
    String yamlContent = """
        apiVersion: v3.0.2
        kind: DataContract
        id: "test-id"
        name: "Test Contract"
        version: "1.0.0"
        status: "active"
        servers:
          - type: "bigquery"
            host: "my-project"
            database: "sales_db"
            schema: "public"
        """;
    
    UUID entityId = UUID.randomUUID();
    
    // Mock the entity lookup
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      Table mockTable = mock(Table.class);
      EntityReference tableRef = new EntityReference();
      tableRef.setId(entityId);
      tableRef.setName("orders");
      tableRef.setType("table");
      
      when(mockTable.getEntityReference()).thenReturn(tableRef);
      entityMock.when(() -> Entity.getEntity(Entity.TABLE, entityId, "", Include.NON_DELETED))
          .thenReturn(mockTable);
      
      // Import the contract
      ODCSImportResponse response = ODCSImportUtil.importContract(yamlContent, "yaml", entityId);
      
      // Verify servers was skipped
      ODCSImportReport report = response.getImportReport();
      assertTrue(report.getSkippedFields().contains("servers"));
      assertTrue(report.getWarnings().stream()
          .anyMatch(w -> w.contains("Servers field ignored")));
    }
  }
}