/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.resources.databases;

import com.fasterxml.jackson.core.JsonProcessingException;
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
import org.openmetadata.catalog.api.data.CreateTable;
import org.openmetadata.catalog.api.services.CreateDatabaseService;
import org.openmetadata.catalog.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.databases.TableResource.TableList;
import org.openmetadata.catalog.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.catalog.resources.tags.TagResourceTest;
import org.openmetadata.catalog.resources.teams.TeamResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.ColumnDataType;
import org.openmetadata.catalog.type.ColumnJoin;
import org.openmetadata.catalog.type.ColumnProfile;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.JoinedWith;
import org.openmetadata.catalog.type.TableConstraint;
import org.openmetadata.catalog.type.TableConstraint.ConstraintType;
import org.openmetadata.catalog.type.TableData;
import org.openmetadata.catalog.type.TableJoins;
import org.openmetadata.catalog.type.TableProfile;
import org.openmetadata.catalog.type.TableType;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.common.utils.JsonSchemaUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static java.util.Collections.singletonList;
import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.CONFLICT;
import static javax.ws.rs.core.Response.Status.CREATED;
import static javax.ws.rs.core.Response.Status.FORBIDDEN;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static javax.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.catalog.resources.databases.DatabaseResourceTest.createAndCheckDatabase;
import static org.openmetadata.catalog.resources.services.DatabaseServiceResourceTest.createService;
import static org.openmetadata.catalog.type.ColumnDataType.ARRAY;
import static org.openmetadata.catalog.type.ColumnDataType.BIGINT;
import static org.openmetadata.catalog.type.ColumnDataType.CHAR;
import static org.openmetadata.catalog.type.ColumnDataType.FLOAT;
import static org.openmetadata.catalog.type.ColumnDataType.INT;
import static org.openmetadata.catalog.type.ColumnDataType.STRING;
import static org.openmetadata.catalog.type.ColumnDataType.STRUCT;
import static org.openmetadata.catalog.util.RestUtil.DATE_FORMAT;
import static org.openmetadata.catalog.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.catalog.util.TestUtils.adminAuthHeaders;
import static org.openmetadata.catalog.util.TestUtils.assertEntityPagination;
import static org.openmetadata.catalog.util.TestUtils.assertResponse;
import static org.openmetadata.catalog.util.TestUtils.authHeaders;
import static org.openmetadata.catalog.util.TestUtils.userAuthHeaders;
import static org.openmetadata.common.utils.CommonUtil.getDateStringByOffset;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class TableResourceTest extends CatalogApplicationTest {
  private static final Logger LOG = LoggerFactory.getLogger(TableResourceTest.class);
  public static Database DATABASE;
  public static final TagLabel USER_ADDRESS_TAG_LABEL = new TagLabel().withTagFQN("User.Address");
  public static final TagLabel USER_BANK_ACCOUNT_TAG_LABEL = new TagLabel().withTagFQN("User.BankAccount");
  public static final TagLabel TIER_1 = new TagLabel().withTagFQN("Tier.Tier1");
  public static final TagLabel TIER_2 = new TagLabel().withTagFQN("Tier.Tier2");

  public static List<Column> COLUMNS = Arrays.asList(
          getColumn("c1", BIGINT, USER_ADDRESS_TAG_LABEL),
          getColumn("c2", ColumnDataType.VARCHAR, USER_ADDRESS_TAG_LABEL).withDataLength(10),
          getColumn("c3", BIGINT, USER_BANK_ACCOUNT_TAG_LABEL));

  public static User USER1;
  public static EntityReference USER_OWNER1;
  public static Team TEAM1;
  public static EntityReference TEAM_OWNER1;
  public static EntityReference SNOWFLAKE_REFERENCE;

  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException {
    CreateDatabaseService createSnowflake = new CreateDatabaseService()
            .withName(DatabaseServiceResourceTest.getName(test, 1))
            .withServiceType(DatabaseServiceType.Snowflake).withJdbc(TestUtils.JDBC_INFO);
    DatabaseService service = createService(createSnowflake, adminAuthHeaders());
    SNOWFLAKE_REFERENCE = new EntityReference().withName(service.getName()).withId(service.getId())
            .withType(Entity.DATABASE_SERVICE);

    CreateDatabase create = DatabaseResourceTest.create(test).withService(SNOWFLAKE_REFERENCE);
    DATABASE = createAndCheckDatabase(create, adminAuthHeaders());

    USER1 = UserResourceTest.createUser(UserResourceTest.create(test), authHeaders("test@open-metadata.org"));
    USER_OWNER1 = new EntityReference().withId(USER1.getId()).withType("user");

    TEAM1 = TeamResourceTest.createTeam(TeamResourceTest.create(test), adminAuthHeaders());
    TEAM_OWNER1 = new EntityReference().withId(TEAM1.getId()).withType("team");
  }

  @Test
  public void post_tableWithLongName_400_badRequest(TestInfo test) {
    // Create table with mandatory name field empty
    CreateTable create = create(test).withName(TestUtils.LONG_ENTITY_NAME);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTable(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_tableWithoutName_400_badRequest(TestInfo test) {
    // Create table with mandatory name field empty
    CreateTable create = create(test).withName("");
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTable(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[name size must be between 1 and 64]");
  }

  @Test
  public void post_tableWithoutColumnDataLength_400(TestInfo test) {
    List<Column> columns = singletonList(getColumn("c1", BIGINT, null).withOrdinalPosition(1));
    CreateTable create = create(test).withColumns(columns);

    // char, varchar, binary, and varbinary columns must have length
    ColumnDataType[] columnDataTypes = {CHAR, ColumnDataType.VARCHAR, ColumnDataType.BINARY,
            ColumnDataType.VARBINARY};

    for (ColumnDataType dataType : columnDataTypes) {
      create.getColumns().get(0).withDataType(dataType);
      HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
              createTable(create, adminAuthHeaders()));
      assertResponse(exception, BAD_REQUEST,
              "For column data types char, varchar, binary, varbinary dataLength must not be null");
    }
  }

  @Test
  public void post_tableInvalidArrayColumn_400(TestInfo test) {
    // No arrayDataType passed for array
    List<Column> columns = singletonList(getColumn("c1", ARRAY, "array<int>", null));
    CreateTable create = create(test).withColumns(columns);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTable(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "For column data type array, arrayDataType must not be null");

    // No dataTypeDisplay passed for array
    columns.get(0).withArrayDataType(INT).withDataTypeDisplay(null);
    exception = assertThrows(HttpResponseException.class, () ->
            createTable(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST,
            "For column data type array, dataTypeDisplay must be of type array<arrayDataType>");
  }

  @Test
  public void post_duplicateColumnName_400(TestInfo test) {
    // Duplicate column names c1
    String repeatedColumnName = "c1";
    List<Column> columns = Arrays.asList(getColumn(repeatedColumnName, ARRAY, "array<int>", null),
            getColumn(repeatedColumnName, INT, null));
    CreateTable create = create(test).withColumns(columns);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTable(create, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, String.format("Column name %s is repeated", repeatedColumnName));
  }

  @Test
  public void post_tableAlreadyExists_409_conflict(TestInfo test) throws HttpResponseException {
    CreateTable create = create(test);
    createTable(create, adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTable(create, adminAuthHeaders()));
    assertResponse(exception, CONFLICT, CatalogExceptionMessage.ENTITY_ALREADY_EXISTS);
  }

  @Test
  public void post_validTables_200_OK(TestInfo test) throws HttpResponseException {
    // Create table with different optional fields
    // Optional field description
    CreateTable create = create(test).withDescription("description");
    createAndCheckTable(create, adminAuthHeaders());

    // Optional fields tableType
    create.withName(getTableName(test, 1)).withTableType(TableType.View);
    createAndCheckTable(create, adminAuthHeaders());
  }

  private static Column getColumn(String name, ColumnDataType columnDataType, TagLabel tag) {

    return getColumn(name, columnDataType, null, tag);
  }

  private static Column getColumn(String name, ColumnDataType columnDataType, String dataTypeDisplay, TagLabel tag) {
    List<TagLabel> tags = tag == null ? new ArrayList<>() : singletonList(tag);
    return new Column().withName(name).withDataType(columnDataType)
            .withDataTypeDisplay(dataTypeDisplay).withTags(tags);
  }

  @Test
  public void post_put_patch_complexColumnTypes(TestInfo test) throws HttpResponseException, JsonProcessingException {
    Column c1 = getColumn("c1", ARRAY, "array<int>", USER_ADDRESS_TAG_LABEL).withArrayDataType(INT);
    Column c2_a = getColumn("a", INT, USER_ADDRESS_TAG_LABEL);
    Column c2_b = getColumn("b", CHAR, USER_ADDRESS_TAG_LABEL);
    Column c2_c_d = getColumn("d", INT, USER_ADDRESS_TAG_LABEL);
    Column c2_c = getColumn("c", STRUCT, "struct<int: d>>>", USER_ADDRESS_TAG_LABEL)
            .withChildren(new ArrayList<>(Arrays.asList(c2_c_d)));

    // Column struct<a: int, b:char, c: struct<int: d>>>
    Column c2 = getColumn("c2", STRUCT, "struct<a: int, b:string, c: struct<int: d>>>",USER_BANK_ACCOUNT_TAG_LABEL)
            .withChildren(new ArrayList<>(Arrays.asList(c2_a, c2_b, c2_c)));

    // Test POST operation can create complex types
    CreateTable create1 = create(test, 1).withColumns(Arrays.asList(c1, c2));
    Table table1 = createAndCheckTable(create1, adminAuthHeaders());

    // Test PUT operation
    CreateTable create2 = create(test, 2).withColumns(Arrays.asList(c1, c2));
    updateAndCheckTable(create2.withName("put_complexColumnType"), Status.CREATED, adminAuthHeaders());
    // Update without any change
    updateAndCheckTable(create2.withName("put_complexColumnType"), Status.OK, adminAuthHeaders());

    //
    // Update the complex columns
    //
    // c1 from array<int> to array<char> and also change the tag
    c1.withArrayDataType(CHAR).withTags(singletonList(USER_BANK_ACCOUNT_TAG_LABEL)).withDataTypeDisplay("array<char>");

    // c2 from -> to
    // struct<a:int, b:char, c:struct<d:int>>>
    // struct<-----, b:char, c:struct<d:int, e:char>, f:char>
    c2_b.withTags(singletonList(USER_BANK_ACCOUNT_TAG_LABEL)); // Change c2.b tag
    c2_c.getChildren().add(getColumn("e", INT,USER_ADDRESS_TAG_LABEL)); // Add c2.c.e
    c2.getChildren().remove(0); // Remove c2.a from struct
    c2.getChildren().add(getColumn("f", CHAR, USER_ADDRESS_TAG_LABEL)); // Add c2.f
    create2 = create2.withColumns(Arrays.asList(c1, c2));

    // Update the columns with put operation and validate update
    updateAndCheckTable(create2.withName("put_complexColumnType"), Status.OK, adminAuthHeaders());


    //
    // Patch operations on table1 created by POST operation. Columns can't be added or deleted. Only tags and
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
    table1 = patchTable(tableJson, table1, adminAuthHeaders());
    validateColumns(Arrays.asList(c1, c2), table1.getColumns());
  }

  @Test
  public void post_tableWithUserOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckTable(create(test).withOwner(USER_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_tableWithTeamOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckTable(create(test).withOwner(TEAM_OWNER1), adminAuthHeaders());
  }

  @Test
  public void post_tableWithInvalidOwnerType_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(TEAM1.getId()); /* No owner type is set */
    CreateTable create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTable(create, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "type must not be null");
  }

  @Test
  public void post_tableWithInvalidDatabase_404(TestInfo test) {
    CreateTable create = create(test).withDatabase(NON_EXISTENT_ENTITY);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTable(create, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.DATABASE, NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_tableWithNonExistentOwner_4xx(TestInfo test) {
    EntityReference owner = new EntityReference().withId(NON_EXISTENT_ENTITY).withType("user");
    CreateTable create = create(test).withOwner(owner);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            createTable(create, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound("User", NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_table_as_non_admin_401(TestInfo test) {
    CreateTable create = create(test);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createTable(create,
            authHeaders("test@open-metadata.org")));
      assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void put_tableUpdateWithNoChange_200(TestInfo test) throws HttpResponseException {
    CreateTable request = create(test).withOwner(USER_OWNER1);
    createAndCheckTable(request, adminAuthHeaders());

    // Update table two times successfully with PUT requests
    updateAndCheckTable(request, OK, adminAuthHeaders());
    updateAndCheckTable(request, OK, adminAuthHeaders());
  }

  @Test
  public void put_tableCreate_200(TestInfo test) throws HttpResponseException {
    // Create a new table with put
    CreateTable request = create(test).withOwner(USER_OWNER1);
    updateAndCheckTable(request.withName("newName").withDescription(null), CREATED, adminAuthHeaders());
  }

  @Test
  public void put_tableNullDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    // Create table with null description
    CreateTable request = create(test).withOwner(USER_OWNER1);
    createAndCheckTable(request, adminAuthHeaders());

    // Update null description with a new description
    Table table = updateAndCheckTable(request.withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("newDescription", table.getDescription());
  }

  @Test
  public void put_tableEmptyDescriptionUpdate_200(TestInfo test) throws HttpResponseException {
    // Create table with empty description
    CreateTable request = create(test).withOwner(USER_OWNER1);
    createAndCheckTable(request, adminAuthHeaders());

    // Update empty description with a new description
    Table table = updateAndCheckTable(request.withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("newDescription", table.getDescription());
  }

  @Test
  public void put_tableNonEmptyDescriptionUpdateIgnored_200(TestInfo test) throws HttpResponseException {
    CreateTable request = create(test).withOwner(USER_OWNER1).withDescription("description");
    createAndCheckTable(request, adminAuthHeaders());

    // Updating non-empty description is ignored
    Table table = updateTable(request.withDescription("newDescription"), OK, adminAuthHeaders());
    assertEquals("description", table.getDescription());
  }

  @Test
  public void put_tableOwnershipUpdate_200(TestInfo test) throws HttpResponseException {
    CreateTable request = create(test).withOwner(USER_OWNER1).withDescription("description");
    Table table = createAndCheckTable(request, adminAuthHeaders());
    checkOwnerOwns(USER_OWNER1, table.getId(), true);

    // Change ownership from USER_OWNER1 to TEAM_OWNER1
    updateAndCheckTable(request.withOwner(TEAM_OWNER1), OK, adminAuthHeaders());
    checkOwnerOwns(USER_OWNER1, table.getId(), false);
    checkOwnerOwns(TEAM_OWNER1, table.getId(), true);

    // Remove ownership
    table = updateAndCheckTable(request.withOwner(null), OK, adminAuthHeaders());
    assertNull(table.getOwner());
    checkOwnerOwns(TEAM_OWNER1, table.getId(), false);
  }

  @Test
  public void put_tableTableConstraintUpdate_200(TestInfo test) throws HttpResponseException {
    // Create table without table constraints
    CreateTable request = create(test).withOwner(USER_OWNER1).withDescription("description").withTableConstraints(null);
    Table table = createAndCheckTable(request, adminAuthHeaders());
    checkOwnerOwns(USER_OWNER1, table.getId(), true);

    // Update the table with constraints
    request = create(test).withOwner(USER_OWNER1).withDescription("description");
    updateAndCheckTable(request, OK, adminAuthHeaders());
  }

  @Test
  public void put_updateColumns_200(TestInfo test) throws HttpResponseException {
    int tagCategoryUsageCount = getTagCategoryUsageCount("user", userAuthHeaders());
    int addressTagUsageCount = getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), userAuthHeaders());
    int bankTagUsageCount = getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), userAuthHeaders());

    //
    // Create a table with column c1, type BIGINT, description c1 and tag USER_ADDRESS_TAB_LABEL
    //
    List<TagLabel> tags = new ArrayList<>(singletonList(USER_ADDRESS_TAG_LABEL));
    List<Column> columns = singletonList(new Column().withName("c1").withDataType(BIGINT)
            .withOrdinalPosition(1).withDescription("c1").withTags(tags));

    CreateTable request = create(test).withColumns(columns);
    Table table = createAndCheckTable(request, adminAuthHeaders());
    columns.get(0).setFullyQualifiedName(table.getFullyQualifiedName() + ".c1");

    // Ensure tag category and tag usage counts are updated
    assertEquals(tagCategoryUsageCount + 1, getTagCategoryUsageCount("user", userAuthHeaders()));
    assertEquals(addressTagUsageCount + 1, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(),
            authHeaders("test@open-metadata.org")));
    assertEquals(bankTagUsageCount, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), userAuthHeaders()));

    //
    // Update the c1 with additional tag USER_BANK_ACCOUNT_TAG_LABEL
    // Ensure description and previous tag is carried forward during update
    //
    tags.add(USER_BANK_ACCOUNT_TAG_LABEL);
    List<Column> updatedColumns = new ArrayList<>();
    updatedColumns.add(new Column().withName("c1").withDataType(BIGINT)
            .withTags(tags).withOrdinalPosition(1));
    table = updateAndCheckTable(request.withColumns(updatedColumns), OK, adminAuthHeaders());

    // Ensure tag usage counts are updated
    assertEquals(tagCategoryUsageCount + 2, getTagCategoryUsageCount("user", userAuthHeaders()));
    assertEquals(addressTagUsageCount + 1, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), userAuthHeaders()));
    assertEquals(bankTagUsageCount + 1, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), userAuthHeaders()));

    //
    // Add a new column and make sure it is added by PUT
    //
    updatedColumns.add(new Column().withName("c2").withDataType(ColumnDataType.BINARY).withOrdinalPosition(2)
            .withDataLength(10).withFullyQualifiedName(table.getFullyQualifiedName() + ".c2").withTags(tags));
    table = updateAndCheckTable(request.withColumns(updatedColumns), OK, adminAuthHeaders());
    assertEquals(2, table.getColumns().size());
    validateTags(updatedColumns.get(0).getTags(), table.getColumns().get(0).getTags());
    validateTags(updatedColumns.get(1).getTags(), table.getColumns().get(1).getTags());

    // Ensure tag usage counts are updated - column c2 added both address and bank tags
    assertEquals(tagCategoryUsageCount + 4, getTagCategoryUsageCount("user", userAuthHeaders()));
    assertEquals(addressTagUsageCount + 2, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), userAuthHeaders()));
    assertEquals(bankTagUsageCount + 2, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), userAuthHeaders()));

    //
    // Remove a column c2 and make sure it is deleted by PUT
    //
    updatedColumns.remove(1);
    table = updateAndCheckTable(request.withColumns(updatedColumns), OK, adminAuthHeaders());
    assertEquals(1, table.getColumns().size());
    validateTags(columns.get(0).getTags(), table.getColumns().get(0).getTags());

    // Ensure tag usage counts are updated to reflect removal of column c2
    assertEquals(tagCategoryUsageCount + 2, getTagCategoryUsageCount("user", userAuthHeaders()));
    assertEquals(addressTagUsageCount + 1, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), userAuthHeaders()));
    assertEquals(bankTagUsageCount + 1, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), userAuthHeaders()));
  }

  @Test
  public void put_tableJoins_200(TestInfo test) throws HttpResponseException, ParseException {
    Table table1 = createAndCheckTable(create(test, 1), adminAuthHeaders());
    Table table2 = createAndCheckTable(create(test, 2), adminAuthHeaders());
    Table table3 = createAndCheckTable(create(test, 3), adminAuthHeaders());

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

    List<ColumnJoin> reportedJoins = Arrays.asList(
            // table1.c1 is joined with table2.c1, and table3.c1 with join count 10
            new ColumnJoin().withColumnName("c1").withJoinedWith(Arrays.asList(
                    new JoinedWith().withFullyQualifiedName(t2c1).withJoinCount(10),
                    new JoinedWith().withFullyQualifiedName(t3c1).withJoinCount(10))),
            // table1.c2 is joined with table2.c1, and table3.c3 with join count 20
            new ColumnJoin().withColumnName("c2").withJoinedWith(Arrays.asList(
                    new JoinedWith().withFullyQualifiedName(t2c2).withJoinCount(20),
                    new JoinedWith().withFullyQualifiedName(t3c2).withJoinCount(20))),
            // table1.c3 is joined with table2.c1, and table3.c3 with join count 30
            new ColumnJoin().withColumnName("c3").withJoinedWith(Arrays.asList(
                    new JoinedWith().withFullyQualifiedName(t2c3).withJoinCount(30),
                    new JoinedWith().withFullyQualifiedName(t3c3).withJoinCount(30))));

    for (int i = 1; i <= 30; i++) {
      // Report joins starting from today back to 30 days. After every report, check the cumulative join count
      TableJoins table1Joins =
              new TableJoins().withDayCount(1).withStartDate(RestUtil.today(-(i-1))).withColumnJoins(reportedJoins);
      putJoins(table1.getId(), table1Joins, adminAuthHeaders());

      List<ColumnJoin> expectedJoins1 = Arrays.asList(
              // table1.c1 is joined with table2.c1, and table3.c1 with join count 10
              new ColumnJoin().withColumnName("c1").withJoinedWith(Arrays.asList(
                      new JoinedWith().withFullyQualifiedName(t2c1).withJoinCount(10 * i),
                      new JoinedWith().withFullyQualifiedName(t3c1).withJoinCount(10 * i))),
              // table1.c2 is joined with table2.c1, and table3.c3 with join count 20
              new ColumnJoin().withColumnName("c2").withJoinedWith(Arrays.asList(
                      new JoinedWith().withFullyQualifiedName(t2c2).withJoinCount(20 * i),
                      new JoinedWith().withFullyQualifiedName(t3c2).withJoinCount(20 * i))),
              // table1.c3 is joined with table2.c1, and table3.c3 with join count 30
              new ColumnJoin().withColumnName("c3").withJoinedWith(Arrays.asList(
                      new JoinedWith().withFullyQualifiedName(t2c3).withJoinCount(30 * i),
                      new JoinedWith().withFullyQualifiedName(t3c3).withJoinCount(30 * i))));

      // getTable and ensure the following column joins are correct
      table1 = getTable(table1.getId(), "joins", adminAuthHeaders());
      validateColumnJoins(expectedJoins1, table1.getJoins());

      // getTable and ensure the following column joins are correct
      table2 = getTable(table2.getId(), "joins", adminAuthHeaders());
      List<ColumnJoin> expectedJoins2 = Arrays.asList(
              // table2.c1 is joined with table1.c1 with join count 10
              new ColumnJoin().withColumnName("c1").withJoinedWith(singletonList(
                      new JoinedWith().withFullyQualifiedName(t1c1).withJoinCount(10 * i))),
              // table2.c2 is joined with table1.c1 with join count 20
              new ColumnJoin().withColumnName("c2").withJoinedWith(singletonList(
                      new JoinedWith().withFullyQualifiedName(t1c2).withJoinCount(20 * i))),
              // table2.c3 is joined with table1.c1 with join count 30
              new ColumnJoin().withColumnName("c3").withJoinedWith(singletonList(
                      new JoinedWith().withFullyQualifiedName(t1c3).withJoinCount(30 * i))));
      validateColumnJoins(expectedJoins2, table2.getJoins());

      // getTable and ensure the following column joins
      table3 = getTable(table3.getId(), "joins", adminAuthHeaders());
      List<ColumnJoin> expectedJoins3 = Arrays.asList(
              // table3.c1 is joined with table1.c1 with join count 10
              new ColumnJoin().withColumnName("c1").withJoinedWith(singletonList(
                      new JoinedWith().withFullyQualifiedName(t1c1).withJoinCount(10 * i))),
              // table3.c2 is joined with table1.c1 with join count 20
              new ColumnJoin().withColumnName("c2").withJoinedWith(singletonList(
                      new JoinedWith().withFullyQualifiedName(t1c2).withJoinCount(20 * i))),
              // table3.c3 is joined with table1.c1 with join count 30
              new ColumnJoin().withColumnName("c3").withJoinedWith(singletonList(
                      new JoinedWith().withFullyQualifiedName(t1c3).withJoinCount(30 * i))));
      validateColumnJoins(expectedJoins3, table3.getJoins());

      // Report again for the previous day and make sure aggregate counts are correct
      table1Joins = new TableJoins().withDayCount(1).withStartDate(RestUtil.today(-1))
              .withColumnJoins(reportedJoins);
      putJoins(table1.getId(), table1Joins, adminAuthHeaders());
      table1 = getTable(table1.getId(), "joins", adminAuthHeaders());
    }
  }

  @Test
  public void put_tableJoinsInvalidColumnName_4xx(TestInfo test) throws HttpResponseException, ParseException {
    Table table1 = createAndCheckTable(create(test, 1), adminAuthHeaders());
    Table table2 = createAndCheckTable(create(test, 2), adminAuthHeaders());

    List<ColumnJoin> joins = singletonList(new ColumnJoin().withColumnName("c1"));
    TableJoins tableJoins = new TableJoins().withStartDate(RestUtil.today(0))
            .withDayCount(1).withColumnJoins(joins);

    // Invalid database name
    String columnFQN = "invalidDB";
    JoinedWith joinedWith = new JoinedWith().withFullyQualifiedName(columnFQN);
    joins.get(0).withJoinedWith(singletonList(joinedWith));
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            putJoins(table1.getId(), tableJoins, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.invalidColumnFQN(columnFQN));

    // Invalid table name
    columnFQN = table2.getDatabase().getName() + ".invalidTable";
    joinedWith = new JoinedWith().withFullyQualifiedName(columnFQN);
    joins.get(0).withJoinedWith(singletonList(joinedWith));
    exception = assertThrows(HttpResponseException.class, () ->
            putJoins(table1.getId(), tableJoins, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.invalidColumnFQN(columnFQN));

    // Invalid column name
    columnFQN = table2.getFullyQualifiedName() + ".invalidColumn";
    joinedWith = new JoinedWith().withFullyQualifiedName(columnFQN);
    joins.get(0).withJoinedWith(singletonList(joinedWith));
    exception = assertThrows(HttpResponseException.class, () ->
            putJoins(table1.getId(), tableJoins, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, CatalogExceptionMessage.invalidColumnFQN(columnFQN));

    // Invalid date older than 30 days
    joinedWith = new JoinedWith().withFullyQualifiedName(table2.getFullyQualifiedName() + ".c1");
    joins.get(0).withJoinedWith(singletonList(joinedWith));
    tableJoins.withStartDate(RestUtil.today(-30));  // 30 days older than today
    exception = assertThrows(HttpResponseException.class, () ->
            putJoins(table1.getId(), tableJoins, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "Date range can only include past 30 days starting today");
  }

  public void validateColumnJoins(List<ColumnJoin> expected, TableJoins actual) throws ParseException {
    // Table reports last 30 days of aggregated join count
    assertEquals(actual.getStartDate(), getDateStringByOffset(DATE_FORMAT, RestUtil.today(0), -30));
    assertEquals(actual.getDayCount(), 30);

    // Sort the columnJoins and the joinedWith to account for different ordering
    expected.sort(new ColumnJoinComparator());
    expected.forEach(c -> c.getJoinedWith().sort(new JoinedWithComparator()));
    actual.getColumnJoins().sort(new ColumnJoinComparator());
    actual.getColumnJoins().forEach(c -> c.getJoinedWith().sort(new JoinedWithComparator()));
    assertEquals(expected, actual.getColumnJoins());
  }

  public static class TagLabelComparator implements Comparator<TagLabel> {
    @Override
    public int compare(TagLabel label, TagLabel t1) {
      return label.getTagFQN().compareTo(t1.getTagFQN());
    }
  }

  public static class ColumnComparator implements Comparator<Column> {
    @Override
    public int compare(Column column, Column t1) {
      return column.getName().compareTo(t1.getName());
    }
  }

  public static class ColumnJoinComparator implements Comparator<ColumnJoin> {
    @Override
    public int compare(ColumnJoin columnJoin, ColumnJoin t1) {
      return columnJoin.getColumnName().compareTo(t1.getColumnName());
    }
  }

  public static class JoinedWithComparator implements Comparator<JoinedWith> {
    @Override
    public int compare(JoinedWith joinedWith, JoinedWith t1) {
      return joinedWith.getFullyQualifiedName().compareTo(t1.getFullyQualifiedName());
    }
  }

  @Test
  public void put_tableSampleData_200(TestInfo test) throws HttpResponseException {
    Table table = createAndCheckTable(create(test), adminAuthHeaders());
    List<String> columns = Arrays.asList("c1", "c2", "c3");

    // Add 3 rows of sample data for 3 columns
    List<List<Object>> rows = Arrays.asList(Arrays.asList("c1Value1", 1, true),
                                            Arrays.asList("c1Value2", null, false),
                                            Arrays.asList("c1Value3", 3, true));

    TableData tableData = new TableData().withColumns(columns).withRows(rows);
    putSampleData(table.getId(), tableData, adminAuthHeaders());

    table = getTable(table.getId(), "sampleData", adminAuthHeaders());
    assertEquals(tableData, table.getSampleData());
  }

  @Test
  public void put_tableInvalidSampleData_4xx(TestInfo test) throws HttpResponseException {
    Table table = createAndCheckTable(create(test), adminAuthHeaders());
    TableData tableData = new TableData();

    // Send sample data with invalid column name
    List<String> columns = Arrays.asList("c1", "c2", "invalidColumn");  // Invalid column name
    List<List<Object>> rows = singletonList(Arrays.asList("c1Value1", 1, true)); // Valid sample data
    tableData.withColumns(columns).withRows(rows);
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> putSampleData(table.getId(), tableData, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "Invalid column name invalidColumn");

    // Send sample data that has more samples than the number of columns
    columns = Arrays.asList("c1", "c2", "c3");  // Invalid column name
    rows = singletonList(Arrays.asList("c1Value1", 1, true, "extra value")); // Extra value
    tableData.withColumns(columns).withRows(rows);
    exception = assertThrows(HttpResponseException.class, () ->
            putSampleData(table.getId(), tableData, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "Number of columns is 3 but row " +
            "has 4 sample values");

    // Send sample data that has less samples than the number of columns
    columns = Arrays.asList("c1", "c2", "c3");  // Invalid column name
    rows = singletonList(Arrays.asList("c1Value1", 1 /* Missing Value */));
    tableData.withColumns(columns).withRows(rows);
    exception = assertThrows(HttpResponseException.class, () ->
            putSampleData(table.getId(), tableData, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "Number of columns is 3 but row h" +
            "as 2 sample values");
  }

  @Test
  public void put_viewDefinition_200(TestInfo test) throws HttpResponseException {
    CreateTable createTable = create(test);
    createTable.setTableType(TableType.View);
    String query = "sales_vw\n" +
            "create view sales_vw as\n" +
            "select * from public.sales\n" +
            "union all\n" +
            "select * from spectrum.sales\n" +
            "with no schema binding;\n";
    createTable.setViewDefinition(query);
    Table table = createAndCheckTable(createTable, adminAuthHeaders());
    table = getTable(table.getId(), "viewDefinition", adminAuthHeaders());
    LOG.info("table view definition {}", table.getViewDefinition());
    assertEquals(table.getViewDefinition(), query);
  }

  @Test
  public void put_viewDefinition_invalid_table_4xx(TestInfo test) {
    CreateTable createTable = create(test);
    createTable.setTableType(TableType.Regular);
    String query = "sales_vw\n" +
            "create view sales_vw as\n" +
            "select * from public.sales\n" +
            "union all\n" +
            "select * from spectrum.sales\n" +
            "with no schema binding;\n";
    createTable.setViewDefinition(query);
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> createAndCheckTable(createTable, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "ViewDefinition can only be set on " +
            "TableType View, SecureView or MaterializedView");
  }

  @Test
  public void put_tableProfile_200(TestInfo test) throws HttpResponseException {
    Table table = createAndCheckTable(create(test), adminAuthHeaders());
    ColumnProfile c1Profile = new ColumnProfile().withName("c1").withMax("100.0")
            .withMin("10.0").withUniqueCount(100.0);
    ColumnProfile c2Profile = new ColumnProfile().withName("c2").withMax("99.0").withMin("20.0").withUniqueCount(89.0);
    ColumnProfile c3Profile = new ColumnProfile().withName("c3").withMax("75.0").withMin("25.0").withUniqueCount(77.0);
   // Add column profiles
    List<ColumnProfile> columnProfiles = List.of(c1Profile, c2Profile, c3Profile);
    TableProfile tableProfile = new TableProfile().withRowCount(6.0).withColumnCount(3.0)
            .withColumnProfile(columnProfiles).withProfileDate("2021-09-09");
    putTableProfileData(table.getId(), tableProfile, adminAuthHeaders());

    table = getTable(table.getId(), "tableProfile", adminAuthHeaders());
    verifyTableProfileData(table.getTableProfile(), List.of(tableProfile));

    // Add new date for TableProfile
    TableProfile newTableProfile = new TableProfile().withRowCount(7.0).withColumnCount(3.0)
            .withColumnProfile(columnProfiles).withProfileDate("2021-09-08");
    putTableProfileData(table.getId(), newTableProfile, adminAuthHeaders());
    table = getTable(table.getId(), "tableProfile", adminAuthHeaders());
    verifyTableProfileData(table.getTableProfile(), List.of(newTableProfile, tableProfile));

    // Replace table profile for a date
    TableProfile newTableProfile1 = new TableProfile().withRowCount(21.0).withColumnCount(3.0)
            .withColumnProfile(columnProfiles).withProfileDate("2021-09-08");
    putTableProfileData(table.getId(), newTableProfile1, adminAuthHeaders());
    table = getTable(table.getId(), "tableProfile", adminAuthHeaders());
    // first result should be the latest date
    assertEquals(tableProfile.getProfileDate(), table.getTableProfile().get(0).getProfileDate());
    verifyTableProfileData(table.getTableProfile(), List.of(newTableProfile1, tableProfile));
  }

  @Test
  public void put_tableInvalidTableProfileData_4xx(TestInfo test) throws HttpResponseException {
    Table table = createAndCheckTable(create(test), adminAuthHeaders());

    ColumnProfile c1Profile = new ColumnProfile().withName("c1").withMax("100").withMin("10.0")
            .withUniqueCount(100.0);
    ColumnProfile c2Profile = new ColumnProfile().withName("c2").withMax("99.0").withMin("20.0").withUniqueCount(89.0);
    ColumnProfile c3Profile = new ColumnProfile().withName("invalidColumn").withMax("75")
            .withMin("25").withUniqueCount(77.0);
    List<ColumnProfile> columnProfiles = List.of(c1Profile, c2Profile, c3Profile);
    TableProfile tableProfile = new TableProfile().withRowCount(6.0).withColumnCount(3.0)
            .withColumnProfile(columnProfiles).withProfileDate("2021-09-09");
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> putTableProfileData(table.getId(), tableProfile, adminAuthHeaders()));
    TestUtils.assertResponseContains(exception, BAD_REQUEST, "Invalid column name invalidColumn");
  }

  @Test
  public void get_nonExistentTable_404_notFound() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getTable(NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.TABLE, NON_EXISTENT_ENTITY));
  }

  @Test
  public void get_tableWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateTable create = create(test).withDescription("description").withOwner(USER_OWNER1);
    Table table = createAndCheckTable(create, adminAuthHeaders());
    validateGetWithDifferentFields(table, false);
  }

  @Test
  public void get_tableByNameWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateTable create = create(test).withDescription("description").withOwner(USER_OWNER1);
    Table table = createAndCheckTable(create, adminAuthHeaders());
    validateGetWithDifferentFields(table, true);
  }

  @Test
  @Order(1) // Run this test first as other tables created in other tests will interfere with listing
  public void get_tableListWithDifferentFields_200_OK(TestInfo test) throws HttpResponseException {
    CreateTable create = create(test, 1).withDescription("description").withOwner(USER_OWNER1)
            .withTags(singletonList(USER_ADDRESS_TAG_LABEL));
    createAndCheckTable(create, adminAuthHeaders());
    CreateTable create1 = create(test, 2).withDescription("description").withOwner(USER_OWNER1);
    createAndCheckTable(create1, adminAuthHeaders());

    // Check tag category and tag usage counts
    // 1 table tags + 3*2 column tags from COLUMNS
    assertEquals(7, getTagCategoryUsageCount("user", adminAuthHeaders()));
    // 1 table tag and 2*2 column tags
    assertEquals(5, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), adminAuthHeaders()));
    // 2*1 column tags
    assertEquals(2, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), adminAuthHeaders()));

    TableList tableList = listTables(null, null, adminAuthHeaders()); // List tables
    assertEquals(2, tableList.getData().size());
    assertFields(tableList.getData(), null);

    // List tables with databaseFQN as filter
    TableList tableList1 = listTables(null, DATABASE.getFullyQualifiedName(), adminAuthHeaders());
    assertEquals(tableList.getData().size(), tableList1.getData().size());
    assertFields(tableList1.getData(), null);

    // GET .../tables?fields=columns,tableConstraints
    String fields = "columns,tableConstraints";
    tableList = listTables(fields, null, adminAuthHeaders());
    assertEquals(2, tableList.getData().size());
    assertFields(tableList.getData(), fields);

    // List tables with databaseFQN as filter
    tableList1 = listTables(fields, DATABASE.getFullyQualifiedName(), adminAuthHeaders());
    assertEquals(tableList.getData().size(), tableList1.getData().size());
    assertFields(tableList1.getData(), fields);

    // GET .../tables?fields=usageSummary,owner,service
    fields = "usageSummary,owner,database";
    tableList = listTables(fields, null, adminAuthHeaders());
    assertEquals(2, tableList.getData().size());
    assertFields(tableList.getData(), fields);
    for (Table table : tableList.getData()) {
      assertEquals(table.getOwner().getId(), USER_OWNER1.getId());
      assertEquals(table.getOwner().getType(), USER_OWNER1.getType());
      assertEquals(table.getDatabase().getId(), DATABASE.getId());
      assertEquals(table.getDatabase().getName(), DATABASE.getName());
    }

    // List tables with databaseFQN as filter
    tableList1 = listTables(fields, DATABASE.getFullyQualifiedName(), adminAuthHeaders());
    assertEquals(tableList.getData().size(), tableList1.getData().size());
    assertFields(tableList1.getData(), fields);
  }

  @Test
  public void get_tableListWithInvalidLimit_4xx() {
    // Limit must be >= 1 and <= 1000,000
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listTables(null, null, -1, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listTables(null, null, 0, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be greater than or equal to 1]");

    exception = assertThrows(HttpResponseException.class, ()
            -> listTables(null, null, 1000001, null, null, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[query param limit must be less than or equal to 1000000]");
  }

  @Test
  public void get_tableListWithInvalidPaginationCursors_4xx() {
    // Passing both before and after cursors is invalid
    HttpResponseException exception = assertThrows(HttpResponseException.class, ()
            -> listTables(null, null, 1, "", "", adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "Only one of before or after query parameter allowed");
  }

  /**
   * For cursor based pagination and implementation details:
   * @see org.openmetadata.catalog.util.ResultList#ResultList
   *
   * The tests and various CASES referenced are base on that.
   */
  @Test
  public void get_tableListWithPagination_200(TestInfo test) throws HttpResponseException {
    // Create a large number of tables
    int maxTables = 40;
    for (int i = 0; i < maxTables; i++) {
      createTable(create(test, i), adminAuthHeaders());
    }

    // List all tables and use it for checking pagination
    TableList allTables = listTables(null, null, 1000000, null, null,
            adminAuthHeaders());
    int totalRecords = allTables.getData().size();
    printTables(allTables);

    // List tables with limit set from 1 to maxTables size
    // Each time comapare the returned list with allTables list to make sure right results are returned
    for (int limit = 1; limit < maxTables; limit++) {
      String after = null;
      String before;
      int pageCount = 0;
      int indexInAllTables = 0;
      TableList forwardPage;
      TableList backwardPage;
      do { // For each limit (or page size) - forward scroll till the end
        LOG.info("Limit {} forward scrollCount {} afterCursor {}", limit, pageCount, after);
        forwardPage = listTables(null, null, limit, null, after, adminAuthHeaders());
        after = forwardPage.getPaging().getAfter();
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allTables.getData(), forwardPage, limit, indexInAllTables);

        if (pageCount == 0) {  // CASE 0 - First page is being returned. There is no before cursor
          assertNull(before);
        } else {
          // Make sure scrolling back based on before cursor returns the correct result
          backwardPage = listTables(null, null, limit, before, null, adminAuthHeaders());
          assertEntityPagination(allTables.getData(), backwardPage, limit, (indexInAllTables - limit));
        }

        printTables(forwardPage);
        indexInAllTables += forwardPage.getData().size();
        pageCount++;
      } while (after != null);

      // We have now reached the last page - test backward scroll till the beginning
      pageCount = 0;
      indexInAllTables = totalRecords - limit - forwardPage.getData().size();
      do {
        LOG.info("Limit {} backward scrollCount {} beforeCursor {}", limit, pageCount, before);
        forwardPage = listTables(null, null, limit, before, null, adminAuthHeaders());
        printTables(forwardPage);
        before = forwardPage.getPaging().getBefore();
        assertEntityPagination(allTables.getData(), forwardPage, limit, indexInAllTables);
        pageCount++;
        indexInAllTables -= forwardPage.getData().size();
      } while (before != null);
    }
  }

  private void printTables(TableList list) {
    list.getData().forEach(table -> LOG.info("Table {}", table.getFullyQualifiedName()));
    LOG.info("before {} after {} ", list.getPaging().getBefore(), list.getPaging().getAfter());
  }

  @Test
  public void delete_table_200_ok(TestInfo test) throws HttpResponseException {
    Table table = createTable(create(test), adminAuthHeaders());
    deleteTable(table.getId(), adminAuthHeaders());
  }

  @Test
  public void delete_table_as_non_admin_401(TestInfo test) throws HttpResponseException {
    Table table = createTable(create(test), adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteTable(table.getId(), authHeaders("test@open-metadata.org")));
    assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }
  
  @Test
  public void delete_nonExistentTable_404() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            getTable(NON_EXISTENT_ENTITY, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.TABLE, NON_EXISTENT_ENTITY));
  }

  @Test
  public void patch_tableAttributes_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create table without description, table tags, tier, owner, tableType, and tableConstraints
    Table table = createTable(create(test).withTableConstraints(null), adminAuthHeaders());
    assertNull(table.getDescription());
    assertNull(table.getOwner());
    assertNull(table.getTableType());
    assertNull(table.getTableConstraints());

    // Add description, table tags, tier, owner, tableType, and tableConstraints when previously they were null
    List<TableConstraint> tableConstraints = List.of(new TableConstraint().withConstraintType(ConstraintType.UNIQUE)
            .withColumns(List.of(COLUMNS.get(0).getName())));
    List<TagLabel> tableTags = singletonList(USER_ADDRESS_TAG_LABEL);
    table = patchTableAttributesAndCheck(table, "description", TEAM_OWNER1, TableType.Regular,
            tableConstraints, tableTags, adminAuthHeaders());
    table.setOwner(TEAM_OWNER1); // Get rid of href and name returned in the response for owner

    // Replace description, tier, owner, tableType, tableConstraints
    tableConstraints = List.of(new TableConstraint().withConstraintType(ConstraintType.UNIQUE)
            .withColumns(List.of(COLUMNS.get(1).getName())));
    tableTags = singletonList(USER_BANK_ACCOUNT_TAG_LABEL);
    table = patchTableAttributesAndCheck(table, "description1", USER_OWNER1, TableType.External,
            tableConstraints, tableTags, adminAuthHeaders());
    table.setOwner(USER_OWNER1); // Get rid of href and name returned in the response for owner

    // Remove description, tier, owner, tableType, tableConstraints
    patchTableAttributesAndCheck(table, null, null, null, null, null,
            adminAuthHeaders());
  }

  @Test
  public void patch_tableColumnTags_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create table without description, table tags, tier, owner, tableType, and tableConstraints
    List<Column> columns = new ArrayList<>();
    columns.add(getColumn("c1", INT, USER_ADDRESS_TAG_LABEL));
    columns.add(getColumn("c2", BIGINT, USER_ADDRESS_TAG_LABEL));
    columns.add(getColumn("c3", FLOAT, USER_BANK_ACCOUNT_TAG_LABEL));

    Table table = createTable(create(test).withColumns(columns), adminAuthHeaders());

    // Update the columns
    columns.get(0).setTags(List.of(USER_ADDRESS_TAG_LABEL, USER_BANK_ACCOUNT_TAG_LABEL)); // Add a tag
    columns.get(1).setTags(List.of(USER_ADDRESS_TAG_LABEL));                              // No change in tag
    columns.get(2).setTags(new ArrayList<>());                                            // Remove tag

    table = patchTableColumnAttributesAndCheck(table, columns, adminAuthHeaders());
    validateColumns(columns, table.getColumns());
  }

  @Test
  public void put_addDeleteFollower_200(TestInfo test) throws HttpResponseException {
    Table table = createAndCheckTable(create(test), adminAuthHeaders());

    // Add follower to the table
    User user1 = UserResourceTest.createUser(UserResourceTest.create(test, 1), userAuthHeaders());
    addAndCheckFollower(table, user1.getId(), CREATED, 1, userAuthHeaders());

    // Add the same user as follower and make sure no errors are thrown and return response is OK (and not CREATED)
    addAndCheckFollower(table, user1.getId(), OK, 1, userAuthHeaders());

    // Add a new follower to the table
    User user2 = UserResourceTest.createUser(UserResourceTest.create(test, 2), userAuthHeaders());
    addAndCheckFollower(table, user2.getId(), CREATED, 2, userAuthHeaders());

    // Delete followers and make sure they are deleted
    deleteAndCheckFollower(table, user1.getId(), 1, userAuthHeaders());
    deleteAndCheckFollower(table, user2.getId(), 0, userAuthHeaders());
  }

  @Test
  public void put_addDeleteInvalidFollower_200(TestInfo test) throws HttpResponseException {
    Table table = createAndCheckTable(create(test), adminAuthHeaders());

    // Add non existent user as follower to the table
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            addAndCheckFollower(table, NON_EXISTENT_ENTITY, CREATED, 1, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound("User", NON_EXISTENT_ENTITY));

    // Delete non existent user as follower to the table
    exception = assertThrows(HttpResponseException.class, () ->
            deleteAndCheckFollower(table, NON_EXISTENT_ENTITY, 1, adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound("User", NON_EXISTENT_ENTITY));
  }

  private Table patchTableAttributesAndCheck(Table table, String description, EntityReference owner,
                                             TableType tableType, List<TableConstraint> tableConstraints,
                                             List<TagLabel> tags, Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String tableJson = JsonUtils.pojoToJson(table);

    // Update the table attributes
    table.setDescription(description);
    table.setOwner(owner);
    table.setTableType(tableType);
    table.setTableConstraints(tableConstraints);
    table.setTags(tags);

    // Validate information returned in patch response has the updates
    Table updatedTable = patchTable(tableJson, table, authHeaders);
    validateTable(updatedTable, table.getDescription(), table.getColumns(), owner, null, tableType,
            tableConstraints, tags);

    // GET the table and Validate information returned
    Table getTable = getTable(table.getId(), "owner,tableConstraints,columns, tags", authHeaders);
    validateTable(getTable, table.getDescription(), table.getColumns(), owner, null, tableType, tableConstraints, tags);
    return updatedTable;
  }

  private Table patchTableColumnAttributesAndCheck(Table table, List<Column> columns, Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String tableJson = JsonUtils.pojoToJson(table);

    // Update the table attributes
    table.setColumns(columns);

    // Validate information returned in patch response has the updates
    return patchTable(tableJson, table, authHeaders);
  }

  // TODO disallow changing href, usage
  // TODO allow changing columns, tableConstraints
  // TODO Change column attributes
  // TODO Add column
  // TODO Remove column
  public static Table createAndCheckTable(CreateTable create, Map<String, String> authHeaders)
          throws HttpResponseException {
    // Validate table created has all the information set in create request
    Table table = createTable(create, authHeaders);
    validateTable(table, create.getDescription(), create.getColumns(), create.getOwner(),
            create.getDatabase(), create.getTableType(), create.getTableConstraints(), create.getTags());

    // GET table created and ensure it has all the information set in create request
    Table getTable = getTable(table.getId(), "columns,owner,database,tags,tableConstraints", authHeaders);
    validateTable(getTable, create.getDescription(), create.getColumns(), create.getOwner(),
            create.getDatabase(), create.getTableType(), create.getTableConstraints(), create.getTags());

    // If owner information is set, GET and make sure the user or team has the table in owns list
    checkOwnerOwns(create.getOwner(), table.getId(), true);
    return table;
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
      assertNull(table.getColumns());
    }
    if (fields.contains("tableConstraints")) {
      assertNotNull(table.getTableConstraints());
    } else {
      assertNull(table.getTableConstraints());
    }
    if (fields.contains("database")) {
      assertNotNull(table.getDatabase());
    } else {
      assertNull(table.getDatabase());
    }
    if (fields.contains("tags")) {
      assertNotNull(table.getTags());
    } else {
      assertNull(table.getTags());
    }
  }

  /** Validate returned fields GET .../tables/{id}?fields="..." or GET .../tables/name/{fqn}?fields="..." */
  private void validateGetWithDifferentFields(Table table, boolean byName) throws HttpResponseException {
    // GET .../tables/{id}
    table = byName ? getTableByName(table.getFullyQualifiedName(), null, adminAuthHeaders()) :
            getTable(table.getId(), adminAuthHeaders());
    assertFields(table, null);

    // GET .../tables/{id}?fields=columns,tableConstraints
    String fields = "columns,tableConstraints";
    table = byName ? getTableByName(table.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getTable(table.getId(), fields, adminAuthHeaders());
    assertFields(table, fields);

    // GET .../tables/{id}?fields=columns,usageSummary,owner,database,tags
    fields = "columns,usageSummary,owner,database,tags";
    table = byName ? getTableByName(table.getFullyQualifiedName(), fields, adminAuthHeaders()) :
            getTable(table.getId(), fields, adminAuthHeaders());
    assertEquals(table.getOwner().getId(), USER_OWNER1.getId());
    assertEquals(table.getOwner().getType(), USER_OWNER1.getType());
    assertEquals(table.getDatabase().getId(), DATABASE.getId());
    assertEquals(table.getDatabase().getName(), DATABASE.getName());
  }

  private static void validateTags(List<TagLabel> expectedList, List<TagLabel> actualList)
          throws HttpResponseException {
    if (expectedList == null) {
      return;
    }
    // When tags from the expected list is added to an entity, the derived tags for those tags are automatically added
    // So add to the expectedList, the derived tags before validating the tags
    List<TagLabel> updatedExpectedList = new ArrayList<>(expectedList);
    for (TagLabel expected : expectedList) {
      List<TagLabel> derived = EntityUtil.getDerivedTags(expected, TagResourceTest.getTag(expected.getTagFQN(),
              adminAuthHeaders()));
      updatedExpectedList.addAll(derived);
    }
    updatedExpectedList = updatedExpectedList.stream().distinct().collect(Collectors.toList());
    updatedExpectedList.sort(new TagLabelComparator());
    actualList.sort(new TagLabelComparator());

    assertEquals(updatedExpectedList.size(), actualList.size());
    for (int i = 0; i < actualList.size(); i++) {
      assertEquals(updatedExpectedList.get(i), actualList.get(i));
    }
  }

  public static Table createTable(CreateTable create, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(CatalogApplicationTest.getResource("tables"), create, Table.class, authHeaders);
  }

  private static void validateTable(Table table, String expectedDescription,
                                    List<Column> expectedColumns, EntityReference expectedOwner,
                                    UUID expectedDatabaseId, TableType expectedTableType,
                                    List<TableConstraint> expectedTableConstraints, List<TagLabel> expectedTags)
          throws HttpResponseException {
    assertNotNull(table.getId());
    assertNotNull(table.getHref());
    assertNotNull(table.getFullyQualifiedName());
    assertEquals(expectedDescription, table.getDescription());
    assertEquals(expectedTableType, table.getTableType());

    validateColumns(expectedColumns, table.getColumns());

    // Validate owner
    if (expectedOwner != null) {
      TestUtils.validateEntityReference(table.getOwner());
      assertEquals(expectedOwner.getId(), table.getOwner().getId());
      assertEquals(expectedOwner.getType(), table.getOwner().getType());
      assertNotNull(table.getOwner().getHref());
    }

    // Validate database
    if (expectedDatabaseId != null) {
      TestUtils.validateEntityReference(table.getDatabase());
      assertEquals(expectedDatabaseId, table.getDatabase().getId());
    }


    // Validate table constraints
    assertEquals(expectedTableConstraints, table.getTableConstraints());
    validateTags(expectedTags, table.getTags());
    TestUtils.validateEntityReference(table.getFollowers());
  }

  private static void validateColumn(Column expectedColumn, Column actualColumn) throws HttpResponseException {
    assertNotNull(actualColumn.getFullyQualifiedName());
    assertEquals(expectedColumn.getName(), actualColumn.getName());
    assertEquals(expectedColumn.getDataType(), actualColumn.getDataType());
    assertEquals(expectedColumn.getArrayDataType(), actualColumn.getArrayDataType());
    if (expectedColumn.getDataTypeDisplay() != null) {
      assertEquals(expectedColumn.getDataTypeDisplay().toLowerCase(Locale.ROOT), actualColumn.getDataTypeDisplay());
    }
    validateTags(expectedColumn.getTags(), actualColumn.getTags());

    // Check the nested columns
    validateColumns(expectedColumn.getChildren(), actualColumn.getChildren());
  }

  private static void validateColumns(List<Column> expectedColumns, List<Column> actualColumns) throws HttpResponseException {
    if (expectedColumns == null && actualColumns == null) {
      return;
    }
    // Sort columns by name
    expectedColumns.sort(new ColumnComparator());
    actualColumns.sort(new ColumnComparator());
    assertEquals(expectedColumns.size(), actualColumns.size());
    for (int i = 0; i < expectedColumns.size(); i++) {
      validateColumn(expectedColumns.get(i), actualColumns.get(i));
    }
  }

  public static Table getTable(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    return getTable(id, null, authHeaders);
  }

  public static Table getTable(UUID id, String fields, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("tables/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Table.class, authHeaders);
  }

  public static Table getTableByName(String fqn, String fields, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("tables/name/" + fqn);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Table.class, authHeaders);
  }

  public static TableList listTables(String fields, String databaseParam, Map<String, String> authHeaders)
          throws HttpResponseException {
    return listTables(fields, databaseParam, null, null, null, authHeaders);
  }

  public static TableList listTables(String fields, String databaseParam, Integer limit, String before, String after,
                                     Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("tables");
    target = fields != null ? target.queryParam("fields", fields) : target;
    target = databaseParam != null ? target.queryParam("database", databaseParam) : target;
    target = limit != null ? target.queryParam("limit", limit) : target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    return TestUtils.get(target, TableList.class, authHeaders);
  }

  public static CreateTable create(TestInfo test) {
    TableConstraint constraint = new TableConstraint().withConstraintType(ConstraintType.UNIQUE)
            .withColumns(List.of(COLUMNS.get(0).getName()));
    return new CreateTable().withName(getTableName(test)).withDatabase(DATABASE.getId()).withColumns(COLUMNS)
            .withTableConstraints(List.of(constraint));
  }

  public static CreateTable create(TestInfo test, int index) {
    TableConstraint constraint = new TableConstraint().withConstraintType(ConstraintType.UNIQUE)
            .withColumns(List.of(COLUMNS.get(0).getName()));
    return new CreateTable().withName(getTableName(test, index)).withDatabase(DATABASE.getId()).withColumns(COLUMNS)
            .withTableConstraints(List.of(constraint));
  }

  /**
   * A method variant to be called form other tests to create a table without depending on Database, DatabaseService
   * set up in the {@code setup()} method
   */
  public static Table createTable(TestInfo test, int index) throws HttpResponseException {
    DatabaseService service = createService(DatabaseServiceResourceTest.create(test), adminAuthHeaders());
    EntityReference serviceRef =
            new EntityReference().withName(service.getName()).withId(service.getId()).withType(Entity.DATABASE_SERVICE);
    Database database = createAndCheckDatabase(DatabaseResourceTest.create(test).withService(serviceRef),
            adminAuthHeaders());
    CreateTable create = new CreateTable().withName(getTableName(test, index))
            .withDatabase(database.getId()).withColumns(COLUMNS);
    return createTable(create, adminAuthHeaders());
  }

  public static Table updateAndCheckTable(CreateTable create, Status status, Map<String, String> authHeaders)
          throws HttpResponseException {
    Table updatedTable = updateTable(create, status, authHeaders);
    validateTable(updatedTable, create.getDescription(), create.getColumns(), create.getOwner(), create.getDatabase(),
            create.getTableType(), create.getTableConstraints(), create.getTags());

    // GET the newly updated database and validate
    Table getTable = getTable(updatedTable.getId(), "columns,database,owner,tableConstraints,tags", authHeaders);
    validateTable(getTable, create.getDescription(), create.getColumns(), create.getOwner(), create.getDatabase(),
            create.getTableType(), create.getTableConstraints(), create.getTags());
    // TODO columns check
    return updatedTable;
  }

  public static Table updateTable(CreateTable create, Status status, Map<String, String> authHeaders)
          throws HttpResponseException {
    return TestUtils.put(CatalogApplicationTest.getResource("tables"), create, Table.class,
            status, authHeaders);
  }

  public static void putJoins(UUID tableId, TableJoins joins, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("tables/" + tableId + "/joins");
    TestUtils.put(target, joins, OK, authHeaders);
  }

  public static void putSampleData(UUID tableId, TableData data, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("tables/" + tableId + "/sampleData");
    TestUtils.put(target, data, OK, authHeaders);
  }

  public static void putTableProfileData(UUID tableId, TableProfile data, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("tables/" + tableId + "/tableProfile");
    TestUtils.put(target, data, OK, authHeaders);
  }


  private void deleteTable(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(CatalogApplicationTest.getResource("tables/" + id), authHeaders);

    // Check to make sure database does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getTable(id, authHeaders));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.TABLE, id));
  }

  private Table patchTable(UUID tableId, String originalJson, Table updatedTable,
                           Map<String, String> authHeaders) throws JsonProcessingException, HttpResponseException {
    String updateTableJson = JsonUtils.pojoToJson(updatedTable);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updateTableJson);
    return TestUtils.patch(CatalogApplicationTest.getResource("tables/" + tableId),
            patch, Table.class, authHeaders);
  }

  private Table patchTable(String originalJson, Table updatedTable,
                           Map<String, String> authHeaders) throws JsonProcessingException, HttpResponseException {
    return patchTable(updatedTable.getId(), originalJson, updatedTable, authHeaders);
  }

  public static void addAndCheckFollower(Table table, UUID userId, Status status, int totalFollowerCount,
                                         Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource(String.format("tables/%s/followers", table.getId()));
    TestUtils.put(target, userId.toString(), status, authHeaders);

    // GET .../tables/{tableId} returns newly added follower
    Table getTable = getTable(table.getId(), "followers", authHeaders);
    assertEquals(totalFollowerCount, getTable.getFollowers().size());
    TestUtils.validateEntityReference(getTable.getFollowers());
    boolean followerFound = false;
    for (EntityReference followers : getTable.getFollowers()) {
      if (followers.getId().equals(userId)) {
        followerFound = true;
        break;
      }
    }
    assertTrue(followerFound, "Follower added was not found in table get response");

    // GET .../users/{userId} shows user as following table
    checkUserFollowing(userId, table.getId(), true, authHeaders);
  }

  private void deleteAndCheckFollower(Table table, UUID userId, int totalFollowerCount,
                                      Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource(String.format("tables/%s/followers/%s",
            table.getId(), userId));
    TestUtils.delete(target, authHeaders);

    Table getTable = checkFollowerDeleted(table.getId(), userId, authHeaders);
    assertEquals(totalFollowerCount, getTable.getFollowers().size());
  }

  public static Table checkFollowerDeleted(UUID tableId, UUID userId, Map<String, String> authHeaders)
          throws HttpResponseException {
    Table getTable = getTable(tableId, "followers", authHeaders);
    TestUtils.validateEntityReference(getTable.getFollowers());
    boolean followerFound = false;
    for (EntityReference followers : getTable.getFollowers()) {
      if (followers.getId().equals(userId)) {
        followerFound = true;
        break;
      }
    }
    assertFalse(followerFound, "Follower deleted is still found in table get response");

    // GET .../users/{userId} shows user as following table
    checkUserFollowing(userId, tableId, false, authHeaders);
    return getTable;
  }

  private static void checkOwnerOwns(EntityReference owner, UUID tableId, boolean expectedOwning)
          throws HttpResponseException {
    if (owner != null) {
      UUID ownerId = owner.getId();
      List<EntityReference> ownsList;
      if (owner.getType().equals(Entity.USER)) {
        User user = UserResourceTest.getUser(ownerId, "owns", adminAuthHeaders());
        ownsList = user.getOwns();
      } else if (owner.getType().equals(Entity.TEAM)) {
        Team team = TeamResourceTest.getTeam(ownerId, "owns", adminAuthHeaders());
        ownsList = team.getOwns();
      } else {
        throw new IllegalArgumentException("Invalid owner type " + owner.getType());
      }

      boolean owning = false;
      for (EntityReference owns : ownsList) {
        TestUtils.validateEntityReference(owns);
        if (owns.getId().equals(tableId)) {
          owning = true;
          break;
        }
      }
      assertEquals(expectedOwning, owning, "Ownership not correct in the owns list for " + owner.getType());
    }
  }

  private static void checkUserFollowing(UUID userId, UUID tableId, boolean expectedFollowing,
                                         Map<String, String> authHeaders) throws HttpResponseException {
    // GET .../users/{userId} shows user as following table
    boolean following = false;
    User user = UserResourceTest.getUser(userId, "follows", authHeaders);
    for (EntityReference follows : user.getFollows()) {
      TestUtils.validateEntityReference(follows);
      if (follows.getId().equals(tableId)) {
        following = true;
        break;
      }
    }
    assertEquals(expectedFollowing, following, "Follower list for the user is invalid");
  }

  private static int getTagUsageCount(String tagFQN, Map<String, String> authHeaders) throws HttpResponseException {
    return TagResourceTest.getTag(tagFQN, "usageCount", authHeaders).getUsageCount();
  }

  private static int getTagCategoryUsageCount(String name, Map<String, String> authHeaders)
          throws HttpResponseException {
    return TagResourceTest.getCategory(name, "usageCount", authHeaders).getUsageCount();
  }

  public static String getTableName(TestInfo test) {
    return String.format("table_%s", test.getDisplayName());
  }

  public static String getTableName(TestInfo test, int index) {
    return String.format("table%d_%s", index, test.getDisplayName());
  }

  private void verifyTableProfileData(List<TableProfile> actualProfiles, List<TableProfile> expectedProfiles) {
    assertEquals(actualProfiles.size(), expectedProfiles.size());
    Map<String, TableProfile> tableProfileMap = new HashMap<>();
    for(TableProfile profile: actualProfiles) {
      tableProfileMap.put(profile.getProfileDate(), profile);
    }
    for(TableProfile tableProfile: expectedProfiles) {
      TableProfile storedProfile = tableProfileMap.get(tableProfile.getProfileDate());
      assertNotNull(storedProfile);
      assertEquals(tableProfile, storedProfile);
    }
  }
}
