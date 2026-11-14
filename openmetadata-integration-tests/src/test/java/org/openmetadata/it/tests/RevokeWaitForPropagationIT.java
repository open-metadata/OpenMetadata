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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.it.tests.CredentialFixtures.LOGGED_IN_USER;

import java.net.http.HttpResponse;
import java.time.Duration;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.ForkedServerNode;
import org.openmetadata.it.bootstrap.ForkedServerNode.Settings;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.security.credentials.CredentialSourceTestSupport;

/**
 * {@code PUT /v1/users/revokeToken?waitForPropagation=true} on server A returns only once every
 * server rejects the token: the first request sent to server B, a second server in its own JVM,
 * after the response arrives is 401 with no polling, and the call took at least {@code maxStaleness}.
 */
@Tag("multi-node")
@ExtendWith(TestNamespaceExtension.class)
class RevokeWaitForPropagationIT {
  private static ForkedServerNode nodeB;

  @BeforeAll
  static void startNodeB() {
    nodeB = ForkedServerNode.start(Settings.DEFAULT);
  }

  @AfterAll
  static void stopNodeB() {
    if (nodeB != null) {
      nodeB.close();
    }
  }

  @Test
  void theFirstRequestToBAfterTheResponseIsRejected(TestNamespace ns) {
    User bot = CredentialFixtures.createBot(ns, "wfp");
    String token = CredentialFixtures.botToken(bot);
    assertEquals(200, statusOnB(token), "B accepts and caches the bot token before the revoke");
    Duration maxStaleness = CredentialSourceTestSupport.serverMaxStaleness();

    long start = System.nanoTime();
    HttpResponse<String> revoke =
        CredentialFixtures.put(
            "/api/v1/users/revokeToken?waitForPropagation=true",
            SdkClients.getAdminToken(),
            "{\"id\":\"" + bot.getId() + "\"}");
    Duration took = Duration.ofNanos(System.nanoTime() - start);

    assertEquals(200, revoke.statusCode(), revoke.body());
    assertEquals(401, statusOnB(token), "B rejects the token on the first request after the call");
    assertTrue(
        took.compareTo(maxStaleness) >= 0,
        "the call took " + took.toMillis() + " ms, less than maxStaleness " + maxStaleness);
  }

  private static int statusOnB(String token) {
    return CredentialFixtures.status(nodeB.apiBase().toString(), LOGGED_IN_USER, token);
  }
}
