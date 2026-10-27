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

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SqlQueryCounter;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;

/**
 * After warm-up a bot or PAT request does no database work for its credential check: it issues the
 * statements of the same request made with a session token of the same user, which has no stored
 * check. The control uses the same principal on purpose, so everything after authentication is
 * identical and any difference is the credential check.
 *
 * <p>{@link SqlQueryCounter#forRequests} counts the statements of every in-flight request, so the
 * class runs {@link Isolated}: no other test's request can be counted. The verifier reads on its own
 * threads, which carry no request context, so those statements are not counted there; the class
 * therefore also asserts that the verifier started no read for a check during the measured loop.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class CredentialHotPathNoIoIT {
  private static final int WARM_UP_REQUESTS = 20;
  private static final int MEASURED_REQUESTS = 200;

  @Test
  void botRequestsIssueTheStatementsOfALoginTokenForTheSameBot(TestNamespace ns) {
    User bot = CredentialFixtures.createBot(ns, "hotbot");

    Measurement measurement =
        measure(CredentialFixtures.botToken(bot), CredentialFixtures.loginToken(bot));

    assertSameStatements(measurement);
  }

  @Test
  void patRequestsIssueTheStatementsOfALoginTokenForTheSameOwner(TestNamespace ns) {
    User owner = CredentialFixtures.createUser(ns, "hotpat");
    PersonalAccessToken pat = CredentialFixtures.createPat(owner, ns.prefix("pat"));

    Measurement measurement = measure(pat.getJwtToken(), CredentialFixtures.loginToken(owner));

    assertSameStatements(measurement);
  }

  private record Measurement(
      int controlStatements, int credentialStatements, double checkStartedReads) {}

  /** Alternates control and credential requests so a drifting background load hits both alike. */
  private static Measurement measure(String credentialToken, String controlToken) {
    for (int i = 0; i < WARM_UP_REQUESTS; i++) {
      assertEquals(200, CredentialFixtures.status(LOGGED_IN_USER, controlToken), "warm-up control");
      assertEquals(
          200, CredentialFixtures.status(LOGGED_IN_USER, credentialToken), "warm-up credential");
    }
    int controlStatements = 0;
    int credentialStatements = 0;
    double readsBefore = CredentialFixtures.checkStartedReads();
    try (SqlQueryCounter counter = SqlQueryCounter.forRequests(Entity.getJdbi(), "")) {
      for (int i = 0; i < MEASURED_REQUESTS; i++) {
        int before = counter.count();
        assertEquals(200, CredentialFixtures.status(LOGGED_IN_USER, controlToken), "control");
        int afterControl = counter.count();
        assertEquals(200, CredentialFixtures.status(LOGGED_IN_USER, credentialToken), "credential");
        controlStatements += afterControl - before;
        credentialStatements += counter.count() - afterControl;
      }
    }
    double checkStartedReads = CredentialFixtures.checkStartedReads() - readsBefore;
    return new Measurement(controlStatements, credentialStatements, checkStartedReads);
  }

  private static void assertSameStatements(Measurement measurement) {
    assertTrue(
        measurement.controlStatements() >= MEASURED_REQUESTS,
        "the control reads its user on every request, so the counter must see at least one"
            + " statement each: "
            + measurement.controlStatements());
    PerRequestCost.assertNoPerRequestCost(
        "statements",
        MEASURED_REQUESTS,
        measurement.controlStatements(),
        measurement.credentialStatements(),
        "warm requests, login token vs credential");
    assertEquals(
        0,
        measurement.checkStartedReads(),
        "the verifier started no read for any of the warm requests");
  }
}
