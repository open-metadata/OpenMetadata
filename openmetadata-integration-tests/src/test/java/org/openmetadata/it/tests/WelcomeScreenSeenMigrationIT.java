package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.openmetadata.it.tests.MetricMigrationSqlFixture.currentConnectionType;
import static org.openmetadata.it.tests.MetricMigrationSqlFixture.readMigrationScripts;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * The 2.1.0 migration marks the first-login welcome screen as seen for every user who signed in or
 * was active before the upgrade. Runs the shipped statement against a copy of the user table, twice,
 * to prove it backfills the right users and is idempotent.
 */
@Isolated("executes the shipped 2.1.0 migration statement against the shared database")
class WelcomeScreenSeenMigrationIT {
  private static final String USER_TABLE = "user_entity";
  private static final String FIELD = "welcomeScreenSeenAt";

  @Test
  void migrationMarksReturningUsersAsHavingSeenTheWelcomeScreen() throws Exception {
    ConnectionType connectionType = currentConnectionType();
    List<String> statements = welcomeScreenStatements(connectionType);
    assertEquals(1, statements.size(), "one user-table backfill");
    String userTable =
        "it_welcome_seen_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    Jdbi jdbi = TestSuiteBootstrap.getJdbi();
    try {
      jdbi.useHandle(
          handle -> {
            createFixture(handle, userTable, connectionType);
            String fixtureStatement =
                statements.getFirst().replace("UPDATE " + USER_TABLE, "UPDATE " + userTable);
            handle.execute(fixtureStatement);
            handle.execute(fixtureStatement);
            assertUsers(readJson(handle, userTable));
          });
    } finally {
      jdbi.useHandle(handle -> handle.execute("DROP TABLE IF EXISTS " + userTable));
    }
  }

  private static List<String> welcomeScreenStatements(ConnectionType connectionType)
      throws Exception {
    return readMigrationScripts(connectionType).postStatements().stream()
        .filter(statement -> statement.contains("UPDATE " + USER_TABLE))
        .filter(statement -> statement.contains(FIELD))
        .toList();
  }

  private static void createFixture(Handle handle, String table, ConnectionType connectionType) {
    handle.execute(
        connectionType == ConnectionType.MYSQL
            ? "CREATE TABLE "
                + table
                + " (id VARCHAR(36) PRIMARY KEY, json JSON,"
                + " lastLoginTime BIGINT UNSIGNED GENERATED ALWAYS AS"
                + " (json_unquote(json_extract(json, '$.lastLoginTime'))) VIRTUAL,"
                + " lastActivityTime BIGINT UNSIGNED GENERATED ALWAYS AS"
                + " (json_unquote(json_extract(json, '$.lastActivityTime'))) VIRTUAL)"
            : "CREATE TABLE "
                + table
                + " (id VARCHAR(36) PRIMARY KEY, json JSONB,"
                + " lastLoginTime BIGINT GENERATED ALWAYS AS"
                + " ((json->>'lastLoginTime')::bigint) STORED,"
                + " lastActivityTime BIGINT GENERATED ALWAYS AS"
                + " ((json->>'lastActivityTime')::bigint) STORED)");
    insert(handle, table, connectionType, "loggedIn", "{\"lastLoginTime\":100}");
    insert(handle, table, connectionType, "activeOnly", "{\"lastActivityTime\":200}");
    insert(
        handle, table, connectionType, "both", "{\"lastLoginTime\":300,\"lastActivityTime\":400}");
    insert(handle, table, connectionType, "neverSeen", "{\"name\":\"neverSeen\"}");
    insert(
        handle,
        table,
        connectionType,
        "alreadySeen",
        "{\"lastLoginTime\":500,\"" + FIELD + "\":7}");
  }

  private static void insert(
      Handle handle, String table, ConnectionType connectionType, String id, String json) {
    String jsonValue = connectionType == ConnectionType.MYSQL ? ":json" : "CAST(:json AS JSONB)";
    handle
        .createUpdate("INSERT INTO " + table + " (id, json) VALUES (:id, " + jsonValue + ")")
        .bind("id", id)
        .bind("json", json)
        .execute();
  }

  private static Map<String, JsonNode> readJson(Handle handle, String table) {
    return handle.createQuery("SELECT id, json FROM " + table).mapToMap().list().stream()
        .collect(
            Collectors.toMap(
                row -> row.get("id").toString(),
                row -> JsonUtils.readTree(row.get("json").toString())));
  }

  private static void assertUsers(Map<String, JsonNode> users) {
    assertEquals(100, seenAt(users, "loggedIn"));
    assertEquals(200, seenAt(users, "activeOnly"), "an SSO user with only activity is backfilled");
    assertEquals(300, seenAt(users, "both"), "the login time wins over activity");
    assertFalse(users.get("neverSeen").has(FIELD), "a user who never signed in still sees it");
    assertEquals(7, seenAt(users, "alreadySeen"), "an existing value is left alone");
  }

  private static long seenAt(Map<String, JsonNode> users, String id) {
    return users.get(id).path(FIELD).asLong();
  }
}
