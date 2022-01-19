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
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.resources.locations.LocationResourceTest.createLocation;
import static org.openmetadata.catalog.resources.locations.LocationResourceTest.getLocationName;
import static org.openmetadata.catalog.security.SecurityUtil.authHeaders;
import static org.openmetadata.catalog.type.ColumnDataType.ARRAY;
import static org.openmetadata.catalog.type.ColumnDataType.BIGINT;
import static org.openmetadata.catalog.type.ColumnDataType.BINARY;
import static org.openmetadata.catalog.type.ColumnDataType.CHAR;
import static org.openmetadata.catalog.type.ColumnDataType.FLOAT;
import static org.openmetadata.catalog.type.ColumnDataType.INT;
import static org.openmetadata.catalog.type.ColumnDataType.STRUCT;
import static org.openmetadata.catalog.util.EntityUtil.tagLabelMatch;
import static org.openmetadata.catalog.util.RestUtil.DATE_FORMAT;
import static org.openmetadata.catalog.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.catalog.util.TestUtils.UpdateType;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MAJOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.MINOR_UPDATE;
import static org.openmetadata.catalog.util.TestUtils.UpdateType.NO_CHANGE;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertListNotNull;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.userAuthHeaders;
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
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.Status;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateDatabase;
import org.openmetadata.catalog.api.data.CreateLocation;
import org.openmetadata.catalog.api.data.CreateTable;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.data.Location;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.jdbi3.TableRepository.TableEntityInterface;
import org.openmetadata.catalog.resources.EntityResourceTest;
import org.openmetadata.catalog.resources.databases.TableResource.TableList;
import org.openmetadata.catalog.resources.locations.LocationResourceTest;
import org.openmetadata.catalog.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.catalog.resources.tags.TagResourceTest;
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
import org.openmetadata.catalog.type.TableProfile;
import org.openmetadata.catalog.type.TableType;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.type.TagLabel.LabelType;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.ResultList;
import org.openmetadata.catalog.util.TestUtils;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TableResourceTest extends EntityResourceTest<Table> {
  public static Database DATABASE;

  public static List<Column> COLUMNS =
      Arrays.asList(
          getColumn("c1", BIGINT, USER_ADDRESS_TAG_LABEL),
          getColumn("c2", ColumnDataType.VARCHAR, USER_ADDRESS_TAG_LABEL).withDataLength(10),
          getColumn("c3", BIGINT, USER_BANK_ACCOUNT_TAG_LABEL));

  public TableResourceTest() {
    super(Entity.TABLE, Table.class, TableList.class, "tables", TableResource.FIELDS, true, true, true, true);
  }

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    super.setup(test);
    DatabaseResourceTest databaseResourceTest = new DatabaseResourceTest();
    CreateDatabase create = databaseResourceTest.create(test).withService(SNOWFLAKE_REFERENCE);
    DATABASE = databaseResourceTest.createAndCheckEntity(create, adminAuthHeaders());

    COLUMNS =
        Arrays.asList(
            getColumn("c1", BIGINT, USER_ADDRESS_TAG_LABEL),
            getColumn("c2", ColumnDataType.VARCHAR, USER_ADDRESS_TAG_LABEL).withDataLength(10),
            getColumn("c3", BIGINT, USER_BANK_ACCOUNT_TAG_LABEL));
  }

  @Test
  void post_tableWithoutColumnDataLength_400(TestInfo test) {
    List<Column> columns = singletonList(getColumn("c1", BIGINT, null).withOrdinalPosition(1));
    CreateTable create = create(test).withColumns(columns);

    // char, varchar, binary, and varbinary columns must have length
    ColumnDataType[] columnDataTypes = {CHAR, ColumnDataType.VARCHAR, ColumnDataType.BINARY, ColumnDataType.VARBINARY};

    for (ColumnDataType dataType : columnDataTypes) {
      create.getColumns().get(0).withDataType(dataType);
      HttpResponseException exception =
          assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
      assertResponse(
          exception, BAD_REQUEST, "For column data types char, varchar, binary, varbinary dataLength must not be null");
    }
  }

  @Test
  void post_tableInvalidArrayColumn_400(TestInfo test) {
    // No arrayDataType passed for array
    List<Column> columns = singletonList(getColumn("c1", ARRAY, "array<int>", null));
    CreateTable create = create(test).withColumns(columns);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "For column data type array, arrayDataType must not be null");

    // No dataTypeDisplay passed for array
    columns.get(0).withArrayDataType(INT).withDataTypeDisplay(null);
    exception = assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    assertResponse(
        exception, BAD_REQUEST, "For column data type array, dataTypeDisplay must be of type array<arrayDataType>");
  }

  @Test
  void post_duplicateColumnName_400(TestInfo test) {
    // Duplicate column names c1
    String repeatedColumnName = "c1";
    List<Column> columns =
        Arrays.asList(
            getColumn(repeatedColumnName, ARRAY, "array<int>", null), getColumn(repeatedColumnName, INT, null));
    CreateTable create = create(test).withColumns(columns);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, String.format("Column name %s is repeated", repeatedColumnName));
  }

  @Test
  void post_validTables_200_OK(TestInfo test) throws IOException {
    // Create table with different optional fields
    // Optional field description
    CreateTable create = create(test).withDescription("description");
    createAndCheckEntity(create, adminAuthHeaders());

    // Optional fields tableType
    create.withName(getEntityName(test, 1)).withTableType(TableType.View);
    Table table = createAndCheckEntity(create, adminAuthHeaders());

    // check the FQN
    Database db = new DatabaseResourceTest().getEntity(table.getDatabase().getId(), null, adminAuthHeaders());
    String expectedFQN = db.getFullyQualifiedName() + "." + table.getName();
    assertEquals(expectedFQN, table.getFullyQualifiedName());
  }

  private static Column getColumn(String name, ColumnDataType columnDataType, TagLabel tag) {
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
        getColumn("c2", STRUCT, "struct<a: int, b:string, c: struct<int: d>>", USER_BANK_ACCOUNT_TAG_LABEL)
            .withChildren(new ArrayList<>(Arrays.asList(c2_a, c2_b, c2_c)));

    // Test POST operation can create complex types
    // c1 array<int>
    // c2 struct<a: int, b:string, c: struct<int:d>>
    //   c2.a int
    //   c2.b char
    //   c2.c struct<int: d>>
    //     c2.c.d int
    CreateTable create1 = create(test, 1).withColumns(Arrays.asList(c1, c2));
    Table table1 = createAndCheckEntity(create1, adminAuthHeaders());

    // Test PUT operation - put operation to create
    CreateTable create2 = create(test, 2).withColumns(Arrays.asList(c1, c2)).withName("put_complexColumnType");
    Table table2 = updateAndCheckEntity(create2, CREATED, adminAuthHeaders(), UpdateType.CREATED, null);

    // Test PUT operation again without any change
    ChangeDescription change = getChangeDescription(table2.getVersion());
    updateAndCheckEntity(create2, Status.OK, adminAuthHeaders(), NO_CHANGE, change);

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
    c2_b.withTags(List.of(USER_ADDRESS_TAG_LABEL, USER_BANK_ACCOUNT_TAG_LABEL)); // Add new tag to c2.b tag
    change
        .getFieldsAdded()
        .add(new FieldChange().withName("columns.c2.b.tags").withNewValue(List.of(USER_BANK_ACCOUNT_TAG_LABEL)));

    Column c2_c_e = getColumn("e", INT, USER_ADDRESS_TAG_LABEL);
    c2_c.getChildren().add(c2_c_e); // Add c2.c.e
    change.getFieldsAdded().add(new FieldChange().withName("columns.c2.c").withNewValue(List.of(c2_c_e)));

    change
        .getFieldsDeleted()
        .add(new FieldChange().withName("columns.c2").withOldValue(List.of(c2.getChildren().get(0))));
    c2.getChildren().remove(0); // Remove c2.a from struct

    Column c2_f = getColumn("f", CHAR, USER_ADDRESS_TAG_LABEL);
    c2.getChildren().add(c2_f); // Add c2.f
    create2 = create2.withColumns(Arrays.asList(c1_new, c2));
    change.getFieldsAdded().add(new FieldChange().withName("columns.c2").withNewValue(List.of(c2_f)));

    // Update the columns with PUT operation and validate update
    // c1 array<int>                                   --> c1 array<chart
    // c2 struct<a: int, b:string, c: struct<int:d>>   --> c2 struct<b:char, c:struct<d:int,
    // e:char>, f:char>
    //   c2.a int                                      --> DELETED
    //   c2.b char                                     --> SAME
    //   c2.c struct<int: d>>
    //     c2.c.d int
    updateAndCheckEntity(
        create2.withName("put_complexColumnType"), Status.OK, adminAuthHeaders(), MAJOR_UPDATE, change);

    //
    // Patch operations on table1 created by POST operation. Columns can't be added or deleted. Only
    // tags and
    // description can be changed
    //
    String tableJson = JsonUtils.pojoToJson(table1);
    c1 = table1.getColumns().get(0);
    c1.withTags(singletonList(USER_BANK_ACCOUNT_TAG_LABEL)); // c1 tag changed

    c2 = table1.getColumns().get(1);
    c2.withTags(Arrays.asList(USER_ADDRESS_TAG_LABEL, USER_BANK_ACCOUNT_TAG_LABEL)); // c2 new tag added

    c2_a = c2.getChildren().get(0);
    c2_a.withTags(singletonList(USER_BANK_ACCOUNT_TAG_LABEL)); // c2.a tag changed

    c2_b = c2.getChildren().get(1);
    c2_b.withTags(new ArrayList<>()); // c2.b tag removed

    c2_c = c2.getChildren().get(2);
    c2_c.withTags(new ArrayList<>()); // c2.c tag removed

    c2_c_d = c2_c.getChildren().get(0);
    c2_c_d.setTags(singletonList(USER_BANK_ACCOUNT_TAG_LABEL)); // c2.c.d new tag added
    table1 = patchEntity(table1.getId(), tableJson, table1, adminAuthHeaders());
    assertColumns(Arrays.asList(c1, c2), table1.getColumns());
  }

  @Test
  void post_tableWithUserOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  void post_tableWithTeamOwner_200_ok(TestInfo test) throws IOException {
    createAndCheckEntity(create(test).withOwner(TEAM_OWNER1), adminAuthHeaders());
  }

  @Test
  void post_tableWithInvalidDatabase_404(TestInfo test) {
    CreateTable create = create(test).withDatabase(NON_EXISTENT_ENTITY);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.DATABASE, NON_EXISTENT_ENTITY));
  }

  @Test
  void post_table_as_non_admin_401(TestInfo test) {
    CreateTable create = create(test);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createEntity(create, authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  void put_tableTableConstraintUpdate_200(TestInfo test) throws IOException {
    // Create table without table constraints
    CreateTable request = create(test).withOwner(USER_OWNER1).withDescription("description").withTableConstraints(null);
    Table table = createAndCheckEntity(request, adminAuthHeaders());
    checkOwnerOwns(USER_OWNER1, table.getId(), true);

    // Update the table with constraints and ensure minor version change
    ChangeDescription change = getChangeDescription(table.getVersion());
    TableConstraint constraint =
        new TableConstraint().withConstraintType(ConstraintType.UNIQUE).withColumns(List.of(COLUMNS.get(0).getName()));
    change.getFieldsAdded().add(new FieldChange().withName("tableConstraints").withNewValue(List.of(constraint)));
    request = request.withTableConstraints(List.of(constraint));
    Table updatedTable = updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);

    // Update again with no change. Version must not change
    change = getChangeDescription(updatedTable.getVersion());
    updatedTable = updateAndCheckEntity(request, OK, adminAuthHeaders(), NO_CHANGE, change);

    // Update the table with new constraints
    change = getChangeDescription(updatedTable.getVersion());
    TableConstraint constraint1 =
        new TableConstraint()
            .withConstraintType(ConstraintType.PRIMARY_KEY)
            .withColumns(List.of(COLUMNS.get(0).getName()));
    request = request.withTableConstraints(List.of(constraint1));
    change.getFieldsAdded().add(new FieldChange().withName("tableConstraints").withNewValue(List.of(constraint1)));
    change.getFieldsDeleted().add(new FieldChange().withName("tableConstraints").withOldValue(List.of(constraint)));
    updatedTable = updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);

    // Remove table constraint and ensure minor version changes
    change = getChangeDescription(updatedTable.getVersion());
    request = request.withTableConstraints(null);
    change.getFieldsDeleted().add(new FieldChange().withName("tableConstraints").withOldValue(List.of(constraint1)));
    updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  void put_columnConstraintUpdate_200(TestInfo test) throws IOException {
    List<Column> columns = new ArrayList<>();
    columns.add(getColumn("c1", INT, null).withConstraint(ColumnConstraint.NULL));
    columns.add(getColumn("c2", INT, null).withConstraint(ColumnConstraint.UNIQUE));
    CreateTable request = create(test).withColumns(columns);
    Table table = createAndCheckEntity(request, adminAuthHeaders());

    // Change the column constraints and expect minor version change
    ChangeDescription change = getChangeDescription(table.getVersion());
    request.getColumns().get(0).withConstraint(ColumnConstraint.NOT_NULL);
    change
        .getFieldsUpdated()
        .add(
            new FieldChange()
                .withName("columns.c1.constraint")
                .withOldValue(ColumnConstraint.NULL)
                .withNewValue(ColumnConstraint.NOT_NULL));

    request.getColumns().get(1).withConstraint(ColumnConstraint.PRIMARY_KEY);
    change
        .getFieldsUpdated()
        .add(
            new FieldChange()
                .withName("columns.c2.constraint")
                .withOldValue(ColumnConstraint.UNIQUE)
                .withNewValue(ColumnConstraint.PRIMARY_KEY));

    Table updatedTable = updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);

    // Remove column constraints and expect minor version change
    change = getChangeDescription(updatedTable.getVersion());
    request.getColumns().get(0).withConstraint(null);
    change
        .getFieldsDeleted()
        .add(new FieldChange().withName("columns.c1.constraint").withOldValue(ColumnConstraint.NOT_NULL));

    request.getColumns().get(1).withConstraint(null);
    change
        .getFieldsDeleted()
        .add(new FieldChange().withName("columns.c2.constraint").withOldValue(ColumnConstraint.PRIMARY_KEY));
    updateAndCheckEntity(request, OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  void put_updateColumns_200(TestInfo test) throws IOException {
    int tagCategoryUsageCount = getTagCategoryUsageCount("user", userAuthHeaders());
    int addressTagUsageCount = getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), userAuthHeaders());
    int bankTagUsageCount = getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), userAuthHeaders());

    //
    // Create a table with column c1, type BIGINT, description c1 and tag USER_ADDRESS_TAB_LABEL
    //
    List<TagLabel> tags = new ArrayList<>();
    tags.add(USER_ADDRESS_TAG_LABEL);
    List<Column> columns = new ArrayList<>();
    columns.add(getColumn("c1", BIGINT, null).withTags(tags));

    CreateTable request = create(test).withColumns(columns);
    Table table = createAndCheckEntity(request, adminAuthHeaders());
    columns.get(0).setFullyQualifiedName(table.getFullyQualifiedName() + ".c1");

    // Ensure tag category and tag usage counts are updated
    assertEquals(tagCategoryUsageCount + 1, getTagCategoryUsageCount("user", userAuthHeaders()));
    assertEquals(
        addressTagUsageCount + 1,
        getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), authHeaders("test@open-metadata.org")));
    assertEquals(bankTagUsageCount, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), userAuthHeaders()));

    //
    // Update the c1 tags to  USER_ADDRESS_TAB_LABEL, USER_BANK_ACCOUNT_TAG_LABEL (newly added)
    // Ensure description and previous tag is carried forward during update
    //
    tags.add(USER_BANK_ACCOUNT_TAG_LABEL);
    List<Column> updatedColumns = new ArrayList<>();
    updatedColumns.add(getColumn("c1", BIGINT, null).withTags(tags));
    ChangeDescription change = getChangeDescription(table.getVersion());
    change
        .getFieldsAdded()
        .add(new FieldChange().withName("columns.c1.tags").withNewValue(List.of(USER_BANK_ACCOUNT_TAG_LABEL)));
    table = updateAndCheckEntity(request.withColumns(updatedColumns), OK, adminAuthHeaders(), MINOR_UPDATE, change);

    // Ensure tag usage counts are updated
    assertEquals(tagCategoryUsageCount + 2, getTagCategoryUsageCount("user", userAuthHeaders()));
    assertEquals(addressTagUsageCount + 1, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), userAuthHeaders()));
    assertEquals(bankTagUsageCount + 1, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), userAuthHeaders()));

    //
    // Add a new column using PUT
    //
    change = getChangeDescription(table.getVersion());
    Column c2 = getColumn("c2", BINARY, null).withOrdinalPosition(2).withDataLength(10).withTags(tags);
    updatedColumns.add(c2);
    change.getFieldsAdded().add(new FieldChange().withName("columns").withNewValue(List.of(c2)));
    table = updateAndCheckEntity(request.withColumns(updatedColumns), OK, adminAuthHeaders(), MINOR_UPDATE, change);

    // Ensure tag usage counts are updated - column c2 added both address and bank tags
    assertEquals(tagCategoryUsageCount + 4, getTagCategoryUsageCount("user", userAuthHeaders()));
    assertEquals(addressTagUsageCount + 2, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), userAuthHeaders()));
    assertEquals(bankTagUsageCount + 2, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), userAuthHeaders()));

    //
    // Remove a column c2 and make sure it is deleted by PUT
    //
    change = getChangeDescription(table.getVersion());
    updatedColumns.remove(1);
    change.getFieldsDeleted().add(new FieldChange().withName("columns").withOldValue(List.of(c2)));
    table = updateAndCheckEntity(request.withColumns(updatedColumns), OK, adminAuthHeaders(), MAJOR_UPDATE, change);
    assertEquals(1, table.getColumns().size());

    // Ensure tag usage counts are updated to reflect removal of column c2
    assertEquals(tagCategoryUsageCount + 2, getTagCategoryUsageCount("user", userAuthHeaders()));
    assertEquals(addressTagUsageCount + 1, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), userAuthHeaders()));
    assertEquals(bankTagUsageCount + 1, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), userAuthHeaders()));
  }

  @Test
  void put_tableJoins_200(TestInfo test) throws IOException, ParseException {
    Table table1 = createAndCheckEntity(create(test, 1), adminAuthHeaders());
    Table table2 = createAndCheckEntity(create(test, 2), adminAuthHeaders());
    Table table3 = createAndCheckEntity(create(test, 3), adminAuthHeaders());

    // Fully qualified names for table1, table2, table3 columns
    String t1c1 = table1.getFullyQualifiedName() + ".c1";
    String t1c2 = table1.getFullyQualifiedName() + ".c2";
    String t1c3 = table1.getFullyQualifiedName() + ".c3";
    String t2c1 = table2.getFullyQualifiedName() + ".c1";
    String t2c2 = table2.getFullyQualifiedName() + ".c2";
    String t2c3 = table2.getFullyQualifiedName() + ".c3";
    String t3c1 = table3.getFullyQualifiedName() + ".c1";
    String t3c2 = table3.getFullyQualifiedName() + ".c2";
    String t3c3 = table3.getFullyQualifiedName() + ".c3";

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
      Table putResponse = putJoins(table1.getId(), table1Joins, adminAuthHeaders());

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
      table1 = getEntity(table1.getId(), "joins", adminAuthHeaders());
      assertColumnJoins(expectedJoins1, table1.getJoins());

      // getTable and ensure the following column joins are correct
      table2 = getEntity(table2.getId(), "joins", adminAuthHeaders());
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
      table3 = getEntity(table3.getId(), "joins", adminAuthHeaders());
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
      putJoins(table1.getId(), table1Joins, adminAuthHeaders());
      table1 = getEntity(table1.getId(), "joins", adminAuthHeaders());
    }
  }

  @Test
  void put_tableJoinsInvalidColumnName_4xx(TestInfo test) throws IOException, ParseException {
    Table table1 = createAndCheckEntity(create(test, 1), adminAuthHeaders());
    Table table2 = createAndCheckEntity(create(test, 2), adminAuthHeaders());

    List<ColumnJoin> joins = singletonList(new ColumnJoin().withColumnName("c1"));
    TableJoins tableJoins = new TableJoins().withStartDate(RestUtil.today(0)).withDayCount(1).withColumnJoins(joins);

    // Invalid database name
    String columnFQN = "invalidDB";
    JoinedWith joinedWith = new JoinedWith().withFullyQualifiedName(columnFQN);
    joins.get(0).withJoinedWith(singletonList(joinedWith));
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> putJoins(table1.getId(), tableJoins, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.invalidColumnFQN(columnFQN));

    // Invalid table name
    columnFQN = table2.getDatabase().getName() + ".invalidTable";
    joinedWith = new JoinedWith().withFullyQualifiedName(columnFQN);
    joins.get(0).withJoinedWith(singletonList(joinedWith));
    exception =
        assertThrows(HttpResponseException.class, () -> putJoins(table1.getId(), tableJoins, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.invalidColumnFQN(columnFQN));

    // Invalid column name
    columnFQN = table2.getFullyQualifiedName() + ".invalidColumn";
    joinedWith = new JoinedWith().withFullyQualifiedName(columnFQN);
    joins.get(0).withJoinedWith(singletonList(joinedWith));
    exception =
        assertThrows(HttpResponseException.class, () -> putJoins(table1.getId(), tableJoins, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.invalidColumnFQN(columnFQN));

    // Invalid date older than 30 days
    joinedWith = new JoinedWith().withFullyQualifiedName(table2.getFullyQualifiedName() + ".c1");
    joins.get(0).withJoinedWith(singletonList(joinedWith));
    tableJoins.withStartDate(RestUtil.today(-30)); // 30 days older than today
    exception =
        assertThrows(HttpResponseException.class, () -> putJoins(table1.getId(), tableJoins, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "Date range can only include past 30 days starting today");
  }

  public void assertColumnJoins(List<ColumnJoin> expected, TableJoins actual) throws ParseException {
    // Table reports last 30 days of aggregated join count
    assertEquals(actual.getStartDate(), getDateStringByOffset(DATE_FORMAT, RestUtil.today(0), -30));
    assertEquals(actual.getDayCount(), 30);

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
    Table table = createAndCheckEntity(create(test), adminAuthHeaders());
    List<String> columns = Arrays.asList("c1", "c2", "c3");

    // Add 3 rows of sample data for 3 columns
    List<List<Object>> rows =
        Arrays.asList(
            Arrays.asList("c1Value1", 1, true),
            Arrays.asList("c1Value2", null, false),
            Arrays.asList("c1Value3", 3, true));

    TableData tableData = new TableData().withColumns(columns).withRows(rows);
    Table putResponse = putSampleData(table.getId(), tableData, adminAuthHeaders());
    assertEquals(tableData, putResponse.getSampleData());

    table = getEntity(table.getId(), "sampleData", adminAuthHeaders());
    assertEquals(tableData, table.getSampleData());
  }

  @Test
  void put_tableInvalidSampleData_4xx(TestInfo test) throws IOException {
    Table table = createAndCheckEntity(create(test), adminAuthHeaders());
    TableData tableData = new TableData();

    // Send sample data with invalid column name
    List<String> columns = Arrays.asList("c1", "c2", "invalidColumn"); // Invalid column name
    List<List<Object>> rows = singletonList(Arrays.asList("c1Value1", 1, true)); // Valid sample data
    tableData.withColumns(columns).withRows(rows);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> putSampleData(table.getId(), tableData, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "Invalid column name invalidColumn");

    // Send sample data that has more samples than the number of columns
    columns = Arrays.asList("c1", "c2", "c3"); // Invalid column name
    rows = singletonList(Arrays.asList("c1Value1", 1, true, "extra value")); // Extra value
    tableData.withColumns(columns).withRows(rows);
    exception =
        assertThrows(HttpResponseException.class, () -> putSampleData(table.getId(), tableData, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "Number of columns is 3 but row " + "has 4 sample values");

    // Send sample data that has fewer samples than the number of columns
    columns = Arrays.asList("c1", "c2", "c3"); // Invalid column name
    rows = singletonList(Arrays.asList("c1Value1", 1 /* Missing Value */));
    tableData.withColumns(columns).withRows(rows);
    exception =
        assertThrows(HttpResponseException.class, () -> putSampleData(table.getId(), tableData, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "Number of columns is 3 but row h" + "as 2 sample values");
  }

  @Test
  void put_viewDefinition_200(TestInfo test) throws IOException {
    CreateTable createTable = create(test);
    createTable.setTableType(TableType.View);
    String query =
        "sales_vw\n"
            + "create view sales_vw as\n"
            + "select * from public.sales\n"
            + "union all\n"
            + "select * from spectrum.sales\n"
            + "with no schema binding;\n";
    createTable.setViewDefinition(query);
    Table table = createAndCheckEntity(createTable, adminAuthHeaders());
    table = getEntity(table.getId(), "viewDefinition", adminAuthHeaders());
    LOG.info("table view definition {}", table.getViewDefinition());
    assertEquals(table.getViewDefinition(), query);
  }

  @Test
  void put_viewDefinition_invalid_table_4xx(TestInfo test) {
    CreateTable createTable = create(test);
    createTable.setTableType(TableType.Regular);
    String query =
        "sales_vw\n"
            + "create view sales_vw as\n"
            + "select * from public.sales\n"
            + "union all\n"
            + "select * from spectrum.sales\n"
            + "with no schema binding;\n";
    createTable.setViewDefinition(query);
    HttpResponseException exception =
        assertThrows(HttpResponseException.class, () -> createAndCheckEntity(createTable, adminAuthHeaders()));
    TestUtils.assertResponseContains(
        exception,
        BAD_REQUEST,
        "ViewDefinition can only be set on " + "TableType View, SecureView or MaterializedView");
  }

  @Test
  void put_tableProfile_200(TestInfo test) throws IOException {
    Table table = createAndCheckEntity(create(test), adminAuthHeaders());
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
    Table putResponse = putTableProfileData(table.getId(), tableProfile, adminAuthHeaders());
    verifyTableProfileData(putResponse.getTableProfile(), List.of(tableProfile));

    table = getEntity(table.getId(), "tableProfile", adminAuthHeaders());
    verifyTableProfileData(table.getTableProfile(), List.of(tableProfile));

    // Add new date for TableProfile
    TableProfile newTableProfile =
        new TableProfile()
            .withRowCount(7.0)
            .withColumnCount(3.0)
            .withColumnProfile(columnProfiles)
            .withProfileDate("2021-09-08");
    putResponse = putTableProfileData(table.getId(), newTableProfile, adminAuthHeaders());
    verifyTableProfileData(putResponse.getTableProfile(), List.of(newTableProfile, tableProfile));

    table = getEntity(table.getId(), "tableProfile", adminAuthHeaders());
    verifyTableProfileData(table.getTableProfile(), List.of(newTableProfile, tableProfile));

    // Replace table profile for a date
    TableProfile newTableProfile1 =
        new TableProfile()
            .withRowCount(21.0)
            .withColumnCount(3.0)
            .withColumnProfile(columnProfiles)
            .withProfileDate("2021-09-08");
    putResponse = putTableProfileData(table.getId(), newTableProfile1, adminAuthHeaders());
    assertEquals(tableProfile.getProfileDate(), putResponse.getTableProfile().get(0).getProfileDate());
    verifyTableProfileData(putResponse.getTableProfile(), List.of(newTableProfile1, tableProfile));

    table = getEntity(table.getId(), "tableProfile", adminAuthHeaders());
    // first result should be the latest date
    assertEquals(tableProfile.getProfileDate(), table.getTableProfile().get(0).getProfileDate());
    verifyTableProfileData(table.getTableProfile(), List.of(newTableProfile1, tableProfile));
  }

  @Test
  void put_tableInvalidTableProfileData_4xx(TestInfo test) throws IOException {
    Table table = createAndCheckEntity(create(test), adminAuthHeaders());

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
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class, () -> putTableProfileData(table.getId(), tableProfile, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "Invalid column name invalidColumn");
  }

  @Test
  void put_tableQueries_200(TestInfo test) throws IOException {
    Table table = createAndCheckEntity(create(test), adminAuthHeaders());
    SQLQuery query = new SQLQuery().withQuery("select * from test;").withQueryDate("2021-09-08").withDuration(600.0);
    Table putResponse = putTableQueriesData(table.getId(), query, adminAuthHeaders());
    table = getEntity(table.getId(), "tableQueries", adminAuthHeaders());
    assertEquals(query.getQuery(), putResponse.getTableQueries().get(0).getQuery());

    // first result should be the latest date
    assertEquals(query.getQuery(), table.getTableQueries().get(0).getQuery());
    SQLQuery query1 =
        new SQLQuery().withQuery("select * from test;").withQueryDate("2021-09-09").withDuration(200.0).withVote(2.0);

    //
    // try updating the same query again
    //
    putResponse = putTableQueriesData(table.getId(), query1, adminAuthHeaders());
    assertEquals(putResponse.getTableQueries().size(), 1);
    assertEquals(query1.getQuery(), putResponse.getTableQueries().get(0).getQuery());
    assertEquals(query1.getVote(), putResponse.getTableQueries().get(0).getVote());

    table = getEntity(table.getId(), "tableQueries", adminAuthHeaders());
    assertEquals(table.getTableQueries().size(), 1);
    assertEquals(query1.getQuery(), table.getTableQueries().get(0).getQuery());
    assertEquals(query1.getVote(), table.getTableQueries().get(0).getVote());

    //
    // Update again
    //
    SQLQuery query2 =
        new SQLQuery().withQuery("select * from users;").withQueryDate("2021-09-09").withDuration(200.0).withVote(5.0);
    putResponse = putTableQueriesData(table.getId(), query2, adminAuthHeaders());
    assertEquals(putResponse.getTableQueries().size(), 2);
    // query2 with the highest vote should be the first result.
    assertEquals(query2.getQuery(), putResponse.getTableQueries().get(0).getQuery());
    assertEquals(query2.getVote(), putResponse.getTableQueries().get(0).getVote());

    table = getEntity(table.getId(), "tableQueries", adminAuthHeaders());
    assertEquals(table.getTableQueries().size(), 2);
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
    Table table = createAndCheckEntity(create(test).withColumns(columns).withDescription(null), adminAuthHeaders());

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
    Table putResponse = putTableDataModel(table.getId(), dataModel, adminAuthHeaders());
    assertDataModel(dataModel, putResponse.getDataModel());
    assertEquals("updatedTableDescription", putResponse.getDescription()); // Table description updated

    // Get the table and validate the data model
    Table getResponse = getEntity(table.getId(), "dataModel,columns,tags", adminAuthHeaders());
    assertDataModel(dataModel, getResponse.getDataModel());
    assertEquals("updatedTableDescription", getResponse.getDescription()); // Table description updated
    assertColumns(columns, getResponse.getColumns()); // Column description updated

    //
    // Update again
    //
    query = "select * from testUpdated;";
    dataModel = new DataModel().withModelType(ModelType.DBT).withSql(query).withGeneratedAt(new Date());
    putResponse = putTableDataModel(table.getId(), dataModel, adminAuthHeaders());
    assertDataModel(dataModel, putResponse.getDataModel());

    // Get the table and validate the data model
    getResponse = getEntity(table.getId(), "dataModel", adminAuthHeaders());
    assertDataModel(dataModel, getResponse.getDataModel());
  }

  public void assertDataModel(DataModel expected, DataModel actual) {
    assertEquals(expected.getSql(), actual.getSql());
    assertEquals(expected.getModelType(), actual.getModelType());
    assertEquals(expected.getGeneratedAt(), actual.getGeneratedAt());
  }

  @Test
  void get_deletedTableWithDeleteLocation(TestInfo test) throws HttpResponseException {
    Object create = createRequest(getEntityName(test), "description", "displayName", USER_OWNER1);
    // Create first time using POST
    Table table = beforeDeletion(test, createEntity(create, adminAuthHeaders()));
    Table tableBeforeDeletion = getEntity(table.getId(), null, TableResource.FIELDS, adminAuthHeaders());
    // delete both
    deleteEntity(tableBeforeDeletion.getId(), adminAuthHeaders());
    new LocationResourceTest().deleteEntity(tableBeforeDeletion.getLocation().getId(), adminAuthHeaders());
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("include", "deleted");
    Table tableAfterDeletion = getEntity(table.getId(), queryParams, TableResource.FIELDS, adminAuthHeaders());
    validateDeletedEntity(create, tableBeforeDeletion, tableAfterDeletion, adminAuthHeaders());
  }

  @Test
  void get_TableWithDeleteLocation(TestInfo test) throws HttpResponseException {
    Object create = createRequest(getEntityName(test), "description", "displayName", USER_OWNER1);
    // Create first time using POST
    Table table = beforeDeletion(test, createEntity(create, adminAuthHeaders()));
    Table tableBeforeDeletion = getEntity(table.getId(), null, TableResource.FIELDS, adminAuthHeaders());
    // delete both
    new LocationResourceTest().deleteEntity(tableBeforeDeletion.getLocation().getId(), adminAuthHeaders());
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("include", "all");
    Table tableAfterDeletion = getEntity(table.getId(), queryParams, TableResource.FIELDS, adminAuthHeaders());
    assertNull(tableAfterDeletion.getLocation());
  }

  @Test
  @Order(1) // Run this test first as other tables created in other tests will interfere with listing
  void get_tableListWithDifferentFields_200_OK(TestInfo test) throws IOException {
    CreateTable create =
        create(test, 1)
            .withDescription("description")
            .withOwner(USER_OWNER1)
            .withTags(singletonList(USER_ADDRESS_TAG_LABEL));
    createAndCheckEntity(create, adminAuthHeaders());
    CreateTable create1 = create(test, 2).withDescription("description").withOwner(USER_OWNER1);
    createAndCheckEntity(create1, adminAuthHeaders());

    // Check tag category and tag usage counts
    // 1 table tags + 3*2 column tags from COLUMNS
    assertEquals(7, getTagCategoryUsageCount("user", adminAuthHeaders()));
    // 1 table tag and 2*2 column tags
    assertEquals(5, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), adminAuthHeaders()));
    // 2*1 column tags
    assertEquals(2, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), adminAuthHeaders()));

    ResultList<Table> tableList = listEntities(null, adminAuthHeaders()); // List tables
    assertEquals(2, tableList.getData().size());
    assertFields(tableList.getData(), null);

    // List tables with databaseFQN as filter
    Map<String, String> queryParams =
        new HashMap<>() {
          {
            put("database", DATABASE.getFullyQualifiedName());
          }
        };
    ResultList<Table> tableList1 = listEntities(queryParams, adminAuthHeaders());
    assertEquals(tableList.getData().size(), tableList1.getData().size());
    assertFields(tableList1.getData(), null);

    // GET .../tables?fields=columns,tableConstraints
    final String fields = "columns,tableConstraints";
    queryParams =
        new HashMap<>() {
          {
            put("fields", fields);
          }
        };
    tableList = listEntities(queryParams, adminAuthHeaders());
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
    tableList1 = listEntities(queryParams, adminAuthHeaders());
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
    tableList = listEntities(queryParams, adminAuthHeaders());
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
    tableList1 = listEntities(queryParams, adminAuthHeaders());
    assertEquals(tableList.getData().size(), tableList1.getData().size());
    assertFields(tableList1.getData(), fields1);
  }

  @Test
  void delete_table_200_ok(TestInfo test) throws HttpResponseException {
    Table table = createEntity(create(test), adminAuthHeaders());
    deleteEntity(table.getId(), adminAuthHeaders());
  }

  @Test
  void delete_put_Table_200(TestInfo test) throws IOException {
    CreateTable request = create(test).withDatabase(DATABASE.getId()).withDescription("");
    Table table = createEntity(request, adminAuthHeaders());

    // Delete
    deleteEntity(table.getId(), adminAuthHeaders());

    ChangeDescription change = getChangeDescription(table.getVersion());
    change.setFieldsUpdated(
        Arrays.asList(
            new FieldChange().withName("deleted").withNewValue(false).withOldValue(true),
            new FieldChange().withName("description").withNewValue("updatedDescription").withOldValue("")));

    // PUT with updated description
    updateAndCheckEntity(
        request.withDescription("updatedDescription"), Response.Status.OK, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  void delete_table_as_non_admin_401(TestInfo test) throws HttpResponseException {
    Table table = createEntity(create(test), adminAuthHeaders());
    HttpResponseException exception =
        assertThrows(
            HttpResponseException.class, () -> deleteEntity(table.getId(), authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  /**
   * See EntityResourceTest#patch_entityAttributes_200_ok(TestInfo) for other patch related tests for patching display,
   * description, owner, and tags
   */
  @Test
  void patch_tableAttributes_200_ok(TestInfo test) throws IOException {
    // Create table without tableType, and tableConstraints
    Table table = createEntity(create(test).withTableConstraints(null), adminAuthHeaders());

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

    table = patchEntityAndCheck(table, originalJson, adminAuthHeaders(), MINOR_UPDATE, change);

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

    table = patchEntityAndCheck(table, originalJson, adminAuthHeaders(), MINOR_UPDATE, change);

    // Remove tableType, tableConstraints
    originalJson = JsonUtils.pojoToJson(table);
    change = getChangeDescription(table.getVersion());

    table.withTableType(null).withTableConstraints(null);

    change.getFieldsDeleted().add(new FieldChange().withName("tableType").withOldValue(TableType.External));
    change.getFieldsDeleted().add(new FieldChange().withName("tableConstraints").withOldValue(tableConstraints1));
    patchEntityAndCheck(table, originalJson, adminAuthHeaders(), MINOR_UPDATE, change);
  }

  @Test
  void patch_tableColumns_200_ok(TestInfo test) throws IOException {
    // Create table with the following columns
    List<Column> columns = new ArrayList<>();
    columns.add(getColumn("c1", INT, USER_ADDRESS_TAG_LABEL).withDescription(null));
    columns.add(getColumn("c2", BIGINT, USER_ADDRESS_TAG_LABEL));
    columns.add(getColumn("c3", FLOAT, USER_BANK_ACCOUNT_TAG_LABEL));

    Table table = createEntity(create(test).withColumns(columns), adminAuthHeaders());

    // Update the column tags and description
    ChangeDescription change = getChangeDescription(table.getVersion());
    columns
        .get(0)
        .withDescription("new0") // Set new description
        .withTags(List.of(USER_ADDRESS_TAG_LABEL, USER_BANK_ACCOUNT_TAG_LABEL));
    change
        .getFieldsAdded()
        .add(
            new FieldChange().withName("columns.c1.description").withNewValue("new0")); // Column c1 has new description
    change
        .getFieldsAdded()
        .add(
            new FieldChange()
                .withName("columns.c1.tags")
                .withNewValue(List.of(USER_BANK_ACCOUNT_TAG_LABEL))); //  Column c1 got new tags

    columns
        .get(1)
        .withDescription("new1") // Change description
        .withTags(List.of(USER_ADDRESS_TAG_LABEL)); // No change in tags
    change
        .getFieldsUpdated()
        .add(
            new FieldChange()
                .withName("columns.c2.description")
                .withNewValue("new1")
                .withOldValue("c2")); // Column c2 description changed

    columns.get(2).withTags(new ArrayList<>()); // Remove tag
    change
        .getFieldsDeleted()
        .add(
            new FieldChange()
                .withName("columns.c3.tags")
                .withOldValue(List.of(USER_BANK_ACCOUNT_TAG_LABEL))); // Column c3 tags were removed

    String originalJson = JsonUtils.pojoToJson(table);
    table.setColumns(columns);
    table = patchEntityAndCheck(table, originalJson, adminAuthHeaders(), MINOR_UPDATE, change);
    assertColumns(columns, table.getColumns());
  }

  @Test
  void patch_tableColumnTags_200_ok(TestInfo test) throws IOException {
    Column c1 = getColumn("c1", INT, null);
    CreateTable create = create(test).withColumns(List.of(c1));
    Table table = createAndCheckEntity(create, adminAuthHeaders());

    // Add a primary tag and derived tag both. The tag list must include derived tags only once.
    String json = JsonUtils.pojoToJson(table);
    table.getColumns().get(0).withTags(List.of(PERSONAL_DATA_TAG_LABEL, USER_ADDRESS_TAG_LABEL));
    Table updatedTable = patchEntity(table.getId(), json, table, adminAuthHeaders());

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
    Table table = createAndCheckEntity(create(test), adminAuthHeaders());

    // Add location to the table
    CreateLocation create =
        new CreateLocation().withName(getLocationName(test)).withService(AWS_STORAGE_SERVICE_REFERENCE);
    Location location = createLocation(create, adminAuthHeaders());
    addAndCheckLocation(table, location.getId(), OK, userAuthHeaders());
    // Delete location and make sure it is deleted
    deleteAndCheckLocation(table, userAuthHeaders());
  }

  @Test
  void put_addLocationAndDeleteTable_200(TestInfo test) throws IOException {
    Table table = createAndCheckEntity(create(test), adminAuthHeaders());

    // Add location to the table
    CreateLocation create =
        new CreateLocation().withName(getLocationName(test)).withService(AWS_STORAGE_SERVICE_REFERENCE);
    Location location = createLocation(create, adminAuthHeaders());
    addAndCheckLocation(table, location.getId(), OK, userAuthHeaders());
    deleteEntity(table.getId(), adminAuthHeaders());
    Map<String, String> queryParams =
        new HashMap<>() {
          {
            put("include", "all");
          }
        };
    table = getEntity(table.getId(), queryParams, "location", adminAuthHeaders());
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
    Fields fields = new Fields(TableResource.FIELD_LIST, fieldsParam);

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
    // GET .../tables/{id}
    table =
        byName
            ? getEntityByName(table.getFullyQualifiedName(), null, null, adminAuthHeaders())
            : getEntity(table.getId(), null, adminAuthHeaders());
    assertFields(table, null);

    // GET .../tables/{id}?fields=columns,tableConstraints
    String fields = "columns,tableConstraints";
    table =
        byName
            ? getEntityByName(table.getFullyQualifiedName(), null, fields, adminAuthHeaders())
            : getEntity(table.getId(), fields, adminAuthHeaders());
    assertFields(table, fields);

    // GET .../tables/{id}?fields=columns,usageSummary,owner,database,tags
    fields = "columns,usageSummary,owner,tags";
    table =
        byName
            ? getEntityByName(table.getFullyQualifiedName(), null, fields, adminAuthHeaders())
            : getEntity(table.getId(), fields, adminAuthHeaders());
    assertEquals(table.getOwner().getId(), USER_OWNER1.getId());
    assertEquals(table.getOwner().getType(), USER_OWNER1.getType());
    assertEquals(table.getDatabase().getId(), DATABASE.getId());
    assertEquals(table.getDatabase().getName(), DATABASE.getFullyQualifiedName());
  }

  private static void assertColumn(Column expectedColumn, Column actualColumn) throws HttpResponseException {
    assertNotNull(actualColumn.getFullyQualifiedName());
    assertEquals(expectedColumn.getName(), actualColumn.getName());
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

  public CreateTable create(TestInfo test) {
    return create(getEntityName(test));
  }

  public CreateTable create(TestInfo test, int index) {
    return create(getEntityName(test, index));
  }

  public CreateTable create(String entityName) {
    TableConstraint constraint =
        new TableConstraint().withConstraintType(ConstraintType.UNIQUE).withColumns(List.of(COLUMNS.get(0).getName()));
    return new CreateTable()
        .withName(entityName)
        .withDatabase(DATABASE.getId())
        .withColumns(COLUMNS)
        .withTableConstraints(List.of(constraint));
  }

  /**
   * A method variant to be called form other tests to create a table without depending on Database, DatabaseService set
   * up in the {@code setup()} method
   */
  public Table createEntity(TestInfo test, int index) throws IOException {
    DatabaseServiceResourceTest databaseServiceResourceTest = new DatabaseServiceResourceTest();
    DatabaseService service =
        databaseServiceResourceTest.createEntity(databaseServiceResourceTest.create(test), adminAuthHeaders());
    EntityReference serviceRef =
        new EntityReference().withName(service.getName()).withId(service.getId()).withType(Entity.DATABASE_SERVICE);
    DatabaseResourceTest databaseResourceTest = new DatabaseResourceTest();
    Database database =
        databaseResourceTest.createAndCheckEntity(
            databaseResourceTest.create(test).withService(serviceRef), adminAuthHeaders());
    CreateTable create =
        new CreateTable().withName(getEntityName(test, index)).withDatabase(database.getId()).withColumns(COLUMNS);
    return createEntity(create, adminAuthHeaders());
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

  private static int getTagUsageCount(String tagFQN, Map<String, String> authHeaders) throws HttpResponseException {
    return TagResourceTest.getTag(tagFQN, "usageCount", authHeaders).getUsageCount();
  }

  private static int getTagCategoryUsageCount(String name, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TagResourceTest.getCategory(name, "usageCount", authHeaders).getUsageCount();
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

  @Override
  public Object createRequest(String name, String description, String displayName, EntityReference owner) {
    return create(name).withDescription(description).withOwner(owner);
  }

  @Override
  public Table beforeDeletion(TestInfo test, Table table) throws HttpResponseException {
    // Add location to the table
    CreateLocation create =
        new CreateLocation().withName(getLocationName(test)).withService(AWS_STORAGE_SERVICE_REFERENCE);
    Location location = createLocation(create, adminAuthHeaders());
    addAndCheckLocation(table, location.getId(), OK, userAuthHeaders());
    return table;
  }

  @Override
  public EntityReference getContainer(Object createRequest) throws URISyntaxException {
    return Entity.getEntityReference(DATABASE); // TODO clean this up
  }

  @Override
  public void validateCreatedEntity(Table createdEntity, Object request, Map<String, String> authHeaders)
      throws HttpResponseException {
    CreateTable createRequest = (CreateTable) request;
    validateCommonEntityFields(
        getEntityInterface(createdEntity),
        createRequest.getDescription(),
        TestUtils.getPrincipal(authHeaders),
        createRequest.getOwner());

    // Entity specific validation
    assertEquals(createRequest.getTableType(), createdEntity.getTableType());
    assertColumns(createRequest.getColumns(), createdEntity.getColumns());
    validateDatabase(createRequest.getDatabase(), createdEntity.getDatabase());
    assertEquals(createRequest.getTableConstraints(), createdEntity.getTableConstraints());
    TestUtils.validateTags(createRequest.getTags(), createdEntity.getTags());
    TestUtils.validateEntityReference(createdEntity.getFollowers());
    assertListNotNull(createdEntity.getService(), createdEntity.getServiceType());
  }

  @Override
  public void validateUpdatedEntity(Table updated, Object request, Map<String, String> authHeaders)
      throws HttpResponseException {
    validateCreatedEntity(updated, request, authHeaders);
  }

  @Override
  protected void validateDeletedEntity(
      Object create, Table entityBeforeDeletion, Table entityAfterDeletion, Map<String, String> authHeaders)
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
    validateDatabase(expected.getDatabase().getId(), patched.getDatabase());
    assertEquals(expected.getTableConstraints(), patched.getTableConstraints());
    TestUtils.validateTags(expected.getTags(), patched.getTags());
    TestUtils.validateEntityReference(expected.getFollowers());
  }

  private void validateDatabase(UUID expectedDatabaseId, EntityReference database) {
    TestUtils.validateEntityReference(database);
    assertEquals(expectedDatabaseId, database.getId());
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
      List<TableConstraint> expectedConstraints = (List<TableConstraint>) expected;
      List<TableConstraint> actualConstraints = JsonUtils.readObjects(actual.toString(), TableConstraint.class);
      assertEquals(expectedConstraints, actualConstraints);
    } else if (fieldName.contains("columns") && !fieldName.endsWith("tags") && !fieldName.endsWith("description")) {
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
