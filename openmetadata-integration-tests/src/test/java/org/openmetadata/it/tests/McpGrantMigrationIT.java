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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.openmetadata.it.tests.MetricMigrationSqlFixture.currentConnectionType;
import static org.openmetadata.it.tests.MetricMigrationSqlFixture.readMigrationScripts;

import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.mcp.auth.AccessToken;
import org.openmetadata.mcp.auth.RefreshToken;
import org.openmetadata.mcp.server.auth.repository.OAuthAuthorizationCodeRepository;
import org.openmetadata.mcp.server.auth.repository.OAuthTokenRepository;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.teams.User;

/**
 * The 2.1.0 migration ends the MCP grants of users that no longer exist or are deleted. Runs the
 * shipped statements twice to prove they touch only those grants, match a grant stored under
 * another casing of a live user's name, and change nothing the second time.
 */
@Isolated("executes the shipped 2.1.0 migration statements against the shared database")
class McpGrantMigrationIT {
  private static final long IN_A_DAY = 86_400_000L;

  private record Grant(String code, String refreshToken, String accessToken) {}

  @Test
  void grantsOfMissingAndDeletedUsersEndAndLiveUsersKeepTheirs() throws Exception {
    List<String> statements =
        readMigrationScripts(currentConnectionType()).postStatements().stream()
            .filter(statement -> statement.contains("oauth_"))
            .toList();
    assertEquals(3, statements.size(), "the migration carries one statement per grant table");
    String clientId = "mcp-grant-migration-" + UUID.randomUUID();
    User live = createUser();
    User deleted = createUser();
    SdkClients.adminClient().users().delete(deleted.getId().toString());

    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              handle.execute("INSERT INTO oauth_clients (client_id) VALUES (?)", clientId);
              try {
                Grant missingUser = seedGrant(clientId, "mcp_gone_" + UUID.randomUUID());
                Grant deletedUser = seedGrant(clientId, deleted.getName());
                Grant liveUser = seedGrant(clientId, live.getName());
                Grant liveUserOtherCasing =
                    seedGrant(clientId, live.getName().toUpperCase(Locale.ROOT));

                statements.forEach(handle::execute);
                statements.forEach(handle::execute);

                assertEnded(missingUser);
                assertEnded(deletedUser);
                assertActive(liveUser);
                assertActive(liveUserOtherCasing);
              } finally {
                handle.execute("DELETE FROM oauth_clients WHERE client_id = ?", clientId);
                hardDelete(live);
                hardDelete(deleted);
              }
            });
  }

  private static Grant seedGrant(String clientId, String userName) {
    Grant grant =
        new Grant(
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString(),
            UUID.randomUUID().toString());
    long expiresAt = System.currentTimeMillis() + IN_A_DAY;
    new OAuthAuthorizationCodeRepository()
        .store(
            grant.code(),
            clientId,
            userName,
            "codeChallenge-123456789012345678901234567890123456789012",
            "S256",
            URI.create("http://127.0.0.1:9090/callback"),
            List.of("openid"),
            expiresAt);
    OAuthTokenRepository tokens = new OAuthTokenRepository();
    tokens.storeRefreshToken(
        new RefreshToken(grant.refreshToken(), clientId, List.of(), expiresAt),
        clientId,
        userName,
        List.of());
    tokens.storeAccessToken(
        new AccessToken(grant.accessToken(), clientId, List.of(), expiresAt),
        clientId,
        userName,
        List.of());
    return grant;
  }

  private static void assertEnded(Grant grant) {
    assertNull(new OAuthAuthorizationCodeRepository().findByCode(grant.code()));
    assertNull(new OAuthTokenRepository().findRefreshToken(grant.refreshToken()));
    assertNull(new OAuthTokenRepository().findAccessToken(grant.accessToken()));
  }

  private static void assertActive(Grant grant) {
    assertNotNull(new OAuthAuthorizationCodeRepository().findByCode(grant.code()));
    assertNotNull(new OAuthTokenRepository().findRefreshToken(grant.refreshToken()));
    assertNotNull(new OAuthTokenRepository().findAccessToken(grant.accessToken()));
  }

  private static User createUser() {
    String name = "mcp_grant_migration_" + UUID.randomUUID().toString().substring(0, 8);
    return SdkClients.adminClient()
        .users()
        .create(new CreateUser().withName(name).withEmail(name + "@example.com"));
  }

  private static void hardDelete(User user) {
    SdkClients.adminClient().users().delete(user.getId().toString(), Map.of("hardDelete", "true"));
  }
}
