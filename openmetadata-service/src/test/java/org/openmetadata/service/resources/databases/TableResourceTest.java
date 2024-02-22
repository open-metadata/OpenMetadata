/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.databases;

import static java.util.Collections.singletonList;
import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.apache.commons.lang.StringEscapeUtils.escapeCsv;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.common.utils.CommonUtil.getDateStringByOffset;
import static org.openmetadata.common.utils.CommonUtil.listOf;
import static org.openmetadata.csv.CsvUtil.recordToString;
import static org.openmetadata.csv.EntityCsvTest.assertRows;
import static org.openmetadata.csv.EntityCsvTest.assertSummary;
import static org.openmetadata.csv.EntityCsvTest.createCsv;
import static org.openmetadata.csv.EntityCsvTest.getFailedRecord;
import static org.openmetadata.schema.type.ColumnDataType.ARRAY;
import static org.openmetadata.schema.type.ColumnDataType.BIGINT;
import static org.openmetadata.schema.type.ColumnDataType.BINARY;
import static org.openmetadata.schema.type.ColumnDataType.CHAR;
import static org.openmetadata.schema.type.ColumnDataType.DATE;
import static org.openmetadata.schema.type.ColumnDataType.DECIMAL;
import static org.openmetadata.schema.type.ColumnDataType.FLOAT;
import static org.openmetadata.schema.type.ColumnDataType.INT;
import static org.openmetadata.schema.type.ColumnDataType.STRING;
import static org.openmetadata.schema.type.ColumnDataType.STRUCT;
import static org.openmetadata.schema.type.ColumnDataType.VARCHAR;
import static org.openmetadata.service.Entity.FIELD_OWNER;
import static org.openmetadata.service.Entity.FIELD_TAGS;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.TAG;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.exception.CatalogExceptionMessage.invalidColumnFQN;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.security.mask.PIIMasker.MASKED_VALUE;
import static org.openmetadata.service.util.EntityUtil.fieldAdded;
import static org.openmetadata.service.util.EntityUtil.fieldDeleted;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;
import static org.openmetadata.service.util.EntityUtil.tagLabelMatch;
import static org.openmetadata.service.util.FullyQualifiedName.build;
import static org.openmetadata.service.util.RestUtil.DATE_FORMAT;
import static org.openmetadata.service.util.TestUtils.*;
import static org.openmetadata.service.util.TestUtils.UpdateType.CHANGE_CONSOLIDATED;
import static org.openmetadata.service.util.TestUtils.UpdateType.MAJOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.service.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.service.util.TestUtils.UpdateType.REVERT;

