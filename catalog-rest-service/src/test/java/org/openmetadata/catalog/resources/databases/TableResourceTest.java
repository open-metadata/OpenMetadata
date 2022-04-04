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

package org.openmetadata.catalog.resources.databases;

import static java.util.Collections.singletonList;
import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.Entity.TABLE;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.catalog.exception.CatalogExceptionMessage.invalidColumnFQN;
import static org.openmetadata.catalog.type.ColumnDataType.ARRAY;
import static org.openmetadata.catalog.type.ColumnDataType.BIGINT;
import static org.openmetadata.catalog.type.ColumnDataType.BINARY;
import static org.openmetadata.catalog.type.ColumnDataType.CHAR;
import static org.openmetadata.catalog.type.ColumnDataType.DATE;
import static org.openmetadata.catalog.type.ColumnDataType.FLOAT;
import static org.openmetadata.catalog.type.ColumnDataType.INT;
import static org.openmetadata.catalog.type.ColumnDataType.STRING;
import static org.openmetadata.catalog.type.ColumnDataType.STRUCT;
import static org.openmetadata.catalog.util.EntityUtil.getFQN;
import static org.openmetadata.catalog.util.EntityUtil.tagLabelMatch;
import static org.openmetadata.catalog.util.RestUtil.DATE_FORMAT;
import static org.openmetadata.catalog.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.catalog.util.TestUtils.TEST_AUTH_HEADERS;
import static org.openmetadata.catalog.util.TestUtils.UpdateType;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MAJOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertListNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.assertResponseContains;
import static org.openmetadata.common.utils.CommonUtil.getDateStringByOffset;

