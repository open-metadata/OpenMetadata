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

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.system.TestLoginProtocol;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.oauth.OAuthRecords;

/**
 * An abandoned Test Login gets no further request, so only the scheduled sweep can clear it. The
 * test waits for a real sweep; it runs concurrently, so the wait costs the suite little.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class TestLoginSessionSweepIT {
  // Each server sweeps once a minute; the rest allows for a slow CI database.
  private static final Duration SWEEP_WAIT = Duration.ofMinutes(3);
  private static final String PENDING = "pending";
  private static final String SEALED_CANDIDATE = "sealed-candidate-with-its-secrets";
  private static final String LDAP = TestLoginProtocol.LDAP.value();

  @Test
  void anAbandonedTestLoginLosesItsSecretsSoonAfterItExpires(TestNamespace ns) {
    assumeFalse(OssTestServer.isExternalMode(), "Reads the embedded server's database");
    CollectionDAO.SsoTestLoginSessionDAO sessions =
        Entity.getCollectionDAO().ssoTestLoginSessionDAO();
    String admin = "sweep" + ns.shortPrefix();
    long now = System.currentTimeMillis();
    // The admin closed the popup: the test expired without any further request.
    String neverAnswered = "sweep-unanswered-" + UUID.randomUUID();
    sessions.insert(neverAnswered, admin, LDAP, PENDING, SEALED_CANDIDATE, null, now - 1);
    // Claimed for credentials by a server that then went away before finishing it.
    String claimed = "sweep-claimed-" + UUID.randomUUID();
    sessions.insert(claimed, admin, LDAP, PENDING, SEALED_CANDIDATE, null, now + 2_000);
    assertEquals(1, sessions.claimForCredentials(claimed, now));

    await()
        .atMost(SWEEP_WAIT)
        .pollInterval(Duration.ofSeconds(2))
        .untilAsserted(
            () -> {
              assertNull(storedRow(sessions, neverAnswered), "an expired, unused test is deleted");
              OAuthRecords.SsoTestLoginSession claimedRow = storedRow(sessions, claimed);
              assertNotNull(claimedRow, "a claimed test still counts towards the credential limit");
              assertNull(claimedRow.pendingState(), "an expired test keeps no secrets");
            });
  }

  /** The stored row whether or not it has expired. */
  private static OAuthRecords.SsoTestLoginSession storedRow(
      CollectionDAO.SsoTestLoginSessionDAO sessions, String testSessionId) {
    return sessions.findLive(testSessionId, 0L);
  }
}
