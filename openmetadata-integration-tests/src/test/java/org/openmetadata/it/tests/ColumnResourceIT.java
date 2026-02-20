package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
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
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Columns;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.network.HttpMethod;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ColumnResourceIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final String TABLE = "table";
  private static final String DASHBOARD_DATA_MODEL = "dashboardDataModel";
  private static final String TABLE_COLUMN = "tableColumn";
  private static final String DASHBOARD_DATA_MODEL_COLUMN = "dashboardDataModelColumn";

  private static Type STRING_TYPE;
  private static Type INT_TYPE;

  @BeforeAll
  public static void setup() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Tables.setDefaultClient(client);
    Columns.setDefaultClient(client);

    STRING_TYPE = getTypeByName(client, "string");
    INT_TYPE = getTypeByName(client, "integer");
  }

  @Test
  void testCreateTableWithSimpleColumns(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    // Note: primaryKey() already implies NOT NULL, so don't chain with notNull() which overwrites
    Column idColumn = Columns.build("id").withType(ColumnDataType.BIGINT).primaryKey().create();

    Column nameColumn =
        Columns.build("name").withType(ColumnDataType.VARCHAR).withLength(255).notNull().create();

    Column emailColumn =
        Columns.build("email").withType(ColumnDataType.VARCHAR).withLength(255).unique().create();

    Table table =
        Tables.create()
            .name(ns.prefix("users"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(idColumn, nameColumn, emailColumn))
            .withDescription("User information table")
            .execute();

    assertNotNull(table);
    assertNotNull(table.getId());
    assertEquals(3, table.getColumns().size());

    Column retrievedId = table.getColumns().get(0);
    assertEquals("id", retrievedId.getName());
    assertEquals(ColumnDataType.BIGINT, retrievedId.getDataType());
    assertEquals(ColumnConstraint.PRIMARY_KEY, retrievedId.getConstraint());

    Column retrievedName = table.getColumns().get(1);
    assertEquals("name", retrievedName.getName());
    assertEquals(ColumnDataType.VARCHAR, retrievedName.getDataType());
    assertEquals(255, retrievedName.getDataLength());
    assertEquals(ColumnConstraint.NOT_NULL, retrievedName.getConstraint());

    Column retrievedEmail = table.getColumns().get(2);
    assertEquals("email", retrievedEmail.getName());
    assertEquals(ColumnDataType.VARCHAR, retrievedEmail.getDataType());
    assertEquals(255, retrievedEmail.getDataLength());
    assertEquals(ColumnConstraint.UNIQUE, retrievedEmail.getConstraint());
  }

  @Test
  void testCreateTableWithNumericColumns(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column idColumn = Columns.build("id").withType(ColumnDataType.BIGINT).primaryKey().create();

    Column priceColumn =
        Columns.build("price")
            .withType(ColumnDataType.DECIMAL)
            .withPrecision(10)
            .withScale(2)
            .create();

    Column quantityColumn =
        Columns.build("quantity").withType(ColumnDataType.INT).notNull().create();

    Column discountColumn =
        Columns.build("discount").withType(ColumnDataType.FLOAT).nullable().create();

    Table table =
        Tables.create()
            .name(ns.prefix("products"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(idColumn, priceColumn, quantityColumn, discountColumn))
            .execute();

    assertNotNull(table);
    assertEquals(4, table.getColumns().size());

    Column retrievedPrice = table.getColumns().get(1);
    assertEquals("price", retrievedPrice.getName());
    assertEquals(ColumnDataType.DECIMAL, retrievedPrice.getDataType());
    assertEquals(10, retrievedPrice.getPrecision());
    assertEquals(2, retrievedPrice.getScale());

    Column retrievedQuantity = table.getColumns().get(2);
    assertEquals("quantity", retrievedQuantity.getName());
    assertEquals(ColumnDataType.INT, retrievedQuantity.getDataType());
    assertEquals(ColumnConstraint.NOT_NULL, retrievedQuantity.getConstraint());

    Column retrievedDiscount = table.getColumns().get(3);
    assertEquals("discount", retrievedDiscount.getName());
    assertEquals(ColumnDataType.FLOAT, retrievedDiscount.getDataType());
    assertEquals(ColumnConstraint.NULL, retrievedDiscount.getConstraint());
  }

  @Test
  void testCreateTableWithDateTimeColumns(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column idColumn = Columns.build("id").withType(ColumnDataType.BIGINT).primaryKey().create();

    Column createdAtColumn =
        Columns.build("created_at").withType(ColumnDataType.TIMESTAMP).notNull().create();

    Column updatedAtColumn =
        Columns.build("updated_at").withType(ColumnDataType.TIMESTAMP).create();

    Column birthDateColumn = Columns.build("birth_date").withType(ColumnDataType.DATE).create();

    Column eventTimeColumn = Columns.build("event_time").withType(ColumnDataType.TIME).create();

    Table table =
        Tables.create()
            .name(ns.prefix("events"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(
                List.of(
                    idColumn, createdAtColumn, updatedAtColumn, birthDateColumn, eventTimeColumn))
            .execute();

    assertNotNull(table);
    assertEquals(5, table.getColumns().size());

    Column retrievedCreated = table.getColumns().get(1);
    assertEquals("created_at", retrievedCreated.getName());
    assertEquals(ColumnDataType.TIMESTAMP, retrievedCreated.getDataType());
    assertEquals(ColumnConstraint.NOT_NULL, retrievedCreated.getConstraint());

    Column retrievedBirthDate = table.getColumns().get(3);
    assertEquals("birth_date", retrievedBirthDate.getName());
    assertEquals(ColumnDataType.DATE, retrievedBirthDate.getDataType());

    Column retrievedEventTime = table.getColumns().get(4);
    assertEquals("event_time", retrievedEventTime.getName());
    assertEquals(ColumnDataType.TIME, retrievedEventTime.getDataType());
  }

  @Test
  void testCreateTableWithTextColumns(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column idColumn = Columns.build("id").withType(ColumnDataType.BIGINT).primaryKey().create();

    Column titleColumn =
        Columns.build("title").withType(ColumnDataType.VARCHAR).withLength(200).notNull().create();

    Column descriptionColumn = Columns.build("description").withType(ColumnDataType.TEXT).create();

    Column contentColumn = Columns.build("content").withType(ColumnDataType.MEDIUMTEXT).create();

    Column codeColumn = Columns.build("code").withType(ColumnDataType.CHAR).withLength(10).create();

    Table table =
        Tables.create()
            .name(ns.prefix("articles"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(
                List.of(idColumn, titleColumn, descriptionColumn, contentColumn, codeColumn))
            .execute();

    assertNotNull(table);
    assertEquals(5, table.getColumns().size());

    Column retrievedTitle = table.getColumns().get(1);
    assertEquals("title", retrievedTitle.getName());
    assertEquals(ColumnDataType.VARCHAR, retrievedTitle.getDataType());
    assertEquals(200, retrievedTitle.getDataLength());

    Column retrievedDescription = table.getColumns().get(2);
    assertEquals("description", retrievedDescription.getName());
    assertEquals(ColumnDataType.TEXT, retrievedDescription.getDataType());

    Column retrievedCode = table.getColumns().get(4);
    assertEquals("code", retrievedCode.getName());
    assertEquals(ColumnDataType.CHAR, retrievedCode.getDataType());
    assertEquals(10, retrievedCode.getDataLength());
  }

  @Test
  void testCreateTableWithBooleanAndBinaryColumns(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column idColumn = Columns.build("id").withType(ColumnDataType.BIGINT).primaryKey().create();

    Column isActiveColumn =
        Columns.build("is_active").withType(ColumnDataType.BOOLEAN).notNull().create();

    Column dataColumn =
        Columns.build("data").withType(ColumnDataType.BINARY).withLength(1024).create();

    Column metadataColumn =
        Columns.build("metadata").withType(ColumnDataType.VARBINARY).withLength(2048).create();

    Table table =
        Tables.create()
            .name(ns.prefix("settings"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(idColumn, isActiveColumn, dataColumn, metadataColumn))
            .execute();

    assertNotNull(table);
    assertEquals(4, table.getColumns().size());

    Column retrievedActive = table.getColumns().get(1);
    assertEquals("is_active", retrievedActive.getName());
    assertEquals(ColumnDataType.BOOLEAN, retrievedActive.getDataType());
    assertEquals(ColumnConstraint.NOT_NULL, retrievedActive.getConstraint());

    Column retrievedData = table.getColumns().get(2);
    assertEquals("data", retrievedData.getName());
    assertEquals(ColumnDataType.BINARY, retrievedData.getDataType());
    assertEquals(1024, retrievedData.getDataLength());

    Column retrievedMetadata = table.getColumns().get(3);
    assertEquals("metadata", retrievedMetadata.getName());
    assertEquals(ColumnDataType.VARBINARY, retrievedMetadata.getDataType());
    assertEquals(2048, retrievedMetadata.getDataLength());
  }

  @Test
  void testCreateTableWithComplexColumns(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column idColumn = Columns.build("id").withType(ColumnDataType.BIGINT).primaryKey().create();

    Column jsonColumn = Columns.build("json_data").withType(ColumnDataType.JSON).create();

    Column arrayColumn =
        Columns.build("tags")
            .withType(ColumnDataType.ARRAY)
            .withArrayDataType(ColumnDataType.VARCHAR)
            .create();

    Column uuidColumn = Columns.build("uuid").withType(ColumnDataType.UUID).unique().create();

    Table table =
        Tables.create()
            .name(ns.prefix("complex_data"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(idColumn, jsonColumn, arrayColumn, uuidColumn))
            .execute();

    assertNotNull(table);
    assertEquals(4, table.getColumns().size());

    Column retrievedJson = table.getColumns().get(1);
    assertEquals("json_data", retrievedJson.getName());
    assertEquals(ColumnDataType.JSON, retrievedJson.getDataType());

    Column retrievedArray = table.getColumns().get(2);
    assertEquals("tags", retrievedArray.getName());
    assertEquals(ColumnDataType.ARRAY, retrievedArray.getDataType());
    assertEquals(ColumnDataType.VARCHAR, retrievedArray.getArrayDataType());

    Column retrievedUuid = table.getColumns().get(3);
    assertEquals("uuid", retrievedUuid.getName());
    assertEquals(ColumnDataType.UUID, retrievedUuid.getDataType());
    assertEquals(ColumnConstraint.UNIQUE, retrievedUuid.getConstraint());
  }

  @Test
  void testCreateTableWithAllConstraintTypes(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column primaryKeyCol =
        Columns.build("id").withType(ColumnDataType.BIGINT).primaryKey().create();

    Column notNullCol =
        Columns.build("required_field")
            .withType(ColumnDataType.VARCHAR)
            .withLength(100)
            .notNull()
            .create();

    Column uniqueCol =
        Columns.build("unique_field")
            .withType(ColumnDataType.VARCHAR)
            .withLength(100)
            .unique()
            .create();

    Column nullableCol =
        Columns.build("optional_field")
            .withType(ColumnDataType.VARCHAR)
            .withLength(100)
            .nullable()
            .create();

    Table table =
        Tables.create()
            .name(ns.prefix("constraints_test"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(primaryKeyCol, notNullCol, uniqueCol, nullableCol))
            .execute();

    assertNotNull(table);
    assertEquals(4, table.getColumns().size());

    assertEquals(ColumnConstraint.PRIMARY_KEY, table.getColumns().get(0).getConstraint());
    assertEquals(ColumnConstraint.NOT_NULL, table.getColumns().get(1).getConstraint());
    assertEquals(ColumnConstraint.UNIQUE, table.getColumns().get(2).getConstraint());
    assertEquals(ColumnConstraint.NULL, table.getColumns().get(3).getConstraint());
  }

  @Test
  void testCreateTableWithDescriptionsAndDisplayNames(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column idColumn =
        Columns.build("id")
            .withType(ColumnDataType.BIGINT)
            .primaryKey()
            .withDescription("Primary key identifier")
            .withDisplayName("ID")
            .create();

    Column nameColumn =
        Columns.build("full_name")
            .withType(ColumnDataType.VARCHAR)
            .withLength(200)
            .withDescription("Complete name of the user")
            .withDisplayName("Full Name")
            .create();

    Table table =
        Tables.create()
            .name(ns.prefix("metadata_test"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(idColumn, nameColumn))
            .execute();

    assertNotNull(table);
    assertEquals(2, table.getColumns().size());

    Column retrievedId = table.getColumns().get(0);
    assertEquals("Primary key identifier", retrievedId.getDescription());
    assertEquals("ID", retrievedId.getDisplayName());

    Column retrievedName = table.getColumns().get(1);
    assertEquals("Complete name of the user", retrievedName.getDescription());
    assertEquals("Full Name", retrievedName.getDisplayName());
  }

  @Test
  void testCreateTableWithDefaultColumns(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    List<Column> defaultColumns = Columns.defaultColumns();

    Table table =
        Tables.create()
            .name(ns.prefix("default_columns"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(defaultColumns)
            .execute();

    assertNotNull(table);
    assertEquals(3, table.getColumns().size());

    assertEquals("id", table.getColumns().get(0).getName());
    assertEquals(ColumnDataType.BIGINT, table.getColumns().get(0).getDataType());

    assertEquals("name", table.getColumns().get(1).getName());
    assertEquals(ColumnDataType.VARCHAR, table.getColumns().get(1).getDataType());
    assertEquals(255, table.getColumns().get(1).getDataLength());

    assertEquals("created_at", table.getColumns().get(2).getName());
    assertEquals(ColumnDataType.TIMESTAMP, table.getColumns().get(2).getDataType());
  }

  @Test
  void testColumnBuilderVariousDataTypes(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column tinyintCol = Columns.build("tiny").withType(ColumnDataType.TINYINT).create();
    Column smallintCol = Columns.build("small").withType(ColumnDataType.SMALLINT).create();
    Column intCol = Columns.build("normal").withType(ColumnDataType.INT).create();
    Column bigintCol = Columns.build("big").withType(ColumnDataType.BIGINT).create();
    Column floatCol = Columns.build("float_val").withType(ColumnDataType.FLOAT).create();
    Column doubleCol = Columns.build("double_val").withType(ColumnDataType.DOUBLE).create();

    Table table =
        Tables.create()
            .name(ns.prefix("numeric_types"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(tinyintCol, smallintCol, intCol, bigintCol, floatCol, doubleCol))
            .execute();

    assertNotNull(table);
    assertEquals(6, table.getColumns().size());
    assertEquals(ColumnDataType.TINYINT, table.getColumns().get(0).getDataType());
    assertEquals(ColumnDataType.SMALLINT, table.getColumns().get(1).getDataType());
    assertEquals(ColumnDataType.INT, table.getColumns().get(2).getDataType());
    assertEquals(ColumnDataType.BIGINT, table.getColumns().get(3).getDataType());
    assertEquals(ColumnDataType.FLOAT, table.getColumns().get(4).getDataType());
    assertEquals(ColumnDataType.DOUBLE, table.getColumns().get(5).getDataType());
  }

  @Test
  void testColumnWithPrecisionAndScale(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column decimalCol =
        Columns.build("amount")
            .withType(ColumnDataType.DECIMAL)
            .withPrecision(18)
            .withScale(4)
            .withDescription("Monetary amount with precision")
            .create();

    Column numericCol =
        Columns.build("rate")
            .withType(ColumnDataType.NUMERIC)
            .withPrecision(5)
            .withScale(3)
            .create();

    Table table =
        Tables.create()
            .name(ns.prefix("precision_test"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(decimalCol, numericCol))
            .execute();

    assertNotNull(table);
    assertEquals(2, table.getColumns().size());

    Column retrievedDecimal = table.getColumns().get(0);
    assertEquals("amount", retrievedDecimal.getName());
    assertEquals(ColumnDataType.DECIMAL, retrievedDecimal.getDataType());
    assertEquals(18, retrievedDecimal.getPrecision());
    assertEquals(4, retrievedDecimal.getScale());

    Column retrievedNumeric = table.getColumns().get(1);
    assertEquals("rate", retrievedNumeric.getName());
    assertEquals(ColumnDataType.NUMERIC, retrievedNumeric.getDataType());
    assertEquals(5, retrievedNumeric.getPrecision());
    assertEquals(3, retrievedNumeric.getScale());
  }

  @Test
  void testCreateMultipleTablesWithDifferentColumns(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Table table1 =
        Tables.create()
            .name(ns.prefix("table1"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(
                List.of(
                    Columns.build("id").withType(ColumnDataType.BIGINT).primaryKey().create(),
                    Columns.build("name")
                        .withType(ColumnDataType.VARCHAR)
                        .withLength(100)
                        .create()))
            .execute();

    Table table2 =
        Tables.create()
            .name(ns.prefix("table2"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(
                List.of(
                    Columns.build("id").withType(ColumnDataType.INT).primaryKey().create(),
                    Columns.build("value").withType(ColumnDataType.DOUBLE).create()))
            .execute();

    Table table3 =
        Tables.create()
            .name(ns.prefix("table3"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(
                List.of(
                    Columns.build("uuid").withType(ColumnDataType.UUID).primaryKey().create(),
                    Columns.build("data").withType(ColumnDataType.JSON).create()))
            .execute();

    assertNotNull(table1);
    assertNotNull(table2);
    assertNotNull(table3);

    assertEquals(2, table1.getColumns().size());
    assertEquals(2, table2.getColumns().size());
    assertEquals(2, table3.getColumns().size());

    assertEquals(ColumnDataType.BIGINT, table1.getColumns().get(0).getDataType());
    assertEquals(ColumnDataType.INT, table2.getColumns().get(0).getDataType());
    assertEquals(ColumnDataType.UUID, table3.getColumns().get(0).getDataType());
  }

  @Test
  void testCreateTableWithNestedStructColumns(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column personalDetailsColumn =
        Columns.build("personal_details").withType(ColumnDataType.STRING).create();

    Column otherInfoColumn = Columns.build("other_info").withType(ColumnDataType.STRING).create();

    Column nestedStructColumn =
        Columns.build("customer_info")
            .withType(ColumnDataType.STRUCT)
            .withChildren(List.of(personalDetailsColumn, otherInfoColumn))
            .create();

    Column topLevelStructColumn =
        Columns.build("data")
            .withType(ColumnDataType.STRUCT)
            .withChildren(List.of(nestedStructColumn))
            .create();

    Table table =
        Tables.create()
            .name(ns.prefix("nested_table"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(topLevelStructColumn))
            .execute();

    assertNotNull(table);
    assertEquals(1, table.getColumns().size());

    Column retrievedTopLevel = table.getColumns().get(0);
    assertEquals("data", retrievedTopLevel.getName());
    assertEquals(ColumnDataType.STRUCT, retrievedTopLevel.getDataType());
    assertEquals(1, retrievedTopLevel.getChildren().size());

    Column retrievedNested = retrievedTopLevel.getChildren().get(0);
    assertEquals("customer_info", retrievedNested.getName());
    assertEquals(ColumnDataType.STRUCT, retrievedNested.getDataType());
    assertEquals(2, retrievedNested.getChildren().size());
  }

  @Test
  void testCreateTableWithEnumAndSetColumns(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column enumColumn = Columns.build("status").withType(ColumnDataType.ENUM).create();

    Column setColumn = Columns.build("permissions").withType(ColumnDataType.SET).create();

    Table table =
        Tables.create()
            .name(ns.prefix("enum_set_table"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(enumColumn, setColumn))
            .execute();

    assertNotNull(table);
    assertEquals(2, table.getColumns().size());
    assertEquals(ColumnDataType.ENUM, table.getColumns().get(0).getDataType());
    assertEquals(ColumnDataType.SET, table.getColumns().get(1).getDataType());
  }

  @Test
  void testCreateTableWithMapColumn(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column mapColumn = Columns.build("metadata").withType(ColumnDataType.MAP).create();

    Table table =
        Tables.create()
            .name(ns.prefix("map_table"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(mapColumn))
            .execute();

    assertNotNull(table);
    assertEquals(1, table.getColumns().size());
    assertEquals(ColumnDataType.MAP, table.getColumns().get(0).getDataType());
  }

  @Test
  void testCreateTableWithSpatialColumns(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column geometryColumn = Columns.build("location").withType(ColumnDataType.GEOMETRY).create();

    Column geographyColumn = Columns.build("region").withType(ColumnDataType.GEOGRAPHY).create();

    Column pointColumn = Columns.build("coordinates").withType(ColumnDataType.POINT).create();

    Table table =
        Tables.create()
            .name(ns.prefix("spatial_table"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(geometryColumn, geographyColumn, pointColumn))
            .execute();

    assertNotNull(table);
    assertEquals(3, table.getColumns().size());
    assertEquals(ColumnDataType.GEOMETRY, table.getColumns().get(0).getDataType());
    assertEquals(ColumnDataType.GEOGRAPHY, table.getColumns().get(1).getDataType());
    assertEquals(ColumnDataType.POINT, table.getColumns().get(2).getDataType());
  }

  @Test
  void testCreateTableWithIntervalColumn(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column intervalColumn = Columns.build("duration").withType(ColumnDataType.INTERVAL).create();

    Table table =
        Tables.create()
            .name(ns.prefix("interval_table"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(intervalColumn))
            .execute();

    assertNotNull(table);
    assertEquals(1, table.getColumns().size());
    assertEquals(ColumnDataType.INTERVAL, table.getColumns().get(0).getDataType());
  }

  @Test
  void testCreateTableWithUnionColumn(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column unionColumn = Columns.build("mixed_data").withType(ColumnDataType.UNION).create();

    Table table =
        Tables.create()
            .name(ns.prefix("union_table"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(unionColumn))
            .execute();

    assertNotNull(table);
    assertEquals(1, table.getColumns().size());
    assertEquals(ColumnDataType.UNION, table.getColumns().get(0).getDataType());
  }

  @Test
  void testCreateTableWithBytesColumn(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column bytesColumn =
        Columns.build("raw_data").withType(ColumnDataType.BYTES).withLength(2048).create();

    Table table =
        Tables.create()
            .name(ns.prefix("bytes_table"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(bytesColumn))
            .execute();

    assertNotNull(table);
    assertEquals(1, table.getColumns().size());

    Column retrievedBytes = table.getColumns().get(0);
    assertEquals("raw_data", retrievedBytes.getName());
    assertEquals(ColumnDataType.BYTES, retrievedBytes.getDataType());
    assertEquals(2048, retrievedBytes.getDataLength());
  }

  @Test
  void testCreateTableWithBlobColumns(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column blobColumn = Columns.build("blob_data").withType(ColumnDataType.BLOB).create();

    Column longblobColumn =
        Columns.build("longblob_data").withType(ColumnDataType.LONGBLOB).create();

    Column mediumblobColumn =
        Columns.build("mediumblob_data").withType(ColumnDataType.MEDIUMBLOB).create();

    Table table =
        Tables.create()
            .name(ns.prefix("blob_table"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(blobColumn, longblobColumn, mediumblobColumn))
            .execute();

    assertNotNull(table);
    assertEquals(3, table.getColumns().size());
    assertEquals(ColumnDataType.BLOB, table.getColumns().get(0).getDataType());
    assertEquals(ColumnDataType.LONGBLOB, table.getColumns().get(1).getDataType());
    assertEquals(ColumnDataType.MEDIUMBLOB, table.getColumns().get(2).getDataType());
  }

  @Test
  void testCreateTableWithTextVariantColumns(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column longtextColumn = Columns.build("longtext_data").withType(ColumnDataType.TEXT).create();

    Column tinytextColumn =
        Columns.build("tinytext_data").withType(ColumnDataType.MEDIUMTEXT).create();

    Table table =
        Tables.create()
            .name(ns.prefix("text_variants_table"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(longtextColumn, tinytextColumn))
            .execute();

    assertNotNull(table);
    assertEquals(2, table.getColumns().size());
    assertEquals(ColumnDataType.TEXT, table.getColumns().get(0).getDataType());
    assertEquals(ColumnDataType.MEDIUMTEXT, table.getColumns().get(1).getDataType());
  }

  @Test
  void testCreateTableWithOrdinalPositions(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column col1 =
        Columns.build("first_col").withType(ColumnDataType.INT).withOrdinalPosition(1).create();

    Column col2 =
        Columns.build("second_col")
            .withType(ColumnDataType.VARCHAR)
            .withLength(100)
            .withOrdinalPosition(2)
            .create();

    Column col3 =
        Columns.build("third_col").withType(ColumnDataType.BOOLEAN).withOrdinalPosition(3).create();

    Table table =
        Tables.create()
            .name(ns.prefix("ordinal_table"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(col1, col2, col3))
            .execute();

    assertNotNull(table);
    assertEquals(3, table.getColumns().size());
    assertEquals(1, table.getColumns().get(0).getOrdinalPosition());
    assertEquals(2, table.getColumns().get(1).getOrdinalPosition());
    assertEquals(3, table.getColumns().get(2).getOrdinalPosition());
  }

  @Test
  void testCreateTableWithMultipleConstraints(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column pkColumn = Columns.build("id").withType(ColumnDataType.INT).primaryKey().create();

    Column notNullColumn =
        Columns.build("required_name")
            .withType(ColumnDataType.VARCHAR)
            .withLength(100)
            .notNull()
            .create();

    Column uniqueColumn =
        Columns.build("email").withType(ColumnDataType.VARCHAR).withLength(255).unique().create();

    Column nullableColumn =
        Columns.build("optional_field")
            .withType(ColumnDataType.VARCHAR)
            .withLength(50)
            .nullable()
            .create();

    Table table =
        Tables.create()
            .name(ns.prefix("multi_constraint_table"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(pkColumn, notNullColumn, uniqueColumn, nullableColumn))
            .execute();

    assertNotNull(table);
    assertEquals(4, table.getColumns().size());
    assertEquals(ColumnConstraint.PRIMARY_KEY, table.getColumns().get(0).getConstraint());
    assertEquals(ColumnConstraint.NOT_NULL, table.getColumns().get(1).getConstraint());
    assertEquals(ColumnConstraint.UNIQUE, table.getColumns().get(2).getConstraint());
    assertEquals(ColumnConstraint.NULL, table.getColumns().get(3).getConstraint());
  }

  @Test
  void testCreateTableWithComplexDataTypes(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column xmlColumn = Columns.build("xml_data").withType(ColumnDataType.XML).create();

    Column hllColumn = Columns.build("hll_sketch").withType(ColumnDataType.HLL).create();

    Column rowtypeColumn = Columns.build("row_data").withType(ColumnDataType.STRUCT).create();

    Table table =
        Tables.create()
            .name(ns.prefix("complex_types_table"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(xmlColumn, hllColumn, rowtypeColumn))
            .execute();

    assertNotNull(table);
    assertEquals(3, table.getColumns().size());
    assertEquals(ColumnDataType.XML, table.getColumns().get(0).getDataType());
    assertEquals(ColumnDataType.HLL, table.getColumns().get(1).getDataType());
    assertEquals(ColumnDataType.STRUCT, table.getColumns().get(2).getDataType());
  }

  @Test
  void testCreateTableWithAggregateStateColumn(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column aggStateColumn =
        Columns.build("agg_state").withType(ColumnDataType.AGGREGATEFUNCTION).create();

    Table table =
        Tables.create()
            .name(ns.prefix("aggregate_table"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(aggStateColumn))
            .execute();

    assertNotNull(table);
    assertEquals(1, table.getColumns().size());
    assertEquals(ColumnDataType.AGGREGATEFUNCTION, table.getColumns().get(0).getDataType());
  }

  @Test
  void testCreateTableWithFixedAndLowCardinalityColumns(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column fixedColumn =
        Columns.build("fixed_data").withType(ColumnDataType.FIXED).withLength(16).create();

    Column lowCardColumn =
        Columns.build("category").withType(ColumnDataType.LOWCARDINALITY).create();

    Table table =
        Tables.create()
            .name(ns.prefix("fixed_lowcard_table"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(fixedColumn, lowCardColumn))
            .execute();

    assertNotNull(table);
    assertEquals(2, table.getColumns().size());
    assertEquals(ColumnDataType.FIXED, table.getColumns().get(0).getDataType());
    assertEquals(16, table.getColumns().get(0).getDataLength());
    assertEquals(ColumnDataType.LOWCARDINALITY, table.getColumns().get(1).getDataType());
  }

  @Test
  void testCreateTableWithColumnDescriptionsAndFullyQualifiedNames(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column idColumn =
        Columns.build("id")
            .withType(ColumnDataType.BIGINT)
            .primaryKey()
            .withDescription("Unique identifier")
            .withDisplayName("ID")
            .create();

    Column nameColumn =
        Columns.build("user_name")
            .withType(ColumnDataType.VARCHAR)
            .withLength(200)
            .withDescription("Full name of the user")
            .withDisplayName("User Name")
            .create();

    Table table =
        Tables.create()
            .name(ns.prefix("fqn_test_table"))
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(List.of(idColumn, nameColumn))
            .execute();

    assertNotNull(table);
    assertEquals(2, table.getColumns().size());

    Column retrievedId = table.getColumns().get(0);
    assertEquals("Unique identifier", retrievedId.getDescription());
    assertEquals("ID", retrievedId.getDisplayName());
    assertNotNull(retrievedId.getFullyQualifiedName());
    assertTrue(retrievedId.getFullyQualifiedName().contains("id"));

    Column retrievedName = table.getColumns().get(1);
    assertEquals("Full name of the user", retrievedName.getDescription());
    assertEquals("User Name", retrievedName.getDisplayName());
    assertNotNull(retrievedName.getFullyQualifiedName());
    assertTrue(retrievedName.getFullyQualifiedName().contains("user_name"));
  }

  // ========================================================================
  // COLUMN UPDATE TESTS - BASIC UPDATES
  // ========================================================================

  @Test
  void test_updateTableColumn_displayName(TestNamespace ns) throws Exception {
    Table table = createTestTableForUpdate(ns);
    String columnFQN = table.getFullyQualifiedName() + ".name";

    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Full Name");

    Column updatedColumn = updateColumn(SdkClients.adminClient(), columnFQN, TABLE, updateColumn);

    assertEquals("Full Name", updatedColumn.getDisplayName());
    assertEquals("name", updatedColumn.getName());
    assertEquals(ColumnDataType.VARCHAR, updatedColumn.getDataType());
  }

  @Test
  void test_updateTableColumn_description(TestNamespace ns) throws Exception {
    Table table = createTestTableForUpdate(ns);
    String columnFQN = table.getFullyQualifiedName() + ".email";

    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDescription("User's email address");

    Column updatedColumn = updateColumn(SdkClients.adminClient(), columnFQN, TABLE, updateColumn);

    assertEquals("User's email address", updatedColumn.getDescription());
  }

  @Test
  void test_updateTableColumn_tags(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Tag personalDataTag = createClassificationAndTag(ns, "PersonalDataCol", "PersonalCol");

    Table table = createTestTableForUpdate(ns);
    String columnFQN = table.getFullyQualifiedName() + ".id";

    UpdateColumn updateColumn = new UpdateColumn();
    TagLabel personalDataTagLabel =
        new TagLabel()
            .withTagFQN(personalDataTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    updateColumn.setTags(List.of(personalDataTagLabel));
    Column updatedColumn = updateColumn(client, columnFQN, TABLE, updateColumn);

    assertNotNull(updatedColumn.getTags());
    assertEquals(1, updatedColumn.getTags().size());
    assertEquals(
        personalDataTag.getFullyQualifiedName(), updatedColumn.getTags().get(0).getTagFQN());
  }

  @Test
  void test_updateTableColumn_constraint(TestNamespace ns) throws Exception {
    Table table = createTestTableForUpdate(ns);
    String columnFQN = table.getFullyQualifiedName() + ".email";

    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setConstraint(ColumnConstraint.UNIQUE);

    Column updatedColumn = updateColumn(SdkClients.adminClient(), columnFQN, TABLE, updateColumn);

    assertEquals(ColumnConstraint.UNIQUE, updatedColumn.getConstraint());
  }

  // ========================================================================
  // DASHBOARD DATA MODEL COLUMN TESTS
  // ========================================================================

  @Test
  void test_updateDashboardDataModelColumn(TestNamespace ns) throws Exception {
    DashboardDataModel dataModel = createTestDashboardDataModel(ns);
    String columnFQN = dataModel.getFullyQualifiedName() + ".metric1";

    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Sales Metric");
    updateColumn.setDescription("Total sales amount");
    updateColumn.setConstraint(ColumnConstraint.PRIMARY_KEY);

    Column updatedColumn =
        updateColumn(SdkClients.adminClient(), columnFQN, DASHBOARD_DATA_MODEL, updateColumn);

    assertEquals("Sales Metric", updatedColumn.getDisplayName());
    assertEquals("Total sales amount", updatedColumn.getDescription());
    assertNull(updatedColumn.getConstraint());
  }

  @Test
  void test_updateDashboardDataModelColumn_tagsAndGlossaryTerms(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Tag businessMetricsTag = createClassificationAndTag(ns, "BusinessMetricsCol", "RevenueCol");
    GlossaryTerm technicalTerm = createGlossaryAndTerm(ns, "TestGlossaryCol", "ContactInfoCol");

    DashboardDataModel dataModel = createTestDashboardDataModel(ns);
    String columnFQN = dataModel.getFullyQualifiedName() + ".dimension1";

    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Customer Dimension");
    updateColumn.setDescription("Customer dimension for analysis");

    TagLabel classificationTag =
        new TagLabel()
            .withTagFQN(businessMetricsTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    TagLabel glossaryTermLabel =
        new TagLabel()
            .withTagFQN(technicalTerm.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.GLOSSARY);

    updateColumn.setTags(List.of(classificationTag, glossaryTermLabel));

    Column updatedColumn = updateColumn(client, columnFQN, DASHBOARD_DATA_MODEL, updateColumn);

    assertEquals("Customer Dimension", updatedColumn.getDisplayName());
    assertEquals("Customer dimension for analysis", updatedColumn.getDescription());
    assertNotNull(updatedColumn.getTags());
    assertEquals(2, updatedColumn.getTags().size());
  }

  // ========================================================================
  // MULTIPLE UPDATES AND ERROR HANDLING TESTS
  // ========================================================================

  @Test
  void test_updateColumn_multipleUpdatesAtOnce(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Tag piiTag = createClassificationAndTag(ns, "PIICol", "SensitiveCol");

    Table table = createTestTableForUpdate(ns);
    String columnFQN = table.getFullyQualifiedName() + ".name";

    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Customer Name");
    updateColumn.setDescription("Name of the customer");

    TagLabel piiTagLabel =
        new TagLabel()
            .withTagFQN(piiTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    updateColumn.setTags(List.of(piiTagLabel));

    Column updatedColumn = updateColumn(client, columnFQN, TABLE, updateColumn);

    assertEquals("Customer Name", updatedColumn.getDisplayName());
    assertEquals("Name of the customer", updatedColumn.getDescription());
    assertEquals(1, updatedColumn.getTags().size());
  }

  @Test
  void test_updateColumn_nonExistentColumn_404(TestNamespace ns) throws Exception {
    Table table = createTestTableForUpdate(ns);
    String invalidColumnFQN = table.getFullyQualifiedName() + ".nonexistent";

    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Should Fail");

    Exception exception =
        assertThrows(
            Exception.class,
            () -> updateColumn(SdkClients.adminClient(), invalidColumnFQN, TABLE, updateColumn));

    assertTrue(exception.getMessage().contains("Column not found"));
  }

  @Test
  void test_updateColumn_nonExistentTable_404(TestNamespace ns) throws Exception {
    String invalidFQN = "nonexistent.service.database.schema.table.column";

    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Should Fail");

    Exception exception =
        assertThrows(
            Exception.class,
            () -> updateColumn(SdkClients.adminClient(), invalidFQN, TABLE, updateColumn));

    assertTrue(exception.getMessage().contains("not found"));
  }

  // ========================================================================
  // GLOSSARY TERMS AND MIXED TAGS TESTS
  // ========================================================================

  @Test
  void test_updateColumn_glossaryTerms(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    GlossaryTerm businessTerm = createGlossaryAndTerm(ns, "GlossaryA_Col", "CustomerDataCol");
    GlossaryTerm technicalTerm = createGlossaryAndTerm(ns, "GlossaryB_Col", "ContactInfoTermCol");

    Table table = createTestTableForUpdate(ns);
    String columnFQN = table.getFullyQualifiedName() + ".email";

    UpdateColumn updateColumn = new UpdateColumn();

    TagLabel glossaryTerm1 =
        new TagLabel()
            .withTagFQN(businessTerm.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.GLOSSARY);

    TagLabel glossaryTerm2 =
        new TagLabel()
            .withTagFQN(technicalTerm.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.GLOSSARY);

    updateColumn.setTags(List.of(glossaryTerm1, glossaryTerm2));
    Column updatedColumn = updateColumn(client, columnFQN, TABLE, updateColumn);

    assertNotNull(updatedColumn.getTags());
    assertEquals(2, updatedColumn.getTags().size());
    assertTrue(
        updatedColumn.getTags().stream()
            .allMatch(t -> t.getSource() == TagLabel.TagSource.GLOSSARY));
  }

  @Test
  void test_updateColumn_mixedTagsAndGlossaryTerms(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Tag personalDataTag = createClassificationAndTag(ns, "PersonalDataMixedCol", "PersonalMixCol");
    GlossaryTerm identifierTerm =
        createGlossaryAndTerm(ns, "TestGlossaryMixedCol", "IdentifierCol");

    Table table = createTestTableForUpdate(ns);
    String columnFQN = table.getFullyQualifiedName() + ".id";

    UpdateColumn updateColumn = new UpdateColumn();

    TagLabel classificationTag =
        new TagLabel()
            .withTagFQN(personalDataTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    TagLabel glossaryTermLabel =
        new TagLabel()
            .withTagFQN(identifierTerm.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.GLOSSARY);

    updateColumn.setTags(List.of(classificationTag, glossaryTermLabel));
    Column updatedColumn = updateColumn(client, columnFQN, TABLE, updateColumn);

    assertNotNull(updatedColumn.getTags());
    assertEquals(2, updatedColumn.getTags().size());

    boolean hasClassification =
        updatedColumn.getTags().stream()
            .anyMatch(tag -> tag.getSource() == TagLabel.TagSource.CLASSIFICATION);
    boolean hasGlossary =
        updatedColumn.getTags().stream()
            .anyMatch(tag -> tag.getSource() == TagLabel.TagSource.GLOSSARY);

    assertTrue(hasClassification);
    assertTrue(hasGlossary);
  }

  // ========================================================================
  // EMPTY STRING AND TAG REMOVAL TESTS
  // ========================================================================

  @Test
  void test_updateColumn_emptyStringValuesDeleteFields(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Tag testTag = createClassificationAndTag(ns, "EmptyTestCol", "TestTagCol");

    Table table = createTestTableForUpdate(ns);
    String columnFQN = table.getFullyQualifiedName() + ".name";

    UpdateColumn initialUpdate = new UpdateColumn();
    initialUpdate.setDisplayName("Initial Display Name");
    initialUpdate.setDescription("Initial description");
    TagLabel tagLabel =
        new TagLabel()
            .withTagFQN(testTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);
    initialUpdate.setTags(List.of(tagLabel));
    updateColumn(client, columnFQN, TABLE, initialUpdate);

    UpdateColumn emptyUpdate = new UpdateColumn();
    emptyUpdate.setDisplayName("");
    emptyUpdate.setDescription("   ");

    Column updatedColumn = updateColumn(client, columnFQN, TABLE, emptyUpdate);

    assertNull(updatedColumn.getDisplayName());
    assertNull(updatedColumn.getDescription());
    assertEquals(1, updatedColumn.getTags().size());
  }

  @Test
  void test_updateColumn_tagRemovalSupport(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Tag personalDataTag = createClassificationAndTag(ns, "RemovalTestCol", "PersonalRemCol");

    Table table = createTestTableForUpdate(ns);
    String columnFQN = table.getFullyQualifiedName() + ".email";

    UpdateColumn addTagsUpdate = new UpdateColumn();
    TagLabel testTag =
        new TagLabel()
            .withTagFQN(personalDataTag.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);
    addTagsUpdate.setTags(List.of(testTag));
    Column columnWithTags = updateColumn(client, columnFQN, TABLE, addTagsUpdate);
    assertEquals(1, columnWithTags.getTags().size());

    UpdateColumn removeTagsUpdate = new UpdateColumn();
    removeTagsUpdate.setTags(new ArrayList<>());
    Column columnWithoutTags = updateColumn(client, columnFQN, TABLE, removeTagsUpdate);

    assertTrue(columnWithoutTags.getTags() == null || columnWithoutTags.getTags().isEmpty());
  }

  @Test
  void test_updateColumn_selectiveTagRemoval(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Tag tag1 = createClassificationAndTag(ns, "SelectiveRemoval1Col", "Tag1Col");
    Tag tag2 = createClassificationAndTag(ns, "SelectiveRemoval2Col", "Tag2Col");

    Table table = createTestTableForUpdate(ns);
    String columnFQN = table.getFullyQualifiedName() + ".name";

    TagLabel tagLabel1 =
        new TagLabel()
            .withTagFQN(tag1.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);
    TagLabel tagLabel2 =
        new TagLabel()
            .withTagFQN(tag2.getFullyQualifiedName())
            .withSource(TagLabel.TagSource.CLASSIFICATION);

    UpdateColumn addAllUpdate = new UpdateColumn();
    addAllUpdate.setTags(List.of(tagLabel1, tagLabel2));
    Column columnWithAll = updateColumn(client, columnFQN, TABLE, addAllUpdate);
    assertEquals(2, columnWithAll.getTags().size());

    UpdateColumn removeOneUpdate = new UpdateColumn();
    removeOneUpdate.setTags(List.of(tagLabel1));
    Column columnWithOne = updateColumn(client, columnFQN, TABLE, removeOneUpdate);
    assertEquals(1, columnWithOne.getTags().size());
    assertEquals(tag1.getFullyQualifiedName(), columnWithOne.getTags().get(0).getTagFQN());
  }

  // ========================================================================
  // DELETE FIELD TESTS
  // ========================================================================

  @Test
  void test_deleteTableColumn_displayName(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTestTableForUpdate(ns);
    String columnFQN = table.getFullyQualifiedName() + ".name";

    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Full Name");
    updateColumn(client, columnFQN, TABLE, updateColumn);

    UpdateColumn deleteDisplayName = new UpdateColumn();
    deleteDisplayName.setDisplayName("");
    Column updatedColumn = updateColumn(client, columnFQN, TABLE, deleteDisplayName);

    assertNull(updatedColumn.getDisplayName());
  }

  @Test
  void test_deleteTableColumn_description(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTestTableForUpdate(ns);
    String columnFQN = table.getFullyQualifiedName() + ".email";

    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDescription("User's email address");
    updateColumn(client, columnFQN, TABLE, updateColumn);

    UpdateColumn deleteDescription = new UpdateColumn();
    deleteDescription.setDescription("");
    Column updatedColumn = updateColumn(client, columnFQN, TABLE, deleteDescription);

    assertNull(updatedColumn.getDescription());
  }

  @Test
  void test_deleteTableColumn_constraint(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTestTableForUpdate(ns);
    String columnFQN = table.getFullyQualifiedName() + ".email";

    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setConstraint(ColumnConstraint.UNIQUE);
    updateColumn(client, columnFQN, TABLE, updateColumn);

    UpdateColumn deleteConstraint = new UpdateColumn();
    deleteConstraint.setRemoveConstraint(true);
    Column updatedColumn = updateColumn(client, columnFQN, TABLE, deleteConstraint);

    assertNull(updatedColumn.getConstraint());
  }

  @Test
  void test_deleteDashboardDataModelColumn_displayName(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    DashboardDataModel dataModel = createTestDashboardDataModel(ns);
    String columnFQN = dataModel.getFullyQualifiedName() + ".metric1";

    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Sales Metric");
    updateColumn(client, columnFQN, DASHBOARD_DATA_MODEL, updateColumn);

    UpdateColumn deleteDisplayName = new UpdateColumn();
    deleteDisplayName.setDisplayName("");
    Column updatedColumn = updateColumn(client, columnFQN, DASHBOARD_DATA_MODEL, deleteDisplayName);

    assertNull(updatedColumn.getDisplayName());
  }

  // ========================================================================
  // CUSTOM PROPERTIES TESTS
  // ========================================================================

  @Test
  void test_tableColumnCustomProperties_completeLifecycle(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String testPropName = ns.prefix("tablePropCL");

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, testPropName + "_str", STRING_TYPE);
      addCustomPropertyToColumnType(client, TABLE_COLUMN, testPropName + "_int", INT_TYPE);

      Table table = createTestTableForUpdate(ns);
      String columnFQN = table.getFullyQualifiedName() + ".name";

      UpdateColumn addValues = new UpdateColumn();
      Map<String, Object> extension = new HashMap<>();
      extension.put(testPropName + "_str", "test-value");
      extension.put(testPropName + "_int", 42);
      addValues.setExtension(extension);

      Column columnWithValues = updateColumn(client, columnFQN, TABLE, addValues);

      if (columnWithValues.getExtension() != null) {
        @SuppressWarnings("unchecked")
        Map<String, Object> addedExt = (Map<String, Object>) columnWithValues.getExtension();
        assertEquals("test-value", addedExt.get(testPropName + "_str"));
        assertEquals(42, addedExt.get(testPropName + "_int"));
      }

      UpdateColumn removeValues = new UpdateColumn();
      removeValues.setExtension(new HashMap<>());
      Column columnWithoutValues = updateColumn(client, columnFQN, TABLE, removeValues);

      if (columnWithoutValues.getExtension() != null) {
        @SuppressWarnings("unchecked")
        Map<String, Object> removedExt = (Map<String, Object>) columnWithoutValues.getExtension();
        assertFalse(removedExt.containsKey(testPropName + "_str"));
        assertFalse(removedExt.containsKey(testPropName + "_int"));
      }

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, testPropName + "_str");
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, testPropName + "_int");
    }
  }

  @Test
  void test_dashboardDataModelColumnCustomProperties(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String stringPropName = ns.prefix("dashStrPropCL");
    String intPropName = ns.prefix("dashIntPropCL");

    try {
      addCustomPropertyToColumnType(
          client, DASHBOARD_DATA_MODEL_COLUMN, stringPropName, STRING_TYPE);
      addCustomPropertyToColumnType(client, DASHBOARD_DATA_MODEL_COLUMN, intPropName, INT_TYPE);

      DashboardDataModel dataModel = createTestDashboardDataModel(ns);
      String columnFQN = dataModel.getFullyQualifiedName() + ".metric1";

      UpdateColumn addValues = new UpdateColumn();
      Map<String, Object> extension = new HashMap<>();
      extension.put(stringPropName, "dashboard-value");
      extension.put(intPropName, 999);
      addValues.setExtension(extension);

      Column columnWithValues = updateColumn(client, columnFQN, DASHBOARD_DATA_MODEL, addValues);

      assertNotNull(columnWithValues.getExtension());
      @SuppressWarnings("unchecked")
      Map<String, Object> addedExt = (Map<String, Object>) columnWithValues.getExtension();
      assertEquals("dashboard-value", addedExt.get(stringPropName));
      assertEquals(999, addedExt.get(intPropName));

    } finally {
      deleteCustomPropertyFromColumnType(client, DASHBOARD_DATA_MODEL_COLUMN, stringPropName);
      deleteCustomPropertyFromColumnType(client, DASHBOARD_DATA_MODEL_COLUMN, intPropName);
    }
  }

  @Test
  void test_tableColumnCustomProperties_validation(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Table table = createTestTableForUpdate(ns);
    String columnFQN = table.getFullyQualifiedName() + ".name";

    UpdateColumn invalidUpdate = new UpdateColumn();
    Map<String, Object> invalidExtension = new HashMap<>();
    invalidExtension.put("undefinedProperty", "should-fail");
    invalidUpdate.setExtension(invalidExtension);

    Exception exception =
        assertThrows(Exception.class, () -> updateColumn(client, columnFQN, TABLE, invalidUpdate));

    assertTrue(exception.getMessage().contains("Unknown custom field"));
  }

  @Test
  void test_customProperties_crossEntityTypeIsolation(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String uniquePropName = ns.prefix("isolationTestCL");

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, uniquePropName, STRING_TYPE);
      addCustomPropertyToColumnType(client, DASHBOARD_DATA_MODEL_COLUMN, uniquePropName, INT_TYPE);

      Table table = createTestTableForUpdate(ns);
      String tableColumnFQN = table.getFullyQualifiedName() + ".email";

      UpdateColumn tableUpdate = new UpdateColumn();
      Map<String, Object> tableExtension = new HashMap<>();
      tableExtension.put(uniquePropName, "table-string-value");
      tableUpdate.setExtension(tableExtension);

      Column updatedTableColumn = updateColumn(client, tableColumnFQN, TABLE, tableUpdate);
      @SuppressWarnings("unchecked")
      Map<String, Object> tableExt = (Map<String, Object>) updatedTableColumn.getExtension();
      assertEquals("table-string-value", tableExt.get(uniquePropName));

      DashboardDataModel dataModel = createTestDashboardDataModel(ns);
      String dashColumnFQN = dataModel.getFullyQualifiedName() + ".dimension1";

      UpdateColumn dashUpdate = new UpdateColumn();
      Map<String, Object> dashExtension = new HashMap<>();
      dashExtension.put(uniquePropName, 456);
      dashUpdate.setExtension(dashExtension);

      Column updatedDashColumn =
          updateColumn(client, dashColumnFQN, DASHBOARD_DATA_MODEL, dashUpdate);
      @SuppressWarnings("unchecked")
      Map<String, Object> dashExt = (Map<String, Object>) updatedDashColumn.getExtension();
      assertEquals(456, dashExt.get(uniquePropName));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, uniquePropName);
      deleteCustomPropertyFromColumnType(client, DASHBOARD_DATA_MODEL_COLUMN, uniquePropName);
    }
  }

  @Test
  void test_customProperties_wrongEntityTypeError(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String tableOnlyProp = ns.prefix("tableOnlyPropCL");

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, tableOnlyProp, STRING_TYPE);

      DashboardDataModel dataModel = createTestDashboardDataModel(ns);
      String dashColumnFQN = dataModel.getFullyQualifiedName() + ".metric1";

      UpdateColumn dashUpdate = new UpdateColumn();
      Map<String, Object> dashExtension = new HashMap<>();
      dashExtension.put(tableOnlyProp, "wrong-entity-type");
      dashUpdate.setExtension(dashExtension);

      Exception exception =
          assertThrows(
              Exception.class,
              () -> updateColumn(client, dashColumnFQN, DASHBOARD_DATA_MODEL, dashUpdate));

      assertTrue(exception.getMessage().contains("Unknown custom field"));

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, tableOnlyProp);
    }
  }

  // ========================================================================
  // ENTITY TYPE VALIDATION TESTS
  // ========================================================================

  @Test
  void test_updateColumn_entityType_validation(TestNamespace ns) throws Exception {
    Table table = createTestTableForUpdate(ns);
    String columnFQN = table.getFullyQualifiedName() + ".name";

    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDisplayName("Test Display Name");

    Exception exception =
        assertThrows(
            Exception.class,
            () ->
                updateColumn(
                    SdkClients.adminClient(), columnFQN, "invalidEntityType", updateColumn));

    assertTrue(exception.getMessage().contains("Unsupported entity type"));
  }

  @Test
  void test_updateNestedTableColumn_description(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    List<Column> innerNestedColumns =
        List.of(new Column().withName("personal_details").withDataType(ColumnDataType.STRING));
    List<Column> customerInfoChildren =
        List.of(
            new Column()
                .withName("personal_details")
                .withDataType(ColumnDataType.STRUCT)
                .withChildren(innerNestedColumns));
    List<Column> deeplyNestedDataChildren =
        List.of(
            new Column()
                .withName("customer_info")
                .withDataType(ColumnDataType.STRUCT)
                .withChildren(customerInfoChildren));
    List<Column> columns =
        List.of(
            new Column()
                .withName("deeply_nested_data")
                .withDataType(ColumnDataType.STRUCT)
                .withChildren(deeplyNestedDataChildren));

    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable createTable =
        new CreateTable()
            .withName(ns.prefix("nestedTable"))
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withColumns(columns);
    Table nestedTable = client.tables().create(createTable);

    String columnFQN =
        nestedTable.getFullyQualifiedName() + ".deeply_nested_data.customer_info.personal_details";
    UpdateColumn updateColumn = new UpdateColumn();
    updateColumn.setDescription("<p>Personal details nested structure updated</p>");

    Column updatedColumn = updateColumn(client, columnFQN, TABLE, updateColumn);

    assertEquals(
        "<p>Personal details nested structure updated</p>", updatedColumn.getDescription());
  }

  @Test
  void test_nestedTableColumnCustomProperties(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    String nestedPropName = ns.prefix("nestedTestCL");

    try {
      addCustomPropertyToColumnType(client, TABLE_COLUMN, nestedPropName, STRING_TYPE);

      List<Column> nestedColumns =
          List.of(new Column().withName("nested_field").withDataType(ColumnDataType.STRING));
      List<Column> structColumns =
          List.of(
              new Column()
                  .withName("struct_column")
                  .withDataType(ColumnDataType.STRUCT)
                  .withChildren(nestedColumns));

      DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
      DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

      CreateTable createNestedTable =
          new CreateTable()
              .withName(ns.prefix("nestedCPTable"))
              .withDatabaseSchema(schema.getFullyQualifiedName())
              .withColumns(structColumns);
      Table nestedTable = client.tables().create(createNestedTable);

      String nestedColumnFQN = nestedTable.getFullyQualifiedName() + ".struct_column.nested_field";
      UpdateColumn updateNested = new UpdateColumn();
      Map<String, Object> nestedExtension = new HashMap<>();
      nestedExtension.put(nestedPropName, "nested-custom-value");
      updateNested.setExtension(nestedExtension);

      Column updatedNestedColumn = updateColumn(client, nestedColumnFQN, TABLE, updateNested);

      if (updatedNestedColumn.getExtension() != null) {
        @SuppressWarnings("unchecked")
        Map<String, Object> nestedExt = (Map<String, Object>) updatedNestedColumn.getExtension();
        assertEquals("nested-custom-value", nestedExt.get(nestedPropName));
      }

    } finally {
      deleteCustomPropertyFromColumnType(client, TABLE_COLUMN, nestedPropName);
    }
  }

  // ========================================================================
  // DERIVED TAGS TESTS
  // ========================================================================

  @Test
  void test_updateColumnWithDerivedTags(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Classification tierClassification = createClassification(client, ns, "TierDerivedCol");
    Tag tierTag = createTag(client, tierClassification, "Tier1Col");

    Glossary glossary = createGlossary(client, ns, "DerivedTagGlossaryCol");

    CreateGlossaryTerm createGlossaryTerm =
        new CreateGlossaryTerm()
            .withName(ns.prefix("CustomerDataDerivedCol"))
            .withDescription("Customer data term")
            .withGlossary(glossary.getFullyQualifiedName())
            .withTags(
                List.of(
                    new TagLabel()
                        .withTagFQN(tierTag.getFullyQualifiedName())
                        .withName(tierTag.getName())
                        .withSource(TagLabel.TagSource.CLASSIFICATION)
                        .withState(TagLabel.State.CONFIRMED)));
    GlossaryTerm glossaryTerm = client.glossaryTerms().create(createGlossaryTerm);

    Table table = createTestTableForUpdate(ns);
    String columnFQN = table.getFullyQualifiedName() + ".id";

    UpdateColumn updateColumnWithTags =
        new UpdateColumn()
            .withTags(
                List.of(
                    new TagLabel()
                        .withTagFQN(glossaryTerm.getFullyQualifiedName())
                        .withName(glossaryTerm.getName())
                        .withSource(TagLabel.TagSource.GLOSSARY)
                        .withState(TagLabel.State.CONFIRMED)));

    Column updatedColumn = updateColumn(client, columnFQN, TABLE, updateColumnWithTags);

    assertNotNull(updatedColumn.getTags());
    assertEquals(2, updatedColumn.getTags().size());

    TagLabel glossaryTag =
        updatedColumn.getTags().stream()
            .filter(tag -> tag.getSource() == TagLabel.TagSource.GLOSSARY)
            .findFirst()
            .orElse(null);
    assertNotNull(glossaryTag);
    assertEquals(glossaryTerm.getFullyQualifiedName(), glossaryTag.getTagFQN());
    assertEquals(TagLabel.LabelType.MANUAL, glossaryTag.getLabelType());

    TagLabel derivedTag =
        updatedColumn.getTags().stream()
            .filter(tag -> tag.getSource() == TagLabel.TagSource.CLASSIFICATION)
            .findFirst()
            .orElse(null);
    assertNotNull(derivedTag);
    assertEquals(tierTag.getFullyQualifiedName(), derivedTag.getTagFQN());
    assertEquals(TagLabel.LabelType.DERIVED, derivedTag.getLabelType());
  }

  // ========================================================================
  // HELPER METHODS
  // ========================================================================

  private Table createTestTableForUpdate(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    Column idColumn = Columns.build("id").withType(ColumnDataType.BIGINT).primaryKey().create();
    Column nameColumn =
        Columns.build("name").withType(ColumnDataType.VARCHAR).withLength(255).create();
    Column emailColumn =
        Columns.build("email").withType(ColumnDataType.VARCHAR).withLength(255).create();

    return Tables.create()
        .name(ns.prefix("updateTestTable"))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(idColumn, nameColumn, emailColumn))
        .withDescription("Test table for column update operations")
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
            .withName(ns.prefix("testDataModel"))
            .withDescription("Test data model for column operations")
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
      OpenMetadataClient client, String columnTypeName, String propertyName, Type propertyType)
      throws Exception {
    Type columnType = getColumnType(client, columnTypeName);

    CustomProperty customProperty =
        new CustomProperty()
            .withName(propertyName)
            .withDescription("Test custom property: " + propertyName)
            .withPropertyType(propertyType.getEntityReference());

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
      OpenMetadataClient client, String columnFQN, String entityType, UpdateColumn updateColumn)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/columns/name/" + encodeURIComponent(columnFQN) + "?entityType=" + entityType,
                updateColumn);

    return OBJECT_MAPPER.readValue(response, Column.class);
  }

  private Tag createClassificationAndTag(
      TestNamespace ns, String classificationName, String tagName) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Classification classification = createClassification(client, ns, classificationName);
    return createTag(client, classification, tagName);
  }

  private Classification createClassification(
      OpenMetadataClient client, TestNamespace ns, String classificationName) {
    CreateClassification createClassification =
        new CreateClassification()
            .withName(ns.prefix(classificationName))
            .withDescription("Test classification for " + classificationName);
    return client.classifications().create(createClassification);
  }

  private Tag createTag(OpenMetadataClient client, Classification classification, String tagName) {
    CreateTag createTag =
        new CreateTag()
            .withName(tagName)
            .withDescription("Test tag: " + tagName)
            .withClassification(classification.getFullyQualifiedName());
    return client.tags().create(createTag);
  }

  private GlossaryTerm createGlossaryAndTerm(TestNamespace ns, String glossaryName, String termName)
      throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Glossary glossary = createGlossary(client, ns, glossaryName);
    return createGlossaryTerm(client, glossary, ns, termName);
  }

  private Glossary createGlossary(
      OpenMetadataClient client, TestNamespace ns, String glossaryName) {
    CreateGlossary createGlossary =
        new CreateGlossary()
            .withName(ns.prefix(glossaryName))
            .withDescription("Test glossary for " + glossaryName);
    return client.glossaries().create(createGlossary);
  }

  private GlossaryTerm createGlossaryTerm(
      OpenMetadataClient client, Glossary glossary, TestNamespace ns, String termName) {
    CreateGlossaryTerm createGlossaryTerm =
        new CreateGlossaryTerm()
            .withName(ns.prefix(termName))
            .withDescription("Test term: " + termName)
            .withGlossary(glossary.getFullyQualifiedName());
    return client.glossaryTerms().create(createGlossaryTerm);
  }

  private static String encodeURIComponent(String value) {
    try {
      return java.net.URLEncoder.encode(value, "UTF-8").replace("+", "%20");
    } catch (java.io.UnsupportedEncodingException e) {
      throw new RuntimeException(e);
    }
  }
}
