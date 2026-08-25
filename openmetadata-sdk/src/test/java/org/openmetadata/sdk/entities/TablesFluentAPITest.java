package org.openmetadata.sdk.entities;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.services.dataassets.TableService;

class TablesFluentAPITest {

  @Test
  void testColumnDataTypeConstants() {
    // Test that all ColumnDataType values are exposed as constants
    assertEquals(ColumnDataType.NUMBER.value(), Tables.NUMBER);
    assertEquals(ColumnDataType.TINYINT.value(), Tables.TINYINT);
    assertEquals(ColumnDataType.SMALLINT.value(), Tables.SMALLINT);
    assertEquals(ColumnDataType.INT.value(), Tables.INT);
    assertEquals(ColumnDataType.BIGINT.value(), Tables.BIGINT);
    assertEquals(ColumnDataType.FLOAT.value(), Tables.FLOAT);
    assertEquals(ColumnDataType.DOUBLE.value(), Tables.DOUBLE);
    assertEquals(ColumnDataType.DECIMAL.value(), Tables.DECIMAL);
    assertEquals(ColumnDataType.NUMERIC.value(), Tables.NUMERIC);

    // Test string types
    assertEquals(ColumnDataType.TIMESTAMP.value(), Tables.TIMESTAMP);
    assertEquals(ColumnDataType.TIME.value(), Tables.TIME);
    assertEquals(ColumnDataType.DATE.value(), Tables.DATE);
    assertEquals(ColumnDataType.DATETIME.value(), Tables.DATETIME);
    assertEquals(ColumnDataType.INTERVAL.value(), Tables.INTERVAL);
    assertEquals(ColumnDataType.STRING.value(), Tables.STRING);
    assertEquals(ColumnDataType.MEDIUMTEXT.value(), Tables.MEDIUMTEXT);
    assertEquals(ColumnDataType.TEXT.value(), Tables.TEXT);
    assertEquals(ColumnDataType.CHAR.value(), Tables.CHAR);
    assertEquals(ColumnDataType.VARCHAR.value(), Tables.VARCHAR);
    assertEquals(ColumnDataType.BOOLEAN.value(), Tables.BOOLEAN);

    // Test complex types
    assertEquals(ColumnDataType.ARRAY.value(), Tables.ARRAY);
    assertEquals(ColumnDataType.BLOB.value(), Tables.BLOB);
    assertEquals(ColumnDataType.LONGBLOB.value(), Tables.LONGBLOB);
    assertEquals(ColumnDataType.MEDIUMBLOB.value(), Tables.MEDIUMBLOB);
    assertEquals(ColumnDataType.MAP.value(), Tables.MAP);
    assertEquals(ColumnDataType.STRUCT.value(), Tables.STRUCT);
    assertEquals(ColumnDataType.UNION.value(), Tables.UNION);
    assertEquals(ColumnDataType.SET.value(), Tables.SET);
    assertEquals(ColumnDataType.GEOGRAPHY.value(), Tables.GEOGRAPHY);
    assertEquals(ColumnDataType.BINARY.value(), Tables.BINARY);
    assertEquals(ColumnDataType.VARBINARY.value(), Tables.VARBINARY);

    // Test JSON type
    assertEquals(ColumnDataType.JSON.value(), Tables.JSON);
  }

  @Test
  void testVarcharHelper() {
    // Test VARCHAR helper method
    assertEquals("VARCHAR(100)", Tables.VARCHAR(100));
    assertEquals("VARCHAR(255)", Tables.VARCHAR(255));
    assertEquals("VARCHAR(1000)", Tables.VARCHAR(1000));
  }

  @Test
  void testCharHelper() {
    // Test CHAR helper method
    assertEquals("CHAR(10)", Tables.CHAR(10));
    assertEquals("CHAR(1)", Tables.CHAR(1));
    assertEquals("CHAR(50)", Tables.CHAR(50));
  }

  @Test
  void testDecimalHelper() {
    // Test DECIMAL helper method
    assertEquals("DECIMAL(10,2)", Tables.DECIMAL(10, 2));
    assertEquals("DECIMAL(18,4)", Tables.DECIMAL(18, 4));
    assertEquals("DECIMAL(5,0)", Tables.DECIMAL(5, 0));
  }

  @Test
  void testFluentApiConstants() {
    // Test that fluent API constants are accessible and correct
    // Note: Full testing of fluent API requires integration tests with a real server

    // Verify basic column type constants are accessible
    assertNotNull(Tables.VARCHAR);
    assertNotNull(Tables.INT);
    assertNotNull(Tables.BIGINT);

    // Test they have the expected values
    assertEquals("VARCHAR", Tables.VARCHAR);
    assertEquals("INT", Tables.INT);
    assertEquals("BIGINT", Tables.BIGINT);
  }

  @Test
  void testAllColumnDataTypesAvailable() {
    // Verify that all ColumnDataType enum values have corresponding constants
    for (ColumnDataType type : ColumnDataType.values()) {
      // Skip types that are not applicable for table columns
      if (type == ColumnDataType.UNKNOWN
          || type == ColumnDataType.NULL
          || type == ColumnDataType.KPI) { // KPI is for metrics, not table columns
        continue;
      }

      // Use reflection to check if the constant exists
      try {
        String fieldName = type.name();
        // Handle special cases where enum name differs from field name
        if (fieldName.equals("IPV_4")) {
          fieldName = "IPV4";
        } else if (fieldName.equals("IPV_6")) {
          fieldName = "IPV6";
        }
        Tables.class.getField(fieldName);
      } catch (NoSuchFieldException e) {
        fail("Missing constant for ColumnDataType." + type.name());
      }
    }
  }

