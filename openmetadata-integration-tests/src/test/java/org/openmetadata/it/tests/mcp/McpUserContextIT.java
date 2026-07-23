package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;

/**
 * Outcome-level coverage for the {@code get_user_context} MCP tool: identity projection from the
 * authenticated caller, the nested owners / flat followers search paths against a live index, the
 * governance gap filters, and the unrecognized-filter warning contract.
 */
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Execution(ExecutionMode.SAME_THREAD)
public class McpUserContextIT extends McpTestBase {

  private static final String TOOL_NAME = "get_user_context";
  private static final Duration INDEX_WAIT = Duration.ofSeconds(60);

  private static User adminUser;
  private static Table ownedTable;

  @BeforeAll
  static void setUp() throws Exception {
    initAuth();
    adminUser = get("users/loggedInUser", User.class);
    ownedTable = createOwnedTableWithoutDescription();
  }

  private static Table createOwnedTableWithoutDescription() throws Exception {
    String suffix = UUID.randomUUID().toString().substring(0, 8);
    DatabaseConnection connection =
        new DatabaseConnection()
            .withConfig(
                new MysqlConnection()
                    .withHostPort("localhost:3306")
                    .withUsername("test")
                    .withAuthType(new basicAuth().withPassword("test")));
    DatabaseService service =
        post(
            "services/databaseServices",
            new CreateDatabaseService()
                .withName("mcp_user_ctx_service_" + suffix)
                .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
                .withConnection(connection),
            DatabaseService.class);
    Database database =
        post(
            "databases",
            new CreateDatabase()
                .withName("mcp_user_ctx_db_" + suffix)
                .withService(service.getFullyQualifiedName()),
            Database.class);
    DatabaseSchema schema =
        post(
            "databaseSchemas",
            new CreateDatabaseSchema()
                .withName("mcp_user_ctx_schema")
                .withDatabase(database.getFullyQualifiedName()),
            DatabaseSchema.class);
    EntityReference adminRef =
        new EntityReference()
            .withId(adminUser.getId())
            .withType("user")
            .withName(adminUser.getName());
    return post(
        "tables",
        new CreateTable()
            .withName("mcp_user_ctx_table_" + suffix)
            .withDatabaseSchema(schema.getFullyQualifiedName())
            .withOwners(List.of(adminRef))
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT))),
        Table.class);
  }

  private JsonNode callUserContext(Map<String, Object> arguments) throws Exception {
    JsonNode response = executeMcpRequest(McpTestUtils.createToolCallRequest(TOOL_NAME, arguments));
    assertThat(response.has("result")).isTrue();
    return toolPayload(response.get("result"));
  }

  private JsonNode toolPayload(JsonNode result) throws Exception {
    JsonNode payload;
    if (result.has("structuredContent")) {
      payload = result.get("structuredContent");
    } else {
      payload = OBJECT_MAPPER.readTree(result.get("content").get(0).get("text").asText());
    }
    return payload;
  }

  private static List<String> fqns(JsonNode entityArray) {
    List<String> result = new ArrayList<>();
    if (entityArray != null && entityArray.isArray()) {
      entityArray.forEach(node -> result.add(node.path("fqn").asText()));
    }
    return result;
  }

  @Test
  @Order(1)
  void identityReflectsAuthenticatedCaller() throws Exception {
    JsonNode payload =
        callUserContext(Map.of("includeOwnedSummary", false, "includeFollowedSummary", false));

    JsonNode user = payload.get("user");
    assertThat(user.get("name").asText()).isEqualTo(adminUser.getName());
    assertThat(user.get("id").asText()).isEqualTo(adminUser.getId().toString());
    assertThat(user.get("isAdmin").asBoolean()).isTrue();
    assertThat(payload.has("owned")).isFalse();
    assertThat(payload.has("followed")).isFalse();
    assertThat(payload.get("roles").isArray()).isTrue();
    assertThat(payload.get("teams").isArray()).isTrue();
  }

  @Test
  @Order(2)
  void ownedSummaryFindsOwnedTableViaNestedOwnersQuery() {
    Awaitility.await("owned table should appear in the user context owned summary")
        .atMost(INDEX_WAIT)
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              JsonNode payload =
                  callUserContext(Map.of("includeFollowedSummary", false, "ownedLimit", 50));
              JsonNode owned = payload.get("owned");
              assertThat(owned.get("totalCount").asInt()).isGreaterThan(0);
              assertThat(owned.has("byTypeComplete")).isTrue();
              assertThat(fqns(owned.get("recent"))).contains(ownedTable.getFullyQualifiedName());
            });
  }

  @Test
  @Order(3)
  void gapFilterReturnsOwnedTableMissingDescription() {
    Awaitility.await("description-less owned table should match MISSING_DESCRIPTION")
        .atMost(INDEX_WAIT)
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              JsonNode payload =
                  callUserContext(
                      Map.of(
                          "includeFollowedSummary",
                          false,
                          "ownedLimit",
                          50,
                          "ownedFilter",
                          "MISSING_DESCRIPTION"));
              JsonNode owned = payload.get("owned");
              assertThat(fqns(owned.get("recent"))).contains(ownedTable.getFullyQualifiedName());
              assertThat(payload.has("warnings")).isFalse();
            });
  }

  @Test
  @Order(4)
  void unrecognizedOwnedFilterSurfacesWarningInsteadOfSilentDefault() throws Exception {
    Map<String, Object> arguments = new HashMap<>();
    arguments.put("includeFollowedSummary", false);
    arguments.put("ownedFilter", "MISSING_TIERS");
    JsonNode payload = callUserContext(arguments);

    assertThat(payload.has("warnings")).isTrue();
    assertThat(payload.get("warnings").get(0).asText()).contains("MISSING_TIERS");
    // Only the warnings contract is asserted here: owned counts depend on index latency and are
    // covered by the Awaitility-guarded tests above, so this test stays stable in isolation.
    assertThat(payload.has("owned")).isTrue();
  }

  @Test
  @Order(5)
  void followedSummaryFindsFollowedTableViaFollowersQuery() throws Exception {
    put(
        "tables/" + ownedTable.getId() + "/followers",
        adminUser.getId().toString(),
        JsonNode.class);

    Awaitility.await("followed table should appear in the user context followed summary")
        .atMost(INDEX_WAIT)
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              JsonNode payload =
                  callUserContext(Map.of("includeOwnedSummary", false, "followedLimit", 50));
              JsonNode followed = payload.get("followed");
              assertThat(followed.get("totalCount").asInt()).isGreaterThan(0);
              assertThat(fqns(followed.get("entities")))
                  .contains(ownedTable.getFullyQualifiedName());
            });
  }
}
