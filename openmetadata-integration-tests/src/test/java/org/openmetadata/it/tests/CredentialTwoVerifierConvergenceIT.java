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
import java.util.concurrent.atomic.AtomicBoolean;
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
import org.openmetadata.service.security.credentials.CredentialUnavailableException;
import org.openmetadata.service.security.credentials.CredentialVerificationConfig;

/**
 * Two verifiers in one JVM over the real database share no state, so a revocation that neither is
 * told about reaches both through the database alone. The server's own verifier receives the write
 * hint; these two do not. They run with their own sweep cadence and the default {@code
 * loadTimeout}. A check that cannot confirm throws {@link CredentialUnavailableException},
 * which a parallel run can cause for one poll, so the polls retry it and the first-use checks wait
 * for a definitive answer; a rejection fails a test at once.
 */
@ExtendWith(TestNamespaceExtension.class)
class CredentialTwoVerifierConvergenceIT {
  private static final long MAX_STALENESS_MILLIS = 6000;
  private static final long MARGIN_MILLIS = 2000;
  private static final long FIRST_USE_MILLIS = 5000;
  private static final long MISS_REFRESH_MIN_AGE_MILLIS = 100;
  private static final long POLL_MILLIS = 25;
  private static final CredentialVerificationConfig CONFIG =
      new CredentialVerificationConfig(
          Duration.milliseconds(MAX_STALENESS_MILLIS),
          Duration.milliseconds(500),
          Duration.milliseconds(MISS_REFRESH_MIN_AGE_MILLIS),
          null,
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
    assertTrue(acceptsFirstUse(verifierA, owner.getName(), token), "A accepts the live PAT");
    assertTrue(acceptsFirstUse(verifierB, owner.getName(), token), "B accepts the live PAT");
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
    assertTrue(acceptsFirstUse(verifierA, bot.getName(), token), "A accepts the live bot token");
    assertTrue(acceptsFirstUse(verifierB, bot.getName(), token), "B accepts the live bot token");
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
    assertTrue(
        acceptsFirstUse(verifierB, owner.getName(), pat.getJwtToken()), "B accepts the live PAT");
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
  void patCreatedAfterBothVerifiersCachedTheOwnerIsAcceptedOnFirstUseWithoutASweep(
      TestNamespace ns) {
    User owner = CredentialFixtures.createUser(ns, "twonew");
    PersonalAccessToken first = CredentialFixtures.createPat(owner, ns.prefix("first"));
    assertTrue(acceptsFirstUse(verifierA, owner.getName(), first.getJwtToken()));
    assertTrue(acceptsFirstUse(verifierB, owner.getName(), first.getJwtToken()));
    verifierA.stop();
    verifierB.stop();
    waitOutMissRefreshMinAge();
    double readsA = verifierA.reads("unknown_token");
    double readsB = verifierB.reads("unknown_token");

    PersonalAccessToken second = CredentialFixtures.createPat(owner, ns.prefix("second"));

    assertTrue(acceptsFirstUse(verifierA, owner.getName(), second.getJwtToken()), "A, first use");
    assertTrue(acceptsFirstUse(verifierB, owner.getName(), second.getJwtToken()), "B, first use");
    assertTrue(verifierA.reads("unknown_token") > readsA, "A re-read the owner for the token");
    assertTrue(verifierB.reads("unknown_token") > readsB, "B re-read the owner for the token");
  }

  @Test
  void patOfAnOwnerNeitherVerifierHasSeenIsAcceptedByBothOnFirstUse(TestNamespace ns) {
    User owner = CredentialFixtures.createUser(ns, "twocold");
    PersonalAccessToken pat = CredentialFixtures.createPat(owner, ns.prefix("pat"));

    assertTrue(acceptsFirstUse(verifierA, owner.getName(), pat.getJwtToken()), "A, first use");
    assertTrue(acceptsFirstUse(verifierB, owner.getName(), pat.getJwtToken()), "B, first use");
  }

  /**
   * The first answer the verifier can give: a check that cannot confirm is repeated, because it
   * says nothing about the credential, while a rejection is returned at once.
   */
  private static boolean acceptsFirstUse(TestVerifier verifier, String userName, String token) {
    AtomicBoolean accepted = new AtomicBoolean();
    Awaitility.await("a definitive answer")
        .atMost(FIRST_USE_MILLIS, TimeUnit.MILLISECONDS)
        .pollInterval(POLL_MILLIS, TimeUnit.MILLISECONDS)
        .ignoreExceptionsInstanceOf(CredentialUnavailableException.class)
        .until(
            () -> {
              accepted.set(verifier.accepts(userName, token));
              return true;
            });
    return accepted.get();
  }

  /**
   * {@code stop()} interrupts the sweep thread without waiting for it, and a sweep blocked in a
   * database read runs on until the read returns. The wait lets such a sweep install before the
   * next PAT exists, and lets the owner's last read age past {@code missRefreshMinAge}, so the
   * PAT's first use reads the owner again.
   */
  private static void waitOutMissRefreshMinAge() {
    Awaitility.await("the owner's last read is older than missRefreshMinAge")
        .pollDelay(MISS_REFRESH_MIN_AGE_MILLIS * 3, TimeUnit.MILLISECONDS)
        .until(() -> true);
  }

  private static void awaitRejected(TestVerifier verifier, String userName, String token) {
    Awaitility.await("rejected within maxStaleness")
        .atMost(MAX_STALENESS_MILLIS + MARGIN_MILLIS, TimeUnit.MILLISECONDS)
        .pollInterval(POLL_MILLIS, TimeUnit.MILLISECONDS)
        .ignoreExceptionsInstanceOf(CredentialUnavailableException.class)
        .untilAsserted(() -> assertFalse(verifier.accepts(userName, token)));
  }
}
