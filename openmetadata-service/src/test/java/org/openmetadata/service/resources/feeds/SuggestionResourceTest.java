package org.openmetadata.service.resources.feeds;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.resources.EntityResourceTest.C1;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.NON_EXISTENT_ENTITY;
import static org.openmetadata.service.util.TestUtils.assertResponse;
import static org.openmetadata.service.util.TestUtils.assertResponseContains;

import java.io.IOException;
import java.net.URISyntaxException;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.feed.CreateSuggestion;
import org.openmetadata.schema.api.feed.CreateThread;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.feed.Suggestion;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.SuggestionType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.teams.TeamResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class SuggestionResourceTest extends OpenMetadataApplicationTest {
  public static Table TABLE;
  public static Table TABLE2;
  public static String TABLE_LINK;
  public static String TABLE_COLUMN_LINK;
  public static String TABLE_DESCRIPTION_LINK;
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
        TABLE_RESOURCE_TEST.createRequest(test).withOwner(TableResourceTest.USER1_REF);
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
    createTable2.withName("table2").withOwner(TEAM2_REF);
    TABLE2 = TABLE_RESOURCE_TEST.createAndCheckEntity(createTable2, ADMIN_AUTH_HEADERS);

    COLUMNS =
        Collections.singletonList(
            new Column().withName("column1").withDataType(ColumnDataType.BIGINT));
    TABLE_LINK = String.format("<#E::table::%s>", TABLE.getFullyQualifiedName());
    TABLE_COLUMN_LINK =
        String.format(
            "<#E::table::%s::columns::" + C1 + "::description>", TABLE.getFullyQualifiedName());
    TABLE_DESCRIPTION_LINK =
        String.format("<#E::table::%s::description>", TABLE.getFullyQualifiedName());

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
        () -> createSuggestion(create, USER_AUTH_HEADERS), BAD_REQUEST, "Suggestion's entityLink cannot be null.");
  }

  @Test
  void post_suggestionWithInvalidAbout_4xx() {
    // Create Suggestion without addressed to entity in the request
    CreateSuggestion create = create().withEntityLink("<>"); // Invalid EntityLink

    String failureReason = "[entityLink must match \"(?U)^<#E::\\w+::[\\w'\\- .&/:+\"\\\\()$#%]+>$\"]";
    assertResponseContains(
        () -> createSuggestion(create, USER_AUTH_HEADERS), BAD_REQUEST, failureReason);

    create.withEntityLink("<#E::>"); // Invalid EntityLink - missing entityType and entityId
    assertResponseContains(
        () -> createSuggestion(create, USER_AUTH_HEADERS), BAD_REQUEST, failureReason);

    create.withEntityLink("<#E::table::>"); // Invalid EntityLink - missing entityId
    assertResponseContains(
        () -> createSuggestion(create, USER_AUTH_HEADERS), BAD_REQUEST, failureReason);

    create.withEntityLink("<#E::table::tableName"); // Invalid EntityLink - missing closing bracket ">"
    assertResponseContains(
        () -> createSuggestion(create, USER_AUTH_HEADERS), BAD_REQUEST, failureReason);
  }

  @Test
  void post_suggestionWithoutDescriptionOrTags_4xx() {
    CreateSuggestion create = create().withDescription(null);
    assertResponseContains(
        () -> createSuggestion(create, USER_AUTH_HEADERS), BAD_REQUEST, "Suggestion's description cannot be empty");
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
  }

  public Suggestion createSuggestion(CreateSuggestion create, Map<String, String> authHeaders)
      throws HttpResponseException {
    return TestUtils.post(getResource("suggestions"), create, Suggestion.class, authHeaders);
  }

  public CreateSuggestion create() {
    String entityLink = String.format("<#E::%s::%s>", Entity.TABLE, TABLE.getFullyQualifiedName());
    return new CreateSuggestion()
        .withDescription("Update description")
        .withType(SuggestionType.SuggestDescription)
        .withEntityLink(entityLink);
  }
}
