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
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.openmetadata.it.tests.CredentialFixtures.LOGGED_IN_USER;

import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.ForkedOperations;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.CreateBot;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.security.credentials.CredentialSourceTestSupport;

/**
 * {@code OpenMetadataOperations regenerate-bot-tokens} writes new bot tokens straight to the
 * database from its own JVM. It has no verifier and sends no hint to any server, so the suite's
 * server learns of the change from the database alone: the old token is rejected within
 * {@code maxStaleness} and the new one is accepted on its first use.
 *
 * <p>The command regenerates every bot's token, not only this test's bot, so the class runs in the
 * multi-node lane, which runs one class at a time.
 */
@Tag("multi-node")
@ExtendWith(TestNamespaceExtension.class)
class OpsRegenerateBotTokensIT {
  @Test
  void tokensRegeneratedByTheOpsCommandReplaceTheOldOnesWithinMaxStaleness(TestNamespace ns) {
    User bot = CredentialFixtures.createBot(ns, "opsbot");
    // The command regenerates the token of each Bot entity's user, so the user needs one.
    SdkClients.adminClient()
        .bots()
        .create(new CreateBot().withName(ns.prefix("opsbot")).withBotUser(bot.getName()));
    String oldToken = CredentialFixtures.botToken(bot);
    assertEquals(200, CredentialFixtures.status(LOGGED_IN_USER, oldToken), "old token works");

    int exitCode = ForkedOperations.run("regenerate-bot-tokens", "--expiry", "Seven");

    assertEquals(0, exitCode, "the ops command succeeded, see target/forked-ops-*.log");
    String newToken = storedToken(bot);
    assertNotEquals(oldToken, newToken, "the command stored a new token");
    assertEquals(
        200, CredentialFixtures.status(LOGGED_IN_USER, newToken), "first use of new token");
    Duration bound = CredentialSourceTestSupport.serverMaxStaleness();
    Awaitility.await("old bot token answers 401 within maxStaleness " + bound)
        .atMost(bound.plusSeconds(1).toMillis(), TimeUnit.MILLISECONDS)
        .pollInterval(25, TimeUnit.MILLISECONDS)
        .untilAsserted(
            () -> assertEquals(401, CredentialFixtures.status(LOGGED_IN_USER, oldToken)));
  }

  /**
   * Read from the table, not through the API: the command did not go through the suite server, so
   * the server's entity cache may still hold the bot's previous document.
   */
  private static String storedToken(User bot) {
    String json =
        Entity.getJdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT json FROM user_entity WHERE name = :name")
                        .bind("name", bot.getName())
                        .mapTo(String.class)
                        .one());
    String stored =
        JsonUtils.readTree(json)
            .path("authenticationMechanism")
            .path("config")
            .path("JWTToken")
            .asText();
    return Fernet.getInstance().decryptIfApplies(stored);
  }
}
