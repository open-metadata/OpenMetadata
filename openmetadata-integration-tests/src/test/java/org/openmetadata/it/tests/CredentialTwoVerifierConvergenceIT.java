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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.dropwizard.util.Duration;
import java.util.concurrent.TimeUnit;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.auth.PersonalAccessToken;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.credentials.CredentialSourceTestSupport;
import org.openmetadata.service.security.credentials.CredentialSourceTestSupport.TestVerifier;
import org.openmetadata.service.security.credentials.CredentialVerificationConfig;

/**
 * Two verifiers in one JVM over the real database share no state, so a revocation that neither is
 * told about reaches both through the database alone. The server's own verifier receives the write
 * hint; these two do not. They run with a 1 s bound so the test stays short; the shared server keeps
 * its configured one.
 */
@ExtendWith(TestNamespaceExtension.class)
class CredentialTwoVerifierConvergenceIT {
  private static final long MAX_STALENESS_MILLIS = 1000;
  private static final long MARGIN_MILLIS = 1000;
  private static final long POLL_MILLIS = 25;
  private static final CredentialVerificationConfig CONFIG =
      new CredentialVerificationConfig(
          Duration.milliseconds(MAX_STALENESS_MILLIS),
          Duration.milliseconds(200),
          Duration.milliseconds(100),
          Duration.milliseconds(500),
          null,
          null,
          null,
          null,
          null);

  private TestVerifier verifierA;
  private TestVerifier verifierB;

  @BeforeEach
  void startVerifiers() {
    verifierA = CredentialSourceTestSupport.newVerifier(Entity.getJdbi(), CONFIG);
    verifierB = CredentialSourceTestSupport.newVerifier(Entity.getJdbi(), CONFIG);
    verifierA.start();
    verifierB.start();
  }

  @AfterEach
  void stopVerifiers() {
    verifierA.stop();
    verifierB.stop();
  }

  @Test
  void revokedPatIsRejectedByBothVerifiersAndBLearnedItFromTheDatabase(TestNamespace ns) {
    User owner = CredentialFixtures.createUser(ns, "twopat");
    PersonalAccessToken pat = CredentialFixtures.createPat(owner, ns.prefix("pat"));
    String token = pat.getJwtToken();
    assertTrue(verifierA.accepts(owner.getName(), token), "A accepts the live PAT");
    assertTrue(verifierB.accepts(owner.getName(), token), "B accepts the live PAT");
    double changedBefore = verifierB.sweepChangedSubjects();

    CredentialFixtures.revokePat(owner, pat);

    awaitRejected(verifierA, owner.getName(), token);
    awaitRejected(verifierB, owner.getName(), token);
    assertTrue(
        verifierB.sweepChangedSubjects() > changedBefore,
        "B's sweep found the principal changed in the database");
  }

  @Test
  void revokedBotTokenIsRejectedByBothVerifiersAndBLearnedItFromTheDatabase(TestNamespace ns) {
    User bot = CredentialFixtures.createBot(ns, "twobot");
    String token = CredentialFixtures.botToken(bot);
    assertTrue(verifierA.accepts(bot.getName(), token), "A accepts the live bot token");
    assertTrue(verifierB.accepts(bot.getName(), token), "B accepts the live bot token");
    double changedBefore = verifierB.sweepChangedSubjects();

    CredentialFixtures.revokeBotToken(bot);

    awaitRejected(verifierA, bot.getName(), token);
    awaitRejected(verifierB, bot.getName(), token);
    assertTrue(
        verifierB.sweepChangedSubjects() > changedBefore,
        "B's sweep found the bot changed in the database");
  }

  @Test
  void verifierWithItsSweepStoppedStillRejectsByMaxStaleness(TestNamespace ns) {
    User owner = CredentialFixtures.createUser(ns, "twostop");
    PersonalAccessToken pat = CredentialFixtures.createPat(owner, ns.prefix("pat"));
    assertTrue(verifierB.accepts(owner.getName(), pat.getJwtToken()), "B accepts the live PAT");
    verifierB.stop();
    double changedBefore = verifierB.sweepChangedSubjects();

    CredentialFixtures.revokePat(owner, pat);

    awaitRejected(verifierB, owner.getName(), pat.getJwtToken());
    assertEquals(
        changedBefore,
        verifierB.sweepChangedSubjects(),
        "B rejected through its request-thread read, not through a sweep");
  }

  @Test
  void patCreatedAfterBothVerifiersCachedTheOwnerIsAcceptedByBoth(TestNamespace ns) {
    User owner = CredentialFixtures.createUser(ns, "twonew");
    PersonalAccessToken first = CredentialFixtures.createPat(owner, ns.prefix("first"));
    assertTrue(verifierA.accepts(owner.getName(), first.getJwtToken()));
    assertTrue(verifierB.accepts(owner.getName(), first.getJwtToken()));

    PersonalAccessToken second = CredentialFixtures.createPat(owner, ns.prefix("second"));

    awaitAccepted(verifierA, owner.getName(), second.getJwtToken());
    awaitAccepted(verifierB, owner.getName(), second.getJwtToken());
  }

  @Test
  void patOfAnOwnerNeitherVerifierHasSeenIsAcceptedByBothOnFirstUse(TestNamespace ns) {
    User owner = CredentialFixtures.createUser(ns, "twocold");
    PersonalAccessToken pat = CredentialFixtures.createPat(owner, ns.prefix("pat"));

    assertTrue(verifierA.accepts(owner.getName(), pat.getJwtToken()), "A, first use");
    assertTrue(verifierB.accepts(owner.getName(), pat.getJwtToken()), "B, first use");
  }

  private static void awaitRejected(TestVerifier verifier, String userName, String token) {
    Awaitility.await("rejected within maxStaleness")
        .atMost(MAX_STALENESS_MILLIS + MARGIN_MILLIS, TimeUnit.MILLISECONDS)
        .pollInterval(POLL_MILLIS, TimeUnit.MILLISECONDS)
        .untilAsserted(() -> assertFalse(verifier.accepts(userName, token)));
  }

  private static void awaitAccepted(TestVerifier verifier, String userName, String token) {
    Awaitility.await("accepted within missRefreshMinAge plus a read")
        .atMost(MARGIN_MILLIS, TimeUnit.MILLISECONDS)
        .pollInterval(POLL_MILLIS, TimeUnit.MILLISECONDS)
        .untilAsserted(() -> assertTrue(verifier.accepts(userName, token)));
  }
}