  @Test
  void testColumnCreation() {
    // Test creating columns with different data types
    Column intColumn = new Column();
    intColumn.setName("age");
    intColumn.setDataType(ColumnDataType.fromValue(Tables.INT));
    assertEquals(ColumnDataType.INT, intColumn.getDataType());

    Column varcharColumn = new Column();
    varcharColumn.setName("email");
    varcharColumn.setDataType(ColumnDataType.fromValue(Tables.VARCHAR));
    varcharColumn.setDataLength(255);
    assertEquals(ColumnDataType.VARCHAR, varcharColumn.getDataType());
    assertEquals(255, varcharColumn.getDataLength());

    Column timestampColumn = new Column();
    timestampColumn.setName("created_at");
    timestampColumn.setDataType(ColumnDataType.fromValue(Tables.TIMESTAMP));
    assertEquals(ColumnDataType.TIMESTAMP, timestampColumn.getDataType());

    Column jsonColumn = new Column();
    jsonColumn.setName("metadata");
    jsonColumn.setDataType(ColumnDataType.fromValue(Tables.JSON));
    assertEquals(ColumnDataType.JSON, jsonColumn.getDataType());
  }

  @Test
  void testComplexDataTypes() {
    // Test complex data types
    Column arrayColumn = new Column();
    arrayColumn.setName("tags");
    arrayColumn.setDataType(ColumnDataType.fromValue(Tables.ARRAY));
    assertEquals(ColumnDataType.ARRAY, arrayColumn.getDataType());

    Column structColumn = new Column();
    structColumn.setName("address");
    structColumn.setDataType(ColumnDataType.fromValue(Tables.STRUCT));
    assertEquals(ColumnDataType.STRUCT, structColumn.getDataType());

    Column mapColumn = new Column();
    mapColumn.setName("properties");
    mapColumn.setDataType(ColumnDataType.fromValue(Tables.MAP));
    assertEquals(ColumnDataType.MAP, mapColumn.getDataType());
  }

  @Test
  void testGeospatialDataTypes() {
    // Test geospatial data types
    Column pointColumn = new Column();
    pointColumn.setName("location");
    pointColumn.setDataType(ColumnDataType.fromValue(Tables.POINT));
    assertEquals(ColumnDataType.POINT, pointColumn.getDataType());

    Column polygonColumn = new Column();
    polygonColumn.setName("boundary");
    polygonColumn.setDataType(ColumnDataType.fromValue(Tables.POLYGON));
    assertEquals(ColumnDataType.POLYGON, polygonColumn.getDataType());

    Column geometryColumn = new Column();
    geometryColumn.setName("shape");
    geometryColumn.setDataType(ColumnDataType.fromValue(Tables.GEOMETRY));
    assertEquals(ColumnDataType.GEOMETRY, geometryColumn.getDataType());
  }

  @Test
  void testFetchReturnsWrappersFluentTable() {
    // Arrange
    OpenMetadataClient mockClient = mock(OpenMetadataClient.class);
    TableService mockTableService = mock(TableService.class);
    when(mockClient.tables()).thenReturn(mockTableService);

    Table table = new Table();
    table.setId(UUID.randomUUID());
    table.setName("test_table");
    when(mockTableService.getByName(eq("service.db.schema.test_table"))).thenReturn(table);

    Tables.setDefaultClient(mockClient);

    // Act
    Object result = Tables.findByName("service.db.schema.test_table").fetch();

    // Assert — must be the wrappers.FluentTable, not the inner Tables.FluentTable
    assertInstanceOf(org.openmetadata.sdk.fluent.wrappers.FluentTable.class, result);
    assertFalse(
        result instanceof Tables.FluentTable, "Must not return Tables.FluentTable (inner class)");

    // Verify rich API methods exist on the returned object
    org.openmetadata.sdk.fluent.wrappers.FluentTable fluent =
        (org.openmetadata.sdk.fluent.wrappers.FluentTable) result;
    assertNotNull(fluent.get());
    assertEquals("test_table", fluent.get().getName());

    // Clean up
    Tables.setDefaultClient(null);
  }

  @Test
  void testFindByIdFetchReturnsWrappersFluentTable() {
    // Arrange
    OpenMetadataClient mockClient = mock(OpenMetadataClient.class);
    TableService mockTableService = mock(TableService.class);
    when(mockClient.tables()).thenReturn(mockTableService);

    String tableId = UUID.randomUUID().toString();
    Table table = new Table();
    table.setId(UUID.fromString(tableId));
    table.setName("test_table");
    when(mockTableService.get(eq(tableId))).thenReturn(table);

    Tables.setDefaultClient(mockClient);

    // Act
    Object result = Tables.find(tableId).fetch();

    // Assert — must be the wrappers.FluentTable
    assertInstanceOf(org.openmetadata.sdk.fluent.wrappers.FluentTable.class, result);

    // Clean up
    Tables.setDefaultClient(null);
  }
}
