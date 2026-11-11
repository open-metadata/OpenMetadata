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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.List;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.jdbi.v3.sqlobject.SqlObjects;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareAnnotationSqlLocator;
import org.openmetadata.service.migration.utils.v210.McpConsentColumns;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Exercises the MCP consent SQL on the shipped migrations: a consent is stored once per request,
 * claimed once with its token hash and never after the request expires. The columns come from
 * 2.1.0: its schemaChanges.sql on PostgreSQL, its Java migration step on MySQL, run twice to show a
 * rerun is harmless. 2.0.7 is applied as it shipped, without them.
 * ADR:2026-10-23-mcp-sso-asks-consent-after-the-idp-round-trip
 */
@Testcontainers(disabledWithoutDocker = true)
@Execution(ExecutionMode.SAME_THREAD)
class McpPendingConsentSqlTest {
  private static final String DATABASE = "mcp_consent";
  private static final String PASSWORD = "mcp-consent-test";
  private static final String TABLE = "mcp_pending_auth_requests";
  private static final String MYSQL = "mysql";
  private static final List<String> MIGRATIONS_BEFORE_CONSENT =
      List.of("1.12.4", "1.13.0", "2.0.7");
  private static final String CONSENT_VERSION = "2.1.0";
  private static final String CONSENT_COLUMNS =
      """
      SELECT COUNT(*) FROM information_schema.columns
      WHERE table_schema = %s AND table_name = 'mcp_pending_auth_requests'
        AND column_name IN ('consent_token_hash', 'consent_user_name')
      """;
  private static final long NOW = 1_000_000L;
  private static final long LATER = NOW + 600_000L;

  @Test
  void consentIsStoredOnceAndClaimedOnceOnMysql() throws IOException {
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
      runChecks(url, "root", "com.mysql.cj.jdbc.Driver", MYSQL);
    }
  }

  @Test
  void consentIsStoredOnceAndClaimedOnceOnPostgres() throws IOException {
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
      runChecks(url, "postgres", "org.postgresql.Driver", "postgres");
    }
  }

  private void runChecks(String url, String username, String driver, String dialect)
      throws IOException {
    Jdbi jdbi = Jdbi.create(url, username, PASSWORD);
    jdbi.installPlugin(new SqlObjectPlugin());
    jdbi.getConfig(SqlObjects.class).setSqlLocator(new ConnectionAwareAnnotationSqlLocator(driver));
    applyTableMigrations(jdbi, dialect);
    OAuthDAOs.McpPendingAuthRequestDAO dao =
        jdbi.onDemand(OAuthDAOs.McpPendingAuthRequestDAO.class);
    assertStoreAndClaim(dao);
    assertExpiredRequestTakesNoConsent(dao);
  }

  private void assertStoreAndClaim(OAuthDAOs.McpPendingAuthRequestDAO dao) {
    insertPending(dao, "req-1", LATER);
    assertEquals(1, dao.storeConsent("req-1", "hash-alice", "alice", LATER, NOW));
    assertEquals(0, dao.storeConsent("req-1", "hash-other", "other", LATER, NOW));
    assertEquals(0, dao.claimConsent("req-1", "hash-other", NOW));
    assertEquals(1, dao.claimConsent("req-1", "hash-alice", NOW));
    assertEquals(0, dao.claimConsent("req-1", "hash-alice", NOW));
    assertEquals("alice", dao.findConsentUserName("req-1"));
    assertEquals(0, dao.storeConsent("req-1", "hash-again", "alice", LATER, NOW));
  }

  private void assertExpiredRequestTakesNoConsent(OAuthDAOs.McpPendingAuthRequestDAO dao) {
    insertPending(dao, "req-2", NOW - 1);
    assertEquals(0, dao.storeConsent("req-2", "hash-alice", "alice", LATER, NOW));
    insertPending(dao, "req-3", LATER);
    assertEquals(1, dao.storeConsent("req-3", "hash-alice", "alice", LATER, NOW));
    assertEquals(0, dao.claimConsent("req-3", "hash-alice", LATER + 1));
  }

  private void insertPending(OAuthDAOs.McpPendingAuthRequestDAO dao, String id, long expiresAt) {
    dao.insert(
        id,
        "client-1",
        "challenge",
        "S256",
        "https://client.example/callback",
        null,
        "[\"openid\"]",
        null,
        null,
        null,
        expiresAt);
  }

  /**
   * Runs the shipped statements that create and alter the table, oldest first. 2.0.7 shipped
   * without the consent feature, so the columns must not exist before 2.1.0: a database that has
   * run a later 2.0.x never reads 2.0.7 again, and 2.1.0 is the only version every upgrade to 2.1
   * runs. 2.1.0 runs twice, as on a database that already has the columns.
   */
  private void applyTableMigrations(Jdbi jdbi, String dialect) throws IOException {
    for (String version : MIGRATIONS_BEFORE_CONSENT) {
      applyTableStatements(jdbi, dialect, version);
    }
    assertEquals(0, consentColumnCount(jdbi, dialect));
    applyTableStatements(jdbi, dialect, CONSENT_VERSION);
    applyTableStatements(jdbi, dialect, CONSENT_VERSION);
    if (MYSQL.equals(dialect)) {
      jdbi.useHandle(McpConsentColumns::addOnMySql);
      jdbi.useHandle(McpConsentColumns::addOnMySql);
    }
    assertEquals(2, consentColumnCount(jdbi, dialect));
  }

  private void applyTableStatements(Jdbi jdbi, String dialect, String version) throws IOException {
    Path file =
        OntologyTestDatabase.repositoryRoot()
            .resolve("bootstrap/sql/migrations/native")
            .resolve(version)
            .resolve(dialect)
            .resolve("schemaChanges.sql");
    List<String> statements =
        Arrays.stream(Files.readString(file).split(";"))
            .filter(statement -> statement.contains(TABLE))
            .toList();
    jdbi.useHandle(handle -> statements.forEach(handle::execute));
  }

  private int consentColumnCount(Jdbi jdbi, String dialect) {
    String schema = MYSQL.equals(dialect) ? "DATABASE()" : "current_schema()";
    return jdbi.withHandle(
        handle -> handle.createQuery(CONSENT_COLUMNS.formatted(schema)).mapTo(Integer.class).one());
  }
}
