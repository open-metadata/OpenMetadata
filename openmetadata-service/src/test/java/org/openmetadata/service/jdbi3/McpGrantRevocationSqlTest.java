/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.migration.utils.v208.McpConsentColumns;
import org.openmetadata.service.migration.utils.v208.McpGrantUserNameIndexes;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Ends a deleted user's MCP grants on the shipped tables: every grant under the name goes, whatever
 * its casing, and no other user's refresh token is locked meanwhile. On MySQL the revoke once
 * scanned and locked every user's tokens, and a refresh by anyone else deadlocked against it. The
 * deleted user holds many rotated tokens, as one who refreshes often does: against a plain
 * user-name index that made the revoked index the cheaper plan again. The MySQL user-name indexes
 * come from the 2.0.8 Java migration step, run twice to show a rerun is harmless.
 */
@Testcontainers(disabledWithoutDocker = true)
@Execution(ExecutionMode.SAME_THREAD)
class McpGrantRevocationSqlTest {
  private static final String DATABASE = "mcp_grants";
  private static final String PASSWORD = "mcp-grants-test";
  private static final String MYSQL = "mysql";
  private static final List<String> MIGRATIONS = List.of("1.12.4", "2.0.8");
  private static final String CLIENT = "client-1";
  // Grants written before they used the account's own name may hold the provider's spelling.
  private static final String DELETED_USER = "alice";
  private static final String DELETED_USER_AS_STORED = "Alice";
  private static final String OTHER_USER = "bob";
  private static final long LATER = 1_600_000L;
  private static final int ROTATED_TOKENS = 50;
  private static final int MORE_USERS = 5;

  @Test
  void deletingAUserEndsOnlyItsGrantsOnMysql() throws IOException {
    try (GenericContainer<?> database =
        new GenericContainer<>("mysql:8.3.0")
            .withEnv("MYSQL_DATABASE", DATABASE)
            .withEnv("MYSQL_ROOT_PASSWORD", PASSWORD)
            .withEnv("MYSQL_ROOT_HOST", "%")
            .withExposedPorts(3306)
            .waitingFor(
                Wait.forSuccessfulCommand(
                    "mysql --protocol=TCP --host=127.0.0.1 --user=root --password="
                        + PASSWORD
                        + " --execute='SELECT 1'"))) {
      database.start();
      String url =
          "jdbc:mysql://%s:%d/%s?allowPublicKeyRetrieval=true&useSSL=false"
              .formatted(database.getHost(), database.getMappedPort(3306), DATABASE);
      Jdbi jdbi = connect(url, "root", "com.mysql.cj.jdbc.Driver", MYSQL);
      assertEquals(3, countUserNameIndexes(jdbi));
      runChecks(jdbi, "SET SESSION innodb_lock_wait_timeout = 2");
    }
  }

  @Test
  void deletingAUserEndsOnlyItsGrantsOnPostgres() throws IOException {
    try (GenericContainer<?> database =
        new GenericContainer<>("postgres:15")
            .withEnv("POSTGRES_DB", DATABASE)
            .withEnv("POSTGRES_PASSWORD", PASSWORD)
            .withExposedPorts(5432)
            .waitingFor(
                Wait.forLogMessage(".*database system is ready to accept connections.*\\n", 2))) {
      database.start();
      String url =
          "jdbc:postgresql://%s:%d/%s"
              .formatted(database.getHost(), database.getMappedPort(5432), DATABASE);
      Jdbi jdbi = connect(url, "postgres", "org.postgresql.Driver", "postgres");
      runChecks(jdbi, "SET lock_timeout = '2s'");
    }
  }

