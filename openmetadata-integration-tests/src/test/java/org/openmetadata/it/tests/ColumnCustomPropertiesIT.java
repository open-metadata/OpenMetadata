package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.customProperties.EnumConfig;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Columns;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for column custom properties feature.
 *
 * <p>Tests custom property CRUD operations on both table columns (tableColumn entity type) and
 * dashboard data model columns (dashboardDataModelColumn entity type).
 *
 * <p>Covers all custom property types: string, integer, number, markdown, email, enum, date-cp,
 * time-cp, dateTime-cp, duration, timestamp, sqlQuery, entityReference, entityReferenceList, and
 * timeInterval.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ColumnCustomPropertiesIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String TABLE_COLUMN = "tableColumn";
  private static final String DASHBOARD_DATA_MODEL_COLUMN = "dashboardDataModelColumn";

  private static Type STRING_TYPE;
  private static Type INT_TYPE;
  private static Type NUMBER_TYPE;
  private static Type MARKDOWN_TYPE;
  private static Type EMAIL_TYPE;
  private static Type ENUM_TYPE;
  private static Type DATECP_TYPE;
  private static Type TIMECP_TYPE;
  private static Type DATETIMECP_TYPE;
  private static Type DURATION_TYPE;
  private static Type TIMESTAMP_TYPE;
  private static Type SQLQUERY_TYPE;
  private static Type ENTITY_REFERENCE_TYPE;
  private static Type ENTITY_REFERENCE_LIST_TYPE;
  private static Type TIME_INTERVAL_TYPE;

  @BeforeAll
  static void setupTypes() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Tables.setDefaultClient(client);
    Columns.setDefaultClient(client);

    STRING_TYPE = getTypeByName(client, "string");
    INT_TYPE = getTypeByName(client, "integer");
    NUMBER_TYPE = getTypeByName(client, "number");
    MARKDOWN_TYPE = getTypeByName(client, "markdown");
    EMAIL_TYPE = getTypeByName(client, "email");
    ENUM_TYPE = getTypeByName(client, "enum");
    DATECP_TYPE = getTypeByName(client, "date-cp");
    TIMECP_TYPE = getTypeByName(client, "time-cp");
    DATETIMECP_TYPE = getTypeByName(client, "dateTime-cp");
    DURATION_TYPE = getTypeByName(client, "duration");
    TIMESTAMP_TYPE = getTypeByName(client, "timestamp");
    SQLQUERY_TYPE = getTypeByName(client, "sqlQuery");
    ENTITY_REFERENCE_TYPE = getTypeByName(client, "entityReference");
    ENTITY_REFERENCE_LIST_TYPE = getTypeByName(client, "entityReferenceList");
    TIME_INTERVAL_TYPE = getTypeByName(client, "timeInterval");
  }

  // ========================================================================
  // STRING CUSTOM PROPERTY TESTS
  // ========================================================================

  @Test
  void test_tableColumn_stringCustomProperty(TestNamespace ns) throws Exception {
    String propName = ns.prefix("strProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, STRING_TYPE, null);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, "test-string-value");

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      assertEquals("test-string-value", resultExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_dashboardColumn_stringCustomProperty(TestNamespace ns) throws Exception {
    String propName = ns.prefix("dashStrProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(
          client, DASHBOARD_DATA_MODEL_COLUMN, propName, STRING_TYPE, null);

      DashboardDataModel dataModel = createTestDashboardDataModel(ns);
      String columnFQN = dataModel.getFullyQualifiedName() + ".metric1";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, "dashboard-string-value");

      Column updated = updateColumn(client, columnFQN, "dashboardDataModel", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      assertEquals("dashboard-string-value", resultExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, DASHBOARD_DATA_MODEL_COLUMN, propName);
    }
  }

  // ========================================================================
  // INTEGER CUSTOM PROPERTY TESTS
  // ========================================================================

  @Test
  void test_tableColumn_integerCustomProperty(TestNamespace ns) throws Exception {
    String propName = ns.prefix("intProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, INT_TYPE, null);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, 42);

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      assertEquals(42, resultExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_tableColumn_integerValidation_rejectsString(TestNamespace ns) throws Exception {
    String propName = ns.prefix("intValProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, INT_TYPE, null);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, "not-a-number");

      assertThrows(
          Exception.class,
          () -> updateColumn(client, columnFQN, "table", extension),
          "Setting string value for integer property should fail");

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  // ========================================================================
  // NUMBER (DECIMAL) CUSTOM PROPERTY TESTS
  // ========================================================================

  @Test
  void test_tableColumn_numberCustomProperty(TestNamespace ns) throws Exception {
    String propName = ns.prefix("numProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, NUMBER_TYPE, null);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, 3.14159);

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      assertEquals(3.14159, ((Number) resultExt.get(propName)).doubleValue(), 0.0001);

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  // ========================================================================
  // MARKDOWN CUSTOM PROPERTY TESTS
  // ========================================================================

  @Test
  void test_tableColumn_markdownCustomProperty(TestNamespace ns) throws Exception {
    String propName = ns.prefix("mdProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, MARKDOWN_TYPE, null);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      String markdownContent =
          "# Header\n\n**Bold text** and *italic*\n\n- List item 1\n- List item 2";
      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, markdownContent);

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      assertEquals(markdownContent, resultExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  // ========================================================================
  // EMAIL CUSTOM PROPERTY TESTS
  // ========================================================================

  @Test
  void test_tableColumn_emailCustomProperty(TestNamespace ns) throws Exception {
    String propName = ns.prefix("emailProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, EMAIL_TYPE, null);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, "test@example.com");

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      assertEquals("test@example.com", resultExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  // ========================================================================
  // ENUM CUSTOM PROPERTY TESTS
  // ========================================================================

  @Test
  void test_tableColumn_enumCustomProperty(TestNamespace ns) throws Exception {
    String propName = ns.prefix("enumProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      EnumConfig enumConfig = new EnumConfig();
      enumConfig.setValues(List.of("HIGH", "MEDIUM", "LOW"));
      CustomPropertyConfig config = new CustomPropertyConfig();
      config.setConfig(enumConfig);

      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, ENUM_TYPE, config);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, List.of("HIGH"));

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      assertEquals(List.of("HIGH"), resultExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_tableColumn_enumMultipleValues(TestNamespace ns) throws Exception {
    String propName = ns.prefix("enumMultiProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      EnumConfig enumConfig = new EnumConfig();
      enumConfig.setValues(List.of("A", "B", "C"));
      enumConfig.setMultiSelect(true);
      CustomPropertyConfig config = new CustomPropertyConfig();
      config.setConfig(enumConfig);

      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, ENUM_TYPE, config);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, List.of("A", "B"));

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      @SuppressWarnings("unchecked")
      List<String> enumValues = (List<String>) resultExt.get(propName);
      assertEquals(2, enumValues.size());
      assertTrue(enumValues.contains("A"));
      assertTrue(enumValues.contains("B"));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  // ========================================================================
  // DATE CUSTOM PROPERTY TESTS
  // ========================================================================

  @Test
  void test_tableColumn_dateCpCustomProperty(TestNamespace ns) throws Exception {
    String propName = ns.prefix("dateProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      CustomPropertyConfig dateConfig = new CustomPropertyConfig();
      dateConfig.setConfig("yyyy-MM-dd");
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, DATECP_TYPE, dateConfig);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, "2024-12-25");

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      assertNotNull(resultExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  // ========================================================================
  // TIME CUSTOM PROPERTY TESTS
  // ========================================================================

  @Test
  void test_tableColumn_timeCpCustomProperty(TestNamespace ns) throws Exception {
    String propName = ns.prefix("timeProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      CustomPropertyConfig timeConfig = new CustomPropertyConfig();
      timeConfig.setConfig("HH:mm:ss");
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, TIMECP_TYPE, timeConfig);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, "14:30:00");

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      assertNotNull(resultExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  // ========================================================================
  // DATETIME CUSTOM PROPERTY TESTS
  // ========================================================================

  @Test
  void test_tableColumn_dateTimeCpCustomProperty(TestNamespace ns) throws Exception {
    String propName = ns.prefix("dtProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      CustomPropertyConfig dateTimeConfig = new CustomPropertyConfig();
      dateTimeConfig.setConfig("yyyy-MM-dd HH:mm:ss");
      addCustomPropertyToColumnType(
          client, TABLE_COLUMN, propName, DATETIMECP_TYPE, dateTimeConfig);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, "2024-12-25 14:30:00");

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      assertNotNull(resultExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  // ========================================================================
  // DURATION CUSTOM PROPERTY TESTS
  // ========================================================================

  @Test
  void test_tableColumn_durationCustomProperty(TestNamespace ns) throws Exception {
    String propName = ns.prefix("durProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, DURATION_TYPE, null);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, "P1DT2H30M");

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      assertNotNull(resultExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  // ========================================================================
  // TIMESTAMP CUSTOM PROPERTY TESTS
  // ========================================================================

  @Test
  void test_tableColumn_timestampCustomProperty(TestNamespace ns) throws Exception {
    String propName = ns.prefix("tsProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, TIMESTAMP_TYPE, null);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      long timestamp = System.currentTimeMillis();
      extension.put(propName, timestamp);

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      assertEquals(timestamp, ((Number) resultExt.get(propName)).longValue());

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  // ========================================================================
  // SQL QUERY CUSTOM PROPERTY TESTS
  // ========================================================================

  @Test
  void test_tableColumn_sqlQueryCustomProperty(TestNamespace ns) throws Exception {
    String propName = ns.prefix("sqlProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, SQLQUERY_TYPE, null);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      String sqlQuery = "SELECT id, name FROM users WHERE active = true";
      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, sqlQuery);

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      assertEquals(sqlQuery, resultExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  // ========================================================================
  // ENTITY REFERENCE CUSTOM PROPERTY TESTS
  // ========================================================================

  @Test
  void test_tableColumn_entityReferenceCustomProperty(TestNamespace ns) throws Exception {
    String propName = ns.prefix("refProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      CustomPropertyConfig config = new CustomPropertyConfig();
      config.setConfig(List.of("user"));

      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, ENTITY_REFERENCE_TYPE, config);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      Map<String, Object> entityRef = new HashMap<>();
      entityRef.put("type", "user");
      entityRef.put("fullyQualifiedName", "admin");
      extension.put(propName, entityRef);

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      assertNotNull(resultExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  // ========================================================================
  // ENTITY REFERENCE LIST CUSTOM PROPERTY TESTS
  // ========================================================================

  @Test
  void test_tableColumn_entityReferenceListCustomProperty(TestNamespace ns) throws Exception {
    String propName = ns.prefix("refListProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      CustomPropertyConfig config = new CustomPropertyConfig();
      config.setConfig(List.of("user"));

      addCustomPropertyToColumnType(
          client, TABLE_COLUMN, propName, ENTITY_REFERENCE_LIST_TYPE, config);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      Map<String, Object> entityRef = new HashMap<>();
      entityRef.put("type", "user");
      entityRef.put("fullyQualifiedName", "admin");
      extension.put(propName, List.of(entityRef));

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      assertNotNull(resultExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  // ========================================================================
  // TIME INTERVAL CUSTOM PROPERTY TESTS
  // ========================================================================

  @Test
  void test_tableColumn_timeIntervalCustomProperty(TestNamespace ns) throws Exception {
    String propName = ns.prefix("intervalProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, TIME_INTERVAL_TYPE, null);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      Map<String, Object> interval = new HashMap<>();
      interval.put("start", System.currentTimeMillis());
      interval.put("end", System.currentTimeMillis() + 86400000L);
      extension.put(propName, interval);

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      assertNotNull(resultExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  // ========================================================================
  // VALIDATION TESTS
  // ========================================================================

  @Test
  void test_tableColumn_unknownProperty_fails(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTestTable(ns);
    String columnFQN = table.getFullyQualifiedName() + ".id";

    Map<String, Object> extension = new HashMap<>();
    extension.put("nonExistentProperty", "some-value");

    assertThrows(
        Exception.class,
        () -> updateColumn(client, columnFQN, "table", extension),
        "Setting undefined custom property should fail");
  }

  @Test
  void test_dashboardColumn_unknownProperty_fails(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    DashboardDataModel dataModel = createTestDashboardDataModel(ns);
    String columnFQN = dataModel.getFullyQualifiedName() + ".metric1";

    Map<String, Object> extension = new HashMap<>();
    extension.put("nonExistentDashProperty", "some-value");

    assertThrows(
        Exception.class,
        () -> updateColumn(client, columnFQN, "dashboardDataModel", extension),
        "Setting undefined custom property on dashboard column should fail");
  }

  // ========================================================================
  // CROSS-ENTITY TYPE ISOLATION TESTS
  // ========================================================================

  @Test
  void test_customProperties_crossEntityTypeIsolation(TestNamespace ns) throws Exception {
    String propName = ns.prefix("isolatedProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, STRING_TYPE, null);

      DashboardDataModel dataModel = createTestDashboardDataModel(ns);
      String columnFQN = dataModel.getFullyQualifiedName() + ".metric1";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, "should-fail-on-dashboard");

      assertThrows(
          Exception.class,
          () -> updateColumn(client, columnFQN, "dashboardDataModel", extension),
          "Using tableColumn property on dashboardDataModelColumn should fail");

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_samePropertyName_differentEntityTypes(TestNamespace ns) throws Exception {
    String propName = ns.prefix("sharedName");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, STRING_TYPE, null);
      addCustomPropertyToColumnType(client, DASHBOARD_DATA_MODEL_COLUMN, propName, INT_TYPE, null);

      Table table = createTestTable(ns);
      String tableColumnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> tableExtension = new HashMap<>();
      tableExtension.put(propName, "string-value");
      Column updatedTableColumn = updateColumn(client, tableColumnFQN, "table", tableExtension);

      DashboardDataModel dataModel = createTestDashboardDataModel(ns);
      String dashColumnFQN = dataModel.getFullyQualifiedName() + ".metric1";

      Map<String, Object> dashExtension = new HashMap<>();
      dashExtension.put(propName, 123);
      Column updatedDashColumn =
          updateColumn(client, dashColumnFQN, "dashboardDataModel", dashExtension);

      @SuppressWarnings("unchecked")
      Map<String, Object> tableExt = (Map<String, Object>) updatedTableColumn.getExtension();
      assertEquals("string-value", tableExt.get(propName));

      @SuppressWarnings("unchecked")
      Map<String, Object> dashExt = (Map<String, Object>) updatedDashColumn.getExtension();
      assertEquals(123, dashExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
      deleteCustomPropertyFromColumnType(client, DASHBOARD_DATA_MODEL_COLUMN, propName);
    }
  }

  // ========================================================================
  // UPDATE AND DELETE TESTS
  // ========================================================================

  @Test
  void test_tableColumn_updateCustomPropertyValue(TestNamespace ns) throws Exception {
    String propName = ns.prefix("updateProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, STRING_TYPE, null);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> initialExtension = new HashMap<>();
      initialExtension.put(propName, "initial-value");
      Column initialColumn = updateColumn(client, columnFQN, "table", initialExtension);

      @SuppressWarnings("unchecked")
      Map<String, Object> initialExt = (Map<String, Object>) initialColumn.getExtension();
      assertEquals("initial-value", initialExt.get(propName));

      Map<String, Object> updatedExtension = new HashMap<>();
      updatedExtension.put(propName, "updated-value");
      Column updatedColumn = updateColumn(client, columnFQN, "table", updatedExtension);

      @SuppressWarnings("unchecked")
      Map<String, Object> updatedExt = (Map<String, Object>) updatedColumn.getExtension();
      assertEquals("updated-value", updatedExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_tableColumn_multipleCustomProperties(TestNamespace ns) throws Exception {
    String strProp = ns.prefix("multiStr");
    String intProp = ns.prefix("multiInt");
    String mdProp = ns.prefix("multiMd");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, strProp, STRING_TYPE, null);
      addCustomPropertyToColumnType(client, TABLE_COLUMN, intProp, INT_TYPE, null);
      addCustomPropertyToColumnType(client, TABLE_COLUMN, mdProp, MARKDOWN_TYPE, null);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      extension.put(strProp, "string-value");
      extension.put(intProp, 42);
      extension.put(mdProp, "# Header\n\nText");

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      assertEquals("string-value", resultExt.get(strProp));
      assertEquals(42, resultExt.get(intProp));
      assertEquals("# Header\n\nText", resultExt.get(mdProp));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, strProp);
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, intProp);
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, mdProp);
    }
  }

  @Test
  void test_tableColumn_clearCustomProperties(TestNamespace ns) throws Exception {
    String propName = ns.prefix("clearProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, STRING_TYPE, null);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, "to-be-cleared");
      Column columnWithValue = updateColumn(client, columnFQN, "table", extension);

      @SuppressWarnings("unchecked")
      Map<String, Object> ext1 = (Map<String, Object>) columnWithValue.getExtension();
      assertEquals("to-be-cleared", ext1.get(propName));

      Column clearedColumn = updateColumn(client, columnFQN, "table", new HashMap<>());

      if (clearedColumn.getExtension() != null) {
        @SuppressWarnings("unchecked")
        Map<String, Object> clearedExt = (Map<String, Object>) clearedColumn.getExtension();
        assertFalse(clearedExt.containsKey(propName));
      }

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private Table createTestTable(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column idColumn = Columns.build("id").withType(ColumnDataType.BIGINT).primaryKey().create();
    Column nameColumn =
        Columns.build("name").withType(ColumnDataType.VARCHAR).withLength(255).create();

    return Tables.create()
        .name(ns.prefix("cpTestTable"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(idColumn, nameColumn))
        .withDescription("Test table for custom properties")
        .execute();
  }

  private DashboardDataModel createTestDashboardDataModel(TestNamespace ns) {
    DashboardService service = DashboardServiceTestFactory.createLooker(ns);

    List<Column> columns =
        Arrays.asList(
            new Column().withName("metric1").withDataType(ColumnDataType.BIGINT),
            new Column()
                .withName("dimension1")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(256));

    CreateDashboardDataModel request =
        new CreateDashboardDataModel()
            .withName(ns.prefix("cpTestDataModel"))
            .withDescription("Test data model for custom properties")
            .withService(service.getFullyQualifiedName())
            .withDataModelType(DataModelType.LookMlView)
            .withColumns(columns);

    return SdkClients.adminClient().dashboardDataModels().create(request);
  }

  private static Type getTypeByName(OpenMetadataClient client, String name) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/metadata/types/name/" + name, null);
    return OBJECT_MAPPER.readValue(response, Type.class);
  }

  private static Type getColumnType(OpenMetadataClient client, String columnTypeName)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/metadata/types/name/" + columnTypeName + "?fields=customProperties",
                null);
    return OBJECT_MAPPER.readValue(response, Type.class);
  }

  private void addCustomPropertyToColumnType(
      OpenMetadataClient client,
      String columnTypeName,
      String propertyName,
      Type propertyType,
      CustomPropertyConfig config)
      throws Exception {
    Type columnType = getColumnType(client, columnTypeName);

    CustomProperty customProperty =
        new CustomProperty()
            .withName(propertyName)
            .withDescription("Test custom property: " + propertyName)
            .withPropertyType(propertyType.getEntityReference());

    if (config != null) {
      customProperty.withCustomPropertyConfig(config);
    }

    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/metadata/types/" + columnType.getId().toString(),
            customProperty,
            Type.class);
  }

  private void deleteCustomPropertyFromColumnType(
      OpenMetadataClient client, String columnTypeName, String propertyName) {
    try {
      Type columnType = getColumnType(client, columnTypeName);
      client
          .getHttpClient()
          .execute(
              HttpMethod.DELETE,
              "/v1/metadata/types/" + columnType.getId().toString() + "/" + propertyName,
              null,
              Void.class);
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }

  private Column updateColumn(
      OpenMetadataClient client, String columnFQN, String entityType, Map<String, Object> extension)
      throws Exception {
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setExtension(extension);

    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/columns/name/" + encodeURIComponent(columnFQN) + "?entityType=" + entityType,
                updateColumn);

    return OBJECT_MAPPER.readValue(response, Column.class);
  }

  private static String encodeURIComponent(String value) {
    try {
      return java.net.URLEncoder.encode(value, "UTF-8").replace("+", "%20");
    } catch (java.io.UnsupportedEncodingException e) {
      throw new RuntimeException(e);
    }
  }
}
