package org.openmetadata.catalog.resources.databases;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.SecureCatalogApplicationTest;
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
import org.openmetadata.catalog.jdbi3.TableRepository;
import org.openmetadata.catalog.resources.databases.TableResource.TableList;
import org.openmetadata.catalog.resources.services.SecureDatabaseServiceResourceTest;
import org.openmetadata.catalog.resources.tags.SecureTagResourceTest;
import org.openmetadata.catalog.resources.teams.SecureTeamResourceTest;
import org.openmetadata.catalog.resources.teams.SecureUserResourceTest;
import org.openmetadata.catalog.resources.teams.TeamResourceTest;
import org.openmetadata.catalog.resources.teams.UserResourceTest;
import org.openmetadata.catalog.type.Column;
import org.openmetadata.catalog.type.ColumnDataType;
import org.openmetadata.catalog.type.ColumnJoin;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.JoinedWith;
import org.openmetadata.catalog.type.TableData;
import org.openmetadata.catalog.type.TableType;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.TestUtils;
import org.openmetadata.common.utils.JsonSchemaUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import javax.ws.rs.client.WebTarget;
import javax.ws.rs.core.Response.Status;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static java.util.Collections.singletonList;
import static javax.ws.rs.core.Response.Status.*;
import static org.junit.jupiter.api.Assertions.*;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class SecureTableResourceTest extends SecureCatalogApplicationTest {
  private static final Logger LOG = LoggerFactory.getLogger(TableRepository.class);
  public static Database DATABASE;
  public static final TagLabel USER_ADDRESS_TAG_LABEL = new TagLabel().withTagFQN("User.Address");
  public static final TagLabel USER_BANK_ACCOUNT_TAG_LABEL = new TagLabel().withTagFQN("User.BankAccount");

  public static List<Column> COLUMNS =
          Arrays.asList(new Column().withName("c1").withColumnDataType(ColumnDataType.BIGINT).withTags(singletonList(USER_ADDRESS_TAG_LABEL)),
          new Column().withName("c2").withColumnDataType(ColumnDataType.BIGINT).withTags(singletonList(USER_ADDRESS_TAG_LABEL)),
          new Column().withName("c3").withColumnDataType(ColumnDataType.BIGINT).withTags(singletonList(USER_BANK_ACCOUNT_TAG_LABEL)));

  public static User USER1;
  public static EntityReference USER_OWNER1;
  public static Team TEAM1;
  public static EntityReference TEAM_OWNER1;
  public static EntityReference SNOWFLAKE_REFERENCE;

  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException {
    CreateDatabaseService createSnowflake = new CreateDatabaseService().withName(SecureDatabaseServiceResourceTest.getName(test, 1))
            .withServiceType(DatabaseServiceType.Snowflake).withJdbc(TestUtils.JDBC_INFO);
    DatabaseService service = SecureDatabaseServiceResourceTest.createService(createSnowflake, TestUtils.adminAuthHeaders());
    SNOWFLAKE_REFERENCE = new EntityReference().withName(service.getName()).withId(service.getId())
            .withType(Entity.DATABASE_SERVICE);

    CreateDatabase create = SecureDatabaseResourceTest.create(test).withService(SNOWFLAKE_REFERENCE);
    DATABASE = SecureDatabaseResourceTest.createAndCheckDatabase(create, TestUtils.adminAuthHeaders());

    USER1 = SecureUserResourceTest.createUser(UserResourceTest.create(test), TestUtils.authHeaders("test@getcollate.io"));
    USER_OWNER1 = new EntityReference().withId(USER1.getId()).withType("user");

    TEAM1 = SecureTeamResourceTest.createTeam(TeamResourceTest.create(test), TestUtils.adminAuthHeaders());
    TEAM_OWNER1 = new EntityReference().withId(TEAM1.getId()).withType("team");
  }

  @Test
  public void post_validTables_200_OK(TestInfo test) throws HttpResponseException {
    // Create table with different optional fields
    // Optional field description
    CreateTable create = create(test).withDescription("description");
    createAndCheckTable(create, TestUtils.adminAuthHeaders());

    // Optional fields tableType
    create.withName(getTableName(test, 1)).withTableType(TableType.View);
    createAndCheckTable(create, TestUtils.adminAuthHeaders());
  }

  @Test
  public void post_tableWithUserOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckTable(create(test).withOwner(USER_OWNER1), TestUtils.adminAuthHeaders());
  }

  @Test
  public void post_tableWithTeamOwner_200_ok(TestInfo test) throws HttpResponseException {
    createAndCheckTable(create(test).withOwner(TEAM_OWNER1), TestUtils.adminAuthHeaders());
  }

    @Test
  public void post_table_as_non_admin_401(TestInfo test) {
    CreateTable create = create(test);
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> createTable(create,
            TestUtils.authHeaders("test@getcollate.com")));
      TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void put_tableUpdateWithNoChange_200(TestInfo test) throws HttpResponseException {
    CreateTable request = create(test).withOwner(USER_OWNER1);
    createAndCheckTable(request, TestUtils.adminAuthHeaders());

    // Update table two times successfully with PUT requests
    updateAndCheckTable(request, OK, TestUtils.adminAuthHeaders());
    updateAndCheckTable(request, OK, TestUtils.adminAuthHeaders());
  }

  @Test
  public void put_tableCreate_200(TestInfo test) throws HttpResponseException {
    // Create a new table with put
    CreateTable request = create(test).withOwner(USER_OWNER1);
    updateAndCheckTable(request.withName("newName").withDescription(null), CREATED, TestUtils.adminAuthHeaders());
  }

  @Test
  public void put_tableOwnershipUpdate_200(TestInfo test) throws HttpResponseException {
    CreateTable request = create(test).withOwner(USER_OWNER1).withDescription("description");
    Table table = createAndCheckTable(request, TestUtils.adminAuthHeaders());
    checkOwnerOwns(USER_OWNER1, table.getId(), true);

    // Change ownership from USER_OWNER1 to TEAM_OWNER1
    updateAndCheckTable(request.withOwner(TEAM_OWNER1), OK, TestUtils.adminAuthHeaders());
    checkOwnerOwns(USER_OWNER1, table.getId(), false);
    checkOwnerOwns(TEAM_OWNER1, table.getId(), true);

    // Remove ownership
    table = updateAndCheckTable(request.withOwner(null), OK, TestUtils.adminAuthHeaders());
    assertNull(table.getOwner());
    checkOwnerOwns(TEAM_OWNER1, table.getId(), false);
  }

  @Test
  public void put_updateColumns_200(TestInfo test) throws HttpResponseException {
    int tagCategoryUsageCount = getTagCategoryUsageCount("user", TestUtils.userAuthHeaders());
    int addressTagUsageCount = getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), TestUtils.userAuthHeaders());
    int bankTagUsageCount = getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), TestUtils.userAuthHeaders());

    //
    // Create a table with column c1, type BIGINT, description c1 and tag USER_ADDRESS_TAB_LABEL
    //
    List<TagLabel> tags = new ArrayList<>(Arrays.asList(USER_ADDRESS_TAG_LABEL));
    List<Column> columns = singletonList(new Column().withName("c1").withColumnDataType(ColumnDataType.BIGINT)
            .withOrdinalPosition(1).withDescription("c1").withTags(tags));
    CreateTable request = create(test).withColumns(columns);
    Table table = createAndCheckTable(request, TestUtils.adminAuthHeaders());
    columns.get(0).setFullyQualifiedName(table.getFullyQualifiedName() + ".c1");

    // Ensure tag category and tag usage counts are updated
    assertEquals(tagCategoryUsageCount + 1, getTagCategoryUsageCount("user", TestUtils.userAuthHeaders()));
    assertEquals(addressTagUsageCount + 1, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(),
            TestUtils.authHeaders("test@getcollate.com")));
    assertEquals(bankTagUsageCount, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), TestUtils.userAuthHeaders()));

    //
    // Update the c1 with additional tag USER_BANK_ACCOUNT_TAG_LABEL
    // Ensure description and previous tag is carried forward during update
    //
    tags.add(USER_BANK_ACCOUNT_TAG_LABEL);
    List<Column> updatedColumns = new ArrayList<>();
    updatedColumns.add(new Column().withName("c1").withColumnDataType(ColumnDataType.BIGINT).withTags(tags).withOrdinalPosition(1));
    table = updateAndCheckTable(request.withColumns(updatedColumns), OK, TestUtils.adminAuthHeaders());

    // Ensure tag usage counts are updated
    assertEquals(tagCategoryUsageCount + 2, getTagCategoryUsageCount("user", TestUtils.userAuthHeaders()));
    assertEquals(addressTagUsageCount + 1, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), TestUtils.userAuthHeaders()));
    assertEquals(bankTagUsageCount + 1, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), TestUtils.userAuthHeaders()));

    //
    // Add a new column and make sure it is added by PUT
    //
    updatedColumns.add(new Column().withName("c2").withColumnDataType(ColumnDataType.BINARY).withOrdinalPosition(2)
            .withFullyQualifiedName(table.getFullyQualifiedName() + ".c2").withTags(tags));
    table = updateAndCheckTable(request.withColumns(updatedColumns), OK, TestUtils.adminAuthHeaders());
    assertEquals(2, table.getColumns().size());

    // Ensure tag usage counts are updated - column c2 added both address and bank tags
    assertEquals(tagCategoryUsageCount + 4, getTagCategoryUsageCount("user", TestUtils.userAuthHeaders()));
    assertEquals(addressTagUsageCount + 2, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), TestUtils.userAuthHeaders()));
    assertEquals(bankTagUsageCount + 2, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), TestUtils.userAuthHeaders()));

    //
    // Remove a column c2 and make sure it is deleted by PUT
    //
    updatedColumns.remove(1);
    table = updateAndCheckTable(request.withColumns(updatedColumns), OK, TestUtils.adminAuthHeaders());
    assertEquals(1, table.getColumns().size());


    // Ensure tag usage counts are updated to reflect removal of column c2
    assertEquals(tagCategoryUsageCount + 2, getTagCategoryUsageCount("user", TestUtils.userAuthHeaders()));
    assertEquals(addressTagUsageCount + 1, getTagUsageCount(USER_ADDRESS_TAG_LABEL.getTagFQN(), TestUtils.userAuthHeaders()));
    assertEquals(bankTagUsageCount + 1, getTagUsageCount(USER_BANK_ACCOUNT_TAG_LABEL.getTagFQN(), TestUtils.userAuthHeaders()));
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
  public void delete_table_200_ok(TestInfo test) throws HttpResponseException {
    Table table = createTable(create(test), TestUtils.adminAuthHeaders());
    deleteTable(table.getId(), TestUtils.adminAuthHeaders());
  }

  @Test
  public void delete_table_as_non_admin_401(TestInfo test) throws HttpResponseException {
    Table table = createTable(create(test), TestUtils.adminAuthHeaders());
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            deleteTable(table.getId(), TestUtils.authHeaders("test@getcollate.io")));
    TestUtils.assertResponse(exception, FORBIDDEN, "Principal: CatalogPrincipal{name='test'} is not admin");
  }

  @Test
  public void patch_tableAttributes_200_ok(TestInfo test) throws HttpResponseException, JsonProcessingException {
    // Create table without description, tier, owner, tableType
    Table table = createTable(create(test), TestUtils.adminAuthHeaders());
    assertNull(table.getDescription());
    assertNull(table.getOwner());
    assertNull(table.getTableType());
    assertNull(table.getTableConstraints());

    // Add description, tier, owner, and tableType when previously they were null
    table = patchTableAttributesAndCheck(table, "description", TEAM_OWNER1, TableType.Regular,
            TestUtils.adminAuthHeaders());
    table.setOwner(TEAM_OWNER1); // Get rid of href and name returned in the response for owner

    // Replace description, tier, owner, tableType
    table = patchTableAttributesAndCheck(table, "description1", USER_OWNER1, TableType.External, TestUtils.adminAuthHeaders());
    table.setOwner(USER_OWNER1); // Get rid of href and name returned in the response for owner

    // Remove description, tier, owner, tableType
    patchTableAttributesAndCheck(table, null, null, null, TestUtils.adminAuthHeaders());
  }

  @Test
  public void put_addDeleteFollower_200(TestInfo test) throws HttpResponseException {
    Table table = createAndCheckTable(create(test), TestUtils.adminAuthHeaders());

    // Add follower to the table
    User user1 = SecureUserResourceTest.createUser(SecureUserResourceTest.create(test, 1), TestUtils.userAuthHeaders());
    addAndCheckFollower(table, user1.getId(), CREATED, 1, TestUtils.userAuthHeaders());

    // Add the same user as follower and make sure no errors are thrown and return response is OK (and not CREATED)
    addAndCheckFollower(table, user1.getId(), OK, 1, TestUtils.userAuthHeaders());

    // Add a new follower to the table
    User user2 = SecureUserResourceTest.createUser(SecureUserResourceTest.create(test, 2), TestUtils.userAuthHeaders());
    addAndCheckFollower(table, user2.getId(), CREATED, 2, TestUtils.userAuthHeaders());

    // Delete followers and make sure they are deleted
    deleteAndCheckFollower(table, user1.getId(), 1, TestUtils.userAuthHeaders());
    deleteAndCheckFollower(table, user2.getId(), 0, TestUtils.userAuthHeaders());
  }

  private Table patchTableAttributesAndCheck(Table table, String description,
                                             EntityReference owner, TableType tableType, Map<String, String> authHeaders)
          throws JsonProcessingException, HttpResponseException {
    String tableJson = JsonUtils.pojoToJson(table);

    // Update the table attributes
    table.setDescription(description);
    table.setOwner(owner);
    table.setTableType(tableType);

    // Validate information returned in patch response has the updates
    Table updatedTable = patchTable(tableJson, table, authHeaders);
    validateTable(updatedTable, table.getDescription(), owner, null, tableType);

    // GET the table and Validate information returned
    Table getTable = getTable(table.getId(), "owner", authHeaders);
    validateTable(getTable, table.getDescription(), owner, null, tableType);
    return updatedTable;
  }

  // TODO disallow changing href, usage
  // TODO allow changing columns, tableConstraints
  // TODO Change column attributes
  // TODO Add column
  // TODO Remove column
  public static Table createAndCheckTable(CreateTable create, Map<String, String> authHeaders) throws HttpResponseException {
    // Validate table created has all the information set in create request
    Table table = createTable(create, authHeaders);
    validateTable(table, create.getDescription(), create.getOwner(),
            create.getDatabase(), create.getTableType());

    // GET table created and ensure it has all the information set in create request
    Table getTable = getTable(table.getId(), "owner,database,tags", authHeaders);
    validateTable(getTable, create.getDescription(), create.getOwner(),
            create.getDatabase(), create.getTableType());

    // If owner information is set, GET and make sure the user or team has the table in owns list
    checkOwnerOwns(create.getOwner(), table.getId(), true);
    return table;
  }

  public static Table createTable(CreateTable create, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.post(SecureCatalogApplicationTest.getResource("tables"), create, Table.class, authHeaders);
  }

  private static void validateTable(Table table, String expectedDescription, EntityReference expectedOwner,
                                    UUID expectedDatabaseId, TableType expectedTableType) {
    assertNotNull(table.getId());
    assertNotNull(table.getHref());
    assertEquals(expectedDescription, table.getDescription());
    Assertions.assertEquals(expectedTableType, table.getTableType());

    // Validate owner
    if (expectedOwner != null) {
      TestUtils.validateEntityReference(table.getOwner());
      Assertions.assertEquals(expectedOwner.getId(), table.getOwner().getId());
      Assertions.assertEquals(expectedOwner.getType(), table.getOwner().getType());
      assertNotNull(table.getOwner().getHref());
    }

    // Validate database
    if (expectedDatabaseId != null) {
      TestUtils.validateEntityReference(table.getDatabase());
      Assertions.assertEquals(expectedDatabaseId, table.getDatabase().getId());
    }
    TestUtils.validateEntityReference(table.getFollowers());
  }

  public static Table getTable(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    return getTable(id, null, authHeaders);
  }

  public static Table getTable(UUID id, String fields, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = SecureCatalogApplicationTest.getResource("tables/" + id);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Table.class, authHeaders);
  }

  public static Table getTableByName(String fqn, String fields, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = SecureCatalogApplicationTest.getResource("tables/name/" + fqn);
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, Table.class, authHeaders);
  }

  public static TableList getTables(String fields, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = SecureCatalogApplicationTest.getResource("tables");
    target = fields != null ? target.queryParam("fields", fields) : target;
    return TestUtils.get(target, TableList.class, authHeaders);
  }

  public static CreateTable create(TestInfo test) {
    return new CreateTable().withName(getTableName(test)).withDatabase(DATABASE.getId()).withColumns(COLUMNS);
  }

  public static CreateTable create(TestInfo test, int index) {
    return new CreateTable().withName(getTableName(test, index)).withDatabase(DATABASE.getId()).withColumns(COLUMNS);
  }

  public static Table updateAndCheckTable(CreateTable create, Status status, Map<String, String> authHeaders) throws HttpResponseException {
    Table updatedTable = updateTable(create, status, authHeaders);
    validateTable(updatedTable, create.getDescription(), create.getOwner(), create.getDatabase(), create.getTableType());

    // GET the newly updated database and validate
    Table getTable = getTable(updatedTable.getId(), "database,owner", authHeaders);
    validateTable(getTable, create.getDescription(), create.getOwner(), create.getDatabase(), create.getTableType());
    // TODO columns check
    return updatedTable;
  }

  public static Table updateTable(CreateTable create, Status status, Map<String, String> authHeaders) throws HttpResponseException {
    return TestUtils.put(SecureCatalogApplicationTest.getResource("tables"), create, Table.class, status, authHeaders);
  }


  public static void putSampleData(UUID tableId, TableData data, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = SecureCatalogApplicationTest.getResource("tables/" + tableId + "/sampleData");
    TestUtils.put(target, data, OK);
  }

  private void deleteTable(UUID id, Map<String, String> authHeaders) throws HttpResponseException {
    TestUtils.delete(SecureCatalogApplicationTest.getResource("tables/" + id), authHeaders);

    // Check to make sure database does not exist
    HttpResponseException exception = assertThrows(HttpResponseException.class, () -> getTable(id, authHeaders));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.TABLE, id));
  }

  private Table patchTable(UUID tableId, String originalJson, Table updatedTable,
                           Map<String, String> authHeaders) throws JsonProcessingException, HttpResponseException {
    String updateTableJson = JsonUtils.pojoToJson(updatedTable);
    JsonPatch patch = JsonSchemaUtil.getJsonPatch(originalJson, updateTableJson);
    return TestUtils.patch(SecureCatalogApplicationTest.getResource("tables/" + tableId), patch, Table.class, authHeaders);
  }

  private Table patchTable(String originalJson, Table updatedTable,
                           Map<String, String> authHeaders) throws JsonProcessingException, HttpResponseException {
    return patchTable(updatedTable.getId(), originalJson, updatedTable, authHeaders);
  }

  public static void addAndCheckFollower(Table table, UUID userId, Status status, int totalFollowerCount, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = SecureCatalogApplicationTest.getResource(String.format("tables/%s/followers", table.getId()));
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

  private void deleteAndCheckFollower(Table table, UUID userId, int totalFollowerCount, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = SecureCatalogApplicationTest.getResource(String.format("tables/%s/followers/%s", table.getId(), userId));
    TestUtils.delete(target, authHeaders);

    Table getTable = checkFollowerDeleted(table.getId(), userId, authHeaders);
    assertEquals(totalFollowerCount, getTable.getFollowers().size());
  }

  public static Table checkFollowerDeleted(UUID tableId, UUID userId, Map<String, String> authHeaders) throws HttpResponseException {
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

  private static void checkOwnerOwns(EntityReference owner, UUID tableId, boolean expectedOwning) throws HttpResponseException {
    if (owner != null) {
      UUID ownerId = owner.getId();
      List<EntityReference> ownsList;
      if (owner.getType().equals(Entity.USER)) {
        User user = SecureUserResourceTest.getUser(ownerId, "owns", TestUtils.adminAuthHeaders());
        ownsList = user.getOwns();
      } else if (owner.getType().equals(Entity.TEAM)) {
        Team team = SecureTeamResourceTest.getTeam(ownerId, "owns", TestUtils.adminAuthHeaders());
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

  private static void checkUserFollowing(UUID userId, UUID tableId, boolean expectedFollowing, Map<String, String> authHeaders) throws HttpResponseException {
    // GET .../users/{userId} shows user as following table
    boolean following = false;
    User user = SecureUserResourceTest.getUser(userId, "follows", authHeaders);
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
    return SecureTagResourceTest.getTag(tagFQN, "usageCount", authHeaders).getUsageCount();
  }

  private static int getTagCategoryUsageCount(String name, Map<String, String> authHeaders) throws HttpResponseException {
    return SecureTagResourceTest.getCategory(name, "usageCount", authHeaders).getUsageCount();
  }

  public static String getTableName(TestInfo test) {
    return String.format("table_%s", test.getDisplayName());
  }

  public static String getTableName(TestInfo test, int index) {
    return String.format("table%d_%s", index, test.getDisplayName());
  }
}
