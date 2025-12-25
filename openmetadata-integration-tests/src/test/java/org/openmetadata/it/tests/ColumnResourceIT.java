package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.sdk.fluent.Columns;
import org.openmetadata.sdk.fluent.Tables;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ColumnResourceIT {

  @BeforeAll
  public static void setup() {
    Tables.setDefaultClient(SdkClients.adminClient());
    Columns.setDefaultClient(SdkClients.adminClient());
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
}
