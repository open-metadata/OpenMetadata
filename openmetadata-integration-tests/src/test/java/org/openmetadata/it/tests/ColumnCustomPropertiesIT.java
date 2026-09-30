package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.BulkApi;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.SharedResourceLocks;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.schema.type.customProperties.EnumConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.Columns;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ReferenceKey;
import org.openmetadata.service.jdbi3.EntityExtensionReferenceCompaction;
import org.openmetadata.service.migration.utils.v210.CustomPropertyReferenceBackfill;
import org.openmetadata.service.util.FullyQualifiedName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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
@ResourceLock(
    value = SharedResourceLocks.TABLE_COLUMN_CUSTOM_PROPERTIES,
    mode = ResourceAccessMode.READ_WRITE)
@ExtendWith(TestNamespaceExtension.class)
public class ColumnCustomPropertiesIT {

  private static final Logger LOG = LoggerFactory.getLogger(ColumnCustomPropertiesIT.class);
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String TABLE_COLUMN = "tableColumn";
  private static final String DASHBOARD_DATA_MODEL_COLUMN = "dashboardDataModelColumn";
  private static final String DEEP_EXTENSION_VALUE = "deep-inline-value";

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
  void test_tableColumn_inlineExtensionInCreatePersists(TestNamespace ns) throws Exception {
    String propName = ns.prefix("inlineCreateProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, STRING_TYPE, null);

      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

      Map<String, Object> idExtension = new HashMap<>();
      idExtension.put(propName, "inline-on-create-id");
      Map<String, Object> nameExtension = new HashMap<>();
      nameExtension.put(propName, "inline-on-create-name");

      Column idColumn =
          new Column()
              .withName("id")
              .withDataType(ColumnDataType.BIGINT)
              .withExtension(idExtension);
      Column nameColumn =
          new Column()
              .withName("name")
              .withDataType(ColumnDataType.VARCHAR)
              .withDataLength(255)
              .withExtension(nameExtension);

      org.openmetadata.schema.api.data.CreateTable create =
          new org.openmetadata.schema.api.data.CreateTable()
              .withName(ns.prefix("inlineCpTable"))
              .withDatabaseSchema(schema.getFullyQualifiedName())
              .withColumns(List.of(idColumn, nameColumn));
      Table created = client.tables().create(create);

      Table reloaded = client.tables().get(created.getId().toString(), "columns,extension");
      assertNotNull(reloaded.getColumns());
      assertEquals(2, reloaded.getColumns().size());
      for (Column c : reloaded.getColumns()) {
        assertNotNull(
            c.getExtension(),
            "column " + c.getName() + " lost its inline extension on POST/PUT-create");
        @SuppressWarnings("unchecked")
        Map<String, Object> ext = (Map<String, Object>) c.getExtension();
        if ("id".equals(c.getName())) {
          assertEquals("inline-on-create-id", ext.get(propName));
        } else if ("name".equals(c.getName())) {
          assertEquals("inline-on-create-name", ext.get(propName));
        }
      }
    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_tableColumn_deeplyNestedInlineExtensionPersists(TestNamespace ns) throws Exception {
    String propName = ns.prefix("deepInlineCreateProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, STRING_TYPE, null);
      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
      CreateTable request =
          new CreateTable()
              .withName(ns.prefix("deepInlineCpTable"))
              .withDatabaseSchema(schema.getFullyQualifiedName())
              .withColumns(List.of(createDeeplyNestedColumn(propName)));

      Table created = client.tables().create(request);
      Table reloaded = client.tables().get(created.getId().toString(), "columns,extension");
      assertFalse(nullOrEmpty(reloaded.getColumns()), "reloaded table must contain columns");
      Column leaf = getDeepestColumn(reloaded.getColumns().getFirst());

      assertNotNull(leaf.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> extension = (Map<String, Object>) leaf.getExtension();
      assertEquals(DEEP_EXTENSION_VALUE, extension.get(propName));
    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_dashboardColumn_inlineExtensionInCreatePersists(TestNamespace ns) throws Exception {
    String propName = ns.prefix("inlineDashCreateProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(
          client, DASHBOARD_DATA_MODEL_COLUMN, propName, STRING_TYPE, null);

      DashboardService service = DashboardServiceTestFactory.createLooker(ns);

      Map<String, Object> metric1Ext = new HashMap<>();
      metric1Ext.put(propName, "inline-dash-metric");

      List<Column> columns =
          Arrays.asList(
              new Column()
                  .withName("metric1")
                  .withDataType(ColumnDataType.BIGINT)
                  .withExtension(metric1Ext),
              new Column()
                  .withName("dimension1")
                  .withDataType(ColumnDataType.VARCHAR)
                  .withDataLength(256));

      CreateDashboardDataModel request =
          new CreateDashboardDataModel()
              .withName(ns.prefix("inlineCpDataModel"))
              .withService(service.getFullyQualifiedName())
              .withDataModelType(DataModelType.LookMlView)
              .withColumns(columns);
      DashboardDataModel created = client.dashboardDataModels().create(request);

      DashboardDataModel reloaded =
          client.dashboardDataModels().get(created.getId().toString(), "columns,extension");
      Column metric1 =
          reloaded.getColumns().stream()
              .filter(c -> "metric1".equals(c.getName()))
              .findFirst()
              .orElseThrow();
      assertNotNull(
          metric1.getExtension(),
          "dashboardDataModel column metric1 lost its inline extension on POST");
      @SuppressWarnings("unchecked")
      Map<String, Object> ext = (Map<String, Object>) metric1.getExtension();
      assertEquals("inline-dash-metric", ext.get(propName));
    } finally {
      deleteCustomPropertyFromColumnType(client, DASHBOARD_DATA_MODEL_COLUMN, propName);
    }
  }

  @Test
  void test_tableColumn_inlineExtensionOnPutAddedColumnPersists(TestNamespace ns) throws Exception {
    String propName = ns.prefix("addedColProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, STRING_TYPE, null);

      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

      Column idColumn = new Column().withName("id").withDataType(ColumnDataType.BIGINT);
      org.openmetadata.schema.api.data.CreateTable create =
          new org.openmetadata.schema.api.data.CreateTable()
              .withName(ns.prefix("putAddedColTable"))
              .withDatabaseSchema(schema.getFullyQualifiedName())
              .withColumns(List.of(idColumn));
      Table created = client.tables().create(create);

      Map<String, Object> nameExtension = new HashMap<>();
      nameExtension.put(propName, "added-via-put");
      Column addedColumn =
          new Column()
              .withName("name")
              .withDataType(ColumnDataType.VARCHAR)
              .withDataLength(255)
              .withExtension(nameExtension);
      created.setColumns(List.of(idColumn, addedColumn));
      client.tables().update(created.getId().toString(), created);

      Table reloaded = client.tables().get(created.getId().toString(), "columns,extension");
      Column nameAfter =
          reloaded.getColumns().stream()
              .filter(c -> "name".equals(c.getName()))
              .findFirst()
              .orElseThrow();
      assertNotNull(
          nameAfter.getExtension(), "newly-added column lost its inline extension on PUT-update");
      @SuppressWarnings("unchecked")
      Map<String, Object> ext = (Map<String, Object>) nameAfter.getExtension();
      assertEquals("added-via-put", ext.get(propName));
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
  // TRANSFORMATION TESTS
  // ========================================================================

  @Test
  void test_tableColumn_enumSortingTransformation(TestNamespace ns) throws Exception {
    String propName = ns.prefix("enumSortTest");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      EnumConfig enumConfig = new EnumConfig();
      enumConfig.setValues(List.of("CRITICAL", "HIGH", "MEDIUM", "LOW"));
      enumConfig.setMultiSelect(true);
      CustomPropertyConfig config = new CustomPropertyConfig();
      config.setConfig(enumConfig);

      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, ENUM_TYPE, config);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, List.of("LOW", "CRITICAL", "MEDIUM"));

      Column updated = updateColumn(client, columnFQN, "table", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      @SuppressWarnings("unchecked")
      List<String> enumValues = (List<String>) resultExt.get(propName);
      assertEquals(3, enumValues.size());
      assertEquals(
          List.of("CRITICAL", "LOW", "MEDIUM"),
          enumValues,
          "Enum values should be sorted alphabetically");

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_dashboardColumn_enumSortingTransformation(TestNamespace ns) throws Exception {
    String propName = ns.prefix("dashEnumSort");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      EnumConfig enumConfig = new EnumConfig();
      enumConfig.setValues(List.of("A", "B", "C", "D"));
      enumConfig.setMultiSelect(true);
      CustomPropertyConfig config = new CustomPropertyConfig();
      config.setConfig(enumConfig);

      addCustomPropertyToColumnType(
          client, DASHBOARD_DATA_MODEL_COLUMN, propName, ENUM_TYPE, config);

      DashboardDataModel dataModel = createTestDashboardDataModel(ns);
      String columnFQN = dataModel.getFullyQualifiedName() + ".metric1";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, List.of("D", "B", "A"));

      Column updated = updateColumn(client, columnFQN, "dashboardDataModel", extension);

      assertNotNull(updated.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) updated.getExtension();
      @SuppressWarnings("unchecked")
      List<String> enumValues = (List<String>) resultExt.get(propName);
      assertEquals(3, enumValues.size());
      assertEquals(
          List.of("A", "B", "D"), enumValues, "Enum values should be sorted alphabetically");

    } finally {
      deleteCustomPropertyFromColumnType(client, DASHBOARD_DATA_MODEL_COLUMN, propName);
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

  @Test
  void test_tableColumn_getWithExtensionField(TestNamespace ns) throws Exception {
    String propName = ns.prefix("getExtProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, STRING_TYPE, null);

      Table table = createTestTable(ns);
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, "test-extension-value");

      updateColumn(client, columnFQN, "table", extension);

      Table fetchedTable = client.tables().get(table.getId().toString(), "columns,extension");

      assertNotNull(fetchedTable.getColumns());
      Column fetchedColumn =
          fetchedTable.getColumns().stream()
              .filter(col -> col.getName().equals("id"))
              .findFirst()
              .orElseThrow();

      assertNotNull(fetchedColumn.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) fetchedColumn.getExtension();
      assertEquals("test-extension-value", resultExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_dashboardColumn_getWithExtensionField(TestNamespace ns) throws Exception {
    String propName = ns.prefix("dashGetExtProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(
          client, DASHBOARD_DATA_MODEL_COLUMN, propName, STRING_TYPE, null);

      DashboardDataModel dataModel = createTestDashboardDataModel(ns);
      String columnFQN = dataModel.getFullyQualifiedName() + ".metric1";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, "dashboard-extension-value");

      updateColumn(client, columnFQN, "dashboardDataModel", extension);

      DashboardDataModel fetchedDataModel =
          client.dashboardDataModels().get(dataModel.getId().toString(), "columns,extension");

      assertNotNull(fetchedDataModel.getColumns());
      Column fetchedColumn =
          fetchedDataModel.getColumns().stream()
              .filter(col -> col.getName().equals("metric1"))
              .findFirst()
              .orElseThrow();

      assertNotNull(fetchedColumn.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> resultExt = (Map<String, Object>) fetchedColumn.getExtension();
      assertEquals("dashboard-extension-value", resultExt.get(propName));

    } finally {
      deleteCustomPropertyFromColumnType(client, DASHBOARD_DATA_MODEL_COLUMN, propName);
    }
  }

  // ========================================================================
  // CHANGE-DESCRIPTION / WORKFLOW-TRIGGER TESTS
  // ========================================================================

  @Test
  void test_tableColumn_extensionChange_recordedInTableChangeDescription(TestNamespace ns)
      throws Exception {
    String propName = ns.prefix("triggerProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, STRING_TYPE, null);

      Table table = createTestTable(ns);
      Double versionBefore = table.getVersion();
      String columnFQN = table.getFullyQualifiedName() + ".id";

      Map<String, Object> extension = new HashMap<>();
      extension.put(propName, "trigger-me");
      updateColumn(client, columnFQN, "table", extension);

      Table afterSet = client.tables().get(table.getId().toString(), "columns,extension");
      assertTrue(
          afterSet.getVersion() > versionBefore,
          "setting a column custom property must bump the table version so workflows can trigger");
      assertNotNull(
          findColumnExtensionChange(afterSet.getChangeDescription(), "id"),
          "table change description must record the column extension change");

      Double versionAfterSet = afterSet.getVersion();
      updateColumn(client, columnFQN, "table", extension);
      Table afterNoop = client.tables().get(table.getId().toString(), "columns,extension");
      assertEquals(
          versionAfterSet,
          afterNoop.getVersion(),
          "re-setting the identical column custom property must not bump the version");
    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_tableColumn_nestedExtensionUnchangedReingest_noVersionBump(TestNamespace ns)
      throws Exception {
    String propName = ns.prefix("nestedTriggerProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, STRING_TYPE, null);
      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

      CreateTable request =
          new CreateTable()
              .withName(ns.prefix("nestedReingestTable"))
              .withDatabaseSchema(schema.getFullyQualifiedName())
              .withColumns(List.of(createDeeplyNestedColumn(propName)));
      Table created = client.tables().create(request);
      Table withExtension = client.tables().get(created.getId().toString(), "columns,extension");
      Double versionAfterCreate = withExtension.getVersion();

      // Re-ingest the identical table via PUT. The nested leaf column's extension must hydrate as
      // the baseline (flattened read); an unchanged value must not record a FieldChange or bump the
      // version. Without the flattened read the nested baseline is null and a spurious change
      // fires.
      Table reingested = client.tables().update(created.getId().toString(), withExtension);
      assertEquals(
          versionAfterCreate,
          reingested.getVersion(),
          "re-ingesting an unchanged nested column custom property must not bump the version");
    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_tableColumn_extensionUnchangedBulkReingest_noVersionBump(TestNamespace ns)
      throws Exception {
    String propName = ns.prefix("bulkReingestProp");
    OpenMetadataClient client = SdkClients.adminClient();

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, propName, STRING_TYPE, null);
      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

      Map<String, Object> idExtension = new HashMap<>();
      idExtension.put(propName, "unchanged-bulk-value");
      CreateTable request =
          new CreateTable()
              .withName(ns.prefix("bulkReingestTable"))
              .withDatabaseSchema(schema.getFullyQualifiedName())
              .withColumns(
                  List.of(
                      new Column()
                          .withName("id")
                          .withDataType(ColumnDataType.BIGINT)
                          .withExtension(idExtension),
                      createDeeplyNestedColumn(propName)));
      Table created = client.tables().create(request);
      Double versionAfterCreate =
          client.tables().get(created.getId().toString(), "columns,extension").getVersion();

      // Re-ingest the identical table through the bulk upsert path. The bulk path hydrates its
      // originals separately from the single-entity PUT, so the stored column extensions (top-level
      // and nested) must be loaded there too; an unchanged value must not record a FieldChange.
      BulkOperationResult result =
          BulkApi.upsert("tables", List.of(request), false, BulkApi.botToken());
      assertEquals(1, result.getNumberOfRowsPassed(), "bulk re-ingest row must succeed");

      Table reingested = client.tables().get(created.getId().toString(), "columns,extension");
      assertEquals(
          versionAfterCreate,
          reingested.getVersion(),
          "bulk re-ingesting an unchanged column custom property must not bump the version");

      // A changed value through the same bulk path must still be recorded, so the assertion above
      // reflects a correct baseline rather than the bulk path ignoring column extensions.
      idExtension.put(propName, "changed-bulk-value");
      BulkOperationResult changedResult =
          BulkApi.upsert("tables", List.of(request), false, BulkApi.botToken());
      assertEquals(1, changedResult.getNumberOfRowsPassed(), "bulk change row must succeed");
      Table changed = client.tables().get(created.getId().toString(), "columns,extension");
      assertTrue(
          changed.getVersion() > versionAfterCreate,
          "bulk-changing a column custom property must bump the version");
      assertNotNull(
          findColumnExtensionChange(changed.getChangeDescription(), "id"),
          "bulk-changing a column custom property must record the column extension change");
    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, propName);
    }
  }

  private static FieldChange findColumnExtensionChange(ChangeDescription cd, String columnName) {
    if (cd == null) {
      return null;
    }
    List<FieldChange> allChanges = new ArrayList<>();
    if (cd.getFieldsAdded() != null) {
      allChanges.addAll(cd.getFieldsAdded());
    }
    if (cd.getFieldsUpdated() != null) {
      allChanges.addAll(cd.getFieldsUpdated());
    }
    return allChanges.stream()
        .filter(
            fc ->
                fc.getName() != null
                    && fc.getName().startsWith("columns")
                    && fc.getName().endsWith("extension")
                    && fc.getName().contains(columnName))
        .findFirst()
        .orElse(null);
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

  private Column createDeeplyNestedColumn(String propertyName) {
    Column leaf =
        new Column()
            .withName("level4")
            .withDataType(ColumnDataType.VARCHAR)
            .withDataLength(64)
            .withExtension(Map.of(propertyName, DEEP_EXTENSION_VALUE));
    Column level3 = structColumn("level3", leaf);
    Column level2 = structColumn("level2", level3);
    return structColumn("level1", level2);
  }

  private Column structColumn(String name, Column child) {
    return new Column()
        .withName(name)
        .withDataType(ColumnDataType.STRUCT)
        .withChildren(List.of(child));
  }

  private Column getDeepestColumn(Column column) {
    Column deepest = column;
    while (!nullOrEmpty(deepest.getChildren())) {
      deepest = deepest.getChildren().getFirst();
    }
    return deepest;
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

  // ========================================================================
  // ENTITY REFERENCE VALUES WHOSE TARGET IS HARD-DELETED (#29862)
  // ========================================================================

  private static final String TEAM = "team";
  private static final Map<String, String> HARD_DELETE =
      Map.of("hardDelete", "true", "recursive", "true");

  @Test
  void test_tableColumn_referenceList_hardDeletedTargetIsRemoved(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String propName =
        addTeamReferenceProperty(client, TABLE_COLUMN, ns, ENTITY_REFERENCE_LIST_TYPE);
    try {
      Team first = createTeam(client, ns.prefix("first"));
      Team second = createTeam(client, ns.prefix("second"));
      Table table = createTestTable(ns);
      String columnFqn = table.getFullyQualifiedName() + ".id";
      updateColumn(
          client, columnFqn, "table", Map.of(propName, List.of(teamRef(first), teamRef(second))));

      client.teams().delete(first.getId().toString(), HARD_DELETE);
      awaitCompacted(table.getId(), first.getId());

      assertEquals(
          List.of(second.getId().toString()),
          columnReferenceIds(tableWith(client, table, "columns,extension"), "id", propName));
      assertFalse(
          columnReferenceIds(tableWith(client, table, "columns"), "id", propName)
              .contains(first.getId().toString()),
          "the inline copy served without the extension field is filtered too");
      awaitCompacted(table.getId(), first.getId());
      assertEquals(List.of(second.getId().toString()), storedReferenceIds(table, "id", propName));
      assertFalse(
          inlineReferenceIds(table, "id", propName).contains(first.getId().toString()),
          "the sweep rewrites the holder's inline copy");
    } finally {
      removeColumnTypeProperty(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_tableColumn_singleReference_hardDeletedTargetUnsetsProperty(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String propName = addTeamReferenceProperty(client, TABLE_COLUMN, ns, ENTITY_REFERENCE_TYPE);
    try {
      Team team = createTeam(client, ns.prefix("only"));
      Table table = createTestTable(ns);
      updateColumn(
          client, table.getFullyQualifiedName() + ".id", "table", Map.of(propName, teamRef(team)));

      client.teams().delete(team.getId().toString(), HARD_DELETE);
      awaitCompacted(table.getId(), team.getId());

      assertTrue(
          columnReferenceIds(tableWith(client, table, "columns,extension"), "id", propName)
              .isEmpty());
      awaitCompacted(table.getId(), team.getId());
      assertTrue(storedReferenceIds(table, "id", propName).isEmpty());
    } finally {
      removeColumnTypeProperty(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_tableColumn_removedColumnDropsLedgerRows(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String propName =
        addTeamReferenceProperty(client, TABLE_COLUMN, ns, ENTITY_REFERENCE_LIST_TYPE);
    try {
      Team team = createTeam(client, ns.prefix("held"));
      Table table = createTestTable(ns);
      updateColumn(
          client,
          table.getFullyQualifiedName() + ".name",
          "table",
          Map.of(propName, List.of(teamRef(team))));
      assertEquals(1, ledgerRowsFor(team.getId()).size());

      Table current = client.tables().get(table.getId().toString(), "columns");
      current.setColumns(
          current.getColumns().stream().filter(c -> !"name".equals(c.getName())).toList());
      client.tables().update(table.getId().toString(), current);

      assertTrue(ledgerRowsFor(team.getId()).isEmpty());
    } finally {
      removeColumnTypeProperty(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_dataModelColumn_referenceList_hardDeletedTargetIsRemoved(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String propName =
        addTeamReferenceProperty(
            client, DASHBOARD_DATA_MODEL_COLUMN, ns, ENTITY_REFERENCE_LIST_TYPE);
    try {
      Team first = createTeam(client, ns.prefix("first"));
      Team second = createTeam(client, ns.prefix("second"));
      DashboardService service = DashboardServiceTestFactory.createLooker(ns);
      Column metric =
          new Column()
              .withName("metric1")
              .withDataType(ColumnDataType.BIGINT)
              .withExtension(Map.of(propName, List.of(teamRef(first), teamRef(second))));
      DashboardDataModel dataModel =
          client
              .dashboardDataModels()
              .create(
                  new CreateDashboardDataModel()
                      .withName(ns.prefix("refDataModel"))
                      .withService(service.getFullyQualifiedName())
                      .withDataModelType(DataModelType.LookMlView)
                      .withColumns(List.of(metric)));

      client.teams().delete(first.getId().toString(), HARD_DELETE);
      awaitCompacted(dataModel.getId(), first.getId());

      DashboardDataModel reloaded =
          client.dashboardDataModels().get(dataModel.getId().toString(), "columns,extension");
      assertEquals(
          List.of(second.getId().toString()),
          referenceIdsOf(columnNamed(reloaded.getColumns(), "metric1"), propName));
      awaitCompacted(dataModel.getId(), first.getId());
      String columnFqn = dataModel.getFullyQualifiedName() + ".metric1";
      assertEquals(
          List.of(second.getId().toString()),
          storedReferenceIds(dataModel.getId(), columnFqn, propName));
      DashboardDataModel stored =
          Entity.getCollectionDAO().dashboardDataModelDAO().findEntityById(dataModel.getId());
      assertEquals(
          List.of(second.getId().toString()),
          referenceIdsOf(columnNamed(stored.getColumns(), "metric1"), propName),
          "the sweep rewrites the data model's inline copy");
      assertEquals(1, ledgerRowsFor(second.getId()).size());
    } finally {
      removeColumnTypeProperty(client, DASHBOARD_DATA_MODEL_COLUMN, propName);
    }
  }

  /**
   * A second edit in the same session reverts to the pre-session snapshot, which still names a
   * target that was hard-deleted and already compacted away; the edit must not fail on it.
   */
  @Test
  void test_tableColumn_sessionConsolidationAfterHardDeleteSucceeds(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String propName =
        addTeamReferenceProperty(client, TABLE_COLUMN, ns, ENTITY_REFERENCE_LIST_TYPE);
    try {
      Team first = createTeam(client, ns.prefix("first"));
      Team second = createTeam(client, ns.prefix("second"));
      Team third = createTeam(client, ns.prefix("third"));
      Table table =
          createTableWithColumnReferences(ns, propName, List.of(teamRef(first), teamRef(second)));
      Table described = client.tables().get(table.getId().toString(), "columns");
      described.setDescription("Edited once in this session");
      client.tables().update(table.getId().toString(), described);
      client.teams().delete(first.getId().toString(), HARD_DELETE);
      awaitCompacted(table.getId(), first.getId());

      updateColumn(
          client,
          table.getFullyQualifiedName() + ".id",
          "table",
          Map.of(propName, List.of(teamRef(second), teamRef(third))));

      assertEquals(
          List.of(second.getId().toString(), third.getId().toString()),
          columnReferenceIds(tableWith(client, table, "columns,extension"), "id", propName));
      assertEquals(1, ledgerRowsFor(third.getId()).size());
    } finally {
      removeColumnTypeProperty(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_tableColumn_backfillMarksReferencesWhoseTargetIsGone(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String propName =
        addTeamReferenceProperty(client, TABLE_COLUMN, ns, ENTITY_REFERENCE_LIST_TYPE);
    try {
      Team first = createTeam(client, ns.prefix("first"));
      Team second = createTeam(client, ns.prefix("second"));
      Table table = createTestTable(ns);
      updateColumn(
          client,
          table.getFullyQualifiedName() + ".id",
          "table",
          Map.of(propName, List.of(teamRef(first), teamRef(second))));
      // A value written before the ledger existed: drop its rows, then lose the target.
      Entity.getCollectionDAO().entityExtensionReferenceDAO().deleteAll(table.getId());
      client.teams().delete(first.getId().toString(), HARD_DELETE);

      CustomPropertyReferenceBackfill.backfillCustomPropertyReferences(Entity.getCollectionDAO());
      awaitCompacted(table.getId(), first.getId());

      assertEquals(
          List.of(second.getId().toString()),
          columnReferenceIds(tableWith(client, table, "columns,extension"), "id", propName));
      awaitCompacted(table.getId(), first.getId());
      assertEquals(1, ledgerRowsFor(second.getId()).size());
    } finally {
      removeColumnTypeProperty(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_tableColumn_bulkCreateTracksReferences(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String propName =
        addTeamReferenceProperty(client, TABLE_COLUMN, ns, ENTITY_REFERENCE_LIST_TYPE);
    try {
      Team first = createTeam(client, ns.prefix("first"));
      Team second = createTeam(client, ns.prefix("second"));
      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
      Column idColumn =
          new Column()
              .withName("id")
              .withDataType(ColumnDataType.BIGINT)
              .withExtension(Map.of(propName, List.of(teamRef(first), teamRef(second))));
      CreateTable create =
          new CreateTable()
              .withName(ns.prefix("bulkRefTable"))
              .withDatabaseSchema(schema.getFullyQualifiedName())
              .withColumns(List.of(idColumn));
      client.tables().bulkCreateOrUpdate(List.of(create));
      Table table =
          client.tables().getByName(schema.getFullyQualifiedName() + "." + create.getName());

      client.teams().delete(first.getId().toString(), HARD_DELETE);
      awaitCompacted(table.getId(), first.getId());

      assertEquals(
          List.of(second.getId().toString()),
          columnReferenceIds(tableWith(client, table, "columns,extension"), "id", propName));
      awaitCompacted(table.getId(), first.getId());
      assertFalse(inlineReferenceIds(table, "id", propName).contains(first.getId().toString()));
    } finally {
      removeColumnTypeProperty(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_tableColumn_nestedColumnReferenceIsRemoved(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String propName =
        addTeamReferenceProperty(client, TABLE_COLUMN, ns, ENTITY_REFERENCE_LIST_TYPE);
    try {
      Team first = createTeam(client, ns.prefix("first"));
      Team second = createTeam(client, ns.prefix("second"));
      Column leaf =
          new Column()
              .withName("leaf")
              .withDataType(ColumnDataType.VARCHAR)
              .withDataLength(32)
              .withExtension(Map.of(propName, List.of(teamRef(first), teamRef(second))));
      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
      Table table =
          Tables.create()
              .name(ns.prefix("nestedRefTable"))
              .inSchema(schema.getFullyQualifiedName())
              .withColumns(List.of(structColumn("outer", leaf)))
              .execute();

      client.teams().delete(first.getId().toString(), HARD_DELETE);
      awaitCompacted(table.getId(), first.getId());

      Table reloaded = tableWith(client, table, "columns,extension");
      Column reloadedLeaf = getDeepestColumn(columnNamed(reloaded.getColumns(), "outer"));
      assertEquals(List.of(second.getId().toString()), referenceIdsOf(reloadedLeaf, propName));
      awaitCompacted(table.getId(), first.getId());
      assertEquals(
          List.of(second.getId().toString()),
          storedReferenceIds(table.getId(), reloadedLeaf.getFullyQualifiedName(), propName));
      Table stored = Entity.getCollectionDAO().tableDAO().findEntityById(table.getId());
      assertEquals(
          List.of(second.getId().toString()),
          referenceIdsOf(getDeepestColumn(columnNamed(stored.getColumns(), "outer")), propName));
    } finally {
      removeColumnTypeProperty(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_tableColumn_listEndpointFiltersDeletedTarget(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String propName =
        addTeamReferenceProperty(client, TABLE_COLUMN, ns, ENTITY_REFERENCE_LIST_TYPE);
    try {
      Team first = createTeam(client, ns.prefix("first"));
      Team second = createTeam(client, ns.prefix("second"));
      Table table =
          createTableWithColumnReferences(ns, propName, List.of(teamRef(first), teamRef(second)));

      client.teams().delete(first.getId().toString(), HARD_DELETE);
      awaitCompacted(table.getId(), first.getId());

      ListResponse<Table> page =
          client
              .tables()
              .list(
                  new ListParams()
                      .setFields("columns")
                      .withLimit(10)
                      .addFilter(
                          "databaseSchema", table.getDatabaseSchema().getFullyQualifiedName()));
      Table listed =
          page.getData().stream()
              .filter(t -> t.getId().equals(table.getId()))
              .findFirst()
              .orElseThrow();
      assertFalse(
          columnReferenceIds(listed, "id", propName).contains(first.getId().toString()),
          "list reads serve the inline copy and filter it");
    } finally {
      removeColumnTypeProperty(client, TABLE_COLUMN, propName);
    }
  }

  @Test
  void test_columnsApi_filtersDeletedTargetForTablesAndDataModels(TestNamespace ns)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String tableProp =
        addTeamReferenceProperty(client, TABLE_COLUMN, ns, ENTITY_REFERENCE_LIST_TYPE);
    String modelProp =
        addTeamReferenceProperty(
            client, DASHBOARD_DATA_MODEL_COLUMN, ns, ENTITY_REFERENCE_LIST_TYPE);
    try {
      Team first = createTeam(client, ns.prefix("first"));
      Team second = createTeam(client, ns.prefix("second"));
      Table table = createTestTable(ns);
      String tableColumn = table.getFullyQualifiedName() + ".id";
      updateColumn(
          client,
          tableColumn,
          "table",
          Map.of(tableProp, List.of(teamRef(first), teamRef(second))));
      DashboardDataModel dataModel =
          client
              .dashboardDataModels()
              .create(
                  new CreateDashboardDataModel()
                      .withName(ns.prefix("apiRefDataModel"))
                      .withService(
                          DashboardServiceTestFactory.createLooker(ns).getFullyQualifiedName())
                      .withDataModelType(DataModelType.LookMlView)
                      .withColumns(
                          List.of(
                              new Column()
                                  .withName("metric1")
                                  .withDataType(ColumnDataType.BIGINT)
                                  .withExtension(
                                      Map.of(
                                          modelProp, List.of(teamRef(first), teamRef(second)))))));
      String modelColumn = dataModel.getFullyQualifiedName() + ".metric1";

      client.teams().delete(first.getId().toString(), HARD_DELETE);
      awaitCompacted(table.getId(), first.getId());
      awaitCompacted(dataModel.getId(), first.getId());

      assertEquals(
          List.of(second.getId().toString()),
          referenceIdsOf(getColumnByName(client, tableColumn, "table", "extension"), tableProp));
      assertEquals(
          List.of(second.getId().toString()),
          referenceIdsOf(
              getColumnByName(client, modelColumn, "dashboardDataModel", "extension"), modelProp));
      // Without the extension field a column may or may not carry its inline copy; either way the
      // deleted target must not be in it.
      assertFalse(
          referenceIdsOf(getColumnByName(client, tableColumn, "table", "tags"), tableProp)
              .contains(first.getId().toString()));
      assertFalse(
          referenceIdsOf(
                  getColumnByName(client, modelColumn, "dashboardDataModel", "tags"), modelProp)
              .contains(first.getId().toString()));
    } finally {
      removeColumnTypeProperty(client, TABLE_COLUMN, tableProp);
      removeColumnTypeProperty(client, DASHBOARD_DATA_MODEL_COLUMN, modelProp);
    }
  }

  private Column getColumnByName(
      OpenMetadataClient client, String columnFqn, String entityType, String fields)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/columns/name/"
                    + encodeURIComponent(columnFqn)
                    + "?entityType="
                    + entityType
                    + "&fields="
                    + fields,
                null);
    return OBJECT_MAPPER.readValue(response, Column.class);
  }

  private String addTeamReferenceProperty(
      OpenMetadataClient client, String columnType, TestNamespace ns, Type propertyType)
      throws Exception {
    String propName = ns.prefix("teamRefs");
    CustomPropertyConfig config = new CustomPropertyConfig();
    config.setConfig(List.of(TEAM));
    addCustomPropertyToColumnType(client, columnType, propName, propertyType, config);
    return propName;
  }

  private static Team createTeam(OpenMetadataClient client, String name) {
    return client
        .teams()
        .create(new CreateTeam().withName(name).withTeamType(CreateTeam.TeamType.GROUP));
  }

  private static Map<String, Object> teamRef(Team team) {
    return Map.of(
        "id",
        team.getId().toString(),
        "type",
        TEAM,
        "name",
        team.getName(),
        "fullyQualifiedName",
        team.getFullyQualifiedName());
  }

  private Table createTableWithColumnReferences(
      TestNamespace ns, String propName, List<Map<String, Object>> refs) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    Column idColumn =
        Columns.build("id")
            .withType(ColumnDataType.BIGINT)
            .primaryKey()
            .create()
            .withExtension(Map.of(propName, refs));
    return Tables.create()
        .name(ns.prefix("cpRefTable"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(idColumn))
        .execute();
  }

  private static Table tableWith(OpenMetadataClient client, Table table, String fields) {
    return client.tables().get(table.getId().toString(), fields);
  }

  private static Column columnNamed(List<Column> columns, String name) {
    return columns.stream().filter(c -> name.equals(c.getName())).findFirst().orElseThrow();
  }

  private static List<String> columnReferenceIds(Table table, String columnName, String propName) {
    return referenceIdsOf(columnNamed(table.getColumns(), columnName), propName);
  }

  private static List<String> referenceIdsOf(Column column, String propName) {
    return referenceIdsIn(
        column.getExtension() == null ? null : JsonUtils.valueToTree(column.getExtension()),
        propName);
  }

  private static List<String> referenceIdsIn(JsonNode extension, String propName) {
    JsonNode value = extension == null ? null : extension.get(propName);
    List<String> ids = new ArrayList<>();
    if (value != null && value.isArray()) {
      value.forEach(ref -> ids.add(ref.path("id").asText()));
    } else if (value != null && value.isObject()) {
      ids.add(value.path("id").asText());
    }
    return ids;
  }

  /** The side-table row, as the compaction sweep leaves it. */
  private static List<String> storedReferenceIds(Table table, String columnName, String propName) {
    return storedReferenceIds(
        table.getId(), table.getFullyQualifiedName() + "." + columnName, propName);
  }

  private static List<String> storedReferenceIds(UUID holderId, String columnFqn, String propName) {
    String json =
        Entity.getCollectionDAO()
            .entityExtensionDAO()
            .getExtension(holderId, FullyQualifiedName.buildHash(columnFqn));
    return referenceIdsIn(json == null ? null : JsonUtils.readTree(json), propName);
  }

  /** Removes a column-type property by patching the type; there is no per-property DELETE route. */
  private static void removeColumnTypeProperty(
      OpenMetadataClient client, String columnType, String propName) throws Exception {
    String typeId = getColumnType(client, columnType).getId().toString();
    for (int attempt = 0; attempt < 5; attempt++) {
      int index = columnTypePropertyIndex(client, typeId, propName);
      if (index < 0) {
        return;
      }
      JsonNode patch =
          OBJECT_MAPPER.readTree(
              String.format(
                  "[{\"op\":\"test\",\"path\":\"/customProperties/%d/name\",\"value\":\"%s\"},"
                      + "{\"op\":\"remove\",\"path\":\"/customProperties/%d\"}]",
                  index, propName, index));
      try {
        client
            .getHttpClient()
            .execute(HttpMethod.PATCH, "/v1/metadata/types/" + typeId, patch, Type.class);
        return;
      } catch (OpenMetadataException e) {
        LOG.debug("Custom property index moved under the patch, retrying: {}", e.getMessage());
      }
    }
  }

  private static int columnTypePropertyIndex(
      OpenMetadataClient client, String typeId, String propName) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/metadata/types/" + typeId + "?fields=customProperties", null);
    JsonNode properties = OBJECT_MAPPER.readTree(response).path("customProperties");
    for (int index = 0; index < properties.size(); index++) {
      if (propName.equals(properties.get(index).path("name").asText())) {
        return index;
      }
    }
    return -1;
  }

  /** The copy inside the table's own JSON row, which reads without the extension field serve. */
  private static List<String> inlineReferenceIds(Table table, String columnName, String propName) {
    Table stored = Entity.getCollectionDAO().tableDAO().findEntityById(table.getId());
    return referenceIdsOf(columnNamed(stored.getColumns(), columnName), propName);
  }

  /**
   * A hard delete marks the references; the compaction sweep rewrites the values shortly after.
   * Tests run one compaction pass for the holder and wait for the settled state.
   */
  private static void awaitCompacted(UUID holderId, UUID deletedTarget) {
    Awaitility.await("column values compacted")
        .atMost(Duration.ofSeconds(30))
        .untilAsserted(
            () -> {
              new EntityExtensionReferenceCompaction(Entity.getCollectionDAO())
                  .compactPendingFor(holderId);
              assertTrue(ledgerRowsFor(deletedTarget).isEmpty());
              assertTrue(
                  Entity.getCollectionDAO()
                      .entityExtensionReferenceDAO()
                      .findPending(List.of(holderId.toString()))
                      .stream()
                      .noneMatch(row -> row.toId().equals(deletedTarget.toString())),
                  "marked rows are gone, so the sweep compacted the value");
            });
  }

  private static List<ReferenceKey> ledgerRowsFor(UUID target) {
    return Entity.getCollectionDAO()
        .entityExtensionReferenceDAO()
        .findByToIds(List.of(target.toString()));
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
