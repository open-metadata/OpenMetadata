package org.openmetadata.service.resources.feeds;

import static jakarta.ws.rs.core.Response.Status.BAD_REQUEST;
import static jakarta.ws.rs.core.Response.Status.CREATED;
import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static jakarta.ws.rs.core.Response.Status.NOT_FOUND;
import static java.util.Collections.singletonList;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.schema.type.ColumnDataType.INT;
import static org.openmetadata.schema.type.ColumnDataType.STRUCT;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.resources.EntityResourceTest.C1;
import static org.openmetadata.service.resources.EntityResourceTest.C2;
import static org.openmetadata.service.resources.EntityResourceTest.PERSONAL_DATA_TAG_LABEL;
import static org.openmetadata.service.resources.EntityResourceTest.PII_SENSITIVE_TAG_LABEL;
import static org.openmetadata.service.resources.EntityResourceTest.TIER1_TAG_LABEL;
import static org.openmetadata.service.resources.EntityResourceTest.TIER2_TAG_LABEL;
import static org.openmetadata.service.resources.EntityResourceTest.USER_ADDRESS_TAG_LABEL;
import static org.openmetadata.service.resources.databases.TableResourceTest.getColumn;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.feed.CreateSuggestion;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Suggestion;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.SuggestionStatus;
import org.openmetadata.schema.type.SuggestionType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.resources.databases.TableResource;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.teams.TeamResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.security.CatalogOpenIdAuthorizationRequestFilter;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class SuggestionsResourceTest extends OpenMetadataApplicationTest {
  public static Table TABLE;
  public static Table TABLE2;
  public static Table TABLE_NESTED;
  public static Table TABLE_DEEPLY_NESTED;

  public static Table TABLE_WITHOUT_OWNER;
  public static String TABLE_LINK;
  public static String TABLE2_LINK;
  public static String TABLE_WITHOUT_OWNER_LINK;
  public static String TABLE_COLUMN1_LINK;
  public static String TABLE_COLUMN2_LINK;
  public static String TABLE_NESTED_LINK;
  public static String TABLE_DEEPLY_NESTED_LINK;
  public static List<Column> COLUMNS;
  public static User USER;
  public static String USER_LINK;
  public static Map<String, String> USER_AUTH_HEADERS;
  public static User USER2;
  public static Map<String, String> USER2_AUTH_HEADERS;
  public static Team TEAM;
  public static Team TEAM2;
  public static String TEAM_LINK;

  public static TableResourceTest TABLE_RESOURCE_TEST;

  @BeforeAll
  public void setup(TestInfo test) throws IOException, URISyntaxException {
    TABLE_RESOURCE_TEST = new TableResourceTest();
    TABLE_RESOURCE_TEST.setup(test); // Initialize TableResourceTest for using helper methods

    UserResourceTest userResourceTest = new UserResourceTest();
    USER2 =
        userResourceTest.createEntity(userResourceTest.createRequest(test, 4), ADMIN_AUTH_HEADERS);
    USER2_AUTH_HEADERS = authHeaders(USER2.getName());

    CreateTable createTable =
        TABLE_RESOURCE_TEST.createRequest(test).withOwners(List.of(TableResourceTest.USER1_REF));
    TABLE = TABLE_RESOURCE_TEST.createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);

    TeamResourceTest teamResourceTest = new TeamResourceTest();
    CreateTeam createTeam =
        teamResourceTest
            .createRequest(test, 4)
            .withDisplayName("Team2")
            .withDescription("Team2 description")
            .withUsers(List.of(USER2.getId()));
    TEAM2 = teamResourceTest.createAndCheckEntity(createTeam, ADMIN_AUTH_HEADERS);
    EntityReference TEAM2_REF = TEAM2.getEntityReference();

    CreateTable createTable2 = TABLE_RESOURCE_TEST.createRequest(test);
    createTable2.withName("table2").withOwners(List.of(TEAM2_REF));
    TABLE2 = TABLE_RESOURCE_TEST.createAndCheckEntity(createTable2, ADMIN_AUTH_HEADERS);

    CreateTable createTable3 = TABLE_RESOURCE_TEST.createRequest(test);
    createTable3.withName("table_without_owner").withOwners(null);
    TABLE_WITHOUT_OWNER =
        TABLE_RESOURCE_TEST.createAndCheckEntity(createTable3, ADMIN_AUTH_HEADERS);

    Column c2_c_d = getColumn("d", INT, USER_ADDRESS_TAG_LABEL);
    Column c2_c =
        getColumn("c", STRUCT, USER_ADDRESS_TAG_LABEL)
            .withChildren(new ArrayList<>(singletonList(c2_c_d)));

    CreateTable createTableNested =
        TABLE_RESOURCE_TEST
            .createRequest(test)
            .withColumns(new ArrayList<>(singletonList(c2_c)))
            .withName("table_with_nested_suggestion")
            .withTableConstraints(null);

    TABLE_NESTED = TABLE_RESOURCE_TEST.createAndCheckEntity(createTableNested, ADMIN_AUTH_HEADERS);
    TABLE_NESTED_LINK =
        String.format("<#E::table::%s::columns::c.d>", TABLE_NESTED.getFullyQualifiedName());

    // Create deeply nested table with 4 levels: level1 -> level2 -> level3 -> level4
    Column level4 = getColumn("level4", INT, USER_ADDRESS_TAG_LABEL);
    Column level3 =
        getColumn("level3", STRUCT, USER_ADDRESS_TAG_LABEL)
            .withChildren(new ArrayList<>(singletonList(level4)));
    Column level2 =
        getColumn("level2", STRUCT, USER_ADDRESS_TAG_LABEL)
            .withChildren(new ArrayList<>(singletonList(level3)));
    Column level1 =
        getColumn("level1", STRUCT, USER_ADDRESS_TAG_LABEL)
            .withChildren(new ArrayList<>(singletonList(level2)));

    CreateTable createTableDeeplyNested =
        TABLE_RESOURCE_TEST
            .createRequest(test)
            .withColumns(new ArrayList<>(singletonList(level1)))
            .withName("table_with_deeply_nested_suggestion")
            .withTableConstraints(null);

    TABLE_DEEPLY_NESTED =
        TABLE_RESOURCE_TEST.createAndCheckEntity(createTableDeeplyNested, ADMIN_AUTH_HEADERS);
    TABLE_DEEPLY_NESTED_LINK =
        String.format(
            "<#E::table::%s::columns::level1.level2.level3.level4>",
            TABLE_DEEPLY_NESTED.getFullyQualifiedName());

    COLUMNS =
        Collections.singletonList(
            new Column().withName("column1").withDataType(ColumnDataType.BIGINT));
    TABLE_LINK = String.format("<#E::table::%s>", TABLE.getFullyQualifiedName());
    TABLE2_LINK = String.format("<#E::table::%s>", TABLE2.getFullyQualifiedName());
    TABLE_WITHOUT_OWNER_LINK =
        String.format("<#E::table::%s>", TABLE_WITHOUT_OWNER.getFullyQualifiedName());
    TABLE_COLUMN1_LINK =
        String.format("<#E::table::%s::columns::" + C1 + ">", TABLE.getFullyQualifiedName());
    TABLE_COLUMN2_LINK =
        String.format("<#E::table::%s::columns::" + C2 + ">", TABLE.getFullyQualifiedName());

    USER = TableResourceTest.USER1;
    USER_LINK = String.format("<#E::user::%s>", USER.getFullyQualifiedName());
    USER_AUTH_HEADERS = authHeaders(USER.getName());

    TEAM = TableResourceTest.TEAM1;
    TEAM_LINK = String.format("<#E::team::%s>", TEAM.getFullyQualifiedName());
  }

  @Test
  void post_suggestionWithoutEntityLink_4xx() {
    // Create thread without addressed to entity in the request
    CreateSuggestion create = create().withEntityLink(null);
    assertResponse(
        () -> createSuggestion(create, USER_AUTH_HEADERS),
        BAD_REQUEST,
        "Suggestion's entityLink cannot be null.");
  }

  @Test
  void post_suggestionWithInvalidAbout_4xx() {
    // Create Suggestion without addressed to entity in the request
    CreateSuggestion create = create().withEntityLink("<>"); // Invalid EntityLink

    String failureReason =
        "[entityLink must match \"(?U)^<#E::\\w+::(?:[^:<>|]|:[^:<>|])+(?:::(?:[^:<>|]|:[^:<>|])+)*>$\"]";
    assertResponseContains(
        () -> createSuggestion(create, USER_AUTH_HEADERS), BAD_REQUEST, failureReason);

    create.withEntityLink("<#E::>"); // Invalid EntityLink - missing entityType and entityId
    assertResponseContains(
        () -> createSuggestion(create, USER_AUTH_HEADERS), BAD_REQUEST, failureReason);

    create.withEntityLink("<#E::table::>"); // Invalid EntityLink - missing entityId
    assertResponseContains(
        () -> createSuggestion(create, USER_AUTH_HEADERS), BAD_REQUEST, failureReason);

    create.withEntityLink(
        "<#E::table::tableName"); // Invalid EntityLink - missing closing bracket ">"
    assertResponseContains(
        () -> createSuggestion(create, USER_AUTH_HEADERS), BAD_REQUEST, failureReason);
  }

  @Test
  void post_suggestionWithoutDescriptionOrTags_4xx() {
    CreateSuggestion create = create().withDescription(null);
    assertResponseContains(
        () -> createSuggestion(create, USER_AUTH_HEADERS),
        BAD_REQUEST,
        "Suggestion's description cannot be empty");
  }

  @Test
  void post_feedWithNonExistentEntity_404() {
    CreateSuggestion create = create().withEntityLink("<#E::table::invalidTableName>");
    assertResponse(
        () -> createSuggestion(create, USER_AUTH_HEADERS),
        NOT_FOUND,
        entityNotFound(Entity.TABLE, "invalidTableName"));
  }

  @Test
  void post_validSuggestionAndList_200(TestInfo test) throws IOException {
    CreateSuggestion create = create();
    Suggestion suggestion = createSuggestion(create, USER_AUTH_HEADERS);
    Assertions.assertEquals(create.getEntityLink(), suggestion.getEntityLink());
    create = create().withEntityLink(TABLE_LINK);
    int suggestionCount = 1;
    for (int i = 0; i < 10; i++) {
      createAndCheck(create, USER_AUTH_HEADERS);
      // List all the threads and make sure the number of threads increased by 1
      assertEquals(
          ++suggestionCount,
          listSuggestions(TABLE.getFullyQualifiedName(), null, null, null, USER_AUTH_HEADERS)
              .getPaging()
              .getTotal());
    }
    SuggestionsResource.SuggestionList suggestionList =
        listSuggestions(TABLE.getFullyQualifiedName(), null, null, null, USER_AUTH_HEADERS);
    assertEquals(suggestionCount, suggestionList.getPaging().getTotal());
    assertEquals(10, suggestionList.getData().size());
    suggestionList =
        listSuggestions(
            TABLE.getFullyQualifiedName(),
            10,
            null,
            suggestionList.getPaging().getAfter(),
            USER_AUTH_HEADERS);
    assertEquals(1, suggestionList.getData().size());
    suggestionList =
        listSuggestions(
            TABLE.getFullyQualifiedName(),
            null,
            suggestionList.getPaging().getBefore(),
            null,
            USER_AUTH_HEADERS);
    assertEquals(10, suggestionList.getData().size());
    create = create().withEntityLink(TABLE_COLUMN1_LINK);
    createAndCheck(create, USER2_AUTH_HEADERS);
    create = create().withEntityLink(TABLE_COLUMN2_LINK);
    createAndCheck(create, USER2_AUTH_HEADERS);
    assertEquals(
        suggestionCount + 2,
        listSuggestions(TABLE.getFullyQualifiedName(), null, null, null, USER_AUTH_HEADERS)
            .getPaging()
            .getTotal());
    create = create().withEntityLink(TABLE2_LINK);
    createAndCheck(create, USER_AUTH_HEADERS);
    assertEquals(
        suggestionCount + 2,
        listSuggestions(TABLE.getFullyQualifiedName(), null, null, null, USER_AUTH_HEADERS)
            .getPaging()
            .getTotal());
    assertEquals(
        1,
        listSuggestions(TABLE2.getFullyQualifiedName(), null, null, null, USER_AUTH_HEADERS)
            .getPaging()
            .getTotal());
    suggestionList =
        listSuggestions(
            TABLE.getFullyQualifiedName(),
            null,
            USER_AUTH_HEADERS,
            USER2.getId(),
            null,
            null,
            null,
            null);
    assertEquals(2, suggestionList.getPaging().getTotal());
    assertNull(suggestionList.getPaging().getBefore());
    assertNull(suggestionList.getPaging().getAfter());
    create = create().withEntityLink(TABLE_WITHOUT_OWNER_LINK);
    createAndCheck(create, USER_AUTH_HEADERS);
    assertEquals(
        1,
        listSuggestions(
                TABLE_WITHOUT_OWNER.getFullyQualifiedName(), null, null, null, USER_AUTH_HEADERS)
            .getPaging()
            .getTotal());
    /*  deleteSuggestions("table", TABLE.getFullyQualifiedName(), USER_AUTH_HEADERS);
    assertEquals(
        0,
        listSuggestions(TABLE.getFullyQualifiedName(), null, USER_AUTH_HEADERS).getPaging().getTotal());
    deleteSuggestions("table", TABLE2.getFullyQualifiedName(), USER_AUTH_HEADERS);
    assertEquals(
        0,
        listSuggestions(TABLE2.getFullyQualifiedName(), null, USER_AUTH_HEADERS).getPaging().getTotal());*/
  }

  @Test
  void put_updateSuggestion_200(TestInfo test) throws IOException {
    CreateSuggestion create = create();
    Suggestion suggestion = createSuggestion(create, USER_AUTH_HEADERS);
    Assertions.assertEquals(create.getEntityLink(), suggestion.getEntityLink());
    suggestion.setDescription("updated description");
    updateSuggestion(suggestion.getId(), suggestion, USER_AUTH_HEADERS);
    Suggestion updatedSuggestion = getSuggestion(suggestion.getId(), USER_AUTH_HEADERS);
    assertEquals(suggestion.getId(), updatedSuggestion.getId());
    assertEquals(suggestion.getDescription(), updatedSuggestion.getDescription());
    updatedSuggestion.setDescription("updated description with different user");
    assertResponse(
        () -> updateSuggestion(updatedSuggestion.getId(), updatedSuggestion, USER2_AUTH_HEADERS),
        FORBIDDEN,
        CatalogExceptionMessage.taskOperationNotAllowed(USER2.getName(), "Update"));
  }

  @Test
  @Order(1)
  void put_acceptSuggestion_200(TestInfo test) throws IOException {
    CreateSuggestion create = create();
    Suggestion suggestion = createSuggestion(create, USER_AUTH_HEADERS);
    Assertions.assertEquals(create.getEntityLink(), suggestion.getEntityLink());
    acceptSuggestion(suggestion.getId(), USER_AUTH_HEADERS);
    TableResourceTest tableResourceTest = new TableResourceTest();
    Table table = tableResourceTest.getEntity(TABLE.getId(), "", USER_AUTH_HEADERS);
    assertEquals(suggestion.getDescription(), table.getDescription());
    suggestion = getSuggestion(suggestion.getId(), USER_AUTH_HEADERS);
    assertEquals(SuggestionStatus.Accepted, suggestion.getStatus());
    create = createTagSuggestion();
    Suggestion suggestion1 = createSuggestion(create, USER_AUTH_HEADERS);
    Assertions.assertEquals(create.getEntityLink(), suggestion.getEntityLink());
    assertResponse(
        () -> acceptSuggestion(suggestion1.getId(), USER2_AUTH_HEADERS),
        FORBIDDEN,
        CatalogExceptionMessage.taskOperationNotAllowed(USER2.getName(), "Accepted"));

    acceptSuggestion(suggestion1.getId(), USER_AUTH_HEADERS);
    table = tableResourceTest.getEntity(TABLE.getId(), "tags", USER_AUTH_HEADERS);
    List<TagLabel> expectedTags = new ArrayList<>(table.getTags());
    expectedTags.addAll(suggestion1.getTagLabels());
    validateAppliedTags(expectedTags, table.getTags());

    create = createTagSuggestion().withEntityLink(TABLE_COLUMN1_LINK);
    Suggestion suggestion2 = createSuggestion(create, USER_AUTH_HEADERS);
    acceptSuggestion(suggestion2.getId(), USER_AUTH_HEADERS);
    table = tableResourceTest.getEntity(TABLE.getId(), "columns,tags", USER_AUTH_HEADERS);
    Column column = null;
    for (Column col : table.getColumns()) {
      if (col.getName().equals(C1)) {
        column = col;
      }
    }
    if (column != null) {
      expectedTags = new ArrayList<>(column.getTags());
      expectedTags.addAll(suggestion2.getTagLabels());
      validateAppliedTags(expectedTags, column.getTags());
    }
    String description = "Table without owner";
    create = create().withEntityLink(TABLE_WITHOUT_OWNER_LINK).withDescription(description);
    Suggestion suggestion3 = createSuggestion(create, USER_AUTH_HEADERS);
    acceptSuggestion(suggestion3.getId(), USER2_AUTH_HEADERS);
    table = tableResourceTest.getEntity(TABLE_WITHOUT_OWNER.getId(), "", USER_AUTH_HEADERS);
    assertEquals(description, table.getDescription());
  }

  @Test
  @Order(2)
  void put_rejectSuggestion_200(TestInfo test) throws IOException {
    CreateSuggestion create = create();
    Suggestion suggestion = createSuggestion(create, USER_AUTH_HEADERS);
    Assertions.assertEquals(create.getEntityLink(), suggestion.getEntityLink());
    assertEquals(
        1,
        listSuggestions(TABLE.getFullyQualifiedName(), null, null, null, USER_AUTH_HEADERS)
            .getPaging()
            .getTotal());
    rejectSuggestion(suggestion.getId(), USER_AUTH_HEADERS);
    suggestion = getSuggestion(suggestion.getId(), USER_AUTH_HEADERS);
    assertEquals(SuggestionStatus.Rejected, suggestion.getStatus());
    CreateSuggestion create1 = create().withEntityLink(TABLE2_LINK);
    final Suggestion suggestion1 = createSuggestion(create1, USER2_AUTH_HEADERS);
    Assertions.assertEquals(create1.getEntityLink(), suggestion1.getEntityLink());
    assertEquals(
        1,
        listSuggestions(TABLE2.getFullyQualifiedName(), null, null, null, USER_AUTH_HEADERS)
            .getPaging()
            .getTotal());
    assertResponse(
        () -> rejectSuggestion(suggestion1.getId(), USER_AUTH_HEADERS),
        FORBIDDEN,
        CatalogExceptionMessage.taskOperationNotAllowed(USER.getName(), "Rejected"));
    rejectSuggestion(suggestion1.getId(), USER2_AUTH_HEADERS);
    Suggestion suggestion2 = getSuggestion(suggestion1.getId(), USER2_AUTH_HEADERS);
    assertEquals(SuggestionStatus.Rejected, suggestion2.getStatus());
  }

  @Test
  @Order(3)
  void put_acceptAllSuggestions_200() throws IOException {
    CreateSuggestion create = create().withEntityLink(TABLE_LINK);
    createAndCheck(create, USER_AUTH_HEADERS);
    // Add another suggestion
    createAndCheck(create, USER_AUTH_HEADERS);
    // And now update tags
    create = createTagSuggestion().withEntityLink(TABLE_LINK);
    createAndCheck(create, USER_AUTH_HEADERS);

    SuggestionsResource.SuggestionList suggestionList =
        listSuggestions(TABLE.getFullyQualifiedName(), null, null, null, USER_AUTH_HEADERS);
    assertEquals(3, suggestionList.getData().size());

    acceptAllSuggestions(
        TABLE.getFullyQualifiedName(),
        USER.getId(),
        SuggestionType.SuggestDescription,
        USER_AUTH_HEADERS);

    suggestionList =
        listSuggestions(
            TABLE.getFullyQualifiedName(),
            null,
            USER_AUTH_HEADERS,
            null,
            null,
            SuggestionStatus.Open.toString(),
            null,
            null);
    // We still have the tag suggestion open, since we only accepted the descriptions
    assertEquals(1, suggestionList.getPaging().getTotal());

    // Now we accept the pending one
    acceptAllSuggestions(
        TABLE.getFullyQualifiedName(),
        USER.getId(),
        SuggestionType.SuggestTagLabel,
        USER_AUTH_HEADERS);

    suggestionList =
        listSuggestions(
            TABLE.getFullyQualifiedName(),
            null,
            USER_AUTH_HEADERS,
            null,
            null,
            SuggestionStatus.Open.toString(),
            null,
            null);
    assertEquals(0, suggestionList.getPaging().getTotal());
  }

  @Test
  @Order(4)
  void put_rejectAllSuggestions_200() throws IOException {
    CreateSuggestion create = create().withEntityLink(TABLE_LINK);
    createAndCheck(create, USER_AUTH_HEADERS);
    // Add another suggestion
    createAndCheck(create, USER_AUTH_HEADERS);
    // And now update tags
    create = createTagSuggestion().withEntityLink(TABLE_LINK);
    createAndCheck(create, USER_AUTH_HEADERS);

    SuggestionsResource.SuggestionList suggestionList =
        listSuggestions(TABLE.getFullyQualifiedName(), null, null, null, USER_AUTH_HEADERS);
    assertEquals(3, suggestionList.getData().size());

    rejectAllSuggestions(
        TABLE.getFullyQualifiedName(),
        USER.getId(),
        SuggestionType.SuggestDescription,
        USER_AUTH_HEADERS);

    suggestionList =
        listSuggestions(
            TABLE.getFullyQualifiedName(),
            null,
            USER_AUTH_HEADERS,
            null,
            null,
            SuggestionStatus.Open.toString(),
            null,
            null);
    assertEquals(1, suggestionList.getPaging().getTotal());

    // Now we reject the pending one
    rejectAllSuggestions(
        TABLE.getFullyQualifiedName(),
        USER.getId(),
        SuggestionType.SuggestTagLabel,
        USER_AUTH_HEADERS);

    suggestionList =
        listSuggestions(
            TABLE.getFullyQualifiedName(),
            null,
            USER_AUTH_HEADERS,
            null,
            null,
            SuggestionStatus.Open.toString(),
            null,
            null);
    assertEquals(0, suggestionList.getPaging().getTotal());
  }

  @Test
  @Order(5)
  void put_acceptAllColumnSuggestions_200() throws IOException {
    CreateSuggestion create = create().withEntityLink(TABLE_LINK);
    createAndCheck(create, USER_AUTH_HEADERS);
    // Add another suggestion at one column level
    create =
        create().withEntityLink(TABLE_COLUMN1_LINK).withDescription("Update column1 description");
    createAndCheck(create, USER_AUTH_HEADERS);
    // And now update another column description
    create =
        create().withEntityLink(TABLE_COLUMN2_LINK).withDescription("Update column2 description");
    createAndCheck(create, USER_AUTH_HEADERS);

    SuggestionsResource.SuggestionList suggestionList =
        listSuggestions(TABLE.getFullyQualifiedName(), null, null, null, USER_AUTH_HEADERS);
    assertEquals(3, suggestionList.getData().size());

    acceptAllSuggestions(
        TABLE.getFullyQualifiedName(),
        USER.getId(),
        SuggestionType.SuggestDescription,
        USER_AUTH_HEADERS);

    suggestionList =
        listSuggestions(
            TABLE.getFullyQualifiedName(),
            null,
            USER_AUTH_HEADERS,
            null,
            null,
            SuggestionStatus.Open.toString(),
            null,
            null);
    assertEquals(0, suggestionList.getPaging().getTotal());

    TableResourceTest tableResourceTest = new TableResourceTest();
    Table table = tableResourceTest.getEntity(TABLE.getId(), "columns", USER_AUTH_HEADERS);
    for (Column column : table.getColumns()) {
      if (column.getName().equals(C1)) {
        assertEquals("Update column1 description", column.getDescription());
      } else if (column.getName().equals(C2)) {
        assertEquals("Update column2 description", column.getDescription());
      }
    }
  }

  @Test
  @Order(6)
  void put_acceptSuggestion_mutuallyExclusiveTags_200(TestInfo test) throws IOException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    CreateTable createTable = tableResourceTest.createRequest(test);
    Table table = tableResourceTest.createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);
    MessageParser.EntityLink entityLink =
        new MessageParser.EntityLink(Entity.TABLE, table.getFullyQualifiedName());

    CreateSuggestion create = createTierSuggestion(TIER1_TAG_LABEL, entityLink);
    Suggestion suggestion = createSuggestion(create, USER_AUTH_HEADERS);
    Assertions.assertEquals(create.getEntityLink(), suggestion.getEntityLink());

    // When accepting the suggestion, we'll get the Tier1 tag applied to the table
    acceptSuggestion(suggestion.getId(), USER_AUTH_HEADERS);
    table = tableResourceTest.getEntity(table.getId(), "tags", USER_AUTH_HEADERS);
    List<TagLabel> expectedTags = new ArrayList<>(table.getTags());
    expectedTags.addAll(suggestion.getTagLabels());
    validateAppliedTags(expectedTags, table.getTags());

    // Not, let's try to apply the Tier2 tag, which is mutually exclusive with the Tier1 tag
    // The table should then only have the Tier2
    create = createTierSuggestion(TIER2_TAG_LABEL, entityLink);
    suggestion = createSuggestion(create, USER_AUTH_HEADERS);
    acceptSuggestion(suggestion.getId(), USER_AUTH_HEADERS);
    table = tableResourceTest.getEntity(table.getId(), "tags", USER_AUTH_HEADERS);
    expectedTags = new ArrayList<>(table.getTags());
    expectedTags.addAll(suggestion.getTagLabels());
    validateAppliedTags(expectedTags, table.getTags());
  }

  @Test
  @Order(7)
  void put_acceptSuggestionNested_200(TestInfo test) throws IOException {
    CreateSuggestion create = create().withEntityLink(TABLE_NESTED_LINK);
    Suggestion suggestion = createSuggestion(create, USER_AUTH_HEADERS);
    Assertions.assertEquals(create.getEntityLink(), suggestion.getEntityLink());

    // When accepting the suggestion, the nested column column1.column2 should have the Updated
    // Description
    acceptSuggestion(suggestion.getId(), USER_AUTH_HEADERS);
    TableResourceTest tableResourceTest = new TableResourceTest();
    Table table = tableResourceTest.getEntity(TABLE_NESTED.getId(), "columns", USER_AUTH_HEADERS);
    Column nestedColumn = table.getColumns().get(0).getChildren().get(0);
    assertEquals("Update description", nestedColumn.getDescription());
  }

  @Test
  @Order(8)
  void put_acceptSuggestionDeeplyNested_200(TestInfo test) throws IOException {
    CreateSuggestion create = create().withEntityLink(TABLE_DEEPLY_NESTED_LINK);
    Suggestion suggestion = createSuggestion(create, USER_AUTH_HEADERS);
    Assertions.assertEquals(create.getEntityLink(), suggestion.getEntityLink());

    // When accepting the suggestion, the deeply nested column level1.level2.level3.level4 should
    // have the Updated Description
    acceptSuggestion(suggestion.getId(), USER_AUTH_HEADERS);
    TableResourceTest tableResourceTest = new TableResourceTest();
    Table table =
        tableResourceTest.getEntity(TABLE_DEEPLY_NESTED.getId(), "columns", USER_AUTH_HEADERS);

    // Navigate through the 4 levels: level1 -> level2 -> level3 -> level4
    Column level1 = table.getColumns().get(0);
    Column level2 = level1.getChildren().get(0);
    Column level3 = level2.getChildren().get(0);
    Column level4 = level3.getChildren().get(0);

    assertEquals("Update description", level4.getDescription());
  }

  @Test
  @Order(9)
  void put_acceptAllColumnSuggestionsManyColumns_200(TestInfo test) throws IOException {

    List<Column> columns = new ArrayList<>();
    for (int i = 1; i <= 100; i++) {
      Column column = getColumn("column" + i, ColumnDataType.STRING, null).withOrdinalPosition(i);
      columns.add(column);
      if (i == 100) {
        column.setTags(List.of(PII_SENSITIVE_TAG_LABEL));
      }
    }

    CreateTable createTable =
        TABLE_RESOURCE_TEST
            .createRequest(test)
            .withOwners(List.of(TableResourceTest.USER1_REF))
            .withColumns(columns)
            .withTableConstraints(null);
    Table table = TABLE_RESOURCE_TEST.createAndCheckEntity(createTable, ADMIN_AUTH_HEADERS);

    String tableColumn50Link =
        String.format("<#E::table::%s::columns::column50>", table.getFullyQualifiedName());
    String tableColumn100Link =
        String.format("<#E::table::%s::columns::column100>", table.getFullyQualifiedName());

    CreateSuggestion create =
        create().withEntityLink(tableColumn50Link).withDescription("Update column 50 description");
    createAndCheck(create, USER_AUTH_HEADERS);

    // And now update another column tags
    create =
        create()
            .withEntityLink(tableColumn100Link)
            .withTagLabels(List.of(PERSONAL_DATA_TAG_LABEL))
            .withType(SuggestionType.SuggestTagLabel);
    createAndCheck(create, USER_AUTH_HEADERS);

    SuggestionsResource.SuggestionList suggestionList =
        listSuggestions(table.getFullyQualifiedName(), null, null, null, USER_AUTH_HEADERS);
    assertEquals(2, suggestionList.getData().size());

    acceptAllSuggestions(
        table.getFullyQualifiedName(),
        USER.getId(),
        SuggestionType.SuggestDescription,
        USER_AUTH_HEADERS);

    acceptAllSuggestions(
        table.getFullyQualifiedName(),
        USER.getId(),
        SuggestionType.SuggestTagLabel,
        USER_AUTH_HEADERS);

    suggestionList =
        listSuggestions(
            table.getFullyQualifiedName(),
            null,
            USER_AUTH_HEADERS,
            null,
            null,
            SuggestionStatus.Open.toString(),
            null,
            null);
    assertEquals(0, suggestionList.getPaging().getTotal());

    // fetch all columns
    WebTarget target =
        getResource("tables/" + table.getId() + "/columns")
            .queryParam("limit", "200")
            .queryParam("fields", "tags");
    TableResource.TableColumnList response =
        TestUtils.get(target, TableResource.TableColumnList.class, ADMIN_AUTH_HEADERS);
    assertEquals(100, response.getData().size());
    assertEquals(100, response.getPaging().getTotal());

    for (Column column : response.getData()) {
      if (column.getName().equals("column50")) {
        assertEquals("Update column 50 description", column.getDescription());
      } else if (column.getName().equals("column100")) {
        assertEquals(List.of(PII_SENSITIVE_TAG_LABEL, PERSONAL_DATA_TAG_LABEL), column.getTags());
      }
    }
  }

  public Suggestion createSuggestion(CreateSuggestion create, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.post(getResource("suggestions"), create, Suggestion.class, authHeaders);
  }

  public void updateSuggestion(UUID id, Suggestion update, Map<String, String> authHeaders)
      throws HttpResponseException {
    TestUtils.put(getResource("suggestions/" + id), update, CREATED, authHeaders);
  }

  public CreateSuggestion create() {
    return new CreateSuggestion()
        .withDescription("Update description")
        .withType(SuggestionType.SuggestDescription)
        .withEntityLink(TABLE_LINK);
  }

  public CreateSuggestion createTagSuggestion() {
    return new CreateSuggestion()
        .withTagLabels(List.of(PII_SENSITIVE_TAG_LABEL, PERSONAL_DATA_TAG_LABEL))
        .withType(SuggestionType.SuggestTagLabel)
        .withEntityLink(TABLE_LINK);
  }

  public CreateSuggestion createTierSuggestion(TagLabel tier, MessageParser.EntityLink entityLink) {
    return new CreateSuggestion()
        .withTagLabels(List.of(tier))
        .withType(SuggestionType.SuggestTagLabel)
        .withEntityLink(entityLink.getLinkString());
  }

  public Suggestion getSuggestion(UUID id, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("suggestions/" + id);
    return TestUtils.get(target, Suggestion.class, authHeaders);
  }

  public void acceptSuggestion(UUID id, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("suggestions/" + id + "/accept");
    TestUtils.put(target, null, Response.Status.OK, authHeaders);
  }

  public void rejectSuggestion(UUID id, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("suggestions/" + id + "/reject");
    TestUtils.put(target, null, Response.Status.OK, authHeaders);
  }

  public void deleteSuggestions(
      String entityType, String entityFQN, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target =
        getResource("suggestions/" + entityType + "/name/" + URLEncoder.encode(entityFQN));
    TestUtils.delete(target, authHeaders);
  }

  public SuggestionsResource.SuggestionList listSuggestions(
      String entityFQN,
      Integer limit,
      Map<String, String> authHeaders,
      UUID userId,
      String suggestionType,
      String status,
      String before,
      String after)
      throws HttpResponseException {
    WebTarget target = getResource("suggestions");
    target = entityFQN != null ? target.queryParam("entityFQN", entityFQN) : target;
    target = userId != null ? target.queryParam("userId", userId) : target;
    target = suggestionType != null ? target.queryParam("suggestionType", suggestionType) : target;
    target = status != null ? target.queryParam("status", status) : target;
    target = before != null ? target.queryParam("before", before) : target;
    target = after != null ? target.queryParam("after", after) : target;
    target = limit != null ? target.queryParam("limit", limit) : target;
    return TestUtils.get(target, SuggestionsResource.SuggestionList.class, authHeaders);
  }

  public SuggestionsResource.SuggestionList listSuggestions(
      String entityFQN, Integer limit, String before, String after, Map<String, String> authHeaders)
      throws HttpResponseException {
    return listSuggestions(entityFQN, limit, authHeaders, null, null, null, before, after);
  }

  public void acceptAllSuggestions(
      String entityFQN, UUID userId, SuggestionType suggestionType, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("suggestions/accept-all");
    target = entityFQN != null ? target.queryParam("entityFQN", entityFQN) : target;
    target = userId != null ? target.queryParam("userId", userId) : target;
    target =
        suggestionType != null
            ? target.queryParam("suggestionType", suggestionType.toString())
            : target;
    TestUtils.put(target, null, Response.Status.OK, authHeaders);
  }

  public void rejectAllSuggestions(
      String entityFQN, UUID userId, SuggestionType suggestionType, Map<String, String> authHeaders)
      throws HttpResponseException {
    WebTarget target = getResource("suggestions/reject-all");
    target = entityFQN != null ? target.queryParam("entityFQN", entityFQN) : target;
    target = userId != null ? target.queryParam("userId", userId) : target;
    target =
        suggestionType != null
            ? target.queryParam("suggestionType", suggestionType.toString())
            : target;
    TestUtils.put(target, null, Response.Status.OK, authHeaders);
  }

  public Suggestion createAndCheck(CreateSuggestion create, Map<String, String> authHeaders)
      throws HttpResponseException {
    // Validate returned thread from POST
    Suggestion suggestion = createSuggestion(create, authHeaders);
    validateSuggestion(
        suggestion,
        create.getEntityLink(),
        authHeaders.get(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER),
        create.getType(),
        create.getDescription(),
        create.getTagLabels());

    // Validate returned thread again from GET
    Suggestion getSuggestion = getSuggestion(suggestion.getId(), authHeaders);
    validateSuggestion(
        getSuggestion,
        create.getEntityLink(),
        authHeaders.get(CatalogOpenIdAuthorizationRequestFilter.X_AUTH_PARAMS_EMAIL_HEADER),
        create.getType(),
        create.getDescription(),
        create.getTagLabels());
    return suggestion;
  }

  private void validateSuggestion(
      Suggestion suggestion,
      String entityLink,
      String createdBy,
      SuggestionType type,
      String description,
      List<TagLabel> tags) {
    assertNotNull(suggestion.getId());
    assertEquals(entityLink, suggestion.getEntityLink());
    assertEquals(createdBy, suggestion.getCreatedBy().getName());
    assertEquals(type, suggestion.getType());
    assertEquals(tags, suggestion.getTagLabels());
    assertEquals(description, suggestion.getDescription());
  }

  private void validateAppliedTags(List<TagLabel> appliedTags, List<TagLabel> entityTags) {
    for (TagLabel tagLabel : appliedTags) {
      Assertions.assertTrue(entityTags.contains(tagLabel));
    }
  }
}
