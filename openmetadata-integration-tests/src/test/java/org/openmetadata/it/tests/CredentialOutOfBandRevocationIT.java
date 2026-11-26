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
import static org.openmetadata.it.tests.CredentialFixtures.status;

import java.time.Duration;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.security.credentials.CredentialSourceTestSupport;

/**
 * A credential changed by SQL alone, with no API call and so no hint to the server, stops working
 * within the staleness bound. The bound is the one the running server was configured with; the
 * shared test config leaves it at the 5 s default, because lowering it would push the 2 s
 * {@code loadTimeout} above it for every IT in the suite.
 */
@ExtendWith(TestNamespaceExtension.class)
class CredentialOutOfBandRevocationIT {
  private static final Duration MARGIN = Duration.ofSeconds(3);
  private static final long POLL_MILLIS = 100;

  @Test
  void patRowDeletedBySqlIsRejectedWithinMaxStaleness(TestNamespace ns) {
    User owner = CredentialFixtures.createUser(ns, "oobpat");
    PersonalAccessToken pat = CredentialFixtures.createPat(owner, ns.prefix("pat"));
    assertEquals(200, status(LOGGED_IN_USER, pat.getJwtToken()), "the PAT works before the delete");

    CredentialFixtures.deletePatRows(owner);

    awaitUnauthorized(pat.getJwtToken());
  }

  @Test
  void botMechanismBlankedBySqlIsRejectedWithinMaxStaleness(TestNamespace ns) {
    User bot = CredentialFixtures.createBot(ns, "oobbot");
    String token = CredentialFixtures.botToken(bot);
    assertEquals(200, status(LOGGED_IN_USER, token), "the bot token works before the edit");

    CredentialFixtures.execute(CredentialFixtures.removeMechanismSql(), bot.getName());

    awaitUnauthorized(token);
  }

  @Test
  void ownerSoftDeletedBySqlLosesItsPatWithinMaxStaleness(TestNamespace ns) {
    User owner = CredentialFixtures.createUser(ns, "oobdel");
    PersonalAccessToken pat = CredentialFixtures.createPat(owner, ns.prefix("pat"));
    assertEquals(200, status(LOGGED_IN_USER, pat.getJwtToken()), "the PAT works before the delete");

    CredentialFixtures.execute(CredentialFixtures.softDeleteSql(), owner.getName());

    awaitUnauthorized(pat.getJwtToken());
  }

  @Test
  void botSoftDeletedBySqlLosesItsTokenWithinMaxStaleness(TestNamespace ns) {
    User bot = CredentialFixtures.createBot(ns, "oobbotdel");
    String token = CredentialFixtures.botToken(bot);
    assertEquals(200, status(LOGGED_IN_USER, token), "the bot token works before the delete");

    CredentialFixtures.execute(CredentialFixtures.softDeleteSql(), bot.getName());

    awaitUnauthorized(token);
  }

  private static void awaitUnauthorized(String token) {
    Duration bound = CredentialSourceTestSupport.serverMaxStaleness();
    Awaitility.await("401 for a credential changed by SQL, within maxStaleness " + bound)
        .atMost(bound.plus(MARGIN).toMillis(), TimeUnit.MILLISECONDS)
        .pollInterval(POLL_MILLIS, TimeUnit.MILLISECONDS)
        .untilAsserted(() -> assertEquals(401, status(LOGGED_IN_USER, token)));
  }
}
