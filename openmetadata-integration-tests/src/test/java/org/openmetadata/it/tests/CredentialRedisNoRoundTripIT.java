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
import static org.openmetadata.it.tests.CredentialFixtures.LOGGED_IN_USER;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.entity.teams.User;

/**
 * After warm-up, a bot or PAT request makes the Redis calls of the same request made with a session
 * token of the same principal, which has no stored check: the credential check adds no Redis round
 * trip. The control uses the same principal so everything after authentication is identical.
 *
 * <p>Redis counts every client's commands, so the class runs {@link Isolated} and compares three
 * phases of 200 sequential requests: control, credential, control again. The second control shows
 * how much background noise a phase carries, and appears in the failure message.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
@EnabledIf(value = "org.openmetadata.it.bootstrap.TestSuiteBootstrap#isRedisEnabled")
class CredentialRedisNoRoundTripIT {
  private static final int WARM_UP_REQUESTS = 20;
  private static final int MEASURED_REQUESTS = 200;

  @Test
  void botRequestsMakeTheRedisCallsOfASessionTokenForTheSameBot(TestNamespace ns) {
    User bot = CredentialFixtures.createBot(ns, "redisbot");

    assertSameRedisCommands(CredentialFixtures.botToken(bot), CredentialFixtures.loginToken(bot));
  }

  @Test
  void patRequestsMakeTheRedisCallsOfASessionTokenForTheSameOwner(TestNamespace ns) {
    User owner = CredentialFixtures.createUser(ns, "redispat");
    PersonalAccessToken pat = CredentialFixtures.createPat(owner, ns.prefix("pat"));

    assertSameRedisCommands(pat.getJwtToken(), CredentialFixtures.loginToken(owner));
  }

  private static void assertSameRedisCommands(String credentialToken, String controlToken) {
    for (int i = 0; i < WARM_UP_REQUESTS; i++) {
      assertEquals(200, CredentialFixtures.status(LOGGED_IN_USER, controlToken), "warm-up control");
      assertEquals(
          200, CredentialFixtures.status(LOGGED_IN_USER, credentialToken), "warm-up token");
    }
    Map<String, Long> control = commandsOf(controlToken);
    Map<String, Long> credential = commandsOf(credentialToken);
    Map<String, Long> controlAgain = commandsOf(controlToken);

    PerRequestCost.assertNoPerRequestCost(
        "Redis calls",
        MEASURED_REQUESTS,
        total(control),
        total(credential),
        "control " + control + ", credential " + credential + ", control again " + controlAgain);
  }

  private static Map<String, Long> commandsOf(String token) {
    Map<String, Long> before = RedisCommandStats.commands();
    for (int i = 0; i < MEASURED_REQUESTS; i++) {
      assertEquals(200, CredentialFixtures.status(LOGGED_IN_USER, token), "request " + i);
    }
    return RedisCommandStats.since(before, RedisCommandStats.commands());
  }

  private static long total(Map<String, Long> commands) {
    return commands.values().stream().mapToLong(Long::longValue).sum();
  }
}
