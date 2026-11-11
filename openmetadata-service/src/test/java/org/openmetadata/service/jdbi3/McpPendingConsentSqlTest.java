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
import org.openmetadata.service.migration.utils.v207.MigrationUtil;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Exercises the MCP consent SQL on the shipped migrations: a consent is stored once per request,
 * claimed once with its token hash and never after the request expires. On MySQL the columns come
 * from the 2.0.7 Java migration step, run twice to show a rerun is harmless.
 * ADR:2026-10-23-mcp-sso-asks-consent-after-the-idp-round-trip
 */
@Testcontainers(disabledWithoutDocker = true)
@Execution(ExecutionMode.SAME_THREAD)
class McpPendingConsentSqlTest {
  private static final String DATABASE = "mcp_consent";
  private static final String PASSWORD = "mcp-consent-test";
  private static final String TABLE = "mcp_pending_auth_requests";
  private static final String MYSQL = "mysql";
  private static final List<String> MIGRATIONS = List.of("1.12.4", "1.13.0", "2.0.7");
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

  /** Runs the shipped statements that create and alter the table, oldest first. */
  private void applyTableMigrations(Jdbi jdbi, String dialect) throws IOException {
    Path root = OntologyTestDatabase.repositoryRoot();
    for (String version : MIGRATIONS) {
      Path file =
          root.resolve("bootstrap/sql/migrations/native")
              .resolve(version)
              .resolve(dialect)
              .resolve("schemaChanges.sql");
      List<String> statements =
          Arrays.stream(Files.readString(file).split(";"))
              .filter(statement -> statement.contains(TABLE))
              .toList();
      jdbi.useHandle(handle -> statements.forEach(handle::execute));
    }
    if (MYSQL.equals(dialect)) {
      jdbi.useHandle(MigrationUtil::addMcpConsentColumnsOnMySql);
      jdbi.useHandle(MigrationUtil::addMcpConsentColumnsOnMySql);
    }
  }
}
