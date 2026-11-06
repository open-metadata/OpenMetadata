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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.MetricMigrationSqlFixture.currentConnectionType;
import static org.openmetadata.it.tests.MetricMigrationSqlFixture.readMigrationScripts;

import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/**
 * The 2.1.0 migration adds {@code idx_user_tokens_user_type} and deletes personal access tokens of
 * users that no longer exist. Runs the shipped statements twice against the shared database to
 * prove the index step is a no-op the second time and the delete touches orphan PAT rows only.
 */
@Isolated("executes the shipped 2.1.0 migration statements against the shared database")
class CredentialIndexMigrationIT {
  private static final String INDEX = "idx_user_tokens_user_type";

  @Test
  void indexExistsAndTheIndexStatementsRunTwice() throws Exception {
    ConnectionType type = currentConnectionType();
    List<String> statements = indexStatements(type);
    assertTrue(statements.size() >= 1, "the migration must carry the index statement");

    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              assertTrue(indexExists(handle, type));
              statements.forEach(handle::execute);
              statements.forEach(handle::execute);
              assertTrue(indexExists(handle, type));
            });
  }

  @Test
  void orphanDeleteRemovesOnlyOrphanPersonalAccessTokens() throws Exception {
    ConnectionType type = currentConnectionType();
    String delete = orphanDelete(type);
    String orphanUserId = UUID.randomUUID().toString();

    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              String existingUser =
                  handle
                      .createQuery("SELECT id FROM user_entity LIMIT 1")
                      .mapTo(String.class)
                      .one();
              String orphanPat = insertToken(handle, orphanUserId, "PERSONAL_ACCESS_TOKEN");
              String orphanRefresh = insertToken(handle, orphanUserId, "REFRESH_TOKEN");
              String livePat = insertToken(handle, existingUser, "PERSONAL_ACCESS_TOKEN");
              try {
                handle.execute(delete);
                handle.execute(delete);
                assertFalse(tokenExists(handle, orphanPat), "orphan PAT is deleted");
                assertTrue(tokenExists(handle, orphanRefresh), "other token types stay");
                assertTrue(tokenExists(handle, livePat), "a live user's PAT stays");
              } finally {
                handle.execute(
                    "DELETE FROM user_tokens WHERE token IN ('"
                        + orphanPat
                        + "', '"
                        + orphanRefresh
                        + "', '"
                        + livePat
                        + "')");
              }
            });
  }

  private static List<String> indexStatements(ConnectionType type) throws Exception {
    List<String> all = readMigrationScripts(type).schemaStatements();
    int start = -1;
    for (int i = 0; i < all.size() && start < 0; i++) {
      if (all.get(i).contains(INDEX)) {
        start = i;
      }
    }
    assertTrue(start >= 0, "no statement creates " + INDEX);
    // MySQL builds the DDL in a session variable: SET, PREPARE, EXECUTE, DEALLOCATE.
    int end = type == ConnectionType.MYSQL ? start + 4 : start + 1;
    return all.subList(start, end);
  }

  private static String orphanDelete(ConnectionType type) throws Exception {
    return readMigrationScripts(type).postStatements().stream()
        .filter(s -> s.contains("DELETE FROM user_tokens"))
        .findFirst()
        .orElseThrow();
  }

  private static boolean indexExists(Handle handle, ConnectionType type) {
    String sql =
        type == ConnectionType.MYSQL
            ? "SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE()"
                + " AND table_name = 'user_tokens' AND index_name = :name"
            : "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'user_tokens'"
                + " AND indexname = :name";
    return handle.createQuery(sql).bind("name", INDEX).mapTo(Long.class).one() > 0;
  }

  private static String insertToken(Handle handle, String userId, String tokenType) {
    String token = UUID.randomUUID().toString();
    String json =
        "{\"token\":\"%s\",\"userId\":\"%s\",\"tokenType\":\"%s\",\"expiryDate\":1}"
            .formatted(token, userId, tokenType);
    String cast =
        currentConnectionType() == ConnectionType.MYSQL ? ":json" : "CAST(:json AS jsonb)";
    handle
        .createUpdate("INSERT INTO user_tokens (json) VALUES (" + cast + ")")
        .bind("json", json)
        .execute();
    return token;
  }

  private static boolean tokenExists(Handle handle, String token) {
    return handle
            .createQuery("SELECT COUNT(*) FROM user_tokens WHERE token = :token")
            .bind("token", token)
            .mapTo(Long.class)
            .one()
        > 0;
  }
}