import java.io.IOException;
import java.net.URISyntaxException;
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
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateLocation;
import org.openmetadata.catalog.api.data.CreateTable;
import org.openmetadata.catalog.api.tests.CreateColumnTest;
import org.openmetadata.catalog.api.tests.CreateCustomMetric;
import org.openmetadata.catalog.api.tests.CreateTableTest;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.data.Location;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.jdbi3.TableRepository.TableEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.databases.TableResource.TableList;
import org.openmetadata.catalog.resources.glossary.GlossaryResourceTest;
import org.openmetadata.catalog.resources.glossary.GlossaryTermResourceTest;
import org.openmetadata.catalog.resources.locations.LocationResourceTest;
import org.openmetadata.catalog.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.catalog.resources.tags.TagResourceTest;
import org.openmetadata.catalog.tests.ColumnTest;
import org.openmetadata.catalog.tests.ColumnTestCase;
import org.openmetadata.catalog.tests.CustomMetric;
import org.openmetadata.catalog.tests.TableTest;
import org.openmetadata.catalog.tests.TableTestCase;
import org.openmetadata.catalog.tests.column.ColumnValueLengthsToBeBetween;
import org.openmetadata.catalog.tests.column.ColumnValuesMissingCountToBeEqual;
import org.openmetadata.catalog.tests.column.ColumnValuesToBeNotNull;
import org.openmetadata.catalog.tests.column.ColumnValuesToBeUnique;
import org.openmetadata.catalog.tests.column.ColumnValuesToMatchRegex;
import org.openmetadata.catalog.tests.table.TableColumnCountToEqual;
import org.openmetadata.catalog.tests.table.TableRowCountToBeBetween;
import org.openmetadata.catalog.tests.table.TableRowCountToEqual;
import org.openmetadata.catalog.tests.type.TestCaseExecutionFrequency;
import org.openmetadata.catalog.tests.type.TestCaseResult;
import org.openmetadata.catalog.tests.type.TestCaseStatus;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.ColumnConstraint;
import org.openmetadata.catalog.type.ColumnDataType;
import org.openmetadata.catalog.type.ColumnJoin;
import org.openmetadata.catalog.type.ColumnProfile;
import org.openmetadata.catalog.type.DataModel;
import org.openmetadata.catalog.type.DataModel.ModelType;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.JoinedWith;
import org.openmetadata.catalog.type.SQLQuery;
import org.openmetadata.catalog.type.TableConstraint;
import org.openmetadata.catalog.type.TableConstraint.ConstraintType;
import org.openmetadata.catalog.type.TableData;
import org.openmetadata.catalog.type.TableJoins;
import org.openmetadata.catalog.type.TablePartition;
import org.openmetadata.catalog.type.TableProfile;
import org.openmetadata.catalog.type.TableType;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.TagLabel.LabelType;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TableResourceTest extends EntityResourceTest<Table, CreateTable> {

  public TableResourceTest() {
    super(TABLE, Table.class, TableList.class, "tables", TableResource.FIELDS);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
  }

  @Test
  void post_tableWithoutColumnDataLength_400(TestInfo test) {
    List<Column> columns = singletonList(getColumn("c1", BIGINT, null).withOrdinalPosition(1));
    CreateTable create = createRequest(test).withColumns(columns);

    // char, varchar, binary, and varbinary columns must have length
    ColumnDataType[] columnDataTypes = {CHAR, ColumnDataType.VARCHAR, ColumnDataType.BINARY, ColumnDataType.VARBINARY};

    for (ColumnDataType dataType : columnDataTypes) {
      create.getColumns().get(0).withDataType(dataType);
      assertResponse(
          () -> createEntity(create, ADMIN_AUTH_HEADERS),
          BAD_REQUEST,
          "For column data types char, varchar, binary, varbinary dataLength must not be null");
    }
  }

  @Test
  void post_tableInvalidArrayColumn_400(TestInfo test) {
    // No arrayDataType passed for array
    List<Column> columns = singletonList(getColumn("c1", ARRAY, "array<int>", null));
    CreateTable create = createRequest(test).withColumns(columns);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "For column data type array, arrayDataType must not be null");

    // No dataTypeDisplay passed for array
    columns.get(0).withArrayDataType(INT).withDataTypeDisplay(null);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "For column data type array, dataTypeDisplay must be of type array<arrayDataType>");
  }

  @Test
  void post_duplicateColumnName_400(TestInfo test) {
    // Duplicate column names c1
    String repeatedColumnName = "c1";
    List<Column> columns =
        Arrays.asList(
            getColumn(repeatedColumnName, ARRAY, "array<int>", null), getColumn(repeatedColumnName, INT, null));
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
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Optional fields tableType
    create.withName(getEntityName(test, 1)).withTableType(TableType.View);
    Table table = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // check the FQN
    Database db = new DatabaseResourceTest().getEntity(table.getDatabase().getId(), null, ADMIN_AUTH_HEADERS);
    String expectedFQN = EntityUtil.getFQN(db.getFullyQualifiedName(), table.getName());
    assertEquals(expectedFQN, table.getFullyQualifiedName());
  }

  @Test
  void post_tableWithColumnWithDots(TestInfo test) throws IOException {
    CreateTable create = createRequest(test);
    List<Column> columns = new ArrayList<>();
    columns.add(getColumn("col.umn", INT, null));
    TableConstraint constraint =
        new TableConstraint().withConstraintType(ConstraintType.UNIQUE).withColumns(List.of(columns.get(0).getName()));
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
    TablePartition partition =
        new TablePartition()
            .withColumns(List.of(columns.get(1).getName()))
            .withIntervalType(TablePartition.IntervalType.TIME_UNIT)
            .withInterval("daily");
    create.setColumns(columns);
    create.setTablePartition(partition);
    Table created = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    assertTablePartition(partition, created.getTablePartition());
  }

  @Test
  void put_tableWithColumnWithOrdinalPositionAndWithoutOrdinalPosition(TestInfo test) throws IOException {
    CreateTable create = createRequest(test);
    List<Column> columns = new ArrayList<>();
    Column column1 = getColumn("column1", INT, null).withOrdinalPosition(1).withDescription("column1");
    Column column2 = getColumn("column2", INT, null).withOrdinalPosition(2).withDescription("column2");
    List<Column> origColumns = new ArrayList<>();
    origColumns.add(column1);
    origColumns.add(column2);
    // add 2 columns
    columns.add(column1);
    columns.add(column2);
    TableConstraint constraint =
        new TableConstraint().withConstraintType(ConstraintType.UNIQUE).withColumns(List.of(columns.get(0).getName()));
    TablePartition partition =
        new TablePartition()
            .withColumns(List.of(columns.get(0).getName(), columns.get(1).getName()))
            .withIntervalType(TablePartition.IntervalType.COLUMN_VALUE)
            .withInterval("column");
    create.setColumns(columns);
    create.setTableConstraints(List.of(constraint));
    create.setTablePartition(partition);
    Table created = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);
    Column column = created.getColumns().get(0);
    assertEquals("column1", column.getName());
    assertEquals("column1", column.getDescription());
    assertTablePartition(partition, created.getTablePartition());

    // keep original ordinalPosition add a column at the end and do not pass descriptions for the first 2 columns
    // we should retain the original description

    Column updateColumn1 = getColumn("column1", INT, null).withOrdinalPosition(1).withDescription("");
    Column updateColumn2 = getColumn("column2", INT, null).withOrdinalPosition(2).withDescription("");
    Column column3 =
        getColumn("column3", STRING, null)
            .withOrdinalPosition(3)
            .withDescription("column3")
            .withTags(List.of(USER_ADDRESS_TAG_LABEL, GLOSSARY1_TERM1_LABEL));
    columns = new ArrayList<>();
    columns.add(updateColumn1);
    columns.add(updateColumn2);
    columns.add(column3);
    partition =
        new TablePartition()
            .withColumns(List.of(columns.get(2).getName()))
            .withIntervalType(TablePartition.IntervalType.COLUMN_VALUE)
            .withInterval("column");
    create.setColumns(columns);
    create.setTableConstraints(List.of(constraint));
    create.setTablePartition(partition);
    // Update the table with constraints and ensure minor version change
    ChangeDescription change = getChangeDescription(created.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("columns").withNewValue(List.of(column3)));
    Table updatedTable = updateEntity(create, OK, ADMIN_AUTH_HEADERS);
    origColumns.add(column3);
    assertColumns(origColumns, updatedTable.getColumns());
    assertTablePartition(partition, updatedTable.getTablePartition());
    Table getTable = getEntity(updatedTable.getId(), "tablePartition", ADMIN_AUTH_HEADERS);
    assertTablePartition(partition, getTable.getTablePartition());

    TestUtils.validateUpdate(created.getVersion(), updatedTable.getVersion(), MINOR_UPDATE);
    // keep ordinalPosition and add a column in between
    updateColumn1 = getColumn("column1", INT, null).withOrdinalPosition(1).withDescription("");
    Column updateColumn4 = getColumn("column4", STRING, null).withOrdinalPosition(2).withDescription("column4");
    updateColumn2 = getColumn("column2", INT, null).withOrdinalPosition(3).withDescription("");
    Column updateColumn3 = getColumn("column3", STRING, null).withOrdinalPosition(4).withDescription("");
    columns = new ArrayList<>();
    columns.add(updateColumn1);
    columns.add(updateColumn2);
    columns.add(updateColumn4);
    columns.add(updateColumn3);
    create.setColumns(columns);
    create.setTableConstraints(List.of(constraint));

    Double prevVersion = updatedTable.getVersion();
    updatedTable = updateEntity(create, OK, ADMIN_AUTH_HEADERS);
    TestUtils.validateUpdate(prevVersion, updatedTable.getVersion(), MINOR_UPDATE);
    origColumns.add(2, updateColumn4);
    assertColumns(origColumns, updatedTable.getColumns());

    // Change data type to cause major update
    updateColumn3 = getColumn("column3", INT, null).withOrdinalPosition(4).withDescription("");
    columns = new ArrayList<>();
    columns.add(updateColumn1);
    columns.add(updateColumn2);
    columns.add(updateColumn4);
    columns.add(updateColumn3);
    create.setColumns(columns);
    create.setTableConstraints(List.of(constraint));
    prevVersion = updatedTable.getVersion();
    updatedTable = updateEntity(create, OK, ADMIN_AUTH_HEADERS);
    TestUtils.validateUpdate(prevVersion, updatedTable.getVersion(), MAJOR_UPDATE);
    origColumns.remove(3);
    origColumns.add(3, column3.withDataType(INT));
    assertColumns(origColumns, updatedTable.getColumns());
  }

  public static Column getColumn(String name, ColumnDataType columnDataType, TagLabel tag) {
    return getColumn(name, columnDataType, null, tag);
  }

  private static Column getColumn(String name, ColumnDataType columnDataType, String dataTypeDisplay, TagLabel tag) {
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
    Column c1 = getColumn("c1", ARRAY, "array<int>", USER_ADDRESS_TAG_LABEL).withArrayDataType(INT);
    Column c2_a = getColumn("a", INT, USER_ADDRESS_TAG_LABEL);
    Column c2_b = getColumn("b", CHAR, USER_ADDRESS_TAG_LABEL);
    Column c2_c_d = getColumn("d", INT, USER_ADDRESS_TAG_LABEL);
    Column c2_c =
        getColumn("c", STRUCT, "struct<int: d>>", USER_ADDRESS_TAG_LABEL)
            .withChildren(new ArrayList<>(singletonList(c2_c_d)));

    // Column struct<a: int, b:char, c: struct<int: d>>>
    Column c2 =
        getColumn("c2", STRUCT, "struct<a: int, b:string, c: struct<int: d>>", GLOSSARY1_TERM1_LABEL)
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
    CreateTable create2 = createRequest(test, 2).withColumns(Arrays.asList(c1, c2)).withName("put_complexColumnType");
    Table table2 = updateAndCheckEntity(create2, CREATED, ADMIN_AUTH_HEADERS, UpdateType.CREATED, null);

    // Test PUT operation again without any change
    ChangeDescription change = getChangeDescription(table2.getVersion());
    updateAndCheckEntity(create2, Status.OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);

    //
    // Update the complex columns
    //
    // c1 from array<int> to array<char> - Data type change means old c1 deleted, and new c1 added
    change = getChangeDescription(table2.getVersion());
    change.getFieldsDeleted().add(new FieldChange().withName("columns").withOldValue(List.of(c1)));
    Column c1_new = getColumn("c1", ARRAY, "array<int>", USER_ADDRESS_TAG_LABEL).withArrayDataType(CHAR);
    change.getFieldsAdded().add(new FieldChange().withName("columns").withNewValue(List.of(c1_new)));

    // c2 from
    // struct<a:int, b:char, c:struct<d:int>>>
    // to
    // struct<-----, b:char, c:struct<d:int, e:char>, f:char>
    c2_b.withTags(List.of(USER_ADDRESS_TAG_LABEL, GLOSSARY1_TERM1_LABEL)); // Add new tag to c2.b tag
    change
        .getFieldsAdded()
        .add(
            new FieldChange()
                .withName(getFQN("columns", "c2", "b", "tags"))
                .withNewValue(List.of(GLOSSARY1_TERM1_LABEL)));

    Column c2_c_e = getColumn("e", INT, USER_ADDRESS_TAG_LABEL);
    c2_c.getChildren().add(c2_c_e); // Add c2.c.e
    change.getFieldsAdded().add(new FieldChange().withName(getFQN("columns", "c2", "c")).withNewValue(List.of(c2_c_e)));

    change
        .getFieldsDeleted()
        .add(new FieldChange().withName(getFQN("columns", "c2")).withOldValue(List.of(c2.getChildren().get(0))));
    c2.getChildren().remove(0); // Remove c2.a from struct

    Column c2_f = getColumn("f", CHAR, USER_ADDRESS_TAG_LABEL);
    c2.getChildren().add(c2_f); // Add c2.f
    create2 = create2.withColumns(Arrays.asList(c1_new, c2));
    change.getFieldsAdded().add(new FieldChange().withName(getFQN("columns", "c2")).withNewValue(List.of(c2_f)));

    // Update the columns with PUT operation and validate update
    // c1 array<int>                                   --> c1 array<chart
    // c2 struct<a: int, b:string, c: struct<int:d>>   --> c2 struct<b:char, c:struct<d:int,
    // e:char>, f:char>
    //   c2.a int                                      --> DELETED
    //   c2.b char                                     --> SAME
    //   c2.c struct<int: d>>
    //     c2.c.d int
    updateAndCheckEntity(
        create2.withName("put_complexColumnType"), Status.OK, ADMIN_AUTH_HEADERS, MAJOR_UPDATE, change);

    //
    // Patch operations on table1 created by POST operation. Columns can't be added or deleted. Only
    // tags and
    // description can be changed
    //
    String tableJson = JsonUtils.pojoToJson(table1);
    c1 = table1.getColumns().get(0);
    c1.withTags(singletonList(GLOSSARY1_TERM1_LABEL)); // c1 tag changed

    c2 = table1.getColumns().get(1);
    c2.withTags(Arrays.asList(USER_ADDRESS_TAG_LABEL, GLOSSARY1_TERM1_LABEL)); // c2 new tag added

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
    EntityReference database = new EntityReference().withId(NON_EXISTENT_ENTITY).withType(Entity.DATABASE);
    CreateTable create = createRequest(test).withDatabase(database);
    assertResponse(
        () -> createEntity(create, ADMIN_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.DATABASE, NON_EXISTENT_ENTITY));
  }

  @Test
  void put_tableTableConstraintUpdate_200(TestInfo test) throws IOException {
    // Create table without table constraints
    CreateTable request =
        createRequest(test).withOwner(USER_OWNER1).withDescription("description").withTableConstraints(null);
    Table table = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    checkOwnerOwns(USER_OWNER1, table.getId(), true);

    // Update the table with constraints and ensure minor version change
    ChangeDescription change = getChangeDescription(table.getVersion());
    TableConstraint constraint =
        new TableConstraint().withConstraintType(ConstraintType.UNIQUE).withColumns(List.of(COLUMNS.get(0).getName()));
    change.getFieldsAdded().add(new FieldChange().withName("tableConstraints").withNewValue(List.of(constraint)));
    request = request.withTableConstraints(List.of(constraint));
    Table updatedTable = updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Update again with no change. Version must not change
    change = getChangeDescription(updatedTable.getVersion());
    updatedTable = updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, NO_CHANGE, change);

    // Update the table with new constraints
    change = getChangeDescription(updatedTable.getVersion());
    TableConstraint constraint1 =
        new TableConstraint()
            .withConstraintType(ConstraintType.PRIMARY_KEY)
            .withColumns(List.of(COLUMNS.get(0).getName()));
    request = request.withTableConstraints(List.of(constraint1));
    change.getFieldsAdded().add(new FieldChange().withName("tableConstraints").withNewValue(List.of(constraint1)));
    change.getFieldsDeleted().add(new FieldChange().withName("tableConstraints").withOldValue(List.of(constraint)));
    updatedTable = updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove table constraint and ensure minor version changes
    change = getChangeDescription(updatedTable.getVersion());
    request = request.withTableConstraints(null);
    change.getFieldsDeleted().add(new FieldChange().withName("tableConstraints").withOldValue(List.of(constraint1)));
    updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_columnConstraintUpdate_200(TestInfo test) throws IOException {
    List<Column> columns = new ArrayList<>();
    columns.add(getColumn("c1", INT, null).withConstraint(ColumnConstraint.NULL));
    columns.add(getColumn("c2", INT, null).withConstraint(ColumnConstraint.UNIQUE));
    CreateTable request = createRequest(test).withColumns(columns);
    Table table = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);

    // Change the column constraints and expect minor version change
    ChangeDescription change = getChangeDescription(table.getVersion());
    request.getColumns().get(0).withConstraint(ColumnConstraint.NOT_NULL);
    change
        .getFieldsUpdated()
        .add(
            new FieldChange()
                .withName(getFQN("columns", "c1", "constraint"))
                .withOldValue(ColumnConstraint.NULL)
                .withNewValue(ColumnConstraint.NOT_NULL));

    request.getColumns().get(1).withConstraint(ColumnConstraint.PRIMARY_KEY);
    change
        .getFieldsUpdated()
        .add(
            new FieldChange()
                .withName(getFQN("columns", "c2", "constraint"))
                .withOldValue(ColumnConstraint.UNIQUE)
                .withNewValue(ColumnConstraint.PRIMARY_KEY));

    Table updatedTable = updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove column constraints and expect minor version change
    change = getChangeDescription(updatedTable.getVersion());
    request.getColumns().get(0).withConstraint(null);
    change
        .getFieldsDeleted()
        .add(new FieldChange().withName(getFQN("columns", "c1", "constraint")).withOldValue(ColumnConstraint.NOT_NULL));

    request.getColumns().get(1).withConstraint(null);
    change
        .getFieldsDeleted()
        .add(
            new FieldChange()
                .withName(getFQN("columns", "c2", "constraint"))
                .withOldValue(ColumnConstraint.PRIMARY_KEY));
    updateAndCheckEntity(request, OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_updateColumns_200(TestInfo test) throws IOException {
    int tagCategoryUsageCount = getTagCategoryUsageCount("user", TEST_AUTH_HEADERS);
    int addressTagUsageCount = getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), TEST_AUTH_HEADERS);
    int glossaryTermUsageCount = getGlossaryTermUsageCount(GLOSSARY1_TERM1_LABEL.getTagFQN(), TEST_AUTH_HEADERS);

    //
    // Create a table with column c1, type BIGINT, description c1 and tag USER_ADDRESS_TAB_LABEL
    //
    List<TagLabel> tags = new ArrayList<>();
    tags.add(USER_ADDRESS_TAG_LABEL);
    tags.add(USER_ADDRESS_TAG_LABEL); // Duplicated tags should be handled
    List<Column> columns = new ArrayList<>();
    columns.add(getColumn("c1", BIGINT, null).withTags(tags));

    CreateTable request = createRequest(test).withColumns(columns);
    Table table = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    columns.get(0).setFullyQualifiedName(table.getFullyQualifiedName() + ".c1");

    // Ensure tag category and tag usage counts are updated
    assertEquals(tagCategoryUsageCount + 1, getTagCategoryUsageCount("user", TEST_AUTH_HEADERS));
    assertEquals(addressTagUsageCount + 1, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), TEST_AUTH_HEADERS));
    assertEquals(
        glossaryTermUsageCount, getGlossaryTermUsageCount(GLOSSARY1_TERM1_LABEL.getTagFQN(), TEST_AUTH_HEADERS));

    //
    // Update the c1 tags to  USER_ADDRESS_TAB_LABEL, GLOSSARY1_TERM1_LABEL (newly added)
    // Ensure description and previous tag is carried forward during update
    //
    tags.add(GLOSSARY1_TERM1_LABEL);
    tags.add(GLOSSARY1_TERM1_LABEL); // Duplicated tags should be handled
    List<Column> updatedColumns = new ArrayList<>();
    updatedColumns.add(getColumn("c1", BIGINT, null).withTags(tags));
    ChangeDescription change = getChangeDescription(table.getVersion());
    change
        .getFieldsAdded()
        .add(new FieldChange().withName(getFQN("columns", "c1", "tags")).withNewValue(List.of(GLOSSARY1_TERM1_LABEL)));
    table = updateAndCheckEntity(request.withColumns(updatedColumns), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Ensure tag usage counts are updated
    assertEquals(tagCategoryUsageCount + 1, getTagCategoryUsageCount("user", TEST_AUTH_HEADERS));
    assertEquals(addressTagUsageCount + 1, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), TEST_AUTH_HEADERS));
    assertEquals(
        glossaryTermUsageCount + 1, getGlossaryTermUsageCount(GLOSSARY1_TERM1_LABEL.getTagFQN(), TEST_AUTH_HEADERS));

    //
    // Add a new column c2 using PUT
    //
    change = getChangeDescription(table.getVersion());
    Column c2 = getColumn("c2", BINARY, null).withOrdinalPosition(2).withDataLength(10).withTags(tags);
    updatedColumns.add(c2);
    change.getFieldsAdded().add(new FieldChange().withName("columns").withNewValue(List.of(c2)));
    table = updateAndCheckEntity(request.withColumns(updatedColumns), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Ensure tag usage counts are updated - column c2 added both address
    assertEquals(tagCategoryUsageCount + 2, getTagCategoryUsageCount("user", TEST_AUTH_HEADERS));
    assertEquals(addressTagUsageCount + 2, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), TEST_AUTH_HEADERS));
    assertEquals(
        glossaryTermUsageCount + 2, getGlossaryTermUsageCount(GLOSSARY1_TERM1_LABEL.getTagFQN(), TEST_AUTH_HEADERS));

    //
    // Change the column c2 data length from 10 to 20. Increasing the data length is considered backward compatible
    // and only minor version changes
    //
    c2.setDataLength(20);
    change = getChangeDescription(table.getVersion());
    String fieldName = getFQN("columns", "c2", "dataLength");
    change.getFieldsUpdated().add(new FieldChange().withName(fieldName).withOldValue(10).withNewValue(20));
    table = updateAndCheckEntity(request.withColumns(updatedColumns), OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    //
    // Change the column c2 data length from 20 to 10. Decreasing the data length is considered backward compatible
    // and results in major version changes
    //
    c2.setDataLength(10);
    change = getChangeDescription(table.getVersion());
    change.getFieldsUpdated().add(new FieldChange().withName(fieldName).withOldValue(20).withNewValue(10));
    table = updateAndCheckEntity(request.withColumns(updatedColumns), OK, ADMIN_AUTH_HEADERS, MAJOR_UPDATE, change);

    //
    // Remove a column c2 and make sure it is deleted by PUT
    //
    change = getChangeDescription(table.getVersion());
    updatedColumns.remove(1);
    change.getFieldsDeleted().add(new FieldChange().withName("columns").withOldValue(List.of(c2)));
    table = updateAndCheckEntity(request.withColumns(updatedColumns), OK, ADMIN_AUTH_HEADERS, MAJOR_UPDATE, change);
    assertEquals(1, table.getColumns().size());

    // Ensure tag usage counts are updated to reflect removal of column c2
    assertEquals(tagCategoryUsageCount + 1, getTagCategoryUsageCount("user", TEST_AUTH_HEADERS));
    assertEquals(addressTagUsageCount + 1, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), TEST_AUTH_HEADERS));
    assertEquals(
        glossaryTermUsageCount + 1, getGlossaryTermUsageCount(GLOSSARY1_TERM1_LABEL.getTagFQN(), TEST_AUTH_HEADERS));
  }

  @Test
  void put_tableJoins_200(TestInfo test) throws IOException, ParseException {
    Table table1 = createAndCheckEntity(createRequest(test, 1), ADMIN_AUTH_HEADERS);
    Table table2 = createAndCheckEntity(createRequest(test, 2), ADMIN_AUTH_HEADERS);
    Table table3 = createAndCheckEntity(createRequest(test, 3), ADMIN_AUTH_HEADERS);

    // Fully qualified names for table1, table2, table3 columns
    String t1c1 = EntityUtil.getFQN(table1.getFullyQualifiedName(), "c1");
    String t1c2 = EntityUtil.getFQN(table1.getFullyQualifiedName(), "c2");
    String t1c3 = EntityUtil.getFQN(table1.getFullyQualifiedName(), "c3");
    String t2c1 = EntityUtil.getFQN(table2.getFullyQualifiedName(), "c1");
    String t2c2 = EntityUtil.getFQN(table2.getFullyQualifiedName(), "c2");
    String t2c3 = EntityUtil.getFQN(table2.getFullyQualifiedName(), "c3");
    String t3c1 = EntityUtil.getFQN(table3.getFullyQualifiedName(), "c1");
    String t3c2 = EntityUtil.getFQN(table3.getFullyQualifiedName(), "c2");
    String t3c3 = EntityUtil.getFQN(table3.getFullyQualifiedName(), "c3");

    List<ColumnJoin> reportedJoins =
        Arrays.asList(
            // table1.c1 is joined with table2.c1, and table3.c1 with join count 10
            new ColumnJoin()
                .withColumnName("c1")
                .withJoinedWith(
                    Arrays.asList(
                        new JoinedWith().withFullyQualifiedName(t2c1).withJoinCount(10),
                        new JoinedWith().withFullyQualifiedName(t3c1).withJoinCount(10))),
            // table1.c2 is joined with table2.c1, and table3.c3 with join count 20
            new ColumnJoin()
                .withColumnName("c2")
                .withJoinedWith(
                    Arrays.asList(
                        new JoinedWith().withFullyQualifiedName(t2c2).withJoinCount(20),
                        new JoinedWith().withFullyQualifiedName(t3c2).withJoinCount(20))),
            // table1.c3 is joined with table2.c1, and table3.c3 with join count 30
            new ColumnJoin()
                .withColumnName("c3")
                .withJoinedWith(
                    Arrays.asList(
                        new JoinedWith().withFullyQualifiedName(t2c3).withJoinCount(30),
                        new JoinedWith().withFullyQualifiedName(t3c3).withJoinCount(30))));

    for (int i = 1; i <= 30; i++) {
      // Report joins starting from today back to 30 days. After every report, check the cumulative
      // join count
      TableJoins table1Joins =
          new TableJoins().withDayCount(1).withStartDate(RestUtil.today(-(i - 1))).withColumnJoins(reportedJoins);
      Table putResponse = putJoins(table1.getId(), table1Joins, ADMIN_AUTH_HEADERS);

      List<ColumnJoin> expectedJoins1 =
          Arrays.asList(
              // table1.c1 is joined with table2.c1, and table3.c1 with join count 10
              new ColumnJoin()
                  .withColumnName("c1")
                  .withJoinedWith(
                      Arrays.asList(
                          new JoinedWith().withFullyQualifiedName(t2c1).withJoinCount(10 * i),
                          new JoinedWith().withFullyQualifiedName(t3c1).withJoinCount(10 * i))),
              // table1.c2 is joined with table2.c1, and table3.c3 with join count 20
              new ColumnJoin()
                  .withColumnName("c2")
                  .withJoinedWith(
                      Arrays.asList(
                          new JoinedWith().withFullyQualifiedName(t2c2).withJoinCount(20 * i),
                          new JoinedWith().withFullyQualifiedName(t3c2).withJoinCount(20 * i))),
              // table1.c3 is joined with table2.c1, and table3.c3 with join count 30
              new ColumnJoin()
                  .withColumnName("c3")
                  .withJoinedWith(
                      Arrays.asList(
                          new JoinedWith().withFullyQualifiedName(t2c3).withJoinCount(30 * i),
                          new JoinedWith().withFullyQualifiedName(t3c3).withJoinCount(30 * i))));

      // Ensure PUT response returns the joins information
      assertColumnJoins(expectedJoins1, putResponse.getJoins());

      // getTable and ensure the following column joins are correct
      table1 = getEntity(table1.getId(), "joins", ADMIN_AUTH_HEADERS);
      assertColumnJoins(expectedJoins1, table1.getJoins());

      // getTable and ensure the following column joins are correct
      table2 = getEntity(table2.getId(), "joins", ADMIN_AUTH_HEADERS);
      List<ColumnJoin> expectedJoins2 =
          Arrays.asList(
              // table2.c1 is joined with table1.c1 with join count 10
              new ColumnJoin()
                  .withColumnName("c1")
                  .withJoinedWith(singletonList(new JoinedWith().withFullyQualifiedName(t1c1).withJoinCount(10 * i))),
              // table2.c2 is joined with table1.c1 with join count 20
              new ColumnJoin()
                  .withColumnName("c2")
                  .withJoinedWith(singletonList(new JoinedWith().withFullyQualifiedName(t1c2).withJoinCount(20 * i))),
              // table2.c3 is joined with table1.c1 with join count 30
              new ColumnJoin()
                  .withColumnName("c3")
                  .withJoinedWith(singletonList(new JoinedWith().withFullyQualifiedName(t1c3).withJoinCount(30 * i))));
      assertColumnJoins(expectedJoins2, table2.getJoins());

      // getTable and ensure the following column joins
      table3 = getEntity(table3.getId(), "joins", ADMIN_AUTH_HEADERS);
      List<ColumnJoin> expectedJoins3 =
          Arrays.asList(
              // table3.c1 is joined with table1.c1 with join count 10
              new ColumnJoin()
                  .withColumnName("c1")
                  .withJoinedWith(singletonList(new JoinedWith().withFullyQualifiedName(t1c1).withJoinCount(10 * i))),
              // table3.c2 is joined with table1.c1 with join count 20
              new ColumnJoin()
                  .withColumnName("c2")
                  .withJoinedWith(singletonList(new JoinedWith().withFullyQualifiedName(t1c2).withJoinCount(20 * i))),
              // table3.c3 is joined with table1.c1 with join count 30
              new ColumnJoin()
                  .withColumnName("c3")
                  .withJoinedWith(singletonList(new JoinedWith().withFullyQualifiedName(t1c3).withJoinCount(30 * i))));
      assertColumnJoins(expectedJoins3, table3.getJoins());

      // Report again for the previous day and make sure aggregate counts are correct
      table1Joins = new TableJoins().withDayCount(1).withStartDate(RestUtil.today(-1)).withColumnJoins(reportedJoins);
      putJoins(table1.getId(), table1Joins, ADMIN_AUTH_HEADERS);
      table1 = getEntity(table1.getId(), "joins", ADMIN_AUTH_HEADERS);
    }
  }

  @Test
  void put_tableJoinsInvalidColumnName_4xx(TestInfo test) throws IOException, ParseException {
    Table table1 = createAndCheckEntity(createRequest(test, 1), ADMIN_AUTH_HEADERS);
    Table table2 = createAndCheckEntity(createRequest(test, 2), ADMIN_AUTH_HEADERS);

    List<ColumnJoin> joins = singletonList(new ColumnJoin().withColumnName("c1"));
    TableJoins tableJoins = new TableJoins().withStartDate(RestUtil.today(0)).withDayCount(1).withColumnJoins(joins);

    // Invalid database name
    String columnFQN = "invalidDB";
    JoinedWith joinedWith = new JoinedWith().withFullyQualifiedName(columnFQN);
    joins.get(0).withJoinedWith(singletonList(joinedWith));
    assertResponse(
        () -> putJoins(table1.getId(), tableJoins, ADMIN_AUTH_HEADERS), BAD_REQUEST, invalidColumnFQN(columnFQN));

    // Invalid table name
    columnFQN = table2.getDatabase().getName() + ".invalidTable";
    joinedWith = new JoinedWith().withFullyQualifiedName(columnFQN);
    joins.get(0).withJoinedWith(singletonList(joinedWith));
    assertResponse(
        () -> putJoins(table1.getId(), tableJoins, ADMIN_AUTH_HEADERS), BAD_REQUEST, invalidColumnFQN(columnFQN));

    // Invalid column name
    columnFQN = table2.getFullyQualifiedName() + ".invalidColumn";
    joinedWith = new JoinedWith().withFullyQualifiedName(columnFQN);
    joins.get(0).withJoinedWith(singletonList(joinedWith));
    assertResponse(
        () -> putJoins(table1.getId(), tableJoins, ADMIN_AUTH_HEADERS), BAD_REQUEST, invalidColumnFQN(columnFQN));

    // Invalid date older than 30 days
    joinedWith = new JoinedWith().withFullyQualifiedName(table2.getFullyQualifiedName() + ".c1");
    joins.get(0).withJoinedWith(singletonList(joinedWith));
    tableJoins.withStartDate(RestUtil.today(-30)); // 30 days older than today
    assertResponse(
        () -> putJoins(table1.getId(), tableJoins, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Date range can only include past 30 days starting today");
  }

  public void assertColumnJoins(List<ColumnJoin> expected, TableJoins actual) throws ParseException {
    // Table reports last 30 days of aggregated join count
    assertEquals(actual.getStartDate(), getDateStringByOffset(DATE_FORMAT, RestUtil.today(0), -30));
    assertEquals(30, actual.getDayCount());

    // Sort the columnJoins and the joinedWith to account for different ordering
    expected.sort(Comparator.comparing(ColumnJoin::getColumnName));
    expected.forEach(c -> c.getJoinedWith().sort(Comparator.comparing(JoinedWith::getFullyQualifiedName)));
    actual.getColumnJoins().sort(Comparator.comparing(ColumnJoin::getColumnName));
    actual
        .getColumnJoins()
        .forEach(c -> c.getJoinedWith().sort(Comparator.comparing(JoinedWith::getFullyQualifiedName)));
    assertEquals(expected, actual.getColumnJoins());
  }

  @Test
  void put_tableSampleData_200(TestInfo test) throws IOException {
    Table table = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    List<String> columns = Arrays.asList("c1", "c2", "c3");

    // Add 3 rows of sample data for 3 columns
    List<List<Object>> rows =
        Arrays.asList(
            Arrays.asList("c1Value1", 1, true),
            Arrays.asList("c1Value2", null, false),
            Arrays.asList("c1Value3", 3, true));

    TableData tableData = new TableData().withColumns(columns).withRows(rows);
    Table putResponse = putSampleData(table.getId(), tableData, ADMIN_AUTH_HEADERS);
    assertEquals(tableData, putResponse.getSampleData());

    table = getEntity(table.getId(), "sampleData", ADMIN_AUTH_HEADERS);
    assertEquals(tableData, table.getSampleData());
  }

  @Test
  void put_tableInvalidSampleData_4xx(TestInfo test) throws IOException {
    Table table = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    TableData tableData = new TableData();

    // Send sample data with invalid column name
    List<String> columns = Arrays.asList("c1", "c2", "invalidColumn"); // Invalid column name
    List<List<Object>> rows = singletonList(Arrays.asList("c1Value1", 1, true)); // Valid sample data
    tableData.withColumns(columns).withRows(rows);
    assertResponseContains(
        () -> putSampleData(table.getId(), tableData, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid column name invalidColumn");

    // Send sample data that has more samples than the number of columns
    columns = Arrays.asList("c1", "c2", "c3"); // Invalid column name
    rows = singletonList(Arrays.asList("c1Value1", 1, true, "extra value")); // Extra value
    tableData.withColumns(columns).withRows(rows);
    assertResponseContains(
        () -> putSampleData(table.getId(), tableData, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Number of columns is 3 but row " + "has 4 sample values");

    // Send sample data that has fewer samples than the number of columns
    columns = Arrays.asList("c1", "c2", "c3"); // Invalid column name
    rows = singletonList(Arrays.asList("c1Value1", 1 /* Missing Value */));
    tableData.withColumns(columns).withRows(rows);
    assertResponseContains(
        () -> putSampleData(table.getId(), tableData, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Number of columns is 3 but row h" + "as 2 sample values");
  }

  @Test
  void put_viewDefinition_200(TestInfo test) throws IOException {
    CreateTable createTable = createRequest(test);
    createTable.setTableType(TableType.View);
    String query =
        "sales_vw\n"
            + "create view sales_vw as\n"
            + "select * from public.sales\n"
            + "union all\n"
            + "select * from spectrum.sales\n"
            + "with no schema binding;\n";
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
        "sales_vw\n"
            + "create view sales_vw as\n"
            + "select * from public.sales\n"
            + "union all\n"
            + "select * from spectrum.sales\n"
            + "with no schema binding;\n";
    createTable.setViewDefinition(query);
    assertResponseContains(
        () -> createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "ViewDefinition can only be set on " + "TableType View, SecureView or MaterializedView");
  }

  @Test
  void put_profileSample_200(TestInfo test) throws IOException {
    CreateTable request = createRequest(test);
    Table table = createAndCheckEntity(request, ADMIN_AUTH_HEADERS);
    ChangeDescription change = getChangeDescription(table.getVersion());
    change.getFieldsAdded().add(new FieldChange().withName("profileSample").withNewValue(80.0));

    updateAndCheckEntity(request.withProfileSample(80.0), Status.OK, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void put_tableProfile_200(TestInfo test) throws IOException {
    Table table = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    ColumnProfile c1Profile = new ColumnProfile().withName("c1").withMax(100.0).withMin(10.0).withUniqueCount(100.0);
    ColumnProfile c2Profile = new ColumnProfile().withName("c2").withMax(99.0).withMin(20.0).withUniqueCount(89.0);
    ColumnProfile c3Profile = new ColumnProfile().withName("c3").withMax(75.0).withMin(25.0).withUniqueCount(77.0);
    // Add column profiles
    List<ColumnProfile> columnProfiles = List.of(c1Profile, c2Profile, c3Profile);
    TableProfile tableProfile =
        new TableProfile()
            .withRowCount(6.0)
            .withColumnCount(3.0)
            .withColumnProfile(columnProfiles)
            .withProfileDate("2021-09-09");
    Table putResponse = putTableProfileData(table.getId(), tableProfile, ADMIN_AUTH_HEADERS);
    verifyTableProfileData(putResponse.getTableProfile(), List.of(tableProfile));

    table = getEntity(table.getId(), "tableProfile", ADMIN_AUTH_HEADERS);
    verifyTableProfileData(table.getTableProfile(), List.of(tableProfile));

    // Add new date for TableProfile
    TableProfile newTableProfile =
        new TableProfile()
            .withRowCount(7.0)
            .withColumnCount(3.0)
            .withColumnProfile(columnProfiles)
            .withProfileDate("2021-09-08");
    putResponse = putTableProfileData(table.getId(), newTableProfile, ADMIN_AUTH_HEADERS);
    verifyTableProfileData(putResponse.getTableProfile(), List.of(newTableProfile, tableProfile));

    table = getEntity(table.getId(), "tableProfile", ADMIN_AUTH_HEADERS);
    verifyTableProfileData(table.getTableProfile(), List.of(newTableProfile, tableProfile));

    // Replace table profile for a date
    TableProfile newTableProfile1 =
        new TableProfile()
            .withRowCount(21.0)
            .withColumnCount(3.0)
            .withColumnProfile(columnProfiles)
            .withProfileDate("2021-09-08");
    putResponse = putTableProfileData(table.getId(), newTableProfile1, ADMIN_AUTH_HEADERS);
    assertEquals(tableProfile.getProfileDate(), putResponse.getTableProfile().get(0).getProfileDate());
    verifyTableProfileData(putResponse.getTableProfile(), List.of(newTableProfile1, tableProfile));

    table = getEntity(table.getId(), "tableProfile", ADMIN_AUTH_HEADERS);
    // first result should be the latest date
    assertEquals(tableProfile.getProfileDate(), table.getTableProfile().get(0).getProfileDate());
    verifyTableProfileData(table.getTableProfile(), List.of(newTableProfile1, tableProfile));
  }

  @Test
  void put_tableInvalidTableProfileData_4xx(TestInfo test) throws IOException {
    Table table = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    ColumnProfile c1Profile = new ColumnProfile().withName("c1").withMax(100.0).withMin(10.0).withUniqueCount(100.0);
    ColumnProfile c2Profile = new ColumnProfile().withName("c2").withMax(99.0).withMin(20.0).withUniqueCount(89.0);
    ColumnProfile c3Profile =
        new ColumnProfile().withName("invalidColumn").withMax(75.0).withMin(25.0).withUniqueCount(77.0);
    List<ColumnProfile> columnProfiles = List.of(c1Profile, c2Profile, c3Profile);
    TableProfile tableProfile =
        new TableProfile()
            .withRowCount(6.0)
            .withColumnCount(3.0)
            .withColumnProfile(columnProfiles)
            .withProfileDate("2021-09-09");
    assertResponseContains(
        () -> putTableProfileData(table.getId(), tableProfile, ADMIN_AUTH_HEADERS),
        BAD_REQUEST,
        "Invalid column name invalidColumn");
  }

  @Test
  void put_tableQueries_200(TestInfo test) throws IOException {
    Table table = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    SQLQuery query = new SQLQuery().withQuery("select * from test;").withQueryDate("2021-09-08").withDuration(600.0);
    Table putResponse = putTableQueriesData(table.getId(), query, ADMIN_AUTH_HEADERS);
    table = getEntity(table.getId(), "tableQueries", ADMIN_AUTH_HEADERS);
    assertEquals(query.getQuery(), putResponse.getTableQueries().get(0).getQuery());

    // first result should be the latest date
    assertEquals(query.getQuery(), table.getTableQueries().get(0).getQuery());
    SQLQuery query1 =
        new SQLQuery().withQuery("select * from test;").withQueryDate("2021-09-09").withDuration(200.0).withVote(2.0);

    //
    // try updating the same query again
    //
    putResponse = putTableQueriesData(table.getId(), query1, ADMIN_AUTH_HEADERS);
    assertEquals(1, putResponse.getTableQueries().size());
    assertEquals(query1.getQuery(), putResponse.getTableQueries().get(0).getQuery());
    assertEquals(query1.getVote(), putResponse.getTableQueries().get(0).getVote());

    table = getEntity(table.getId(), "tableQueries", ADMIN_AUTH_HEADERS);
    assertEquals(1, table.getTableQueries().size());
    assertEquals(query1.getQuery(), table.getTableQueries().get(0).getQuery());
    assertEquals(query1.getVote(), table.getTableQueries().get(0).getVote());

    //
    // Update again
    //
    SQLQuery query2 =
        new SQLQuery().withQuery("select * from users;").withQueryDate("2021-09-09").withDuration(200.0).withVote(5.0);
    putResponse = putTableQueriesData(table.getId(), query2, ADMIN_AUTH_HEADERS);
    assertEquals(2, putResponse.getTableQueries().size());
    // query2 with the highest vote should be the first result.
    assertEquals(query2.getQuery(), putResponse.getTableQueries().get(0).getQuery());
    assertEquals(query2.getVote(), putResponse.getTableQueries().get(0).getVote());

    table = getEntity(table.getId(), "tableQueries", ADMIN_AUTH_HEADERS);
    assertEquals(2, table.getTableQueries().size());
    // query2 with the highest vote should be the first result.
    assertEquals(query2.getQuery(), table.getTableQueries().get(0).getQuery());
    assertEquals(query2.getVote(), table.getTableQueries().get(0).getVote());
  }

  @Test
  void put_tableDataModel(TestInfo test) throws IOException {
    List<Column> columns =
        Arrays.asList(
            getColumn("c1", BIGINT, USER_ADDRESS_TAG_LABEL).withDescription(null),
            getColumn("c2", ColumnDataType.VARCHAR, USER_ADDRESS_TAG_LABEL).withDataLength(10).withDescription(null));
    Table table =
        createAndCheckEntity(createRequest(test).withColumns(columns).withDescription(null), ADMIN_AUTH_HEADERS);

    //
    // Update the data model and validate the response.
    // Make sure table and column description is carried forward if the original entity had them as
    // null
    //
    columns.get(0).setDescription("updatedDescription");
    columns.get(1).setDescription("updatedDescription");
    String query = "select * from test;";
    DataModel dataModel =
        new DataModel()
            .withDescription("updatedTableDescription")
            .withModelType(ModelType.DBT)
            .withSql(query)
            .withGeneratedAt(new Date())
            .withColumns(columns);
    Table putResponse = putTableDataModel(table.getId(), dataModel, ADMIN_AUTH_HEADERS);
    assertDataModel(dataModel, putResponse.getDataModel());
    assertEquals("updatedTableDescription", putResponse.getDescription()); // Table description updated

    // Get the table and validate the data model
    Table getResponse = getEntity(table.getId(), "dataModel,tags", ADMIN_AUTH_HEADERS);
    assertDataModel(dataModel, getResponse.getDataModel());
    assertEquals("updatedTableDescription", getResponse.getDescription()); // Table description updated
    assertColumns(columns, getResponse.getColumns()); // Column description updated

    //
    // Update again
    //
    query = "select * from testUpdated;";
    dataModel = new DataModel().withModelType(ModelType.DBT).withSql(query).withGeneratedAt(new Date());
    putResponse = putTableDataModel(table.getId(), dataModel, ADMIN_AUTH_HEADERS);
    assertDataModel(dataModel, putResponse.getDataModel());

    // Get the table and validate the data model
    getResponse = getEntity(table.getId(), "dataModel", ADMIN_AUTH_HEADERS);
    assertDataModel(dataModel, getResponse.getDataModel());
  }

  public void assertDataModel(DataModel expected, DataModel actual) {
    assertEquals(expected.getSql(), actual.getSql());
    assertEquals(expected.getModelType(), actual.getModelType());
    assertEquals(expected.getGeneratedAt(), actual.getGeneratedAt());
  }

  @Test
  void createUpdateDelete_tableCustomMetrics_200(TestInfo test) throws IOException {
    Table table = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    Column c1 = table.getColumns().get(0);

    CreateCustomMetric createMetric =
        new CreateCustomMetric()
            .withName("custom")
            .withColumnName(c1.getName())
            .withExpression("SELECT SUM(xyz) FROM abc");
    Table putResponse = putCustomMetric(table.getId(), createMetric, ADMIN_AUTH_HEADERS);
    verifyCustomMetrics(putResponse, c1, List.of(createMetric));

    table = getEntity(table.getId(), "customMetrics", ADMIN_AUTH_HEADERS);
    verifyCustomMetrics(table, c1, List.of(createMetric));

    // Update Custom Metric
    CreateCustomMetric updatedMetric =
        new CreateCustomMetric()
            .withName("custom")
            .withColumnName(c1.getName())
            .withExpression("Another select statement");
    putResponse = putCustomMetric(table.getId(), updatedMetric, ADMIN_AUTH_HEADERS);
    verifyCustomMetrics(putResponse, c1, List.of(updatedMetric));

    // Add another Custom Metric
    CreateCustomMetric createMetric2 =
        new CreateCustomMetric()
            .withName("custom2")
            .withColumnName(c1.getName())
            .withExpression("Yet another statement");
    putResponse = putCustomMetric(table.getId(), createMetric2, ADMIN_AUTH_HEADERS);
    verifyCustomMetrics(putResponse, c1, List.of(createMetric2));

    table = getEntity(table.getId(), "customMetrics", ADMIN_AUTH_HEADERS);
    verifyCustomMetrics(table, c1, List.of(updatedMetric, createMetric2));

    // Delete Custom Metric
    putResponse = deleteCustomMetric(table.getId(), c1.getName(), updatedMetric.getName(), ADMIN_AUTH_HEADERS);
    table = getEntity(table.getId(), "customMetrics", ADMIN_AUTH_HEADERS);
    verifyCustomMetrics(table, c1, List.of(createMetric2));
  }

  @Test
  void createUpdateDelete_tableColumnTests_200(TestInfo test) throws IOException {
    Table table = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);
    TableRowCountToEqual tableRowCountToEqual = new TableRowCountToEqual().withValue(100);
    TableTestCase tableTestCase =
        new TableTestCase()
            .withTableTestType(TableTestCase.TableTestType.TABLE_ROW_COUNT_TO_EQUAL)
            .withConfig(tableRowCountToEqual);
    CreateTableTest createTableTest =
        new CreateTableTest().withTestCase(tableTestCase).withExecutionFrequency(TestCaseExecutionFrequency.Hourly);
    Table putResponse = putTableTest(table.getId(), createTableTest, ADMIN_AUTH_HEADERS);
    verifyTableTest(putResponse.getName(), putResponse.getTableTests(), List.of(createTableTest));

    table = getEntity(table.getId(), "tests", ADMIN_AUTH_HEADERS);
    verifyTableTest(table.getName(), table.getTableTests(), List.of(createTableTest));

    // Add result to tableTest
    TestCaseResult testCaseResult1 =
        new TestCaseResult()
            .withResult("Rows equal to 100")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withSampleData("Rows == 100")
            .withExecutionTime(100L);
    createTableTest.setResult(testCaseResult1);
    putResponse = putTableTest(table.getId(), createTableTest, ADMIN_AUTH_HEADERS);
    verifyTableTest(putResponse.getName(), putResponse.getTableTests(), List.of(createTableTest));

    TestCaseResult testCaseResult2 =
        new TestCaseResult()
            .withResult("Rows equal to 100")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withSampleData("Rows == 100")
            .withExecutionTime(100L);
    createTableTest.setResult(testCaseResult2);
    table = getEntity(table.getId(), "tests", ADMIN_AUTH_HEADERS);
    verifyTableTest(table.getName(), table.getTableTests(), List.of(createTableTest));
    TableRowCountToBeBetween tableRowCountToBeBetween =
        new TableRowCountToBeBetween().withMinValue(100).withMaxValue(1000);
    TableTestCase tableTestCase1 =
        new TableTestCase()
            .withTableTestType(TableTestCase.TableTestType.TABLE_ROW_COUNT_TO_BE_BETWEEN)
            .withConfig(tableRowCountToBeBetween);
    CreateTableTest createTableTest1 = new CreateTableTest().withTestCase(tableTestCase1);
    putResponse = putTableTest(table.getId(), createTableTest1, ADMIN_AUTH_HEADERS);
    // returns the current test thats updated or created
    verifyTableTest(putResponse.getName(), putResponse.getTableTests(), List.of(createTableTest1));
    table = getEntity(table.getId(), "tests", ADMIN_AUTH_HEADERS);
    verifyTableTest(table.getName(), table.getTableTests(), List.of(createTableTest, createTableTest1));

    // update the test case
    tableRowCountToBeBetween = new TableRowCountToBeBetween().withMaxValue(10).withMaxValue(100);
    tableTestCase1.withConfig(tableRowCountToBeBetween);
    putResponse = putTableTest(table.getId(), createTableTest1, ADMIN_AUTH_HEADERS);
    // returns the current test thats updated or created
    verifyTableTest(putResponse.getName(), putResponse.getTableTests(), List.of(createTableTest1));

    Column c1 = table.getColumns().get(0);
    ColumnValueLengthsToBeBetween columnValueLengthsToBeBetween =
        new ColumnValueLengthsToBeBetween().withMaxLength(100).withMinLength(10);
    ColumnTestCase columnTestCase =
        new ColumnTestCase()
            .withColumnTestType(ColumnTestCase.ColumnTestType.COLUMN_VALUE_LENGTHS_TO_BE_BETWEEN)
            .withConfig(columnValueLengthsToBeBetween);
    CreateColumnTest createColumnTest =
        new CreateColumnTest()
            .withColumnName(c1.getName())
            .withTestCase(columnTestCase)
            .withExecutionFrequency(TestCaseExecutionFrequency.Hourly);
    putResponse = putColumnTest(table.getId(), createColumnTest, ADMIN_AUTH_HEADERS);
    verifyColumnTest(putResponse, c1, List.of(createColumnTest));

    table = getEntity(table.getId(), "tests", ADMIN_AUTH_HEADERS);
    verifyTableTest(table.getName(), table.getTableTests(), List.of(createTableTest, createTableTest1));
    verifyColumnTest(table, c1, List.of(createColumnTest));

    // Add result to columnTest
    TestCaseResult colTestCaseResult =
        new TestCaseResult()
            .withResult("min is > 100 and max < 1000")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withSampleData("minValue is 100 and maxValue is 1000")
            .withExecutionTime(100L);
    createColumnTest.setResult(colTestCaseResult);
    putResponse = putColumnTest(table.getId(), createColumnTest, ADMIN_AUTH_HEADERS);
    verifyColumnTest(putResponse, c1, List.of(createColumnTest));

    ColumnValuesMissingCountToBeEqual columnValuesMissingCountToBeEqual =
        new ColumnValuesMissingCountToBeEqual().withMissingCountValue(10);
    ColumnTestCase columnTestCase1 =
        new ColumnTestCase()
            .withColumnTestType(ColumnTestCase.ColumnTestType.COLUMN_VALUES_MISSING_COUNT_TO_BE_EQUAL)
            .withConfig(columnValuesMissingCountToBeEqual);
    CreateColumnTest createColumnTest1 =
        new CreateColumnTest()
            .withColumnName(c1.getName())
            .withTestCase(columnTestCase1)
            .withExecutionFrequency(TestCaseExecutionFrequency.Hourly);
    putResponse = putColumnTest(table.getId(), createColumnTest1, ADMIN_AUTH_HEADERS);
    verifyColumnTest(putResponse, c1, List.of(createColumnTest1));

    // update the test config
    columnValuesMissingCountToBeEqual = new ColumnValuesMissingCountToBeEqual().withMissingCountValue(100);
    columnTestCase1 =
        new ColumnTestCase()
            .withColumnTestType(ColumnTestCase.ColumnTestType.COLUMN_VALUES_MISSING_COUNT_TO_BE_EQUAL)
            .withConfig(columnValuesMissingCountToBeEqual);
    createColumnTest1 =
        new CreateColumnTest()
            .withColumnName(c1.getName())
            .withTestCase(columnTestCase1)
            .withExecutionFrequency(TestCaseExecutionFrequency.Hourly);
    putResponse = putColumnTest(table.getId(), createColumnTest1, ADMIN_AUTH_HEADERS);
    verifyColumnTest(putResponse, c1, List.of(createColumnTest1));

    // Add result to columnTest
    TestCaseResult colTestCaseResult1 =
        new TestCaseResult()
            .withResult("min is > 100 and max < 1000")
            .withTestCaseStatus(TestCaseStatus.Success)
            .withSampleData("minValue is 100 and maxValue is 1000")
            .withExecutionTime(100L);
    createColumnTest.setResult(colTestCaseResult1);
    putResponse = putColumnTest(table.getId(), createColumnTest, ADMIN_AUTH_HEADERS);
    createColumnTest.setResult(colTestCaseResult1);
    verifyColumnTest(putResponse, c1, List.of(createColumnTest));

    table = getEntity(table.getId(), "tests", ADMIN_AUTH_HEADERS);
    verifyColumnTest(table, c1, List.of(createColumnTest, createColumnTest1));

    // delete the table test case
    deleteTableTest(table.getId(), createTableTest1.getTestCase().getTableTestType().toString(), ADMIN_AUTH_HEADERS);
    table = getEntity(table.getId(), "tests", ADMIN_AUTH_HEADERS);
    verifyTableTest(table.getName(), table.getTableTests(), List.of(createTableTest));

    // delete column test case
    deleteColumnTest(table.getId(), c1.getName(), columnTestCase1.getColumnTestType().toString(), ADMIN_AUTH_HEADERS);
    table = getEntity(table.getId(), "tests", ADMIN_AUTH_HEADERS);
    verifyColumnTest(table, c1, List.of(createColumnTest));
  }

  @Test
  void get_deletedTableWithDeleteLocation(TestInfo test) throws IOException {
    CreateTable create = createRequest(getEntityName(test), "description", "displayName", USER_OWNER1);
    // Create first time using POST
    Table table = beforeDeletion(test, createEntity(create, ADMIN_AUTH_HEADERS));
    Table tableBeforeDeletion = getEntity(table.getId(), TableResource.FIELDS, ADMIN_AUTH_HEADERS);
    // delete both
    deleteAndCheckEntity(table, ADMIN_AUTH_HEADERS);
    new LocationResourceTest().deleteEntity(tableBeforeDeletion.getLocation().getId(), ADMIN_AUTH_HEADERS);
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("include", "deleted");
    Table tableAfterDeletion = getEntity(table.getId(), queryParams, TableResource.FIELDS, ADMIN_AUTH_HEADERS);
    validateDeletedEntity(create, tableBeforeDeletion, tableAfterDeletion, ADMIN_AUTH_HEADERS);
  }

  @Test
  @Order(1) // Run this test first as other tables created in other tests will interfere with listing
  void get_tableListWithDifferentFields_200_OK(TestInfo test) throws IOException {
    // Create a table test1 with 1 table tag and 3 column tags
    CreateTable create =
        createRequest(test, 1)
            .withOwner(USER_OWNER1)
            .withTags(List.of(USER_ADDRESS_TAG_LABEL, GLOSSARY2_TERM1_LABEL)) // 2 table tags - USER_ADDRESS, g2t1
            .withColumns(COLUMNS); // 3 column tags - 2 USER_ADDRESS and 1 g1t1
    createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Total 3 user tags  - 1 table tag + 2 column tags
    assertEquals(3, getTagCategoryUsageCount("user", ADMIN_AUTH_HEADERS));

    // Total 1 glossary1 tags  - 1 column
    assertEquals(1, getGlossaryUsageCount("g1", ADMIN_AUTH_HEADERS));

    // Total 1 glossary2 tags  - 1 table
    assertEquals(1, getGlossaryUsageCount("g2", ADMIN_AUTH_HEADERS));

    // Total 3 USER_ADDRESS tags - 1 table tag and 2 column tags
    assertEquals(3, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), ADMIN_AUTH_HEADERS));
    // Total 1 GLOSSARY1_TERM1 - 1 column level
    assertEquals(1, getGlossaryTermUsageCount(GLOSSARY1_TERM1_LABEL.getTagFQN(), ADMIN_AUTH_HEADERS));
    // Total 1 GLOSSARY1_TERM1 - 1 table level
    assertEquals(1, getGlossaryTermUsageCount(GLOSSARY2_TERM1_LABEL.getTagFQN(), ADMIN_AUTH_HEADERS));

    // Create a table test2 with 3 column tags
    CreateTable create1 =
        createRequest(test, 2)
            .withDescription("description")
            .withOwner(USER_OWNER1)
            .withColumns(COLUMNS); // 3 column tags - 2 USER_ADDRESS and 1 USER_BANK_ACCOUNT
    createAndCheckEntity(create1, ADMIN_AUTH_HEADERS);

    // Additional 2 user tags - 2 column tags
    assertEquals(5, getTagCategoryUsageCount("user", ADMIN_AUTH_HEADERS));
    // Additional 2 USER_ADDRESS tags - 2 column tags
    assertEquals(5, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), ADMIN_AUTH_HEADERS));
    // Additional 1 glossary tag - 1 column tags
    assertEquals(2, getGlossaryTermUsageCount(GLOSSARY1_TERM1_LABEL.getTagFQN(), ADMIN_AUTH_HEADERS));

    ResultList<Table> tableList = listEntities(null, ADMIN_AUTH_HEADERS); // List tables
    assertEquals(2, tableList.getData().size());
    assertFields(tableList.getData(), null);

    // List tables with databaseFQN as filter
    Map<String, String> queryParams =
        new HashMap<>() {
          {
            put("database", DATABASE.getFullyQualifiedName());
          }
        };
    ResultList<Table> tableList1 = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(tableList.getData().size(), tableList1.getData().size());
    assertFields(tableList1.getData(), null);

    // GET .../tables?fields=columns,tableConstraints
    final String fields = "tableConstraints";
    queryParams =
        new HashMap<>() {
          {
            put("fields", fields);
          }
        };
    tableList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, tableList.getData().size());
    assertFields(tableList.getData(), fields);

    // List tables with databaseFQN as filter
    queryParams =
        new HashMap<>() {
          {
            put("fields", fields);
            put("database", DATABASE.getFullyQualifiedName());
          }
        };
    tableList1 = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(tableList.getData().size(), tableList1.getData().size());
    assertFields(tableList1.getData(), fields);

    // GET .../tables?fields=usageSummary,owner
    final String fields1 = "usageSummary,owner";
    queryParams =
        new HashMap<>() {
          {
            put("fields", fields1);
          }
        };
    tableList = listEntities(queryParams, ADMIN_AUTH_HEADERS);
    assertEquals(2, tableList.getData().size());
    assertFields(tableList.getData(), fields1);
    for (Table table : tableList.getData()) {
      assertEquals(table.getOwner().getId(), USER_OWNER1.getId());
      assertEquals(table.getOwner().getType(), USER_OWNER1.getType());
      assertEquals(table.getDatabase().getId(), DATABASE.getId());
      assertEquals(table.getDatabase().getName(), DATABASE.getFullyQualifiedName());
    }

    // List tables with databaseFQN as filter
    queryParams =
        new HashMap<>() {
          {
            put("fields", fields1);
            put("database", DATABASE.getFullyQualifiedName());
          }
        };
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
                .withColumns(List.of(COLUMNS.get(0).getName())));

    String originalJson = JsonUtils.pojoToJson(table);
    ChangeDescription change = getChangeDescription(table.getVersion());

    table.withTableType(TableType.Regular).withTableConstraints(tableConstraints);

    change.getFieldsAdded().add(new FieldChange().withName("tableType").withNewValue(TableType.Regular));
    change.getFieldsAdded().add(new FieldChange().withName("tableConstraints").withNewValue(tableConstraints));

    table = patchEntityAndCheck(table, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    //
    // Replace tableType, tableConstraints
    //
    List<TableConstraint> tableConstraints1 =
        List.of(
            new TableConstraint()
                .withConstraintType(ConstraintType.UNIQUE)
                .withColumns(List.of(COLUMNS.get(1).getName())));
    originalJson = JsonUtils.pojoToJson(table);
    change = getChangeDescription(table.getVersion());

    table.withTableType(TableType.External).withTableConstraints(tableConstraints1);

    change
        .getFieldsUpdated()
        .add(new FieldChange().withName("tableType").withOldValue(TableType.Regular).withNewValue(TableType.External));
    change.getFieldsDeleted().add(new FieldChange().withName("tableConstraints").withOldValue(tableConstraints));
    change.getFieldsAdded().add(new FieldChange().withName("tableConstraints").withNewValue(tableConstraints1));

    table = patchEntityAndCheck(table, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);

    // Remove tableType, tableConstraints
    originalJson = JsonUtils.pojoToJson(table);
    change = getChangeDescription(table.getVersion());

    table.withTableType(null).withTableConstraints(null);

    change.getFieldsDeleted().add(new FieldChange().withName("tableType").withOldValue(TableType.External));
    change.getFieldsDeleted().add(new FieldChange().withName("tableConstraints").withOldValue(tableConstraints1));
    patchEntityAndCheck(table, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
  }

  @Test
  void patch_tableColumns_200_ok(TestInfo test) throws IOException {
    // Create table with the following columns
    List<Column> columns = new ArrayList<>();
    columns.add(getColumn("c1", INT, USER_ADDRESS_TAG_LABEL).withDescription(null));
    columns.add(getColumn("c2", BIGINT, USER_ADDRESS_TAG_LABEL));
    columns.add(getColumn("c3", FLOAT, GLOSSARY1_TERM1_LABEL));

    Table table = createEntity(createRequest(test).withColumns(columns), ADMIN_AUTH_HEADERS);

    // Update the column tags and description
    ChangeDescription change = getChangeDescription(table.getVersion());
    columns
        .get(0)
        .withDescription("new0") // Set new description
        .withTags(List.of(USER_ADDRESS_TAG_LABEL, GLOSSARY1_TERM1_LABEL));
    // Column c1 has new description
    change
        .getFieldsAdded()
        .add(new FieldChange().withName(getFQN("columns", "c1", "description")).withNewValue("new0"));
    //  Column c1 got new tags
    change
        .getFieldsAdded()
        .add(new FieldChange().withName(getFQN("columns", "c1", "tags")).withNewValue(List.of(GLOSSARY1_TERM1_LABEL)));

    columns
        .get(1)
        .withDescription("new1") // Change description
        .withTags(List.of(USER_ADDRESS_TAG_LABEL)); // No change in tags
    // Column c2 description changed
    change
        .getFieldsUpdated()
        .add(
            new FieldChange().withName(getFQN("columns", "c2", "description")).withNewValue("new1").withOldValue("c2"));

    columns.get(2).withTags(new ArrayList<>()); // Remove tag
    // Column c3 tags were removed
    change
        .getFieldsDeleted()
        .add(new FieldChange().withName(getFQN("columns", "c3", "tags")).withOldValue(List.of(GLOSSARY1_TERM1_LABEL)));

    String originalJson = JsonUtils.pojoToJson(table);
    table.setColumns(columns);
    table = patchEntityAndCheck(table, originalJson, ADMIN_AUTH_HEADERS, MINOR_UPDATE, change);
    assertColumns(columns, table.getColumns());
  }

  @Test
  void patch_tableColumnTags_200_ok(TestInfo test) throws IOException {
    Column c1 = getColumn("c1", INT, null);
    CreateTable create = createRequest(test).withColumns(List.of(c1));
    Table table = createAndCheckEntity(create, ADMIN_AUTH_HEADERS);

    // Add a primary tag and derived tag both. The tag list must include derived tags only once.
    String json = JsonUtils.pojoToJson(table);
    table.getColumns().get(0).withTags(List.of(PERSONAL_DATA_TAG_LABEL, USER_ADDRESS_TAG_LABEL));
    Table updatedTable = patchEntity(table.getId(), json, table, ADMIN_AUTH_HEADERS);

    // Ensure only three tag labels are found - Manual tags PersonalData.Personal, User.Address
    // and a derived tag PII.Sensitive
    List<TagLabel> updateTags = updatedTable.getColumns().get(0).getTags();
    assertEquals(3, updateTags.size());

    TagLabel userAddress =
        updateTags.stream().filter(t -> tagLabelMatch.test(t, USER_ADDRESS_TAG_LABEL)).findAny().orElse(null);
    assertNotNull(userAddress);
    assertEquals(LabelType.MANUAL, userAddress.getLabelType());

    TagLabel personData =
        updateTags.stream().filter(t -> tagLabelMatch.test(t, PERSONAL_DATA_TAG_LABEL)).findAny().orElse(null);
    assertNotNull(personData);
    assertEquals(LabelType.MANUAL, personData.getLabelType());

    TagLabel piiSensitive =
        updateTags.stream().filter(t -> tagLabelMatch.test(t, PII_SENSITIVE_TAG_LABEL)).findAny().orElse(null);
    assertNotNull(piiSensitive);
    assertEquals(LabelType.DERIVED, piiSensitive.getLabelType());
  }

  @Test
  void put_addDeleteLocation_200(TestInfo test) throws IOException {
    Table table = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    // Add location to the table
    LocationResourceTest locationResourceTest = new LocationResourceTest();
    CreateLocation create = locationResourceTest.createRequest(test);
    Location location = locationResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);
    addAndCheckLocation(table, location.getId(), OK, TEST_AUTH_HEADERS);
    // Delete location and make sure it is deleted
    deleteAndCheckLocation(table, TEST_AUTH_HEADERS);
  }

  @Test
  void put_addLocationAndDeleteTable_200(TestInfo test) throws IOException {
    Table table = createAndCheckEntity(createRequest(test), ADMIN_AUTH_HEADERS);

    // Add location to the table
    LocationResourceTest locationResourceTest = new LocationResourceTest();
    CreateLocation create = locationResourceTest.createRequest(test);
    Location location = locationResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);
    addAndCheckLocation(table, location.getId(), OK, TEST_AUTH_HEADERS);
    deleteAndCheckEntity(table, ADMIN_AUTH_HEADERS);
    Map<String, String> queryParams =
        new HashMap<>() {
          {
            put("include", "all");
          }
        };
    table = getEntity(table.getId(), queryParams, "location", ADMIN_AUTH_HEADERS);
    assertNotNull(table.getLocation(), "The location is missing");
    assertEquals(location.getId(), table.getLocation().getId(), "The locations are different");
  }

  private void deleteAndCheckLocation(Table table, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource(String.format("tables/%s/location", table.getId()));
    TestUtils.delete(target, authHeaders);
    checkLocationDeleted(table.getId(), authHeaders);
  }

  public void checkLocationDeleted(UUID tableId, Map<String, String> authHeaders) throws HttpResponseException {
    Table getTable = getEntity(tableId, "location", authHeaders);
    assertNull(getTable.getLocation());
  }

  public void addAndCheckLocation(Table table, UUID locationId, Status status, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource(String.format("tables/%s/location", table.getId()));
    TestUtils.put(target, locationId.toString(), status, authHeaders);

    // GET .../tables/{tableId} returns newly added location
    Table getTable = getEntity(table.getId(), "location", authHeaders);
    TestUtils.validateEntityReference(getTable.getLocation());
    assertEquals(
        locationId, getTable.getLocation().getId(), "Location added was not found in the table " + "get response");
  }

  void assertFields(List<Table> tableList, String fieldsParam) {
    tableList.forEach(t -> assertFields(t, fieldsParam));
  }

  void assertFields(Table table, String fieldsParam) {
    // TODO cleanup
    Fields fields = new Fields(Entity.getEntityFields(Table.class), fieldsParam);

    if (fields.contains("usageSummary")) {
      assertNotNull(table.getUsageSummary());
    } else {
      assertNull(table.getUsageSummary());
    }
    if (fields.contains("owner")) {
      assertNotNull(table.getOwner());
    } else {
      assertNull(table.getOwner());
    }
    if (fields.contains("columns")) {
      assertNotNull(table.getColumns());
      if (fields.contains("tags")) {
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
    if (fields.contains("tags")) {
      assertNotNull(table.getTags());
    } else {
      assertNull(table.getTags());
    }
    // Default fields that are always returned
    assertListNotNull(table.getDatabase(), table.getService(), table.getServiceType());
  }

  /** Validate returned fields GET .../tables/{id}?fields="..." or GET .../tables/name/{fqn}?fields="..." */
  @Override
  public void validateGetWithDifferentFields(Table table, boolean byName) throws HttpResponseException {
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
        table.getTableProfile(),
        table.getLocation(),
        table.getTableQueries(),
        table.getDataModel());

    String fields =
        "tableConstraints,usageSummary,owner,"
            + "tags,followers,joins,sampleData,viewDefinition,tableProfile,location,tableQueries,dataModel";
    table =
        byName
            ? getEntityByName(table.getFullyQualifiedName(), fields, ADMIN_AUTH_HEADERS)
            : getEntity(table.getId(), fields, ADMIN_AUTH_HEADERS);
    assertListNotNull(table.getService(), table.getServiceType(), table.getColumns());
    // Fields sampleData, viewDefinition, tableProfile, location, tableQueries,
    // and dataModel are not set during creation - tested elsewhere
    assertListNotNull(
        table.getTableConstraints(),
        table.getUsageSummary(),
        table.getOwner(),
        table.getTags(),
        table.getFollowers(),
        table.getJoins() /*, table.getSampleData(), table.getViewDefinition(), table
            .getTableProfile(),  table.getLocation(), table.getTableQueries(), table.getDataModel()*/);
  }

  private static void assertColumn(Column expectedColumn, Column actualColumn) throws HttpResponseException {
    assertNotNull(actualColumn.getFullyQualifiedName());
    assertTrue(
        expectedColumn.getName().equals(actualColumn.getName())
            || expectedColumn.getName().equals(actualColumn.getDisplayName()));
    assertEquals(expectedColumn.getDescription(), actualColumn.getDescription());
    assertEquals(expectedColumn.getDataType(), actualColumn.getDataType());
    assertEquals(expectedColumn.getArrayDataType(), actualColumn.getArrayDataType());
    assertEquals(expectedColumn.getConstraint(), actualColumn.getConstraint());
    if (expectedColumn.getDataTypeDisplay() != null) {
      assertEquals(expectedColumn.getDataTypeDisplay().toLowerCase(Locale.ROOT), actualColumn.getDataTypeDisplay());
    }
    TestUtils.validateTags(expectedColumn.getTags(), actualColumn.getTags());

    // Check the nested columns
    assertColumns(expectedColumn.getChildren(), actualColumn.getChildren());
  }

  private static void assertColumns(List<Column> expectedColumns, List<Column> actualColumns)
      throws HttpResponseException {
    if (expectedColumns == null && actualColumns == null) {
      return;
    }
    // Sort columns by name
    assertNotNull(expectedColumns);
    assertEquals(expectedColumns.size(), actualColumns.size());
    for (int i = 0; i < expectedColumns.size(); i++) {
      assertColumn(expectedColumns.get(i), actualColumns.get(i));
    }
  }

  /**
   * A method variant to be called form other tests to create a table without depending on Database, DatabaseService set
   * up in the {@code setup()} method
   */
  public Table createEntity(TestInfo test, int index) throws IOException {
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    DatabaseService service =
        databaseServiceResourceTest.createEntity(databaseServiceResourceTest.createRequest(test), ADMIN_AUTH_HEADERS);
    EntityReference serviceRef =
        new EntityReference().withName(service.getName()).withId(service.getId()).withType(Entity.DATABASE_SERVICE);
    DatabaseResourceTest databaseResourceTest = new DatabaseResourceTest();
    Database database =
        databaseResourceTest.createAndCheckEntity(
            databaseResourceTest.createRequest(test).withService(serviceRef), ADMIN_AUTH_HEADERS);
    CreateTable create = createRequest(test, index);
    return createEntity(create, ADMIN_AUTH_HEADERS).withDatabase(Entity.getEntityReference(database));
  }

  public static Table putJoins(UUID tableId, TableJoins joins, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("tables/" + tableId + "/joins");
    return TestUtils.put(target, joins, Table.class, OK, authHeaders);
  }

  public static Table putSampleData(UUID tableId, TableData data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("tables/" + tableId + "/sampleData");
    return TestUtils.put(target, data, Table.class, OK, authHeaders);
  }

  public static Table putTableProfileData(UUID tableId, TableProfile data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("tables/" + tableId + "/tableProfile");
    return TestUtils.put(target, data, Table.class, OK, authHeaders);
  }

  public static Table putTableQueriesData(UUID tableId, SQLQuery data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("tables/" + tableId + "/tableQuery");
    return TestUtils.put(target, data, Table.class, OK, authHeaders);
  }

  public static Table putTableDataModel(UUID tableId, DataModel dataModel, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("tables/" + tableId + "/dataModel");
    return TestUtils.put(target, dataModel, Table.class, OK, authHeaders);
  }

  public static Table putTableTest(UUID tableId, CreateTableTest data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("tables/" + tableId + "/tableTest");
    return TestUtils.put(target, data, Table.class, OK, authHeaders);
  }

  public static Table deleteTableTest(UUID tableId, String tableTestType, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("tables/" + tableId + "/tableTest/" + tableTestType);
    return TestUtils.delete(target, Table.class, authHeaders);
  }

  public static Table putColumnTest(UUID tableId, CreateColumnTest data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("tables/" + tableId + "/columnTest");
    return TestUtils.put(target, data, Table.class, OK, authHeaders);
  }

  public static Table deleteColumnTest(
      UUID tableId, String columnName, String columnTestType, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target =
        CatalogApplicationTest.getResource("tables/" + tableId + "/columnTest/" + columnName + "/" + columnTestType);
    return TestUtils.delete(target, Table.class, authHeaders);
  }

  public static Table putCustomMetric(UUID tableId, CreateCustomMetric data, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("tables/" + tableId + "/customMetric");
    return TestUtils.put(target, data, Table.class, OK, authHeaders);
  }

  public static Table deleteCustomMetric(
      UUID tableId, String columnName, String metricName, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target =
        CatalogApplicationTest.getResource("tables/" + tableId + "/customMetric/" + columnName + "/" + metricName);
    return TestUtils.delete(target, Table.class, authHeaders);
  }

  private static int getTagUsageCount(String tagFQN, Map<String, String> authHeaders) throws HttpResponseException {
    return TagResourceTest.getTag(tagFQN, "usageCount", authHeaders).getUsageCount();
  }

  private static int getTagCategoryUsageCount(String name, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TagResourceTest.getCategory(name, "usageCount", authHeaders).getUsageCount();
  }

  private static int getGlossaryUsageCount(String name, Map<String, String> authHeaders) throws HttpResponseException {
    return new GlossaryResourceTest().getEntityByName(name, "usageCount", authHeaders).getUsageCount();
  }

  private static int getGlossaryTermUsageCount(String name, Map<String, String> authHeaders)
      throws HttpResponseException {
    return new GlossaryTermResourceTest().getEntityByName(name, "usageCount", authHeaders).getUsageCount();
  }

  private void verifyTableProfileData(List<TableProfile> actualProfiles, List<TableProfile> expectedProfiles) {
    assertEquals(actualProfiles.size(), expectedProfiles.size());
    Map<String, TableProfile> tableProfileMap = new HashMap<>();
    for (TableProfile profile : actualProfiles) {
      tableProfileMap.put(profile.getProfileDate(), profile);
    }
    for (TableProfile tableProfile : expectedProfiles) {
      TableProfile storedProfile = tableProfileMap.get(tableProfile.getProfileDate());
      assertNotNull(storedProfile);
      assertEquals(tableProfile, storedProfile);
    }
  }

  private void verifyTableTest(String tableName, List<TableTest> actualTests, List<CreateTableTest> expectedTests) {
    assertEquals(expectedTests.size(), actualTests.size());
    Map<String, TableTest> tableTestMap = new HashMap<>();
    for (TableTest test : actualTests) {
      tableTestMap.put(test.getName(), test);
    }
    for (CreateTableTest test : expectedTests) {
      // passed in test name will be overridden in backend
      String expectedTestName = tableName + "." + test.getTestCase().getTableTestType().toString();
      TableTest storedTest = tableTestMap.get(expectedTestName);
      assertNotNull(storedTest);
      assertEquals(expectedTestName, storedTest.getName());
      assertEquals(test.getDescription(), storedTest.getDescription());
      assertEquals(test.getExecutionFrequency(), storedTest.getExecutionFrequency());
      assertEquals(test.getOwner(), storedTest.getOwner());
      verifyTableTestCase(test.getTestCase(), storedTest.getTestCase());
      if (test.getResult() != null && storedTest.getResults().size() > 0) {
        verifyTestCaseResults(test.getResult(), storedTest.getResults());
      }
    }
  }

  private void verifyTableTestCase(TableTestCase expected, TableTestCase actual) {
    assertEquals(expected.getTableTestType(), actual.getTableTestType());
    if (expected.getTableTestType() == TableTestCase.TableTestType.TABLE_COLUMN_COUNT_TO_EQUAL) {
      TableColumnCountToEqual expectedTest = (TableColumnCountToEqual) expected.getConfig();
      TableColumnCountToEqual actualTest = JsonUtils.convertValue(actual.getConfig(), TableColumnCountToEqual.class);
      assertEquals(expectedTest.getColumnCount(), actualTest.getColumnCount());
    } else if (expected.getTableTestType() == TableTestCase.TableTestType.TABLE_ROW_COUNT_TO_BE_BETWEEN) {
      TableRowCountToBeBetween expectedTest = (TableRowCountToBeBetween) expected.getConfig();
      TableRowCountToBeBetween actualTest = JsonUtils.convertValue(actual.getConfig(), TableRowCountToBeBetween.class);
      assertEquals(expectedTest.getMaxValue(), actualTest.getMaxValue());
      assertEquals(expectedTest.getMinValue(), actualTest.getMinValue());
    } else if (expected.getTableTestType() == TableTestCase.TableTestType.TABLE_ROW_COUNT_TO_EQUAL) {
      TableRowCountToEqual expectedTest = (TableRowCountToEqual) expected.getConfig();
      TableRowCountToEqual actualTest = JsonUtils.convertValue(actual.getConfig(), TableRowCountToEqual.class);
      assertEquals(expectedTest.getValue(), actualTest.getValue());
    }
  }

  private void verifyColumnTest(Table table, Column column, List<CreateColumnTest> expectedTests) {
    List<ColumnTest> actualTests = new ArrayList<>();
    for (Column c : table.getColumns()) {
      if (c.getName().equals(column.getName())) {
        actualTests = c.getColumnTests();
      }
    }
    assertEquals(actualTests.size(), expectedTests.size());

    Map<String, ColumnTest> columnTestMap = new HashMap<>();
    for (ColumnTest test : actualTests) {
      columnTestMap.put(test.getName(), test);
    }

    for (CreateColumnTest test : expectedTests) {
      // passed in test name will be overridden in backend
      String expectedTestName = column.getName() + "." + test.getTestCase().getColumnTestType().toString();
      ColumnTest storedTest = columnTestMap.get(expectedTestName);
      assertNotNull(storedTest);
      assertEquals(expectedTestName, storedTest.getName());
      assertEquals(test.getDescription(), storedTest.getDescription());
      assertEquals(test.getExecutionFrequency(), storedTest.getExecutionFrequency());
      assertEquals(test.getOwner(), storedTest.getOwner());
      verifyColumnTestCase(test.getTestCase(), storedTest.getTestCase());
      if (test.getResult() != null) {
        verifyTestCaseResults(test.getResult(), storedTest.getResults());
      }
    }
  }

  private void verifyCustomMetrics(Table table, Column column, List<CreateCustomMetric> expectedMetrics) {
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

  private void verifyColumnTestCase(ColumnTestCase expected, ColumnTestCase actual) {
    assertEquals(expected.getColumnTestType(), actual.getColumnTestType());
    if (expected.getColumnTestType() == ColumnTestCase.ColumnTestType.COLUMN_VALUES_TO_BE_UNIQUE) {
      ColumnValuesToBeUnique expectedTest = (ColumnValuesToBeUnique) expected.getConfig();
      ColumnValuesToBeUnique actualTest = JsonUtils.convertValue(actual.getConfig(), ColumnValuesToBeUnique.class);
      assertEquals(expectedTest, actualTest);
    } else if (expected.getColumnTestType() == ColumnTestCase.ColumnTestType.COLUMN_VALUES_TO_BE_NOT_NULL) {
      ColumnValuesToBeNotNull expectedTest = (ColumnValuesToBeNotNull) expected.getConfig();
      ColumnValuesToBeNotNull actualTest = JsonUtils.convertValue(actual.getConfig(), ColumnValuesToBeNotNull.class);
      assertEquals(expectedTest, actualTest);
    } else if (expected.getColumnTestType() == ColumnTestCase.ColumnTestType.COLUMN_VALUES_TO_MATCH_REGEX) {
      ColumnValuesToMatchRegex expectedTest = (ColumnValuesToMatchRegex) expected.getConfig();
      ColumnValuesToMatchRegex actualTest = JsonUtils.convertValue(actual.getConfig(), ColumnValuesToMatchRegex.class);
      assertEquals(expectedTest.getRegex(), actualTest.getRegex());
    } else if (expected.getColumnTestType() == ColumnTestCase.ColumnTestType.COLUMN_VALUE_LENGTHS_TO_BE_BETWEEN) {
      ColumnValueLengthsToBeBetween expectedTest = (ColumnValueLengthsToBeBetween) expected.getConfig();
      ColumnValueLengthsToBeBetween actualTest =
          JsonUtils.convertValue(actual.getConfig(), ColumnValueLengthsToBeBetween.class);
      assertEquals(expectedTest.getMaxLength(), actualTest.getMaxLength());
      assertEquals(expectedTest.getMinLength(), actualTest.getMinLength());
    } else if (expected.getColumnTestType() == ColumnTestCase.ColumnTestType.COLUMN_VALUES_MISSING_COUNT_TO_BE_EQUAL) {
      ColumnValuesMissingCountToBeEqual expectedTest = (ColumnValuesMissingCountToBeEqual) expected.getConfig();
      ColumnValuesMissingCountToBeEqual actualTest =
          JsonUtils.convertValue(actual.getConfig(), ColumnValuesMissingCountToBeEqual.class);
      assertEquals(expectedTest.getMissingCountValue(), actualTest.getMissingCountValue());
      assertEquals(expectedTest.getMissingValueMatch(), actualTest.getMissingValueMatch());
    }
  }

  private void verifyTestCaseResults(TestCaseResult expected, List<TestCaseResult> actual) {
    Map<Long, TestCaseResult> actualResultMap = new HashMap<>();
    for (Object a : actual) {
      TestCaseResult result = JsonUtils.convertValue(a, TestCaseResult.class);
      actualResultMap.put(result.getExecutionTime(), result);
    }
    TestCaseResult result = JsonUtils.convertValue(expected, TestCaseResult.class);
    TestCaseResult actualResult = actualResultMap.get(result.getExecutionTime());
    assertNotNull(actualResult);
    assertEquals(result.getResult(), actualResult.getResult());
    assertEquals(result.getSampleData(), actualResult.getSampleData());
  }

  @Override
  public CreateTable createRequest(String name, String description, String displayName, EntityReference owner) {
    TableConstraint constraint =
        new TableConstraint().withConstraintType(ConstraintType.UNIQUE).withColumns(List.of(COLUMNS.get(0).getName()));
    return new CreateTable()
        .withName(name)
        .withDatabase(getContainer())
        .withColumns(COLUMNS)
        .withTableConstraints(List.of(constraint))
        .withDescription(description)
        .withOwner(owner);
  }

  @Override
  public Table beforeDeletion(TestInfo test, Table table) throws HttpResponseException {
    // Add location to the table
    LocationResourceTest locationResourceTest = new LocationResourceTest();
    CreateLocation create = locationResourceTest.createRequest(test);
    Location location = locationResourceTest.createEntity(create, ADMIN_AUTH_HEADERS);
    addAndCheckLocation(table, location.getId(), OK, TEST_AUTH_HEADERS);
    return table;
  }

  @Override
  public EntityReference getContainer() {
    return DATABASE_REFERENCE;
  }

  @Override
  public void validateCreatedEntity(Table createdEntity, CreateTable createRequest, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(createdEntity),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());

    // Entity specific validation
    assertEquals(createRequest.getTableType(), createdEntity.getTableType());
    assertColumns(createRequest.getColumns(), createdEntity.getColumns());
    validateDatabase(createRequest.getDatabase(), createdEntity.getDatabase());
    validateTableConstraints(createRequest.getTableConstraints(), createdEntity.getTableConstraints());
    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
    TestUtils.validateEntityReferences(createdEntity.getFollowers());
    assertListNotNull(createdEntity.getService(), createdEntity.getServiceType());
  }

  private void validateTableConstraints(List<TableConstraint> expected, List<TableConstraint> actual) {
    if (expected == null || actual == null) {
      assertEquals(expected, actual);
      return;
    }
    assertEquals(expected, actual);
  }

  @Override
  protected void validateDeletedEntity(
      CreateTable create, Table entityBeforeDeletion, Table entityAfterDeletion, Map<String, String> authHeaders)
      throws HttpResponseException {
    super.validateDeletedEntity(create, entityBeforeDeletion, entityAfterDeletion, authHeaders);

    assertReference(entityBeforeDeletion.getLocation(), entityAfterDeletion.getLocation());
  }

  @Override
  public void compareEntities(Table expected, Table patched, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCommonEntityFields(
        getEntityInterface(patched),
        expected.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        expected.getOwner());

    // Entity specific validation
    assertEquals(expected.getTableType(), patched.getTableType());
    assertColumns(expected.getColumns(), patched.getColumns());
    validateDatabase(expected.getDatabase(), patched.getDatabase());
    assertEquals(expected.getTableConstraints(), patched.getTableConstraints());
    TestUtils.validateTags(expected.getTags(), patched.getTags());
    TestUtils.validateEntityReferences(expected.getFollowers());
  }

  private void validateDatabase(EntityReference expectedDatabase, EntityReference database) {
    TestUtils.validateEntityReference(database);
    assertEquals(expectedDatabase.getId(), database.getId());
  }

  private void assertTablePartition(TablePartition expectedPartition, TablePartition actualPartition) {
    if (expectedPartition == null && actualPartition == null) {
      return;
    }
    assert expectedPartition != null;
    assertEquals(expectedPartition.getColumns().size(), actualPartition.getColumns().size());
    assertEquals(expectedPartition.getIntervalType(), actualPartition.getIntervalType());
    assertEquals(expectedPartition.getInterval(), actualPartition.getInterval());

    for (int i = 0; i < expectedPartition.getColumns().size(); i++) {
      assertEquals(expectedPartition.getColumns().get(i), actualPartition.getColumns().get(i));
    }
  }

  @Override
  public TableEntityInterface getEntityInterface(Table entity) {
    return new TableEntityInterface(entity);
  }

  @Override
  public void assertFieldChange(String fieldName, Object expected, Object actual) throws IOException {
    if (expected == actual) {
      return;
    }
    if (fieldName.startsWith("columns") && fieldName.endsWith("constraint")) {
      ColumnConstraint expectedConstraint = (ColumnConstraint) expected;
      ColumnConstraint actualConstraint = ColumnConstraint.fromValue((String) actual);
      assertEquals(expectedConstraint, actualConstraint);
    } else if (fieldName.endsWith("tableConstraints")) {
      @SuppressWarnings("unchecked")
      List<TableConstraint> expectedConstraints = (List<TableConstraint>) expected;
      List<TableConstraint> actualConstraints = JsonUtils.readObjects(actual.toString(), TableConstraint.class);
      assertEquals(expectedConstraints, actualConstraints);
    } else if (fieldName.contains("columns") && !fieldName.endsWith("tags") && !fieldName.endsWith("description")) {
      @SuppressWarnings("unchecked")
      List<Column> expectedRefs = (List<Column>) expected;
      List<Column> actualRefs = JsonUtils.readObjects(actual.toString(), Column.class);
      assertColumns(expectedRefs, actualRefs);
    } else if (fieldName.endsWith("tableType")) {
      TableType expectedTableType = (TableType) expected;
      TableType actualTableType = TableType.fromValue(actual.toString());
      assertEquals(expectedTableType, actualTableType);
    } else {
      assertCommonFieldChange(fieldName, expected, actual);
    }
  }
}