  private Jdbi connect(String url, String username, String driver, String dialect)
      throws IOException {
    Jdbi jdbi = Jdbi.create(url, username, PASSWORD);
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlObjects.class).setSqlLocator(new ConnectionAwareAnnotationSqlLocator(driver));
    applyTableMigrations(jdbi, dialect);
    jdbi.useHandle(
        handle -> handle.execute("INSERT INTO oauth_clients (client_id) VALUES (?)", CLIENT));
    return jdbi;
  }

  /** The delete stays open while another user's refresh rotates its token. */
  private void runChecks(Jdbi jdbi, String failLockWaitsAfterTwoSeconds) {
    seedGrant(jdbi, DELETED_USER_AS_STORED);
    seedRotatedTokens(jdbi, DELETED_USER_AS_STORED);
    seedGrant(jdbi, OTHER_USER);
    seedLiveTokensOfMoreUsers(jdbi);
    try (Handle deleting = jdbi.open();
        Handle refreshing = jdbi.open()) {
      deleting.begin();
      deleting.attach(CollectionDAO.OAuthRefreshTokenDAO.class).revokeAllGrantsOfUser(DELETED_USER);
      refreshing.execute(failLockWaitsAfterTwoSeconds);
      rotateLikeOAuthTokenRepository(refreshing.attach(CollectionDAO.OAuthRefreshTokenDAO.class));
      deleting.commit();
    }
    assertGrantEnded(jdbi, DELETED_USER_AS_STORED);
    assertGrantKept(jdbi, OTHER_USER);
  }

  /** The statements of OAuthTokenRepository.rotateRefreshToken, in its order. */
  private void rotateLikeOAuthTokenRepository(CollectionDAO.OAuthRefreshTokenDAO tokens) {
    assertEquals(1, tokens.revokeAtomic("refresh-" + OTHER_USER));
    tokens.revokeAllForUser(CLIENT, OTHER_USER);
    tokens.insert("rotated-" + OTHER_USER, "encrypted", CLIENT, OTHER_USER, "[]", LATER);
  }

  private void seedGrant(Jdbi jdbi, String userName) {
    CollectionDAO.McpPendingAuthRequestDAO pending =
        jdbi.onDemand(CollectionDAO.McpPendingAuthRequestDAO.class);
    pending.insert(
        "pending-" + userName,
        CLIENT,
        "challenge",
        "S256",
        "https://client.example/callback",
        null,
        "[]",
        null,
        null,
        null,
        LATER);
    pending.storeConsent("pending-" + userName, "consent-hash", userName, LATER, 0L);
    jdbi.onDemand(CollectionDAO.OAuthAuthorizationCodeDAO.class)
        .insert(
            "code-" + userName,
            CLIENT,
            userName,
            "challenge",
            "S256",
            "https://client.example/callback",
            "[\"openid\"]",
            LATER);
    jdbi.onDemand(CollectionDAO.OAuthAccessTokenDAO.class)
        .insert("access-" + userName, "encrypted", CLIENT, userName, "[]", LATER);
    jdbi.onDemand(CollectionDAO.OAuthRefreshTokenDAO.class)
        .insert("refresh-" + userName, "encrypted", CLIENT, userName, "[]", LATER);
  }

  /**
   * Stored already revoked, as rotation leaves them once MySQL's purge has run. Revoking each one
   * here would leave index entries purge has not removed yet, and on a table this small MySQL then
   * scans the whole table.
   */
  private void seedRotatedTokens(Jdbi jdbi, String userName) {
    jdbi.useHandle(
        handle -> {
          for (int i = 0; i < ROTATED_TOKENS; i++) {
            handle.execute(
                "INSERT INTO oauth_refresh_tokens (token_hash, refresh_token_encrypted, client_id,"
                    + " user_name, scopes, expires_at, revoked)"
                    + " VALUES (?, 'encrypted', ?, ?, '[]', ?, TRUE)",
                "rotated-" + i + "-" + userName,
                CLIENT,
                userName,
                LATER);
          }
        });
  }

  private void seedLiveTokensOfMoreUsers(Jdbi jdbi) {
    CollectionDAO.OAuthRefreshTokenDAO tokens =
        jdbi.onDemand(CollectionDAO.OAuthRefreshTokenDAO.class);
    for (int i = 0; i < MORE_USERS; i++) {
      tokens.insert("live-" + i, "encrypted", CLIENT, "user-" + i, "[]", LATER);
    }
  }

  private void assertGrantEnded(Jdbi jdbi, String userName) {
    assertNull(
        jdbi.onDemand(CollectionDAO.McpPendingAuthRequestDAO.class)
            .findByAuthRequestId("pending-" + userName));
    assertNull(
        jdbi.onDemand(CollectionDAO.OAuthAuthorizationCodeDAO.class)
            .findByCode("code-" + userName));
    assertNull(
        jdbi.onDemand(CollectionDAO.OAuthAccessTokenDAO.class)
            .findByTokenHash("access-" + userName));
    assertTrue(
        jdbi.onDemand(CollectionDAO.OAuthRefreshTokenDAO.class)
            .findByTokenHash("refresh-" + userName)
            .revoked());
  }

  private void assertGrantKept(Jdbi jdbi, String userName) {
    assertNotNull(
        jdbi.onDemand(CollectionDAO.McpPendingAuthRequestDAO.class)
            .findByAuthRequestId("pending-" + userName));
    assertNotNull(
        jdbi.onDemand(CollectionDAO.OAuthAuthorizationCodeDAO.class)
            .findByCode("code-" + userName));
    assertNotNull(
        jdbi.onDemand(CollectionDAO.OAuthAccessTokenDAO.class)
            .findByTokenHash("access-" + userName));
  }

  private int countUserNameIndexes(Jdbi jdbi) {
    return jdbi.withHandle(
        handle ->
            handle
                .createQuery(
                    "SELECT COUNT(DISTINCT index_name) FROM information_schema.statistics"
                        + " WHERE table_schema = DATABASE() AND index_name LIKE 'idx%user_name%'")
                .mapTo(Integer.class)
                .one());
  }

  /** Runs the shipped statements that create and alter the grant tables, oldest first. */
  private void applyTableMigrations(Jdbi jdbi, String dialect) throws IOException {
    for (String version : MIGRATIONS) {
      Path file =
          repositoryRoot()
              .resolve("bootstrap/sql/migrations/native")
              .resolve(version)
              .resolve(dialect)
              .resolve("schemaChanges.sql");
      List<String> statements =
          Arrays.stream(Files.readString(file).split(";"))
              .filter(
                  statement ->
                      statement.contains("oauth_")
                          || statement.contains("mcp_pending_auth_requests"))
              .toList();
      jdbi.useHandle(handle -> statements.forEach(handle::execute));
    }
    if (MYSQL.equals(dialect)) {
      jdbi.useHandle(McpConsentColumns::addOnMySql);
      jdbi.useHandle(McpConsentColumns::addOnMySql);
      jdbi.useHandle(McpGrantUserNameIndexes::addOnMySql);
      jdbi.useHandle(McpGrantUserNameIndexes::addOnMySql);
    }
  }

  private static Path repositoryRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.isDirectory(current.resolve("bootstrap/sql"))) {
      current = current.getParent();
    }
    if (current == null) {
      throw new IllegalStateException("Unable to locate the OpenMetadata repository root");
    }
    return current;
  }
}