import java.io.IOException;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.csv.EntityCsv;
import org.openmetadata.schema.api.VoteRequest;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateQuery;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTableProfile;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.tests.CreateCustomMetric;
import org.openmetadata.schema.api.tests.CreateTestSuite;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Query;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.tests.CustomMetric;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ColumnJoin;
import org.openmetadata.schema.type.ColumnProfile;
import org.openmetadata.schema.type.ColumnProfilerConfig;
import org.openmetadata.schema.type.DataModel;
import org.openmetadata.schema.type.DataModel.ModelType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.JoinedWith;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.PartitionColumnDetails;
import org.openmetadata.schema.type.PartitionIntervalTypes;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TableConstraint.ConstraintType;
import org.openmetadata.schema.type.TableData;
import org.openmetadata.schema.type.TableJoins;
import org.openmetadata.schema.type.TablePartition;
import org.openmetadata.schema.type.TableProfile;
import org.openmetadata.schema.type.TableProfilerConfig;
import org.openmetadata.schema.type.TableType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.TableRepository.TableCsv;
import org.openmetadata.service.resources.EntityResourceTest;
import org.openmetadata.service.resources.databases.TableResource.TableList;
import org.openmetadata.service.resources.dqtests.TestSuiteResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryResourceTest;
import org.openmetadata.service.resources.glossary.GlossaryTermResourceTest;
import org.openmetadata.service.resources.query.QueryResource;
import org.openmetadata.service.resources.query.QueryResourceTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.resources.tags.ClassificationResourceTest;
import org.openmetadata.service.resources.tags.TagResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class TableResourceTest extends EntityResourceTest<Table, CreateTable> {
  private final TagResourceTest tagResourceTest = new TagResourceTest();
  private final DatabaseServiceResourceTest dbServiceTest = new DatabaseServiceResourceTest();
  private final DatabaseResourceTest dbTest = new DatabaseResourceTest();
  private final DatabaseSchemaResourceTest schemaTest = new DatabaseSchemaResourceTest();

  public TableResourceTest() {
    super(TABLE, Table.class, TableList.class, "tables", TableResource.FIELDS);
    supportedNameCharacters = "_'+#- .()$" + EntityResourceTest.RANDOM_STRING_GENERATOR.generate(1);
    supportsSearchIndex = true;
  }

  public void setupDatabaseSchemas(TestInfo test) throws IOException {
    CreateDatabase create =
        dbTest.createRequest(test).withService(SNOWFLAKE_REFERENCE.getFullyQualifiedName());
    DATABASE = dbTest.createEntity(create, ADMIN_AUTH_HEADERS);

    CreateDatabaseSchema createSchema =
        schemaTest.createRequest(test).withDatabase(DATABASE.getFullyQualifiedName());
    DATABASE_SCHEMA = schemaTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);

    COLUMNS =
        Arrays.asList(
            getColumn(C1, BIGINT, USER_ADDRESS_TAG_LABEL),
            getColumn(C2, ColumnDataType.VARCHAR, USER_ADDRESS_TAG_LABEL).withDataLength(10),
            getColumn(C3, BIGINT, GLOSSARY1_TERM1_LABEL));
  }

  @Test
  void post_tableWithoutColumnDataLength_400(TestInfo test) {
    List<Column> columns = singletonList(getColumn(C1, BIGINT, null).withOrdinalPosition(1));
    CreateTable create = createRequest(test).withColumns(columns);

    // char, varchar, binary, and varbinary columns must have length
    ColumnDataType[] columnDataTypes = {
      CHAR, ColumnDataType.VARCHAR, ColumnDataType.BINARY, ColumnDataType.VARBINARY
    };

    for (ColumnDataType dataType : columnDataTypes) {
      create.getColumns().get(0).withDataType(dataType);
      assertResponse(
          () -> createEntity(create, ADMIN_AUTH_HEADERS),
          BAD_REQUEST,
          "For column data types char, varchar, binary, varbinary dataLength must not be null");
    }
  }

  @Test
  void post_tableInvalidPrecisionScale_400(TestInfo test) {
    // No precision set but only column
    final List<Column> columns = singletonList(getColumn(C1, DECIMAL, null).withScale(1));
    final CreateTable create = createRequest(test).withColumns(columns);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Scale is set but precision is not set for the column " + C1);

    // Scale (decimal digits) larger than precision (total number of digits)
    columns.get(0).withScale(2).withPrecision(1);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Scale can't be greater than the precision for the column " + C1);
  }

  @Test
  void post_tableInvalidArrayColumn_400(TestInfo test) {
    // No arrayDataType passed for array
    List<Column> columns = singletonList(getColumn(C1, ARRAY, "array<int>", null));
    CreateTable create = createRequest(test).withColumns(columns);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "For column data type array, arrayDataType must not be null");
  }

  @Test
  void post_duplicateColumnName_400(TestInfo test) {
    // Duplicate column names c1
    String repeatedColumnName = C1;
    List<Column> columns =
        Arrays.asList(
            getColumn(repeatedColumnName, ARRAY, "array<int>", null),
            getColumn(repeatedColumnName, INT, null));
    CreateTable create = createRequest(test).withColumns(columns);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        String.format("Column name %s is repeated", repeatedColumnName));
  }

  @Test
  void post_validTables_200_OK(TestInfo test) throws IOException {
    // Create table with different optional fields
    // Optional field description
    CreateTable create = createRequest(test).withDescription("description");
    Table createdTable = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    // Optional fields tableType
    create.withName(getEntityName(test, 1)).withTableType(TableType.View);
    Table createdTableWithOptionalFields = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    assertNotNull(createdTable);
    assertNotNull(createdTableWithOptionalFields);
  }

  @Test
  void post_tableWithColumnWithDots(TestInfo test) throws IOException {
    CreateTable create = createRequest(test);
    List<Column> columns = new ArrayList<>();
    columns.add(getColumn("col.umn", INT, null));
    TableConstraint constraint =
        new TableConstraint()
            .withConstraintType(ConstraintType.UNIQUE)
            .withColumns(List.of(columns.get(0).getName()));
    create.setColumns(columns);
    create.setTableConstraints(List.of(constraint));
    Table created = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    Column column = created.getColumns().get(0);
    assertEquals("col.umn", column.getName());
    assertTrue(column.getFullyQualifiedName().contains("col.umn"));
    assertEquals("col.umn", created.getTableConstraints().get(0).getColumns().get(0));
  }

  @Test
  void post_tableWithPartition(TestInfo test) throws IOException {
    CreateTable create = createRequest(test).withTableConstraints(null);
    List<Column> columns = new ArrayList<>();
    columns.add(getColumn("user_id", INT, null));
    columns.add(getColumn("date", DATE, null));

    PartitionColumnDetails partitionColumnDetails =
        new PartitionColumnDetails()
            .withColumnName(columns.get(1).getName())
            .withIntervalType(PartitionIntervalTypes.TIME_UNIT)
            .withInterval("daily");

    TablePartition partition = new TablePartition().withColumns(List.of(partitionColumnDetails));
    create.setColumns(columns);
    create.setTablePartition(partition);
    Table created = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    assertTablePartition(partition, created.getTablePartition());
  }

  @Test
  void put_tableWithColumnWithOrdinalPositionAndWithoutOrdinalPosition(TestInfo test)
      throws IOException {
    CreateTable create = createRequest(test);
    Column column1 = getColumn("column1", INT, null, "column1", "c1").withOrdinalPosition(1);
    Column column2 = getColumn("column2", INT, null, "column2", "c2").withOrdinalPosition(2);
    Column column3 =
        getColumn("column3", STRING, null, "column3", null)
            .withOrdinalPosition(3)
            .withTags(List.of(USER_ADDRESS_TAG_LABEL, GLOSSARY1_TERM1_LABEL));

    TableConstraint constraint =
        new TableConstraint()
            .withConstraintType(ConstraintType.UNIQUE)
            .withColumns(List.of(column1.getName()));

    List<PartitionColumnDetails> listPartitionColumnDetails = new ArrayList<>();
    listPartitionColumnDetails.add(
        new PartitionColumnDetails()
            .withColumnName(column1.getName())
            .withIntervalType(PartitionIntervalTypes.COLUMN_VALUE)
            .withInterval("column"));
    listPartitionColumnDetails.add(
        new PartitionColumnDetails()
            .withColumnName(column2.getName())
            .withIntervalType(PartitionIntervalTypes.COLUMN_VALUE)
            .withInterval("column"));

    TablePartition partition = new TablePartition().withColumns(listPartitionColumnDetails);

    //
    // Create a table with two columns - column1, column2, table constraint and table partition
    //
    create.setColumns(new ArrayList<>(List.of(column1, column2)));
    create.setTableConstraints(List.of(constraint));
    create.setTablePartition(partition);
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    //
    // Update the column description and display name as a BOT user.
    // The updates are ignored for a BOT user and the table version does not change
    //
    create.getColumns().set(0, getColumn("column1", INT, null, "x", "y"));
    Table table = updateAndCheckEntity(create, OK, INGESTION_BOT_AUTH_HEADERS, NO_CHANGE, null);
    create.getColumns().set(0, column1); // Revert to previous value

    //
    // Description and DisplayName can be updated by a non-bot user
    // Update column1 description and displayName.
    // Remove column2 display name.
    // Add a new column column3.
    // Update table partition
    //
    column1.withDescription("").withDisplayName("");
    column2.withDisplayName(null);
    create.getColumns().add(column3);

    PartitionColumnDetails partitionColumnDetails =
        new PartitionColumnDetails()
            .withColumnName(column3.getName())
            .withIntervalType(PartitionIntervalTypes.COLUMN_VALUE)
            .withInterval("column");

    partition = new TablePartition().withColumns(List.of(partitionColumnDetails));
    create.setTablePartition(partition);

    ChangeDescription change = getChangeDescription(table, MINOR_UPDATE);
    fieldAdded(change, "columns", List.of(column3));
    fieldUpdated(change, build("columns", "column1", "description"), "column1", "");
    fieldUpdated(change, build("columns", "column1", "displayName"), "c1", "");
    fieldDeleted(change, build("columns", "column2", "displayName"), "c2");
    table = updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    //
    // Change the ordinal position of column2 from 2 to 3.
    // Change the ordinal position of column3 from 3 to 4.
    // Add column4 with ordinal position 3.
    //
    // After the update: TODO is this correct?
    // Column 3 must retain the ordinal position as 3
    // Column 4 must change to ordinal position as 4
    //
    column2.setOrdinalPosition(3);
    column3.setOrdinalPosition(4);
    Column column4 = getColumn("column4", STRING, null, "column4", null).withOrdinalPosition(2);
    create.getColumns().add(2, column4);

    change = getChangeDescription(table, MINOR_UPDATE);
    fieldAdded(change, "columns", List.of(column4));
    table = updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Change column1 data type from INT to STRING to cause major update
    Column updatedColumn1 =
        getColumn("column1", STRING, null, "column1", "c1").withOrdinalPosition(1);
    create.getColumns().set(0, updatedColumn1);
    change = getChangeDescription(table, MINOR_UPDATE);
    fieldDeleted(change, "columns", List.of(column1));
    fieldAdded(change, "columns", List.of(updatedColumn1));
    table = updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, MAJOR_UPDATE, change);

    // Delete column4 to cause major update
    create.getColumns().remove(2);
    change = getChangeDescription(table, MINOR_UPDATE);
    fieldDeleted(change, "columns", List.of(column4));
    table = updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, MAJOR_UPDATE, change);

    // Change the case of the column name for column2, and it shouldn't update
    column2.setName("COLUMN2");
    change = getChangeDescription(table, NO_CHANGE);
    updateAndCheckEntity(create, OK, ADMIN_AUTH_HEADERS, CHANGE_CONSOLIDATED, change);
  }

  public static Column getColumn(String name, ColumnDataType columnDataType, TagLabel tag) {
    return getColumn(name, columnDataType, null, tag);
  }

  public static Column getColumn(
      String name,
      ColumnDataType columnDataType,
      TagLabel tag,
      String description,
      String displayName) {
    return getColumn(name, columnDataType, null, tag)
        .withDescription(description)
        .withDisplayName(displayName);
  }

  private static Column getColumn(
      String name, ColumnDataType columnDataType, String dataTypeDisplay, TagLabel tag) {
    List<TagLabel> tags = tag == null ? new ArrayList<>() : singletonList(tag);
    return new Column()
        .withName(name)
        .withDataType(columnDataType)
        .withDescription(name)
        .withDataTypeDisplay(dataTypeDisplay)
        .withTags(tags);
  }

  @Test
  void post_put_patch_complexColumnTypes(TestInfo test) throws IOException {
    Column c1 = getColumn(C1, ARRAY, "array<int>", USER_ADDRESS_TAG_LABEL).withArrayDataType(INT);
    Column c2_a = getColumn("a", INT, USER_ADDRESS_TAG_LABEL);
    Column c2_b = getColumn("b", CHAR, USER_ADDRESS_TAG_LABEL);
    Column c2_c_d = getColumn("d", INT, USER_ADDRESS_TAG_LABEL);
    Column c2_c =
        getColumn("c", STRUCT, "struct<int: d>>", USER_ADDRESS_TAG_LABEL)
            .withChildren(new ArrayList<>(singletonList(c2_c_d)));

    // Column struct<a: int, b:char, c: struct<int: d>>>
    Column c2 =
        getColumn(C2, STRUCT, "struct<a: int, b:string, c: struct<int: d>>", GLOSSARY1_TERM1_LABEL)
            .withChildren(new ArrayList<>(Arrays.asList(c2_a, c2_b, c2_c)));

    // Test POST operation can create complex types
    // c1 array<int>
    // c2 struct<a: int, b:string, c: struct<int:d>>
    //   c2.a int
    //   c2.b char
    //   c2.c struct<int: d>>
    //     c2.c.d int
    CreateTable create1 = createRequest(test, 1).withColumns(Arrays.asList(c1, c2));
    Table table1 = createAndCheckEntity(create1, ADMIN_AUTH_HEADERS);

    // Test PUT operation - put operation to create
    CreateTable create2 =
        createRequest(test, 2).withColumns(Arrays.asList(c1, c2)).withName("put_complexColumnType");
    Table table2 =
        updateAndCheckEntity(create2, CREATED, ADMIN_AUTH_HEADERS, UpdateType.CREATED, null);

    // Test PUT operation again without any change
    ChangeDescription change = getChangeDescription(table2, NO_CHANGE);
    updateAndCheckEntity(create2, Status.OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);

    //
    // Update the complex columns
    //
    // c1 from array<int> to array<char> - Data type change means old c1 deleted, and new c1 added
    change = getChangeDescription(table2, MAJOR_UPDATE);
    fieldDeleted(change, "columns", List.of(c1));
    Column c1_new =
        getColumn(C1, ARRAY, "array<int>", USER_ADDRESS_TAG_LABEL).withArrayDataType(CHAR);
    fieldAdded(change, "columns", List.of(c1_new));

    // c2 from
    // struct<a:int, b:char, c:struct<d:int>>>
    // to
    // struct<-----, b:char, c:struct<d:int, e:char>, f:char>
    c2_b.withTags(
        List.of(USER_ADDRESS_TAG_LABEL, GLOSSARY1_TERM1_LABEL)); // Add new tag to c2.b tag
    fieldAdded(change, build("columns", C2, "b", "tags"), List.of(GLOSSARY1_TERM1_LABEL));
    Column c2_c_e = getColumn("e", INT, USER_ADDRESS_TAG_LABEL);
    c2_c.getChildren().add(c2_c_e); // Add c2.c.e
    fieldAdded(change, build("columns", C2, "c"), List.of(c2_c_e));
    fieldDeleted(change, build("columns", C2), List.of(c2.getChildren().get(0)));
    c2.getChildren().remove(0); // Remove c2.a from struct

    Column c2_f = getColumn("f", CHAR, USER_ADDRESS_TAG_LABEL);
    c2.getChildren().add(c2_f); // Add c2.f
    create2 = create2.withColumns(Arrays.asList(c1_new, c2));
    fieldAdded(change, build("columns", C2), List.of(c2_f));

    // Update the columns with PUT operation and validate update
    // c1 array<int>                                   --> c1 array<chart
    // c2 struct<a: int, b:string, c: struct<int:d>>   --> c2 struct<b:char, c:struct<d:int,
    // e:char>, f:char>
    //   c2.a int                                      --> DELETED
    //   c2.b char                                     --> SAME
    //   c2.c struct<int: d>>
    //     c2.c.d int
    updateAndCheckEntity(
        create2.withName("put_complexColumnType"),
        Status.OK,
        ADMIN_AUTH_HEADERS,
        MAJOR_UPDATE,
        change);

    //
    // Patch operations on table1 created by POST operation. Columns can't be added or deleted. Only
    // tags and description can be changed
    //
    String tableJson = JsonUtils.pojoToJson(table1);
    c1 = table1.getColumns().get(0);
    c1.withTags(singletonList(GLOSSARY1_TERM1_LABEL)); // c1 tag changed

    c2 = table1.getColumns().get(1);
    c2.getTags().add(USER_ADDRESS_TAG_LABEL); // c2 new tag added

    c2_a = c2.getChildren().get(0);
    c2_a.withTags(singletonList(GLOSSARY1_TERM1_LABEL)); // c2.a tag changed

    c2_b = c2.getChildren().get(1);
    c2_b.withTags(new ArrayList<>()); // c2.b tag removed

    c2_c = c2.getChildren().get(2);
    c2_c.withTags(new ArrayList<>()); // c2.c tag removed

    c2_c_d = c2_c.getChildren().get(0);
    c2_c_d.setTags(singletonList(GLOSSARY1_TERM1_LABEL)); // c2.c.d new tag added
    table1 = patchEntity(table1.getId(), tableJson, table1, ADMIN_AUTH_HEADERS);
    assertColumns(Arrays.asList(c1, c2), table1.getColumns());
  }

  @Test
  void post_tableWithInvalidDatabase_404(TestInfo test) {
    CreateTable create = createRequest(test).withDatabaseSchema("nonExistentSchema");
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.DATABASE_SCHEMA, "nonExistentSchema"));
  }

  @Test
  void put_columnUpdateWithDescriptionPersists_200(TestInfo test) throws IOException {
    List<Column> columns = new ArrayList<>();
    columns.add(
        getColumn(C1, VARCHAR, null).withDescription("c1VarcharDescription").withDataLength(255));
    CreateTable request = createRequest(test).withColumns(columns);
    Table table = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Update Request
    request.getColumns().get(0).withDataType(CHAR).withDataLength(200).withDescription(null);

    Table updatedTable = updateEntity(request, OK, ADMIN_AUTH_HEADERS);
    assertEquals(
        table.getColumns().get(0).getDescription(),
        updatedTable.getColumns().get(0).getDescription());
    assertEquals(CHAR, updatedTable.getColumns().get(0).getDataType());
    assertEquals(200, updatedTable.getColumns().get(0).getDataLength());
  }

  @Test
  void put_tableTableConstraintUpdate_200(TestInfo test) throws IOException {
    // Create table without table constraints
    CreateTable request =
        createRequest(test)
            .withOwner(USER1_REF)
            .withDescription("description")
            .withTableConstraints(null);
    Table table = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    checkOwnerOwns(USER1_REF, table.getId(), true);

    // Update the table with constraints and ensure minor version change
    ChangeDescription change = getChangeDescription(table, MINOR_UPDATE);
    TableConstraint constraint =
        new TableConstraint().withConstraintType(ConstraintType.UNIQUE).withColumns(List.of(C1));
    fieldAdded(change, "tableConstraints", List.of(constraint));
    request = request.withTableConstraints(List.of(constraint));
    Table updatedTable =
        updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Update again with no change. Version must not change
    change = getChangeDescription(updatedTable, NO_CHANGE);
    updatedTable = updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);

    // Update the table with new constraints
    change = getChangeDescription(updatedTable, MINOR_UPDATE);
    TableConstraint constraint1 =
        new TableConstraint()
            .withConstraintType(ConstraintType.PRIMARY_KEY)
            .withColumns(List.of(C1));
    request = request.withTableConstraints(List.of(constraint1));
    fieldAdded(change, "tableConstraints", List.of(constraint1));
    fieldDeleted(change, "tableConstraints", List.of(constraint));
    updatedTable = updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove table constraint and ensure minor version changes
    change = getChangeDescription(updatedTable, MINOR_UPDATE);
    request = request.withTableConstraints(null);
    fieldDeleted(change, "tableConstraints", List.of(constraint1));
    updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_columnConstraintUpdate_200(TestInfo test) throws IOException {
    List<Column> columns = new ArrayList<>();
    columns.add(getColumn(C1, INT, null).withConstraint(ColumnConstraint.NULL));
    columns.add(getColumn(C2, INT, null).withConstraint(ColumnConstraint.UNIQUE));
    CreateTable request = createRequest(test).withColumns(columns);
    Table table = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Change the column constraints and expect minor version change
    ChangeDescription change = getChangeDescription(table, MINOR_UPDATE);
    request.getColumns().get(0).withConstraint(ColumnConstraint.NOT_NULL);
    fieldUpdated(
        change,
        build("columns", C1, "constraint"),
        ColumnConstraint.NULL,
        ColumnConstraint.NOT_NULL);

    request.getColumns().get(1).withConstraint(ColumnConstraint.PRIMARY_KEY);
    fieldUpdated(
        change,
        build("columns", C2, "constraint"),
        ColumnConstraint.UNIQUE,
        ColumnConstraint.PRIMARY_KEY);

    Table updatedTable =
        updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove column constraints and expect minor version change
    change = getChangeDescription(updatedTable, MINOR_UPDATE);
    request.getColumns().get(0).withConstraint(null);
    fieldDeleted(change, build("columns", C1, "constraint"), ColumnConstraint.NOT_NULL);

    request.getColumns().get(1).withConstraint(null);
    fieldDeleted(change, build("columns", C2, "constraint"), ColumnConstraint.PRIMARY_KEY);
    updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_updateColumns_200(TestInfo test) throws IOException {
    int classificationUsageCount = getClassificationUsageCount("User", TEST_AUTH_HEADERS);
    int addressTagUsageCount =
        getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), TEST_AUTH_HEADERS);
    int glossaryTermUsageCount =
        getGlossaryTermUsageCount(GLOSSARY1_TERM1_LABEL.getTagFQN(), TEST_AUTH_HEADERS);

    //
    // Create a table with column c1, type BIGINT, description c1 and tag USER_ADDRESS_TAB_LABEL
    //
    List<TagLabel> tags = new ArrayList<>();
    tags.add(USER_ADDRESS_TAG_LABEL);
    tags.add(USER_ADDRESS_TAG_LABEL); // Duplicated tags should be handled
    List<Column> columns = new ArrayList<>();
    columns.add(getColumn(C1, BIGINT, null).withTags(tags));

    CreateTable request = createRequest(test).withColumns(columns);
    Table table = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    columns.get(0).setFullyQualifiedName(table.getFullyQualifiedName() + "." + C1);

    // Ensure classification and tag usage counts are updated
    assertEquals(
        classificationUsageCount + 1, getClassificationUsageCount("User", TEST_AUTH_HEADERS));
    assertEquals(
        addressTagUsageCount + 1,
        getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), TEST_AUTH_HEADERS));
    assertEquals(
        glossaryTermUsageCount,
        getGlossaryTermUsageCount(GLOSSARY1_TERM1_LABEL.getTagFQN(), TEST_AUTH_HEADERS));

    //
    // Update the c1 tags to  USER_ADDRESS_TAB_LABEL, GLOSSARY1_TERM1_LABEL (newly added)
    // Ensure description and previous tag is carried forward during update
    //
    tags.add(GLOSSARY1_TERM1_LABEL);
    tags.add(GLOSSARY1_TERM1_LABEL); // Duplicated tags should be handled
    List<Column> updatedColumns = new ArrayList<>();
    updatedColumns.add(getColumn(C1, BIGINT, null).withTags(tags));
    ChangeDescription change = getChangeDescription(table, MINOR_UPDATE);
    fieldAdded(change, build("columns", C1, "tags"), List.of(GLOSSARY1_TERM1_LABEL));
    table =
        updateAndCheckEntity(
            request.withColumns(updatedColumns), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Ensure tag usage counts are updated
    assertEquals(
        classificationUsageCount + 1, getClassificationUsageCount("User", TEST_AUTH_HEADERS));
    assertEquals(
        addressTagUsageCount + 1,
        getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), TEST_AUTH_HEADERS));
    assertEquals(
        glossaryTermUsageCount + 1,
        getGlossaryTermUsageCount(GLOSSARY1_TERM1_LABEL.getTagFQN(), TEST_AUTH_HEADERS));

    //
    // Add a new column c2 using PUT
    //
    change = getChangeDescription(table, MINOR_UPDATE);
    Column c2 =
        getColumn(C2, BINARY, null).withOrdinalPosition(2).withDataLength(10).withTags(tags);
    updatedColumns.add(c2);
    fieldAdded(change, "columns", List.of(c2));
    table =
        updateAndCheckEntity(
            request.withColumns(updatedColumns), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Ensure tag usage counts are updated - column c2 added both address
    assertEquals(
        classificationUsageCount + 2, getClassificationUsageCount("User", TEST_AUTH_HEADERS));
    assertEquals(
        addressTagUsageCount + 2,
        getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), TEST_AUTH_HEADERS));
    assertEquals(
        glossaryTermUsageCount + 2,
        getGlossaryTermUsageCount(GLOSSARY1_TERM1_LABEL.getTagFQN(), TEST_AUTH_HEADERS));

    //
    // Change the column c2 data length from 10 to 20. Increasing the data length is considered
    // backward compatible and only minor version changes
    //
    c2.setDataLength(20);
    change = getChangeDescription(table, MINOR_UPDATE);
    String fieldName = build("columns", C2, "dataLength");
    fieldUpdated(change, fieldName, 10, 20);
    table =
        updateAndCheckEntity(
            request.withColumns(updatedColumns), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    //
    // Change the column c2 data length from 20 to 10. Decreasing the data length is considered
    // backward compatible and results in major version changes
    //
    c2.setDataLength(10);
    change = getChangeDescription(table, MAJOR_UPDATE);
    fieldUpdated(change, fieldName, 20, 10);
    table =
        updateAndCheckEntity(
            request.withColumns(updatedColumns), OK, ADMIN_AUTH_HEADERS, MAJOR_UPDATE, change);

    //
    // Remove a column c2 and make sure it is deleted by PUT
    //
    change = getChangeDescription(table, MAJOR_UPDATE);
    updatedColumns.remove(1);
    fieldDeleted(change, "columns", List.of(c2));
    table =
        updateAndCheckEntity(
            request.withColumns(updatedColumns), OK, ADMIN_AUTH_HEADERS, MAJOR_UPDATE, change);
    assertEquals(1, table.getColumns().size());

    // Ensure tag usage counts are updated to reflect removal of column c2
    assertEquals(
        classificationUsageCount + 1, getClassificationUsageCount("User", TEST_AUTH_HEADERS));
    assertEquals(
        addressTagUsageCount + 1,
        getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), TEST_AUTH_HEADERS));
    assertEquals(
        glossaryTermUsageCount + 1,
        getGlossaryTermUsageCount(GLOSSARY1_TERM1_LABEL.getTagFQN(), TEST_AUTH_HEADERS));
  }

  @Test
  void put_tableJoins_200(TestInfo test) throws IOException {
    Table table1 = createAndCheckEntity(createRequest(test, 1), ADMIN_AUTH_HEADERS);
    Table table2 = createAndCheckEntity(createRequest(test, 2), ADMIN_AUTH_HEADERS);
    Table table3 = createAndCheckEntity(createRequest(test, 3), ADMIN_AUTH_HEADERS);

    // Fully qualified names for table1, table2, table3 columns
    String t1c1 = FullyQualifiedName.add(table1.getFullyQualifiedName(), C1);
    String t1c2 = FullyQualifiedName.add(table1.getFullyQualifiedName(), C2);
    String t1c3 = FullyQualifiedName.add(table1.getFullyQualifiedName(), C3);
    String t2c1 = FullyQualifiedName.add(table2.getFullyQualifiedName(), C1);
    String t2c2 = FullyQualifiedName.add(table2.getFullyQualifiedName(), C2);
    String t2c3 = FullyQualifiedName.add(table2.getFullyQualifiedName(), C3);
    String t3c1 = FullyQualifiedName.add(table3.getFullyQualifiedName(), C1);
    String t3c2 = FullyQualifiedName.add(table3.getFullyQualifiedName(), C2);
    String t3c3 = FullyQualifiedName.add(table3.getFullyQualifiedName(), C3);

    List<ColumnJoin> reportedColumnJoins =
        Arrays.asList(
            // table1.c1 is joined with table2.c1, and table3.c1 with join count 10
            new ColumnJoin()
                .withColumnName(C1)
                .withJoinedWith(
                    Arrays.asList(
                        new JoinedWith().withFullyQualifiedName(t2c1).withJoinCount(10),
                        new JoinedWith().withFullyQualifiedName(t3c1).withJoinCount(10))),
            // table1.c2 is joined with table2.c1, and table3.c3 with join count 20
            new ColumnJoin()
                .withColumnName(C2)
                .withJoinedWith(
                    Arrays.asList(
                        new JoinedWith().withFullyQualifiedName(t2c2).withJoinCount(20),
                        new JoinedWith().withFullyQualifiedName(t3c2).withJoinCount(20))),
            // table1.c3 is joined with table2.c1, and table3.c3 with join count 30
            new ColumnJoin()
                .withColumnName(C3)
                .withJoinedWith(
                    Arrays.asList(
                        new JoinedWith().withFullyQualifiedName(t2c3).withJoinCount(30),
                        new JoinedWith().withFullyQualifiedName(t3c3).withJoinCount(30))));

    List<JoinedWith> reportedDirectTableJoins =
        List.of(
            new JoinedWith()
                .withFullyQualifiedName(table2.getFullyQualifiedName())
                .withJoinCount(10),
            new JoinedWith()
                .withFullyQualifiedName(table3.getFullyQualifiedName())
                .withJoinCount(20));

    for (int i = 1; i <= 30; i++) {
      // Report joins starting from today back to 30 days. After every report, check the cumulative
      // join count
      TableJoins table1Joins =
          new TableJoins()
              .withDayCount(1)
              .withStartDate(RestUtil.today(-(i - 1)))
              .withColumnJoins(reportedColumnJoins)
              .withDirectTableJoins(reportedDirectTableJoins);
      Table putResponse = putJoins(table1.getId(), table1Joins, ADMIN_AUTH_HEADERS);

      List<ColumnJoin> expectedColumnJoins1 =
          Arrays.asList(
              // table1.c1 is joined with table2.c1, and table3.c1 with join count 10
              new ColumnJoin()
                  .withColumnName(C1)
                  .withJoinedWith(
                      Arrays.asList(
                          new JoinedWith().withFullyQualifiedName(t2c1).withJoinCount(10 * i),
                          new JoinedWith().withFullyQualifiedName(t3c1).withJoinCount(10 * i))),
              // table1.c2 is joined with table2.c1, and table3.c3 with join count 20
              new ColumnJoin()
                  .withColumnName(C2)
                  .withJoinedWith(
                      Arrays.asList(
                          new JoinedWith().withFullyQualifiedName(t2c2).withJoinCount(20 * i),
                          new JoinedWith().withFullyQualifiedName(t3c2).withJoinCount(20 * i))),
              // table1.c3 is joined with table2.c1, and table3.c3 with join count 30
              new ColumnJoin()
                  .withColumnName(C3)
                  .withJoinedWith(
                      Arrays.asList(
                          new JoinedWith().withFullyQualifiedName(t2c3).withJoinCount(30 * i),
                          new JoinedWith().withFullyQualifiedName(t3c3).withJoinCount(30 * i))));

      List<JoinedWith> expectedDirectTableJoins1 =
          List.of(
              new JoinedWith()
                  .withFullyQualifiedName(table2.getFullyQualifiedName())
                  .withJoinCount(10 * i),
              new JoinedWith()
                  .withFullyQualifiedName(table3.getFullyQualifiedName())
                  .withJoinCount(20 * i));

      // Ensure PUT response returns the joins information
      TableJoins actualJoins1 = putResponse.getJoins();
      assertColumnJoins(expectedColumnJoins1, actualJoins1);
      assertDirectTableJoins(expectedDirectTableJoins1, actualJoins1);

      // getTable and ensure the following column joins are correct
      table1 = getEntity(table1.getId(), "joins", ADMIN_AUTH_HEADERS);
      assertColumnJoins(expectedColumnJoins1, table1.getJoins());

      // getTable and ensure the following column joins are correct
      table2 = getEntity(table2.getId(), "joins", ADMIN_AUTH_HEADERS);
      List<ColumnJoin> expectedColumnJoins2 =
          Arrays.asList(
              // table2.c1 is joined with table1.c1 with join count 10
              new ColumnJoin()
                  .withColumnName(C1)
                  .withJoinedWith(
                      singletonList(
                          new JoinedWith().withFullyQualifiedName(t1c1).withJoinCount(10 * i))),
              // table2.c2 is joined with table1.c1 with join count 20
              new ColumnJoin()
                  .withColumnName(C2)
                  .withJoinedWith(
                      singletonList(
                          new JoinedWith().withFullyQualifiedName(t1c2).withJoinCount(20 * i))),
              // table2.c3 is joined with table1.c1 with join count 30
              new ColumnJoin()
                  .withColumnName(C3)
                  .withJoinedWith(
                      singletonList(
                          new JoinedWith().withFullyQualifiedName(t1c3).withJoinCount(30 * i))));

      List<JoinedWith> expectedDirectTableJoins2 =
          List.of(
              new JoinedWith()
                  .withFullyQualifiedName(table1.getFullyQualifiedName())
                  .withJoinCount(10 * i));

      TableJoins actualJoins2 = table2.getJoins();
      assertColumnJoins(expectedColumnJoins2, actualJoins2);
      assertDirectTableJoins(expectedDirectTableJoins2, actualJoins2);

      // getTable and ensure the following column joins
      table3 = getEntity(table3.getId(), "joins", ADMIN_AUTH_HEADERS);
      List<ColumnJoin> expectedColumnJoins3 =
          Arrays.asList(
              // table3.c1 is joined with table1.c1 with join count 10
              new ColumnJoin()
                  .withColumnName(C1)
                  .withJoinedWith(
                      singletonList(
                          new JoinedWith().withFullyQualifiedName(t1c1).withJoinCount(10 * i))),
              // table3.c2 is joined with table1.c1 with join count 20
              new ColumnJoin()
                  .withColumnName(C2)
                  .withJoinedWith(
                      singletonList(
                          new JoinedWith().withFullyQualifiedName(t1c2).withJoinCount(20 * i))),
              // table3.c3 is joined with table1.c1 with join count 30
              new ColumnJoin()
                  .withColumnName(C3)
                  .withJoinedWith(
                      singletonList(
                          new JoinedWith().withFullyQualifiedName(t1c3).withJoinCount(30 * i))));

      List<JoinedWith> expectedDirectTableJoins3 =
          List.of(
              new JoinedWith()
                  .withFullyQualifiedName(table1.getFullyQualifiedName())
                  .withJoinCount(20 * i));
      TableJoins actualJoins3 = table3.getJoins();
      assertColumnJoins(expectedColumnJoins3, actualJoins3);
      assertDirectTableJoins(expectedDirectTableJoins3, actualJoins3);

      // Report again for the previous day and make sure aggregate counts are correct
      table1Joins =
          new TableJoins()
              .withDayCount(1)
              .withStartDate(RestUtil.today(-1))
              .withColumnJoins(reportedColumnJoins)
              .withDirectTableJoins(reportedDirectTableJoins);
      putJoins(table1.getId(), table1Joins, ADMIN_AUTH_HEADERS);
      table1 = getEntity(table1.getId(), "joins", ADMIN_AUTH_HEADERS);
    }
  }

  @Test
  void put_tableJoinsInvalidColumnName_4xx(TestInfo test) throws IOException {
    Table table1 = createAndCheckEntity(createRequest(test, 1), ADMIN_AUTH_HEADERS);
    Table table2 = createAndCheckEntity(createRequest(test, 2), ADMIN_AUTH_HEADERS);

    // Invalid database name
    String invalidColumnFQN1 = "columnDB";
    TableJoins tableJoins1 = getTableJoins(getColumnJoin(C1, invalidColumnFQN1));
    assertResponse(
        () -> putJoins(table1.getId(), tableJoins1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        invalidColumnFQN(invalidColumnFQN1));

    // Invalid table name
    String invalidColumnFQN2 = table2.getDatabase().getName() + ".invalidTable.c1";
    TableJoins tableJoins2 = getTableJoins(getColumnJoin(C1, invalidColumnFQN2));
    assertResponse(
        () -> putJoins(table1.getId(), tableJoins2, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        invalidColumnFQN(invalidColumnFQN2));

    // Invalid column name
    String invalidColumnFQN3 = table2.getFullyQualifiedName() + ".invalidColumn";
    TableJoins tableJoins3 = getTableJoins(getColumnJoin(C1, invalidColumnFQN3));
    assertResponse(
        () -> putJoins(table1.getId(), tableJoins3, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        invalidColumnFQN(invalidColumnFQN3));

    // Invalid date older than 30 days
    String invalidColumnFQN4 = table2.getFullyQualifiedName() + ".c1";
    TableJoins tableJoins4 =
        getTableJoins(getColumnJoin(C1, invalidColumnFQN4)).withStartDate(RestUtil.today(-30));
    assertResponse(
        () -> putJoins(table1.getId(), tableJoins4, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Date range can only include past 30 days starting today");

    // Invalid direct table name
    String invalidTableFQN = table2.getDatabase().getName() + ".invalidTable";
    TableJoins tableJoins5 =
        new TableJoins()
            .withStartDate(RestUtil.today(0))
            .withDayCount(1)
            .withDirectTableJoins(
                List.of(new JoinedWith().withFullyQualifiedName(invalidTableFQN).withJoinCount(1)));
    assertResponse(
        () -> putJoins(table1.getId(), tableJoins5, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid table name " + invalidTableFQN);
  }

  public void assertColumnJoins(List<ColumnJoin> expected, TableJoins actual) {
    // Table reports last 30 days of aggregated join count
    assertEquals(actual.getStartDate(), getDateStringByOffset(DATE_FORMAT, RestUtil.today(0), -30));
    assertEquals(30, actual.getDayCount());

    // Sort the columnJoins and the joinedWith to account for different ordering
    expected.sort(Comparator.comparing(ColumnJoin::getColumnName));
    expected.forEach(
        c -> c.getJoinedWith().sort(Comparator.comparing(JoinedWith::getFullyQualifiedName)));
    actual.getColumnJoins().sort(Comparator.comparing(ColumnJoin::getColumnName));
    actual
        .getColumnJoins()
        .forEach(
            c -> c.getJoinedWith().sort(Comparator.comparing(JoinedWith::getFullyQualifiedName)));
    assertEquals(expected, actual.getColumnJoins());
  }

  public void assertDirectTableJoins(List<JoinedWith> expected, TableJoins actual) {
    // Table reports last 30 days of aggregated join count
    assertEquals(actual.getStartDate(), getDateStringByOffset(DATE_FORMAT, RestUtil.today(0), -30));
    assertEquals(30, actual.getDayCount());

    // Sort the columnJoins and the joinedWith to account for different ordering
    assertEquals(
        expected.stream()
            .sorted(Comparator.comparing(JoinedWith::getFullyQualifiedName))
            .collect(Collectors.toList()),
        actual.getDirectTableJoins().stream()
            .sorted(Comparator.comparing(JoinedWith::getFullyQualifiedName))
            .collect(Collectors.toList()));
  }

  @Test
  void put_tableSampleData_200(TestInfo test) throws IOException {
    Table table =
        createAndCheckEntity(createRequest(test).withOwner(USER1_REF), ADMIN_AUTH_HEADERS);
    List<String> columns = Arrays.asList(C1, C2, C3);

    // Add 3 rows of sample data for 3 columns
    List<List<Object>> rows =
        Arrays.asList(
            Arrays.asList("c1Value1", 1, true),
            Arrays.asList("c1Value2", null, false),
            Arrays.asList("c1Value3", 3, true));

    // Sample data can be put as an ADMIN
    putSampleData(table, columns, rows, ADMIN_AUTH_HEADERS);

    // Sample data can be put as owner
    rows.get(0).set(1, 2); // Change value 1 to 2
    putSampleData(table, columns, rows, authHeaders(USER1.getName()));

    // Sample data can't be put as non-owner, non-admin
    assertResponse(
        () -> putSampleData(table, columns, rows, authHeaders(USER2.getName())),
        FORBIDDEN,
        permissionNotAllowed(USER2.getName(), List.of(MetadataOperation.EDIT_SAMPLE_DATA)));
  }

  private void putSampleData(
      Table table, List<String> columns, List<List<Object>> rows, Map<String, String> authHeaders)
      throws IOException {
    TableData tableData = new TableData().withColumns(columns).withRows(rows);
    Table putResponse = putSampleData(table.getId(), tableData, authHeaders);
    assertEquals(tableData, putResponse.getSampleData());

    table = getSampleData(table.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(tableData, table.getSampleData());
  }

  @Test
  void put_tableInvalidSampleData_4xx(TestInfo test) throws IOException {
    Table table = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    TableData tableData = new TableData();

    // Send sample data with invalid column name
    List<String> columns = Arrays.asList(C1, C2, "invalidColumn"); // Invalid column name
    List<List<Object>> rows =
        singletonList(Arrays.asList("c1Value1", 1, true)); // Valid sample data
    tableData.withColumns(columns).withRows(rows);
    assertResponseContains(
        () -> putSampleData(table.getId(), tableData, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid column name invalidColumn");

    // Send sample data that has more samples than the number of columns
    columns = Arrays.asList(C1, C2, C3);
    rows = singletonList(Arrays.asList("c1Value1", 1, true, "extra value")); // Extra value
    tableData.withColumns(columns).withRows(rows);
    assertResponseContains(
        () -> putSampleData(table.getId(), tableData, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Number of columns is 3 but row has 4 sample values");

    // Send sample data that has fewer samples than the number of columns
    columns = Arrays.asList(C1, C2, C3);
    rows = singletonList(Arrays.asList("c1Value1", 1 /* Missing Value */));
    tableData.withColumns(columns).withRows(rows);
    assertResponseContains(
        () -> putSampleData(table.getId(), tableData, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Number of columns is 3 but row has 2 sample values");
  }

  @Test
  void put_viewDefinition_200(TestInfo test) throws IOException {
    CreateTable createTable = createRequest(test);
    createTable.setTableType(TableType.View);
    String query =
        """
                    sales_vw
                    create view sales_vw as
                    select * from public.sales
                    union all
                    select * from spectrum.sales
                    with no schema binding;
                    """;
    createTable.setViewDefinition(query);
    Table table = createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);
    table = getEntity(table.getId(), "viewDefinition", ADMIN_AUTH_HEADERS);
    LOG.info("table view definition {}", table.getViewDefinition());
    assertEquals(table.getViewDefinition(), query);
  }

  @Test
  void put_viewDefinition_invalid_table_4xx(TestInfo test) {
    CreateTable createTable = createRequest(test);
    createTable.setTableType(TableType.Regular);
    String query =
        """
                    sales_vw
                    create view sales_vw as
                    select * from public.sales
                    union all
                    select * from spectrum.sales
                    with no schema binding;
                    """;
    createTable.setViewDefinition(query);
    assertResponseContains(
        () -> createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "ViewDefinition can only be set on TableType View, SecureView or MaterializedView");
  }

  @Test
  void put_profileConfig_200(TestInfo test) throws IOException {
    CreateTable request = createRequest(test).withOwner(USER1_REF);
    Table table = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Admin can PUT profile configuration
    putProfileConfig(table, ADMIN_AUTH_HEADERS);

    // Owner can PUT profile configuration
    putProfileConfig(table, authHeaders(USER1.getName()));

    // Non-owner/non-admin can't PUT profile configuration
    assertResponse(
        () -> putProfileConfig(table, authHeaders(USER2.getName())),
        FORBIDDEN,
        permissionNotAllowed(USER2.getName(), List.of(MetadataOperation.EDIT_DATA_PROFILE)));
  }

  void putProfileConfig(Table table, Map<String, String> authHeaders) throws IOException {
    // Add table profile config with columns c1, c3 and column c2 excluded
    List<ColumnProfilerConfig> columnProfilerConfigs = new ArrayList<>();
    columnProfilerConfigs.add(
        getColumnProfilerConfig(
            C1, "valuesCount", "valuePercentage", "validCount", "duplicateCount"));
    columnProfilerConfigs.add(
        getColumnProfilerConfig(C3, "duplicateCount", "nullCount", "missingCount"));

    TableProfilerConfig tableProfilerConfig =
        new TableProfilerConfig()
            .withProfileQuery("SELECT * FROM dual")
            .withExcludeColumns(List.of(C2))
            .withIncludeColumns(columnProfilerConfigs);
    table = putTableProfilerConfig(table.getId(), tableProfilerConfig, authHeaders);
    assertEquals(tableProfilerConfig, table.getTableProfilerConfig());
    Table storedTable = getEntity(table.getId(), "tableProfilerConfig", authHeaders);
    assertEquals(tableProfilerConfig, storedTable.getTableProfilerConfig());

    // Change table profile config with columns c2, c3 and column c1 excluded
    // Also change the profileQuery from dual to dual1
    columnProfilerConfigs.remove(0);
    columnProfilerConfigs.add(
        getColumnProfilerConfig(
            C2, "valuesCount", "valuePercentage", "validCount", "duplicateCount"));
    tableProfilerConfig =
        new TableProfilerConfig()
            .withProfileQuery("SELECT * FROM dual1")
            .withExcludeColumns(List.of(C1))
            .withIncludeColumns(columnProfilerConfigs);
    table = putTableProfilerConfig(table.getId(), tableProfilerConfig, authHeaders);
    assertEquals(tableProfilerConfig, table.getTableProfilerConfig());
    Table tableWithConfig = getTableProfileConfig(table.getId(), authHeaders);
    assertEquals(tableProfilerConfig, tableWithConfig.getTableProfilerConfig());
    table = deleteTableProfilerConfig(table.getId(), authHeaders);
    assertNull(table.getTableProfilerConfig());
    storedTable = getTableProfileConfig(table.getId(), authHeaders);
    assertNull(storedTable.getTableProfilerConfig());
    tableProfilerConfig = new TableProfilerConfig().withProfileSample(80.0);
    table = putTableProfilerConfig(table.getId(), tableProfilerConfig, authHeaders);
    assertEquals(tableProfilerConfig, table.getTableProfilerConfig());
    storedTable = getEntity(table.getId(), "tableProfilerConfig", authHeaders);
    assertEquals(tableProfilerConfig, storedTable.getTableProfilerConfig());
  }

  @Test
  void put_tableProfile_200(TestInfo test) throws IOException, ParseException {
    Table table = createEntity(createRequest(test).withOwner(USER1_REF), ADMIN_AUTH_HEADERS);
    Table table1 = createEntity(createRequest(test, 1).withOwner(USER1_REF), ADMIN_AUTH_HEADERS);

    // Admin can PUT table profile
    putTableProfile(table, table1, ADMIN_AUTH_HEADERS);

    // Owner can PUT table profile
    Table table3 = createEntity(createRequest(test, 2).withOwner(USER1_REF), ADMIN_AUTH_HEADERS);
    Table table4 = createEntity(createRequest(test, 3).withOwner(USER1_REF), ADMIN_AUTH_HEADERS);
    putTableProfile(table3, table4, authHeaders(USER1.getName()));

    // Others can't PUT table profile data
    assertResponse(
        () -> putTableProfile(table, table1, authHeaders(USER2.getName())),
        FORBIDDEN,
        permissionNotAllowed(USER2.getName(), List.of(MetadataOperation.EDIT_DATA_PROFILE)));
  }

  void putTableProfile(Table table, Table table1, Map<String, String> authHeaders)
      throws IOException, ParseException {
    Long timestamp = TestUtils.dateToTimestamp("2021-09-09");
    ColumnProfile c1Profile = getColumnProfile(C1, 100.0, 10.0, 100.0, timestamp);
    ColumnProfile c2Profile = getColumnProfile(C2, 99.0, 20.0, 89.0, timestamp);
    ColumnProfile c3Profile = getColumnProfile(C3, 75.0, 25.0, 77.0, timestamp);
    // Add column profiles
    List<ColumnProfile> columnProfiles = List.of(c1Profile, c2Profile, c3Profile);
    List<ColumnProfile> columnProfileResults = new ArrayList<>();
    columnProfileResults.add(c1Profile);
    TableProfile tableProfile =
        new TableProfile()
            .withRowCount(6.0)
            .withColumnCount(3.0)
            .withTimestamp(timestamp)
            .withProfileSample(10.0);
    CreateTableProfile createTableProfile =
        new CreateTableProfile().withTableProfile(tableProfile).withColumnProfile(columnProfiles);
    Table putResponse = putTableProfileData(table.getId(), createTableProfile, authHeaders);
    verifyTableProfile(putResponse.getProfile(), createTableProfile.getTableProfile());

    ResultList<TableProfile> tableProfiles =
        getTableProfiles(table.getFullyQualifiedName(), timestamp, timestamp, authHeaders);
    verifyTableProfiles(tableProfiles, List.of(tableProfile), 1);

    ResultList<ColumnProfile> tableColumnProfiles =
        getColumnProfiles(
            table.getFullyQualifiedName() + "." + C1,
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-10"),
            authHeaders);
    verifyColumnProfiles(tableColumnProfiles, List.of(c1Profile), 1);

    timestamp = TestUtils.dateToTimestamp("2021-09-10");

    // Add new date for TableProfile
    TableProfile newTableProfile =
        new TableProfile().withRowCount(7.0).withColumnCount(3.0).withTimestamp(timestamp);
    c1Profile = getColumnProfile(C1, 100.0, 10.0, 100.0, timestamp);
    c2Profile = getColumnProfile(C2, 99.0, 20.0, 89.0, timestamp);
    c3Profile = getColumnProfile(C3, 75.0, 25.0, 77.0, timestamp);
    columnProfiles = List.of(c1Profile, c2Profile, c3Profile);
    columnProfileResults.add(c1Profile);
    createTableProfile =
        new CreateTableProfile()
            .withTableProfile(newTableProfile)
            .withColumnProfile(columnProfiles);
    putResponse = putTableProfileData(table.getId(), createTableProfile, authHeaders);
    verifyTableProfile(putResponse.getProfile(), createTableProfile.getTableProfile());

    tableProfiles =
        getTableProfiles(
            table.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-10"),
            authHeaders);
    verifyTableProfiles(tableProfiles, List.of(newTableProfile, tableProfile), 2);

    tableColumnProfiles =
        getColumnProfiles(
            table.getFullyQualifiedName() + "." + C1,
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-10"),
            authHeaders);
    verifyColumnProfiles(tableColumnProfiles, columnProfileResults, 2);

    table = getEntity(table.getId(), "profile", authHeaders);
    // first result should be the latest date
    tableProfiles =
        getTableProfiles(
            table.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-10"),
            authHeaders);
    verifyTableProfiles(tableProfiles, List.of(newTableProfile, tableProfile), 2);

    String dateStr = "2021-09-";
    List<TableProfile> tableProfileList = new ArrayList<>();
    tableProfileList.add(tableProfile);
    tableProfileList.add(newTableProfile);
    for (int i = 11; i <= 20; i++) {
      timestamp = TestUtils.dateToTimestamp(dateStr + i);
      tableProfile =
          new TableProfile().withRowCount(21.0).withColumnCount(3.0).withTimestamp(timestamp);
      createTableProfile.setTableProfile(tableProfile);
      c1Profile = getColumnProfile(C1, 100.0, 10.0, 100.0, timestamp);
      c2Profile = getColumnProfile(C2, 99.0, 20.0, 89.0, timestamp);
      c3Profile = getColumnProfile(C3, 75.0, 25.0, 77.0, timestamp);
      columnProfiles = List.of(c1Profile, c2Profile, c3Profile);
      columnProfileResults.add(c1Profile);
      createTableProfile =
          new CreateTableProfile().withTableProfile(tableProfile).withColumnProfile(columnProfiles);
      putTableProfileData(table.getId(), createTableProfile, authHeaders);
      tableProfileList.add(tableProfile);
    }
    tableProfiles =
        getTableProfiles(
            table.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-20"),
            authHeaders);
    verifyTableProfiles(tableProfiles, tableProfileList, 12);

    tableColumnProfiles =
        getColumnProfiles(
            table.getFullyQualifiedName() + "." + C1,
            TestUtils.dateToTimestamp("2021-09-09"),
            TestUtils.dateToTimestamp("2021-09-20"),
            authHeaders);
    verifyColumnProfiles(tableColumnProfiles, columnProfileResults, 12);

    // Add profiles for table1
    List<TableProfile> table1ProfileList = new ArrayList<>();
    dateStr = "2021-10-";
    for (int i = 11; i <= 15; i++) {
      timestamp = TestUtils.dateToTimestamp(dateStr + i);
      tableProfile =
          new TableProfile().withRowCount(21.0).withColumnCount(3.0).withTimestamp(timestamp);
      c1Profile = getColumnProfile(C1, 100.0, 10.0, 100.0, timestamp);
      c2Profile = getColumnProfile(C2, 88.0, 20.0, 89.0, timestamp);
      c3Profile = getColumnProfile(C3, 75.0, 25.0, 77.0, timestamp);
      columnProfiles = List.of(c1Profile, c2Profile, c3Profile);
      createTableProfile =
          new CreateTableProfile().withTableProfile(tableProfile).withColumnProfile(columnProfiles);
      putTableProfileData(table1.getId(), createTableProfile, authHeaders);
      table1ProfileList.add(tableProfile);
    }
    tableProfiles =
        getTableProfiles(
            table1.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-10-11"),
            TestUtils.dateToTimestamp("2021-10-15"),
            authHeaders);
    verifyTableProfiles(tableProfiles, table1ProfileList, 5);
    deleteTableProfile(
        table1.getFullyQualifiedName(),
        TABLE,
        TestUtils.dateToTimestamp("2021-10-11"),
        authHeaders);
    table1ProfileList.remove(0);
    tableProfiles =
        getTableProfiles(
            table1.getFullyQualifiedName(),
            TestUtils.dateToTimestamp("2021-10-11"),
            TestUtils.dateToTimestamp("2021-10-15"),
            authHeaders);
    verifyTableProfiles(tableProfiles, table1ProfileList, 4);

    table1 = getLatestTableProfile(table1.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    verifyTableProfile(table1.getProfile(), table1ProfileList.get(table1ProfileList.size() - 1));

    // Table profile with column profile as null
    timestamp = TestUtils.dateToTimestamp("2022-09-09");
    tableProfile =
        new TableProfile()
            .withRowCount(6.0)
            .withColumnCount(3.0)
            .withTimestamp(timestamp)
            .withProfileSample(10.0);
    createTableProfile =
        new CreateTableProfile().withTableProfile(tableProfile).withColumnProfile(null);
    putResponse = putTableProfileData(table.getId(), createTableProfile, authHeaders);
    verifyTableProfile(putResponse.getProfile(), createTableProfile.getTableProfile());

    // Table profile without column profile
    timestamp = TestUtils.dateToTimestamp("2022-10-09");
    tableProfile =
        new TableProfile()
            .withRowCount(6.0)
            .withColumnCount(3.0)
            .withTimestamp(timestamp)
            .withProfileSample(10.0);
    createTableProfile = new CreateTableProfile().withTableProfile(tableProfile);
    putTableProfileData(table.getId(), createTableProfile, authHeaders);
    Table table2 = getLatestTableProfile(table.getFullyQualifiedName(), ADMIN_AUTH_HEADERS);
    verifyTableProfile(table2.getProfile(), createTableProfile.getTableProfile());
  }

  @Test
  void put_tableInvalidTableProfileData_4xx(TestInfo test) throws IOException, ParseException {
    Table table = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    Long timestamp = TestUtils.dateToTimestamp("2021-09-10");
    ColumnProfile c1Profile = getColumnProfile(C1, 100.0, 10.0, 100.0, timestamp);
    ColumnProfile c2Profile = getColumnProfile(C2, 99.0, 20.0, 89.0, timestamp);
    ColumnProfile c3Profile = getColumnProfile("invalidColumn", 75.0, 25.0, 77.0, timestamp);
    List<ColumnProfile> columnProfiles = List.of(c1Profile, c2Profile, c3Profile);
    TableProfile tableProfile =
        new TableProfile().withRowCount(6.0).withColumnCount(3.0).withTimestamp(timestamp);
    CreateTableProfile createTableProfile =
        new CreateTableProfile().withTableProfile(tableProfile).withColumnProfile(columnProfiles);
    assertResponseContains(
        () -> putTableProfileData(table.getId(), createTableProfile, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid column name invalidColumn");
  }

  @Test
  void put_tableQueries_200(TestInfo test) throws IOException {
    // Setup Query Test
    QueryResourceTest queryResourceTest = new QueryResourceTest();
    queryResourceTest.setupQuery(test);

    // Create a table
    Table table = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    // Create Query
    CreateQuery query =
        queryResourceTest
            .createRequest("table_query_test")
            .withQuery("select * from test;")
            .withDuration(600.0);
    Query createdQuery = queryResourceTest.createAndCheckEntity(query, ADMIN_AUTH_HEADERS);
    putTableQueriesData(
        createdQuery.getId(), List.of(table.getEntityReference()), ADMIN_AUTH_HEADERS);
    List<Query> entityQueries = getTableQueriesData(table.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(1, entityQueries.size());
    assertEquals(query.getQuery(), entityQueries.get(0).getQuery());

    // Create
    CreateQuery query1 =
        queryResourceTest
            .createRequest("table_query_test")
            .withQuery("select * from test;")
            .withDuration(200.0)
            .withQueryUsedIn(List.of(table.getEntityReference()));

    //
    // try updating the same query again
    //
    createdQuery = queryResourceTest.updateEntity(query1, OK, ADMIN_AUTH_HEADERS);
    assertEquals(query1.getQuery(), createdQuery.getQuery());
    assertEquals(query1.getDuration(), createdQuery.getDuration());

    // Update bot
    VoteRequest request = new VoteRequest().withUpdatedVoteType(VoteRequest.VoteType.VOTED_UP);
    WebTarget target =
        getResource(String.format("queries/%s/vote", createdQuery.getId().toString()));
    ChangeEvent changeEvent =
        TestUtils.put(target, request, ChangeEvent.class, OK, ADMIN_AUTH_HEADERS);
    Query updatedEntity = JsonUtils.convertValue(changeEvent.getEntity(), Query.class);
    assertEquals(1, updatedEntity.getVotes().getUpVotes());
    assertEquals(0, updatedEntity.getVotes().getDownVotes());

    entityQueries = getTableQueriesData(table.getId(), ADMIN_AUTH_HEADERS);
    assertEquals(1, entityQueries.size());
    assertEquals(query1.getQuery(), entityQueries.get(0).getQuery());
    assertEquals(1, updatedEntity.getVotes().getUpVotes());
    assertEquals(0, updatedEntity.getVotes().getDownVotes());
  }

  @Test
  void put_tableDataModel(TestInfo test) throws IOException {
    List<Column> columns =
        Arrays.asList(
            getColumn(C1, BIGINT, USER_ADDRESS_TAG_LABEL).withDescription(null),
            getColumn(C2, ColumnDataType.VARCHAR, USER_ADDRESS_TAG_LABEL)
                .withDataLength(10)
                .withDescription(null));
    Table table =
        createAndCheckEntity(
            createRequest(test).withColumns(columns).withDescription(null), ADMIN_AUTH_HEADERS);
    UserResourceTest userResourceTest = new UserResourceTest();
    User user =
        userResourceTest.createAndCheckEntity(
            userResourceTest
                .createRequest(test)
                .withName("test1")
                .withEmail("test1@gmail.com")
                .withIsBot(false),
            ADMIN_AUTH_HEADERS);

    //
    // Update the data model and validate the response. Make sure table and column description
    // is carried forward if the original entity had them as null
    //
    columns.get(0).setDescription("updatedDescription");
    columns.get(1).setDescription("updatedDescription");
    String query = "select * from test;";
    DataModel dataModel =
        new DataModel()
            .withModelType(ModelType.DBT)
            .withSql(query)
            .withGeneratedAt(new Date())
            .withColumns(columns)
            .withOwner(reduceEntityReference(user));
    Table putResponse = putTableDataModel(table.getId(), dataModel, ADMIN_AUTH_HEADERS);
    assertDataModel(dataModel, putResponse.getDataModel());

    // Get the table and validate the data model
    Table getResponse = getEntity(table.getId(), "dataModel,tags", ADMIN_AUTH_HEADERS);
    assertDataModel(dataModel, getResponse.getDataModel());

    //
    // Update again
    //
    query = "select * from testUpdated;";
    dataModel =
        new DataModel().withModelType(ModelType.DBT).withSql(query).withGeneratedAt(new Date());
    putResponse = putTableDataModel(table.getId(), dataModel, ADMIN_AUTH_HEADERS);
    assertDataModel(dataModel, putResponse.getDataModel());

    // Get the table and validate the data model
    getResponse = getEntity(table.getId(), "dataModel", ADMIN_AUTH_HEADERS);
    assertDataModel(dataModel, getResponse.getDataModel());
  }

  @Test
  void createUpdateDelete_tableCustomMetrics_200(TestInfo test) throws IOException {
    // Creating custom metric is allowed for the admin
    Table table =
        createAndCheckEntity(createRequest(test).withOwner(USER1_REF), ADMIN_AUTH_HEADERS);
    createUpdateDeleteCustomMetrics(table, ADMIN_AUTH_HEADERS);

    // Creating custom metric is allowed for the owner
    Table table1 =
        createAndCheckEntity(createRequest(test, 1).withOwner(USER1_REF), ADMIN_AUTH_HEADERS);
    createUpdateDeleteCustomMetrics(table1, authHeaders(USER1.getName()));

    // Creating custom metric is not allowed for other users
    assertResponse(
        () -> createUpdateDeleteCustomMetrics(table, authHeaders(USER2.getName())),
        FORBIDDEN,
        permissionNotAllowed(USER2.getName(), List.of(MetadataOperation.EDIT_DATA_PROFILE)));
  }

  void createUpdateDeleteCustomMetrics(Table table, Map<String, String> authHeaders)
      throws IOException {
    // ===========================
    // Check Column custom metrics
    Column c1 = table.getColumns().get(0);

    CreateCustomMetric createMetric =
        new CreateCustomMetric()
            .withName("custom")
            .withColumnName(c1.getName())
            .withExpression("SELECT SUM(xyz) FROM abc");
    Table putResponse = putCustomMetric(table.getId(), createMetric, authHeaders);
    verifyCustomMetrics(putResponse, c1, List.of(createMetric));

    table = getEntity(table.getId(), "customMetrics,columns", authHeaders);
    verifyCustomMetrics(table, c1, List.of(createMetric));

    // Update Custom Metric
    CreateCustomMetric updatedMetric =
        new CreateCustomMetric()
            .withName("custom")
            .withColumnName(c1.getName())
            .withExpression("Another select statement");
    putResponse = putCustomMetric(table.getId(), updatedMetric, authHeaders);
    verifyCustomMetrics(putResponse, c1, List.of(updatedMetric));

    // Add another Custom Metric
    CreateCustomMetric createMetric2 =
        new CreateCustomMetric()
            .withName("custom2")
            .withColumnName(c1.getName())
            .withExpression("Yet another statement");
    putResponse = putCustomMetric(table.getId(), createMetric2, authHeaders);
    verifyCustomMetrics(putResponse, c1, List.of(createMetric2, updatedMetric));

    table = getEntity(table.getId(), "customMetrics,columns", authHeaders);
    verifyCustomMetrics(table, c1, List.of(updatedMetric, createMetric2));

    // Delete Column Custom Metric
    deleteCustomMetric(table.getId(), c1.getName(), updatedMetric.getName(), authHeaders);
    table = getEntity(table.getId(), "customMetrics,columns", authHeaders);
    verifyCustomMetrics(table, c1, List.of(createMetric2));

    // ===========================
    // Check Table custom metrics
    // Create table custom metric
    CreateCustomMetric createTableMetric =
        new CreateCustomMetric()
            .withName("customTable")
            .withExpression("SELECT SUM(xyz) + SUM(def) FROM abc");
    Table tablePutResponse = putCustomMetric(table.getId(), createTableMetric, authHeaders);
    assertEquals(1, tablePutResponse.getCustomMetrics().size());

    // Add another table custom metric
    CreateCustomMetric createTableMetric2 =
        new CreateCustomMetric()
            .withName("custom2Table")
            .withExpression("SELECT SUM(xyz) / SUM(def) FROM abc");
    tablePutResponse = putCustomMetric(table.getId(), createTableMetric2, authHeaders);
    assertEquals(2, tablePutResponse.getCustomMetrics().size());

    // check we can get the custom metrics
    Map<String, Object> customMetrics =
        tablePutResponse.getCustomMetrics().stream()
            .collect(Collectors.toMap(CustomMetric::getName, (metric) -> metric));

    for (CreateCustomMetric metric : List.of(createTableMetric, createTableMetric2)) {
      CustomMetric customMetric = (CustomMetric) customMetrics.get(metric.getName());
      assertEquals(customMetric.getExpression(), metric.getExpression());
    }

    // Update table custom metric
    CreateCustomMetric updatedTableMetric =
        new CreateCustomMetric()
            .withName("customTable")
            .withExpression("SELECT SUM(xyz) - SUM(def) FROM abc");
    tablePutResponse = putCustomMetric(table.getId(), updatedTableMetric, authHeaders);
    CustomMetric updatedCustomMetric =
        tablePutResponse.getCustomMetrics().stream()
            .filter(metric -> metric.getName().equals(updatedTableMetric.getName()))
            .findFirst()
            .orElseThrow();
    assertEquals(updatedCustomMetric.getExpression(), updatedTableMetric.getExpression());

    // Delete table custom metric
    deleteTableCustomMetric(table.getId(), updatedTableMetric.getName(), authHeaders);
    table = getEntity(table.getId(), "customMetrics,columns", authHeaders);
    assertEquals(1, table.getCustomMetrics().size());
    assertEquals(createTableMetric2.getName(), table.getCustomMetrics().get(0).getName());
  }

  @Test
  @Order(
      1) // Run this test first as other tables created in other tests will interfere with listing
  void get_tableListWithDifferentFields_200_OK(TestInfo test) throws IOException {
    int initialTableCount = listEntities(null, ADMIN_AUTH_HEADERS).getPaging().getTotal();
    // Create a table test1 with 1 table tag and 3 column tags
    CreateTable create =
        createRequest(test, 1)
            .withOwner(USER1_REF)
            .withTags(
                List.of(
                    USER_ADDRESS_TAG_LABEL,
                    GLOSSARY2_TERM1_LABEL)) // 2 table tags - USER_ADDRESS, g2t1
            .withColumns(COLUMNS); // 3 column tags - 2 USER_ADDRESS and 1 g1t1
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Total 5 user tags  - 1 table tag + 2 column tags includes global test entities
    assertEquals(3, getClassificationUsageCount("User", ADMIN_AUTH_HEADERS));

    // Total 1 glossary1 tags  - 1 column
    assertEquals(1, getGlossaryUsageCount(GLOSSARY1.getName()));

    // Total 1 glossary2 tags  - 1 table
    assertEquals(1, getGlossaryUsageCount(GLOSSARY2.getName()));

    // Total 3 USER_ADDRESS tags - 1 table tag and 2 column tags
    assertEquals(3, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), ADMIN_AUTH_HEADERS));
    // Total 1 GLOSSARY1_TERM1 - 1 column level
    assertEquals(
        1, getGlossaryTermUsageCount(GLOSSARY1_TERM1_LABEL.getTagFQN(), ADMIN_AUTH_HEADERS));
    // Total 1 GLOSSARY1_TERM1 - 1 table level
    assertEquals(
        1, getGlossaryTermUsageCount(GLOSSARY2_TERM1_LABEL.getTagFQN(), ADMIN_AUTH_HEADERS));

    // Create a table test2 with 3 column tags
    CreateTable create1 =
        createRequest(test, 2)
            .withDescription("description")
            .withOwner(USER1_REF)
            .withColumns(COLUMNS); // 3 column tags - 2 USER_ADDRESS and 1 USER_BANK_ACCOUNT
    createAndCheckEntity(create1, ADMIN_AUTH_HEADERS);

    // Additional 2 user tags - 2 column tags
    assertEquals(5, getClassificationUsageCount("User", ADMIN_AUTH_HEADERS));
    // Additional 2 USER_ADDRESS tags - 2 column tags
    assertEquals(5, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), ADMIN_AUTH_HEADERS));
    // Additional 1 glossary tag - 1 column tags
    assertEquals(
        2, getGlossaryTermUsageCount(GLOSSARY1_TERM1_LABEL.getTagFQN(), ADMIN_AUTH_HEADERS));

    ResultList<Table> tableList = listEntities(null, ADMIN_AUTH_HEADERS); // List tables
    assertEquals(initialTableCount + 2, tableList.getData().size());
    assertFields(tableList.getData(), null);

    // List tables with databaseFQN as filter
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("database", DATABASE.getFullyQualifiedName());
    ResultList<Table> tableList1 = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(tableList.getData().size(), tableList1.getData().size());
    assertFields(tableList1.getData(), null);

    // GET .../tables?fields=columns,tableConstraints
    final String fields = "tableConstraints";
    queryParams = new HashMap<>();
    queryParams.put("fields", fields);
    tableList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(initialTableCount + 2, tableList.getData().size());
    assertFields(tableList.getData(), fields);

    // List tables with databaseFQN as filter
    queryParams = new HashMap<>();
    queryParams.put("fields", fields);
    queryParams.put("database", DATABASE.getFullyQualifiedName());
    tableList1 = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(tableList.getData().size(), tableList1.getData().size());
    assertFields(tableList1.getData(), fields);

    // List tables with databaseSchemaFQN as filter
    queryParams = new HashMap<>();
    queryParams.put("fields", fields);
    queryParams.put("databaseSchema", DATABASE_SCHEMA.getFullyQualifiedName());
    tableList1 = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(tableList.getData().size(), tableList1.getData().size());
    assertFields(tableList1.getData(), fields);

    // GET .../tables?fields=usageSummary,owner
    final String fields1 = "usageSummary,owner";
    queryParams = new HashMap<>();
    queryParams.put("fields", fields1);
    tableList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(initialTableCount + 2, tableList.getData().size());
    assertFields(tableList.getData(), fields1);
    for (Table table : tableList.getData()) {
      assertEquals(USER1_REF, table.getOwner());
      assertReference(DATABASE.getFullyQualifiedName(), table.getDatabase());
    }

    // List tables with databaseFQN as filter
    queryParams = new HashMap<>();
    queryParams.put("fields", fields1);
    queryParams.put("database", DATABASE.getFullyQualifiedName());
    tableList1 = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(tableList.getData().size(), tableList1.getData().size());
    assertFields(tableList1.getData(), fields1);
  }

  /**
   * See EntityResourceTest#patch_entityAttributes_200_ok(TestInfo) for other patch related tests for patching display,
   * description, owner, and tags
   */
  @Test
  void patch_tableAttributes_200_ok(TestInfo test) throws IOException {
    // Create table without tableType, and tableConstraints
    Table table = createEntity(createRequest(test).withTableConstraints(null), ADMIN_AUTH_HEADERS);

    List<TableConstraint> tableConstraints =
        List.of(
            new TableConstraint()
                .withConstraintType(ConstraintType.UNIQUE)
                .withColumns(List.of(C1)));

    // Add tableType, tableConstraints
    String originalJson = JsonUtils.pojoToJson(table);
    ChangeDescription change = getChangeDescription(table, MINOR_UPDATE);
    table.withTableType(TableType.Regular).withTableConstraints(tableConstraints);
    fieldAdded(change, "tableType", TableType.Regular);
    fieldAdded(change, "tableConstraints", tableConstraints);
    table = patchEntityAndCheck(table, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Replace tableType, tableConstraints
    // Changes from this PATCH is consolidated with the previous changes
    List<TableConstraint> tableConstraints1 =
        List.of(
            new TableConstraint()
                .withConstraintType(ConstraintType.UNIQUE)
                .withColumns(List.of(C2)));
    originalJson = JsonUtils.pojoToJson(table);
    change = getChangeDescription(table, CHANGE_CONSOLIDATED);
    table.withTableType(TableType.External).withTableConstraints(tableConstraints1);
    fieldAdded(change, "tableType", TableType.External);
    fieldAdded(change, "tableConstraints", tableConstraints1);
    table =
        patchEntityAndCheck(table, originalJson, ADMIN_AUTH_HEADERS, CHANGE_CONSOLIDATED, change);

    // Remove tableType, tableConstraints
    // Changes from this PATCH is consolidated with the previous changes resulting in no change
    originalJson = JsonUtils.pojoToJson(table);
    table.withTableType(null).withTableConstraints(null);
    patchEntityAndCheck(table, originalJson, ADMIN_AUTH_HEADERS, REVERT, null);

    // add retention period
    originalJson = JsonUtils.pojoToJson(table);
    table.withRetentionPeriod("10D");
    change = getChangeDescription(table, CHANGE_CONSOLIDATED);
    fieldAdded(change, "retentionPeriod", "10D");
    patchEntityAndCheck(table, originalJson, ADMIN_AUTH_HEADERS, CHANGE_CONSOLIDATED, change);
  }

  @Test
  void patch_tableColumns_200_ok(TestInfo test) throws IOException {
    // Create table with the following columns
    List<Column> columns = new ArrayList<>();
    columns.add(getColumn(C1, INT, USER_ADDRESS_TAG_LABEL).withDescription(null));
    columns.add(getColumn(C2, BIGINT, USER_ADDRESS_TAG_LABEL));
    columns.add(getColumn(C3, FLOAT, GLOSSARY1_TERM1_LABEL));

    Table table = createEntity(createRequest(test).withColumns(columns), ADMIN_AUTH_HEADERS);

    // Update the column tags and description with PATCH
    ChangeDescription change = getChangeDescription(table, MAJOR_UPDATE);
    columns
        .get(0)
        .withDescription("new0") // Set new description
        .withTags(List.of(USER_ADDRESS_TAG_LABEL, GLOSSARY1_TERM1_LABEL));
    fieldAdded(change, build("columns", C1, "description"), "new0");
    fieldAdded(change, build("columns", C1, "tags"), List.of(GLOSSARY1_TERM1_LABEL));
    columns
        .get(1)
        .withDescription("new1") // Change description
        .withTags(List.of(USER_ADDRESS_TAG_LABEL)); // No change in tags
    fieldUpdated(change, build("columns", C2, "description"), C2, "new1");

    columns.get(2).withTags(new ArrayList<>()).withPrecision(10).withScale(3); // Remove tag
    fieldDeleted(change, build("columns", C3, "tags"), List.of(GLOSSARY1_TERM1_LABEL));
    fieldAdded(change, build("columns", C3, "precision"), 10);
    fieldAdded(change, build("columns", C3, "scale"), 3);

    String originalJson = JsonUtils.pojoToJson(table);
    table.setColumns(columns);
    table = patchEntityAndCheck(table, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertColumns(columns, table.getColumns());

    // Now reduce the precision and make sure it is a backward incompatible change
    // Changes from this PATCH is consolidated with the previous changes
    change = getChangeDescription(table, CHANGE_CONSOLIDATED);
    fieldAdded(change, build("columns", C1, "description"), "new0");
    fieldAdded(change, build("columns", C1, "tags"), List.of(GLOSSARY1_TERM1_LABEL));
    fieldUpdated(change, build("columns", C2, "description"), C2, "new1");
    fieldDeleted(change, build("columns", C3, "tags"), List.of(GLOSSARY1_TERM1_LABEL));
    fieldAdded(change, build("columns", C3, "precision"), 7); // Change in this patch
    fieldAdded(change, build("columns", C3, "scale"), 3);
    originalJson = JsonUtils.pojoToJson(table);
    columns = table.getColumns();
    columns
        .get(2)
        .withPrecision(7)
        .withScale(3); // Precision change from 10 to 7. Scale remains the same
    table.setColumns(columns);
    table =
        patchEntityAndCheck(table, originalJson, ADMIN_AUTH_HEADERS, CHANGE_CONSOLIDATED, change);
    assertColumns(columns, table.getColumns());

    // Now reduce the scale and make sure it is a backward incompatible change
    // Changes from this PATCH is consolidated with the previous changes
    change = getChangeDescription(table, CHANGE_CONSOLIDATED);
    fieldAdded(change, build("columns", C1, "description"), "new0");
    fieldAdded(change, build("columns", C1, "tags"), List.of(GLOSSARY1_TERM1_LABEL));
    fieldUpdated(change, build("columns", C2, "description"), C2, "new1");
    fieldDeleted(change, build("columns", C3, "tags"), List.of(GLOSSARY1_TERM1_LABEL));
    fieldAdded(change, build("columns", C3, "precision"), 7);
    fieldAdded(change, build("columns", C3, "scale"), 1); // Change in this patch
    originalJson = JsonUtils.pojoToJson(table);
    columns = table.getColumns();
    columns
        .get(2)
        .withPrecision(7)
        .withScale(1); // Scale change from 10 to 7. Scale remains the same
    table.setColumns(columns);
    table =
        patchEntityAndCheck(table, originalJson, ADMIN_AUTH_HEADERS, CHANGE_CONSOLIDATED, change);
    assertColumns(columns, table.getColumns());
  }

  @Test
  void patch_tableColumnsTags_200_ok(TestInfo test) throws IOException {
    Column c1 = getColumn(C1, INT, null);
    CreateTable create = createRequest(test).withColumns(List.of(c1));
    Table table = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add a primary tag and derived tag both. The tag list must include derived tags only once.
    String json = JsonUtils.pojoToJson(table);
    table
        .getColumns()
        .get(0)
        .withTags(
            List.of(
                GLOSSARY1_TERM1_LABEL,
                PERSONAL_DATA_TAG_LABEL,
                USER_ADDRESS_TAG_LABEL,
                PII_SENSITIVE_TAG_LABEL));
    Table updatedTable = patchEntity(table.getId(), json, table, ADMIN_AUTH_HEADERS);

    // Ensure only 4 tag labels are found - Manual tags PersonalData.Personal, User.Address,
    // glossaryTerm1 and a derived tag PII.Sensitive from glossary term1
    List<TagLabel> updateTags = updatedTable.getColumns().get(0).getTags();
    assertEquals(4, updateTags.size());

    TagLabel glossaryTerm1 =
        updateTags.stream()
            .filter(t -> tagLabelMatch.test(t, GLOSSARY1_TERM1_LABEL))
            .findAny()
            .orElse(null);
    assertNotNull(glossaryTerm1);
    assertEquals(LabelType.MANUAL, glossaryTerm1.getLabelType());

    TagLabel userAddress =
        updateTags.stream()
            .filter(t -> tagLabelMatch.test(t, USER_ADDRESS_TAG_LABEL))
            .findAny()
            .orElse(null);
    assertNotNull(userAddress);
    assertEquals(LabelType.MANUAL, userAddress.getLabelType());

    TagLabel personData =
        updateTags.stream()
            .filter(t -> tagLabelMatch.test(t, PERSONAL_DATA_TAG_LABEL))
            .findAny()
            .orElse(null);
    assertNotNull(personData);
    assertEquals(LabelType.MANUAL, personData.getLabelType());

    TagLabel piiSensitive =
        updateTags.stream()
            .filter(t -> tagLabelMatch.test(t, PII_SENSITIVE_TAG_LABEL))
            .findAny()
            .orElse(null);
    assertNotNull(piiSensitive);
    assertEquals(LabelType.MANUAL, piiSensitive.getLabelType());
  }

  @Test
  void test_mutuallyExclusiveTags(TestInfo testInfo) {
    // Apply mutually exclusive tags to a table
    CreateTable create =
        createRequest(testInfo).withTags(List.of(TIER1_TAG_LABEL, TIER2_TAG_LABEL));
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));

    // Apply mutually exclusive tags to a table column
    CreateTable create1 = createRequest(testInfo, 1).withTableConstraints(null);
    Column column = getColumn("test", INT, null).withTags(listOf(TIER1_TAG_LABEL, TIER2_TAG_LABEL));
    create1.setColumns(listOf(column));
    assertResponse(
        () -> createEntity(create1, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));

    // Apply mutually exclusive tags to a table's nested column
    CreateTable create2 = createRequest(testInfo, 1).withTableConstraints(null);
    Column nestedColumns =
        getColumn("testNested", INT, null).withTags(listOf(TIER1_TAG_LABEL, TIER2_TAG_LABEL));
    Column column1 = getColumn("test", STRUCT, null).withChildren(List.of(nestedColumns));
    create2.setColumns(listOf(column1));
    assertResponse(
        () -> createEntity(create2, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        CatalogExceptionMessage.mutuallyExclusiveLabels(TIER2_TAG_LABEL, TIER1_TAG_LABEL));
  }

  @Test
  void test_ownershipInheritance(TestInfo test) throws HttpResponseException {
    // When a databaseSchema has no owner set, it inherits the ownership from database
    // When a table has no owner set, it inherits the ownership from databaseSchema
    Database db =
        dbTest.createEntity(dbTest.createRequest(test).withOwner(USER1_REF), ADMIN_AUTH_HEADERS);

    // Ensure databaseSchema owner is inherited from database
    CreateDatabaseSchema createSchema =
        schemaTest.createRequest(test).withDatabase(db.getFullyQualifiedName());
    DatabaseSchema schema = schemaTest.assertOwnerInheritance(createSchema, USER1_REF);

    // Ensure table owner is inherited from databaseSchema
    CreateTable createTable =
        createRequest(test).withDatabaseSchema(schema.getFullyQualifiedName());
    Table table = assertOwnerInheritance(createTable, USER1_REF);

    // Change the ownership of table and ensure further ingestion updates don't overwrite the
    // ownership
    assertOwnershipInheritanceOverride(table, createTable.withOwner(null), USER2_REF);

    // Change the ownership of schema and ensure further ingestion updates don't overwrite the
    // ownership
    schemaTest.assertOwnershipInheritanceOverride(schema, createSchema.withOwner(null), USER2_REF);
  }

  @Test
  void test_domainInheritance(TestInfo test) throws HttpResponseException {
    // Domain is inherited from databaseService > database > databaseSchema > table
    DatabaseService dbService =
        dbServiceTest.createEntity(
            dbServiceTest.createRequest(test).withDomain(DOMAIN.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);

    // Ensure database domain is inherited from database service
    CreateDatabase createDb =
        dbTest.createRequest(test).withService(dbService.getFullyQualifiedName());
    Database db = dbTest.assertDomainInheritance(createDb, DOMAIN.getEntityReference());

    // Ensure databaseSchema domain is inherited from database
    CreateDatabaseSchema createSchema =
        schemaTest.createRequest(test).withDatabase(db.getFullyQualifiedName());
    DatabaseSchema schema =
        schemaTest.assertDomainInheritance(createSchema, DOMAIN.getEntityReference());

    // Ensure table domain is inherited from databaseSchema
    CreateTable createTable =
        createRequest(test).withDatabaseSchema(schema.getFullyQualifiedName());
    Table table = assertDomainInheritance(createTable, DOMAIN.getEntityReference());

    // Change the domain of table and ensure further ingestion updates don't overwrite the domain
    assertDomainInheritanceOverride(
        table, createTable.withDomain(null), SUB_DOMAIN.getEntityReference());

    // Change the ownership of schema and ensure further ingestion updates don't overwrite the
    // ownership
    schemaTest.assertDomainInheritanceOverride(
        schema, createSchema.withDomain(null), SUB_DOMAIN.getEntityReference());
  }

  @Test
  void test_domainUpdate(TestInfo test) throws HttpResponseException {
    DatabaseService dbService =
        dbServiceTest.createEntity(dbServiceTest.createRequest(test), ADMIN_AUTH_HEADERS);
    CreateDatabase createDb =
        dbTest.createRequest(test).withService(dbService.getFullyQualifiedName());
    Database db = dbTest.createEntity(createDb, ADMIN_AUTH_HEADERS);
    CreateDatabaseSchema createSchema =
        schemaTest.createRequest(test).withDatabase(db.getFullyQualifiedName());
    DatabaseSchema schema = schemaTest.createEntity(createSchema, ADMIN_AUTH_HEADERS);
    CreateTable createTable =
        createRequest(test)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withDomain(DOMAIN.getFullyQualifiedName());
    Table table = createEntity(createTable, ADMIN_AUTH_HEADERS);

    Table createdTable = getEntity(table.getId(), "domain", ADMIN_AUTH_HEADERS);
    assertEquals(DOMAIN.getFullyQualifiedName(), createdTable.getDomain().getFullyQualifiedName());

    // update table entity domain w/ PUT request w/ bot auth and check update is ignored
    CreateTable updateTablePayload = createTable.withDomain(DOMAIN1.getFullyQualifiedName());
    updateEntity(updateTablePayload, OK, INGESTION_BOT_AUTH_HEADERS);
    Table updatedTable = getEntity(table.getId(), "domain", ADMIN_AUTH_HEADERS);
    assertEquals(DOMAIN.getFullyQualifiedName(), updatedTable.getDomain().getFullyQualifiedName());

    // patch domain w/ bot auth and check update is applied
    patchEntity(
        table.getId(),
        JsonUtils.pojoToJson(createTable),
        createdTable.withDomain(DOMAIN1.getEntityReference()),
        INGESTION_BOT_AUTH_HEADERS);
    Table patchedTable = getEntity(table.getId(), "domain", ADMIN_AUTH_HEADERS);
    assertEquals(DOMAIN1.getFullyQualifiedName(), patchedTable.getDomain().getFullyQualifiedName());
  }

  @Test
  void test_retentionPeriod(TestInfo test) throws HttpResponseException {
    CreateDatabase createDatabase =
        dbTest.createRequest(getEntityName(test)).withRetentionPeriod("P30D");
    Database database = dbTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);
    assertEquals("P30D", database.getRetentionPeriod());

    // Ensure database schema retention period is carried over from the parent database
    CreateDatabaseSchema createDatabaseSchema =
        schemaTest.createRequest(test).withDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema =
        schemaTest
            .createEntity(createDatabaseSchema, ADMIN_AUTH_HEADERS)
            .withDatabase(database.getEntityReference());
    assertEquals(
        "P30D", schema.getRetentionPeriod()); // Retention period is inherited in create response
    schema = schemaTest.getEntity(schema.getId(), "", ADMIN_AUTH_HEADERS);
    assertEquals(
        "P30D", schema.getRetentionPeriod()); // Retention period is inherited in create response

    // Ensure table retention period is carried over from the parent database schema
    CreateTable createTable =
        createRequest(test).withDatabaseSchema(schema.getFullyQualifiedName());
    Table table =
        createEntity(createTable, ADMIN_AUTH_HEADERS).withDatabase(database.getEntityReference());
    assertEquals(
        "P30D", table.getRetentionPeriod()); // Retention period is inherited in get response
    table = getEntity(table.getId(), "", ADMIN_AUTH_HEADERS);
    assertEquals(
        "P30D", table.getRetentionPeriod()); // Retention period is inherited in get response
  }

  @Test
  void get_tablesWithTestCases(TestInfo test) throws IOException {
    TestSuiteResourceTest testSuiteResourceTest = new TestSuiteResourceTest();

    // Create Database
    CreateDatabase createDatabase = dbTest.createRequest(getEntityName(test));
    Database database = dbTest.createEntity(createDatabase, ADMIN_AUTH_HEADERS);
    // Create Database Schema
    CreateDatabaseSchema createDatabaseSchema =
        schemaTest.createRequest(test).withDatabase(database.getFullyQualifiedName());
    DatabaseSchema schema =
        schemaTest
            .createEntity(createDatabaseSchema, ADMIN_AUTH_HEADERS)
            .withDatabase(database.getEntityReference());
    schema = schemaTest.getEntity(schema.getId(), "", ADMIN_AUTH_HEADERS);
    // Create Table 1
    CreateTable createTable1 =
        createRequest(test).withDatabaseSchema(schema.getFullyQualifiedName());
    Table table1 =
        createEntity(createTable1, ADMIN_AUTH_HEADERS).withDatabase(database.getEntityReference());
    // Create Table 2
    CreateTable createTable2 =
        createRequest(test.getClass().getName() + "2")
            .withDatabaseSchema(schema.getFullyQualifiedName());
    createEntity(createTable2, ADMIN_AUTH_HEADERS).withDatabase(database.getEntityReference());
    // Create Executable Test Suite
    CreateTestSuite createExecutableTestSuite =
        testSuiteResourceTest.createRequest(table1.getFullyQualifiedName());
    TestSuite executableTestSuite =
        testSuiteResourceTest.createExecutableTestSuite(
            createExecutableTestSuite, ADMIN_AUTH_HEADERS);

    HashMap<String, String> queryParams = new HashMap<>();
    queryParams.put("includeEmptyTestSuite", "false");
    queryParams.put("fields", "testSuite");
    queryParams.put("limit", "100");

    ResultList<Table> tables = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(3, tables.getData().size());
    assertNotNull(tables.getData().get(0).getTestSuite());
  }

  @Test
  void test_sensitivePIISampleData(TestInfo test) throws IOException {
    // Create table with owner and a column tagged with PII.Sensitive
    Table table =
        createAndCheckEntity(
            createRequest(test).withOwner(USER_TEAM21.getEntityReference()), ADMIN_AUTH_HEADERS);
    List<String> columns = Arrays.asList(C1, C2, C3);
    // Add 3 rows of sample data for 3 columns
    List<List<Object>> rows =
        Arrays.asList(
            Arrays.asList("c1Value1", 1, true),
            Arrays.asList("c1Value2", null, false),
            Arrays.asList("c1Value3", 3, true));
    // add sample data
    putSampleData(table, columns, rows, ADMIN_AUTH_HEADERS);
    // assert values are not masked for the table owner
    table = getSampleData(table.getId(), authHeaders(USER_TEAM21.getName()));
    assertFalse(
        table.getSampleData().getRows().stream()
            .flatMap(List::stream)
            .map(r -> r == null ? "" : r)
            .map(Object::toString)
            .anyMatch(MASKED_VALUE::equals));
    // assert values are masked when is not the table owner
    table = getSampleData(table.getId(), authHeaders(USER1_REF.getName()));
    assertEquals(
        3,
        table.getSampleData().getRows().stream()
            .flatMap(List::stream)
            .map(r -> r == null ? "" : r)
            .map(Object::toString)
            .filter(MASKED_VALUE::equals)
            .count());
  }

  @Test
  void test_sensitivePIIColumnProfile(TestInfo test) throws IOException, ParseException {
    // Create table with owner and a column tagged with PII.Sensitive
    // C3 has the PII.Sensitive tag
    Table table =
        createEntity(
            createRequest(test).withOwner(USER_TEAM21.getEntityReference()), ADMIN_AUTH_HEADERS);
    Table table1 =
        createEntity(
            createRequest(test, 1).withOwner(USER_TEAM21.getEntityReference()), ADMIN_AUTH_HEADERS);
    putTableProfile(table, table1, ADMIN_AUTH_HEADERS);

    // Owner can read the column profile of C3
    Table tableWithProfileFromOwner =
        getLatestTableProfile(table.getFullyQualifiedName(), authHeaders(USER_TEAM21.getName()));
    assertNotNull(tableWithProfileFromOwner.getColumns().get(2).getProfile());

    // Non owners cannot read the column profile of C3
    Table tableWithProfileFromNotOwner =
        getLatestTableProfile(table.getFullyQualifiedName(), authHeaders(USER1_REF.getName()));
    assertNull(tableWithProfileFromNotOwner.getColumns().get(2).getProfile());
  }

  @Test
  void testInheritedPermissionFromParent(TestInfo test) throws IOException {
    // DatabaseService has owner dataConsumer
    CreateDatabaseService createDatabaseService =
        dbServiceTest.createRequest(test).withOwner(DATA_CONSUMER.getEntityReference());
    DatabaseService service = dbServiceTest.createEntity(createDatabaseService, ADMIN_AUTH_HEADERS);

    // dataConsumer as owner of service can create database under it
    CreateDatabase createDatabase =
        dbTest
            .createRequest("db")
            .withService(service.getFullyQualifiedName())
            .withOwner(DATA_STEWARD.getEntityReference());
    Database db = dbTest.createEntity(createDatabase, authHeaders(DATA_CONSUMER.getName()));

    // dataSteward as owner of database can create database schema under it
    CreateDatabaseSchema createDatabaseSchema =
        schemaTest
            .createRequest("schema")
            .withDatabase(db.getFullyQualifiedName())
            .withOwner(USER1.getEntityReference());
    DatabaseSchema schema =
        schemaTest.createEntity(createDatabaseSchema, authHeaders(DATA_STEWARD.getName()));

    // User1 as owner of database schema can create table under it
    CreateTable createTable =
        createRequest("schema").withDatabaseSchema(schema.getFullyQualifiedName());
    createEntity(createTable, authHeaders(USER1.getName()));
  }

  @Test
  void test_columnWithInvalidTag(TestInfo test) throws HttpResponseException {
    // Add an entity with invalid tag
    TagLabel invalidTag = new TagLabel().withTagFQN("invalidTag");
    List<Column> invalidTagColumns = List.of(getColumn(C1, BIGINT, invalidTag));
    CreateTable create = createRequest(getEntityName(test)).withColumns(invalidTagColumns);

    // Entity can't be created with PUT or POST
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    assertResponse(
        () -> updateEntity(create, Status.CREATED, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    // Create an entity and update the columns with PUT and PATCH with an invalid tag
    List<Column> validColumns = List.of(getColumn(C1, BIGINT, TIER1_TAG_LABEL));
    create.setColumns(validColumns);
    Table entity = createEntity(create, ADMIN_AUTH_HEADERS);
    String json = JsonUtils.pojoToJson(entity);

    create.setColumns(invalidTagColumns);
    assertResponse(
        () -> updateEntity(create, Status.CREATED, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    entity.setTags(listOf(invalidTag));
    assertResponse(
        () -> patchEntity(entity.getId(), json, entity, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        CatalogExceptionMessage.entityNotFound(TAG, "invalidTag"));

    // No lingering relationships should cause error in listing the entity
    listEntities(null, ADMIN_AUTH_HEADERS);
  }

  @Test
  @SneakyThrows
  void testImportInvalidCsv() {
    Column c1 = new Column().withName("c1").withDataType(INT);
    CreateTable createTable =
        createRequest("s1").withColumns(listOf(c1)).withTableConstraints(null);
    Table table = createEntity(createTable, ADMIN_AUTH_HEADERS);
    String tableName = table.getFullyQualifiedName();

    // Headers: name, displayName, description, owner, tags, retentionPeriod, sourceUrl, domain
    // Create table with invalid tags field
    String resultsHeader = recordToString(EntityCsv.getResultHeaders(TableCsv.HEADERS));
    String record = "s1,dsp1,dsc1,,Tag.invalidTag,,,,c1,c1,c1,INT,";
    String csv = createCsv(TableCsv.HEADERS, listOf(record), null);
    CsvImportResult result = importCsv(tableName, csv, false);
    assertSummary(result, ApiStatus.FAILURE, 2, 1, 1);
    String[] expectedRows =
        new String[] {
          resultsHeader,
          getFailedRecord(record, EntityCsv.entityNotFound(4, "tag", "Tag.invalidTag"))
        };
    assertRows(result, expectedRows);

    // Add an invalid column tag
    record = "s1,dsp1,dsc1,,,,,,c1,,,,Tag.invalidTag";
    csv = createCsv(TableCsv.HEADERS, listOf(record), null);
    result = importCsv(tableName, csv, false);
    assertSummary(result, ApiStatus.FAILURE, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader,
          getFailedRecord(record, EntityCsv.entityNotFound(12, "tag", "Tag.invalidTag"))
        };
    assertRows(result, expectedRows);

    // Update a non existing column
    record = "s1,dsp1,dsc1,,,,,,nonExistingColumn,,,,";
    csv = createCsv(TableCsv.HEADERS, listOf(record), null);
    result = importCsv(tableName, csv, false);
    assertSummary(result, ApiStatus.FAILURE, 2, 1, 1);
    expectedRows =
        new String[] {
          resultsHeader, getFailedRecord(record, EntityCsv.columnNotFound(8, "nonExistingColumn"))
        };
    assertRows(result, expectedRows);
  }

  @Test
  void testImportExport() throws IOException {
    String user1 = USER1.getName();
    Column c1 = new Column().withName("c1").withDataType(STRUCT);
    Column c11 = new Column().withName("c11").withDataType(INT);
    Column c2 = new Column().withName("c2").withDataType(INT);
    c1.withChildren(listOf(c11));
    CreateTable createTable =
        createRequest("s1").withColumns(listOf(c1, c2)).withTableConstraints(null);
    Table table = createEntity(createTable, ADMIN_AUTH_HEADERS);

    // Headers: name, displayName, description, owner, tags, retentionPeriod, sourceUrl, domain
    // Update terms with change in description
    List<String> updateRecords =
        listOf(
            String.format(
                "s1,dsp1,new-dsc1,user;%s,Tier.Tier1,P23DT23H,http://test.com,%s,c1,"
                    + "dsp1-new,desc1,type,PII.Sensitive",
                user1, escapeCsv(DOMAIN.getFullyQualifiedName())),
            ",,,,,,,,c1.c11,dsp11-new,desc11,type1,PII.Sensitive",
            ",,,,,,,,c2,,,,");

    // Update created entity with changes
    importCsvAndValidate(table.getFullyQualifiedName(), TableCsv.HEADERS, null, updateRecords);
    deleteEntityByName(table.getFullyQualifiedName(), true, true, ADMIN_AUTH_HEADERS);
  }

  void assertFields(List<Table> tableList, String fieldsParam) {
    tableList.forEach(t -> assertFields(t, fieldsParam));
  }

  void assertFields(Table table, String fieldsParam) {
    Fields fields = new Fields(Entity.getEntityFields(Table.class), fieldsParam);
    if (fields.contains("usageSummary")) {
      assertNotNull(table.getUsageSummary());
    } else {
      assertNull(table.getUsageSummary());
    }
    if (fields.contains(FIELD_OWNER)) {
      assertNotNull(table.getOwner());
    } else {
      assertNull(table.getOwner());
    }
    if (fields.contains("columns")) {
      assertNotNull(table.getColumns());
      if (fields.contains(FIELD_TAGS)) {
        table.getColumns().forEach(column -> assertNotNull(column.getTags()));
      } else {
        table.getColumns().forEach(column -> assertNull(column.getTags()));
      }
    } else {
      assertNotNull(table.getColumns());
    }
    if (fields.contains("tableConstraints")) {
      assertNotNull(table.getTableConstraints());
    } else {
      assertNull(table.getTableConstraints());
    }
    if (fields.contains(FIELD_TAGS)) {
      assertNotNull(table.getTags());
    } else {
      assertNull(table.getTags());
    }
    // Default fields that are always returned
    assertListNotNull(table.getDatabase(), table.getService(), table.getServiceType());
  }

  @Override
  public Table validateGetWithDifferentFields(Table table, boolean byName)
      throws HttpResponseException {
    table =
        byName
            ? getEntityByName(table.getFullyQualifiedName(), null, ADMIN_AUTH_HEADERS)
            : getEntity(table.getId(), null, ADMIN_AUTH_HEADERS);
    assertListNotNull(table.getService(), table.getServiceType(), table.getColumns());
    assertListNull(
        table.getTableConstraints(),
        table.getUsageSummary(),
        table.getOwner(),
        table.getTags(),
        table.getFollowers(),
        table.getJoins(),
        table.getSampleData(),
        table.getViewDefinition(),
        table.getProfile(),
        table.getLocation(),
        table.getDataModel());

    String fields =
        "tableConstraints,usageSummary,owner,"
            + "tags,followers,joins,sampleData,viewDefinition,profile,location,dataModel";
    table =
        byName
            ? getEntityByName(table.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(table.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(table.getService(), table.getServiceType(), table.getColumns());
    // Fields sampleData, viewDefinition, tableProfile, location,
    // and dataModel are not set during creation - tested elsewhere
    assertListNotNull(
        table.getTableConstraints(),
        table.getUsageSummary(),
        table.getJoins() /*, table.getSampleData(), table.getViewDefinition(), table
            .getTableProfile(),  table.getLocation(), table.getDataModel()*/);
    assertListNotEmpty(table.getTableConstraints());
    // Checks for other owner, tags, and followers is done in the base class
    return table;
  }

  public void assertDataModel(DataModel expected, DataModel actual) {
    assertEquals(expected.getSql(), actual.getSql());
    assertEquals(expected.getModelType(), actual.getModelType());
    assertEquals(expected.getGeneratedAt(), actual.getGeneratedAt());
  }

  private static void assertColumn(Column expectedColumn, Column actualColumn)
      throws HttpResponseException {
    assertNotNull(actualColumn.getFullyQualifiedName());
    assertTrue(
        expectedColumn.getName().equalsIgnoreCase(actualColumn.getName())
            || expectedColumn.getName().equalsIgnoreCase(actualColumn.getDisplayName()));
    assertEquals(expectedColumn.getDescription(), actualColumn.getDescription());
    assertEquals(expectedColumn.getDataType(), actualColumn.getDataType());
    assertEquals(expectedColumn.getArrayDataType(), actualColumn.getArrayDataType());
    assertEquals(expectedColumn.getConstraint(), actualColumn.getConstraint());
    if (expectedColumn.getDataTypeDisplay() != null) {
      assertEquals(
          expectedColumn.getDataTypeDisplay().toLowerCase(Locale.ROOT),
          actualColumn.getDataTypeDisplay());
    }
    TestUtils.validateTags(expectedColumn.getTags(), actualColumn.getTags());

    // Check the nested columns
    assertColumns(expectedColumn.getChildren(), actualColumn.getChildren());
  }

  public static void assertColumns(List<Column> expectedColumns, List<Column> actualColumns)
      throws HttpResponseException {
    if (expectedColumns == actualColumns) {
      return;
    }
    // Sort columns by name
    assertEquals(expectedColumns.size(), actualColumns.size());

    // Make a copy before sorting in case the lists are immutable
    List<Column> expected = new ArrayList<>(expectedColumns);
    List<Column> actual = new ArrayList<>(actualColumns);
    expected.sort(Comparator.comparing(Column::getName, String.CASE_INSENSITIVE_ORDER));
    actual.sort(Comparator.comparing(Column::getName, String.CASE_INSENSITIVE_ORDER));
    for (int i = 0; i < expected.size(); i++) {
      assertColumn(expected.get(i), actual.get(i));
    }
  }

  /**
   * A method variant to be called form other tests to create a table without depending on Database, DatabaseService set
   * up in the {@code setup()} method
   */
  public Table createEntity(TestInfo test, int index) throws IOException {
    DatabaseService service =
        dbServiceTest.createEntity(dbServiceTest.createRequest(test), ADMIN_AUTH_HEADERS);
    Database database =
        dbTest.createAndCheckEntity(
            dbTest.createRequest(test).withService(service.getFullyQualifiedName()),
            ADMIN_AUTH_HEADERS);
    CreateTable create = createRequest(test, index);
    return createEntity(create, ADMIN_AUTH_HEADERS).withDatabase(database.getEntityReference());
  }

  public Table putJoins(UUID tableId, TableJoins joins, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(tableId).path("/joins");
    return TestUtils.put(target, joins, Table.class, OK, authHeaders);
  }

  public Table putSampleData(UUID tableId, TableData data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(tableId).path("/sampleData");
    return TestUtils.put(target, data, Table.class, OK, authHeaders);
  }

  public Table getSampleData(UUID tableId, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(tableId).path("/sampleData");
    return TestUtils.get(target, Table.class, authHeaders);
  }

  public Table putTableProfilerConfig(
      UUID tableId, TableProfilerConfig data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(tableId).path("/tableProfilerConfig");
    return TestUtils.put(target, data, Table.class, OK, authHeaders);
  }

  public Table getTableProfileConfig(UUID tableId, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(tableId).path("/tableProfilerConfig");
    return TestUtils.get(target, Table.class, authHeaders);
  }

  public Table deleteTableProfilerConfig(UUID tableId, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(tableId).path("/tableProfilerConfig");
    return TestUtils.delete(target, Table.class, authHeaders);
  }

  public Table getLatestTableProfile(String fqn, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/" + fqn + "/tableProfile/latest");
    return TestUtils.get(target, Table.class, authHeaders);
  }

  public Table putTableProfileData(
      UUID tableId, CreateTableProfile data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(tableId).path("/tableProfile");
    return TestUtils.put(target, data, Table.class, OK, authHeaders);
  }

  public void deleteTableProfile(
      String fqn, String entityType, Long timestamp, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target =
        getCollection().path("/" + fqn + "/" + entityType + "/" + timestamp + "/profile");
    TestUtils.delete(target, authHeaders);
  }

  public ResultList<TableProfile> getTableProfiles(
      String fqn, Long startTs, Long endTs, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/" + fqn + "/tableProfile");
    target = target.queryParam("startTs", startTs).queryParam("endTs", endTs);
    return TestUtils.get(target, TableResource.TableProfileList.class, authHeaders);
  }

  public ResultList<ColumnProfile> getColumnProfiles(
      String fqn, Long startTs, Long endTs, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getCollection().path("/" + fqn + "/columnProfile");
    target = target.queryParam("startTs", startTs).queryParam("endTs", endTs);
    return TestUtils.get(target, TableResource.ColumnProfileList.class, authHeaders);
  }

  public void putTableQueriesData(
      UUID queryId, List<EntityReference> data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(String.format("queries/%s/usage", queryId));
    TestUtils.put(target, data, ChangeEvent.class, CREATED, authHeaders);
  }

  public List<Query> getTableQueriesData(UUID entityId, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(String.format("queries?entityId=%s&fields=votes", entityId));
    return TestUtils.get(target, QueryResource.QueryList.class, authHeaders).getData();
  }

  public Table putTableDataModel(UUID tableId, DataModel dataModel, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(tableId).path("/dataModel");
    return TestUtils.put(target, dataModel, Table.class, OK, authHeaders);
  }

  public Table putCustomMetric(
      UUID tableId, CreateCustomMetric data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(tableId).path("/customMetric");
    return TestUtils.put(target, data, Table.class, OK, authHeaders);
  }

  public void deleteCustomMetric(
      UUID tableId, String columnName, String metricName, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(tableId).path("/customMetric/" + columnName + "/" + metricName);
    TestUtils.delete(target, Table.class, authHeaders);
  }

  public void deleteTableCustomMetric(
      UUID tableId, String metricName, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource(tableId).path("/customMetric/" + metricName);
    TestUtils.delete(target, Table.class, authHeaders);
  }

  private int getTagUsageCount(String tagFqn, Map<String, String> authHeaders)
      throws HttpResponseException {
    return tagResourceTest.getEntityByName(tagFqn, "usageCount", authHeaders).getUsageCount();
  }

  private int getClassificationUsageCount(String name, Map<String, String> authHeaders)
      throws HttpResponseException {
    ClassificationResourceTest classificationResourceTest = new ClassificationResourceTest();
    return classificationResourceTest
        .getEntityByName(name, "usageCount", authHeaders)
        .getUsageCount();
  }

  private static int getGlossaryUsageCount(String name) throws HttpResponseException {
    return new GlossaryResourceTest()
        .getEntityByName(name, null, "usageCount", TestUtils.ADMIN_AUTH_HEADERS)
        .getUsageCount();
  }

  private static int getGlossaryTermUsageCount(String name, Map<String, String> authHeaders)
      throws HttpResponseException {
    return new GlossaryTermResourceTest()
        .getEntityByName(name, null, "usageCount", authHeaders)
        .getUsageCount();
  }

  private void verifyTableProfiles(
      ResultList<TableProfile> actualProfiles,
      List<TableProfile> expectedProfiles,
      int expectedCount) {
    assertEquals(expectedCount, actualProfiles.getPaging().getTotal());
    assertEquals(expectedProfiles.size(), actualProfiles.getData().size());
    Map<Long, TableProfile> tableProfileMap = new HashMap<>();
    for (TableProfile profile : actualProfiles.getData()) {
      tableProfileMap.put(profile.getTimestamp(), profile);
    }
    for (TableProfile tableProfile : expectedProfiles) {
      TableProfile storedProfile = tableProfileMap.get(tableProfile.getTimestamp());
      verifyTableProfile(storedProfile, tableProfile);
    }
  }

  private void verifyColumnProfiles(
      ResultList<ColumnProfile> actualProfiles,
      List<ColumnProfile> expectedProfiles,
      int expectedCount) {
    assertEquals(expectedCount, actualProfiles.getPaging().getTotal());
    assertEquals(expectedProfiles.size(), actualProfiles.getData().size());
    Map<Long, ColumnProfile> columnProfileMap = new HashMap<>();
    for (ColumnProfile profile : actualProfiles.getData()) {
      columnProfileMap.put(profile.getTimestamp(), profile);
    }
    for (ColumnProfile columnProfile : expectedProfiles) {
      ColumnProfile storedProfile = columnProfileMap.get(columnProfile.getTimestamp());
      verifyColumnProfile(storedProfile, columnProfile);
    }
  }

  private void verifyTableProfile(TableProfile actualProfile, TableProfile expectedProfile) {
    assertNotNull(actualProfile);
    assertEquals(actualProfile, expectedProfile);
  }

  private void verifyColumnProfile(ColumnProfile actualProfile, ColumnProfile expectedProfile) {
    assertNotNull(actualProfile);
    assertEquals(actualProfile, expectedProfile);
  }

  private void verifyCustomMetrics(
      Table table, Column column, List<CreateCustomMetric> expectedMetrics) {
    List<CustomMetric> actualMetrics = new ArrayList<>();
    for (Column c : table.getColumns()) {
      if (c.getName().equals(column.getName())) {
        actualMetrics = c.getCustomMetrics();
      }
    }
    assertEquals(actualMetrics.size(), expectedMetrics.size());

    Map<String, CustomMetric> columnMetricMap = new HashMap<>();
    for (CustomMetric metric : actualMetrics) {
      columnMetricMap.put(metric.getName(), metric);
    }

    for (CreateCustomMetric metric : expectedMetrics) {
      CustomMetric storedMetric = columnMetricMap.get(metric.getName());
      assertNotNull(storedMetric);
      assertEquals(metric.getDescription(), storedMetric.getDescription());
      assertEquals(metric.getOwner(), storedMetric.getOwner());
      assertEquals(metric.getExpression(), storedMetric.getExpression());
    }
  }

  @Override
  public CreateTable createRequest(String name) {
    TableConstraint constraint =
        new TableConstraint().withConstraintType(ConstraintType.UNIQUE).withColumns(List.of(C1));
    return new CreateTable()
        .withName(name)
        .withDatabaseSchema(getContainer().getFullyQualifiedName())
        .withColumns(COLUMNS)
        .withTableConstraints(List.of(constraint));
  }

  @Override
  public EntityReference getContainer() {
    return DATABASE_SCHEMA.getEntityReference();
  }

  @Override
  public EntityReference getContainer(Table entity) {
    return entity.getDatabaseSchema();
  }

  @Override
  public void validateCreatedEntity(
      Table createdEntity, CreateTable createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Entity specific validation
    assertEquals(createRequest.getTableType(), createdEntity.getTableType());
    assertColumns(createRequest.getColumns(), createdEntity.getColumns());
    assertReference(createRequest.getDatabaseSchema(), createdEntity.getDatabaseSchema());
    validateEntityReference(createdEntity.getDatabase());
    validateEntityReference(createdEntity.getService());
    validateTableConstraints(
        createRequest.getTableConstraints(), createdEntity.getTableConstraints());
    assertTablePartition(createRequest.getTablePartition(), createdEntity.getTablePartition());
    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
    TestUtils.validateEntityReferences(createdEntity.getFollowers());
    assertListNotNull(createdEntity.getService(), createdEntity.getServiceType());
    assertEquals(
        FullyQualifiedName.add(
            createdEntity.getDatabaseSchema().getFullyQualifiedName(), createdEntity.getName()),
        createdEntity.getFullyQualifiedName());
  }

  private void validateTableConstraints(
      List<TableConstraint> expected, List<TableConstraint> actual) {
    assertEquals(expected, actual);
  }

  @Override
  protected void validateDeletedEntity(
      CreateTable create,
      Table entityBeforeDeletion,
      Table entityAfterDeletion,
      Map<String, String> authHeaders)
      throws HttpResponseException {
    super.validateDeletedEntity(create, entityBeforeDeletion, entityAfterDeletion, authHeaders);

    assertReference(entityBeforeDeletion.getLocation(), entityAfterDeletion.getLocation());
  }

  @Override
  public void compareEntities(Table expected, Table patched, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Entity specific validation
    assertEquals(expected.getTableType(), patched.getTableType());
    assertColumns(expected.getColumns(), patched.getColumns());
    validateDatabase(expected.getDatabase(), patched.getDatabase());
    assertEquals(expected.getTableConstraints(), patched.getTableConstraints());
    TestUtils.validateTags(expected.getTags(), patched.getTags());
    TestUtils.validateEntityReferences(expected.getFollowers());
    assertEquals(
        FullyQualifiedName.add(
            patched.getDatabaseSchema().getFullyQualifiedName(), patched.getName()),
        patched.getFullyQualifiedName());
  }

  private void validateDatabase(EntityReference expectedDatabase, EntityReference database) {
    TestUtils.validateEntityReference(database);
    assertEquals(expectedDatabase.getId(), database.getId());
  }

  private void assertTablePartition(
      TablePartition expectedPartition, TablePartition actualPartition) {
    if (expectedPartition == null && actualPartition == null) {
      return;
    }

    Map<String, PartitionColumnDetails> expectedColumnMap = new HashMap<>();
    for (PartitionColumnDetails column : expectedPartition.getColumns()) {
      expectedColumnMap.put(column.getColumnName(), column);
    }

    assert expectedPartition != null;
    assertEquals(expectedPartition.getColumns().size(), actualPartition.getColumns().size());
    for (PartitionColumnDetails actualColumn : actualPartition.getColumns()) {
      PartitionColumnDetails expectedColumn = expectedColumnMap.get(actualColumn.getColumnName());
      assertNotNull(expectedColumn);
      assertEquals(expectedColumn.getIntervalType(), actualColumn.getIntervalType());
      assertEquals(expectedColumn.getInterval(), actualColumn.getInterval());
    }
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual)
      throws IOException {
    if (expected == actual) {
      return;
    }
    if (fieldName.startsWith("columns") && fieldName.endsWith("constraint")) {
      ColumnConstraint expectedConstraint = (ColumnConstraint) expected;
      ColumnConstraint actualConstraint = ColumnConstraint.fromValue((String) actual);
      assertEquals(expectedConstraint, actualConstraint);
    } else if (fieldName.startsWith("columns")
        && (fieldName.endsWith("description") || fieldName.endsWith("displayName"))) {
      assertEquals(expected, actual);
    } else if (fieldName.endsWith("tableConstraints")) {
      @SuppressWarnings("unchecked")
      List<TableConstraint> expectedConstraints =
          expected instanceof List
              ? (List<TableConstraint>) expected
              : JsonUtils.readObjects(expected.toString(), TableConstraint.class);
      List<TableConstraint> actualConstraints =
          JsonUtils.readObjects(actual.toString(), TableConstraint.class);
      assertEquals(expectedConstraints, actualConstraints);
    } else if (fieldName.contains("columns") && !fieldName.endsWith(FIELD_TAGS)) {
      assertColumnsFieldChange(expected, actual);
    } else if (fieldName.endsWith("tableType")) {
      TableType expectedTableType = TableType.fromValue(expected.toString());
      TableType actualTableType = TableType.fromValue(actual.toString());
      assertEquals(expectedTableType, actualTableType);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }

  public ColumnProfilerConfig getColumnProfilerConfig(String name, String... metrics) {
    return new ColumnProfilerConfig().withColumnName(name).withMetrics(List.of(metrics));
  }

  public ColumnProfile getColumnProfile(
      String name, Object max, Object min, Double uniqueCount, Long timestamp) {
    return new ColumnProfile()
        .withName(name)
        .withMax(max)
        .withMin(min)
        .withUniqueCount(uniqueCount)
        .withTimestamp(timestamp);
  }

  private static TableJoins getTableJoins(ColumnJoin... columnJoins) {
    return new TableJoins()
        .withStartDate(RestUtil.today(0))
        .withDayCount(1)
        .withColumnJoins(List.of(columnJoins));
  }

  private static ColumnJoin getColumnJoin(String columnName, String joinedWithFQN) {
    return new ColumnJoin()
        .withColumnName(columnName)
        .withJoinedWith(
            List.of(new JoinedWith().withJoinCount(1).withFullyQualifiedName(joinedWithFQN)));
  }
}
