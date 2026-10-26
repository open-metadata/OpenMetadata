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

package org.openmetadata.service.security.credentials;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.dropwizard.util.Duration;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.openmetadata.service.security.AuthenticationException;

/**
 * A real verifier over an in-memory source and a hand-moved clock. Assertions are on
 * what a caller observes (require passes or throws which exception) and on statement counts where
 * the contract is about database load.
 */
@Timeout(60)
class CredentialVerifierTest {
  private static final CredentialVerificationConfig DEFAULTS =
      CredentialVerificationConfig.defaults();
  private static final long SECOND = TimeUnit.SECONDS.toNanos(1);
  private static final long MILLISECOND = TimeUnit.MILLISECONDS.toNanos(1);
  private static final long MAX_STALENESS_NANOS = 5 * SECOND;
  private static final long DEEP_VERIFY_INTERVAL_NANOS = 10 * TimeUnit.MINUTES.toNanos(1);
  private static final String ALICE = "alice";
  private static final String BOB = "bob";
  private static final String TOKEN_A = "pat-token-a";
  private static final String TOKEN_B = "pat-token-b";
  private static final String TOKEN_C = "pat-token-c";
  private static final String JWT_OLD = "bot-jwt-old";
  private static final String JWT_NEW = "bot-jwt-new";
  private static final String NEVER_ISSUED = "never-issued";
  private static final String REJECTED = "rejected";

  private record Revocation(CredentialSubject subject, Set<TokenDigest> removed) {}

  private final FakeCredentialSource source = new FakeCredentialSource();
  private final FakeTicker ticker = new FakeTicker();
  private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
  private final List<Revocation> revocations = new CopyOnWriteArrayList<>();
  private ExecutorService threads;
  private CredentialVerifier verifier;

  @BeforeEach
  void startThreads() {
    threads = Executors.newVirtualThreadPerTaskExecutor();
  }

  @AfterEach
  void stopEverything() {
    threads.shutdownNow();
    if (verifier != null) {
      verifier.stop();
    }
  }

  @Test
  void revokedTokenIsRejectedWithinMaxStalenessWithNoSweeper() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);

    source.revokeAll(ALICE);
    ticker.advanceNanos(MAX_STALENESS_NANOS - 1);
    assertAccepted(ALICE, TOKEN_A);
    assertEquals(1, source.fullReads());

    ticker.advanceNanos(2);
    AuthenticationException rejected = assertRejected(ALICE, TOKEN_A);

    assertEquals("Not Authorized! rejected", rejected.getMessage());
    assertEquals(2, source.fullReads());
    assertEquals(0, source.fingerprintReads());
    assertEquals(1.0, counter("om.credential.reads", "reason", "stale", "outcome", "ok"));
  }

  @Test
  void revokedTokenIsRejectedAfterOneSweep() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);

    source.revokeAll(ALICE);
    sweepAfterInterval();

    assertRejected(ALICE, TOKEN_A);
    assertEquals(1, source.fingerprintReads());
    assertEquals(2, source.fullReads());
    assertEquals(1.0, counter("om.credential.sweep.changed.subjects"));
    assertEquals(1.0, counter("om.credential.sweep.queries", "query", "fingerprint"));
    assertEquals(1.0, counter("om.credential.sweep.queries", "query", "full"));
  }

  @Test
  void sweepReconfirmationExtendsTrustWithoutAFullRead() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);

    ticker.advanceNanos(4 * SECOND);
    verifier.sweepOnce();
    ticker.advanceNanos(4 * SECOND);

    assertAccepted(ALICE, TOKEN_A);
    assertEquals(1, source.fullReads());
    assertEquals(1, source.fingerprintReads());
    assertEquals(0.0, counter("om.credential.sweep.changed.subjects"));
  }

  @Test
  void slowLoadThatStartedBeforeRevocationCannotExtendTrust() throws Exception {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    source.blockNextRead();
    Future<Throwable> slow = requireAsync(ALICE, TOKEN_A);
    source.awaitReadStarted();

    source.revokeAll(ALICE);
    ticker.advanceNanos(SECOND);
    verifier.nudge(subject(ALICE));
    verifier.sweepOnce();
    source.releaseReads();

    assertInstanceOf(AuthenticationException.class, slow.get());
    assertRejected(ALICE, TOKEN_A);
    assertEquals(2, source.fullReads());
  }

  @Test
  void loadThatFinishesOutsideTheBoundCannotConfirm() throws Exception {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    source.blockNextRead();
    Future<Throwable> slow = requireAsync(ALICE, TOKEN_A);
    source.awaitReadStarted();

    ticker.advanceNanos(MAX_STALENESS_NANOS + 1);
    source.releaseReads();

    assertInstanceOf(CredentialUnavailableException.class, slow.get());
    assertEquals(1.0, counter("om.credential.unavailable", "cause", "timeout"));
  }

  @Test
  void joinedLoadIsTrustedOnlyUntilItsOwnStampAges() throws Exception {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    source.blockNextRead();
    List<Future<Throwable>> checks =
        IntStream.range(0, 100).mapToObj(i -> requireAsync(ALICE, TOKEN_A)).toList();
    source.awaitReadStarted();
    source.releaseReads();
    for (Future<Throwable> check : checks) {
      assertNull(check.get());
    }
    assertEquals(1, source.fullReads());
    assertEquals(100.0, counter("om.credential.checks", "decision", "accept"));

    ticker.advanceNanos(MAX_STALENESS_NANOS + 1);
    source.failReads();

    assertUnavailable(ALICE, TOKEN_A);
  }

  @Test
  void newTokenOnPeerIsAcceptedOnFirstUse() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);

    source.addPat(ALICE, TOKEN_B);
    ticker.advanceNanos(600 * MILLISECOND);

    assertAccepted(ALICE, TOKEN_B);
    assertEquals(2, source.fullReads());
    assertEquals(1.0, counter("om.credential.reads", "reason", "unknown_token", "outcome", "ok"));
  }

  @Test
  void tokenCreatedRightAfterAReconfirmationIsAcceptedOnFirstUse() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);
    sweepAfterInterval();

    source.addPat(ALICE, TOKEN_B);
    ticker.advanceNanos(100 * MILLISECOND);

    assertAccepted(ALICE, TOKEN_B);
    assertEquals(2, source.fullReads());
    assertEquals(1.0, counter("om.credential.reads", "reason", "unknown_token", "outcome", "ok"));
  }

  @Test
  void unknownTokenReloadsAreRateLimited() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);

    for (int millisecond = 1; millisecond <= 1000; millisecond++) {
      ticker.advanceNanos(MILLISECOND);
      assertRejected(ALICE, NEVER_ISSUED);
    }

    assertEquals(3, source.fullReads());
    assertEquals(1000.0, counter("om.credential.checks", "decision", "reject"));
  }

  @Test
  void sourceFailureIsUnavailableAndDoesNotPoisonTheCache() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    source.failReads();

    assertUnavailable(ALICE, TOKEN_A);
    assertEquals(0, verifier.cachedSubjects());

    source.heal();
    assertAccepted(ALICE, TOKEN_A);
    assertEquals(1.0, counter("om.credential.unavailable", "cause", "read_failed"));
    assertEquals(1.0, counter("om.credential.reads", "reason", "miss", "outcome", "error"));
    assertEquals(1.0, counter("om.credential.reads", "reason", "miss", "outcome", "ok"));
  }

  @Test
  void permitTimeoutYieldsCredentialUnavailable() throws Exception {
    source.withPats(ALICE, TOKEN_A).withPats(BOB, TOKEN_B);
    verifier(
        new CredentialVerificationConfig(
            null, null, null, Duration.milliseconds(100), 1, null, null, null, null));
    source.blockNextRead();
    Future<Throwable> holder = requireAsync(ALICE, TOKEN_A);
    source.awaitReadStarted();

    assertUnavailable(BOB, TOKEN_B);

    assertEquals(0, source.fullReadsOf(BOB));
    assertEquals(1.0, counter("om.credential.unavailable", "cause", "no_permit"));
    assertEquals(1.0, counter("om.credential.reads", "reason", "miss", "outcome", "no_permit"));
    source.releaseReads();
    assertNull(holder.get());
    assertAccepted(BOB, TOKEN_B);
  }

  @Test
  void unchangedMechanismVersionAvoidsTheDecrypt() {
    source.withJwtMechanism(ALICE, JWT_OLD);
    verifier(DEFAULTS);
    assertAccepted(ALICE, JWT_OLD);
    assertEquals(1, source.decrypts());

    source.addPat(ALICE, TOKEN_B);
    sweepAfterInterval();
    assertAccepted(ALICE, TOKEN_B);
    assertEquals(1, source.decrypts());

    for (int reload = 0; reload < 10; reload++) {
      ticker.advanceNanos(500 * MILLISECOND);
      assertRejected(ALICE, NEVER_ISSUED);
    }
    assertEquals(12, source.fullReads());
    assertEquals(1, source.decrypts());

    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    verifier.sweepOnce();
    assertEquals(2, source.decrypts());
    assertEquals(1.0, counter("om.credential.reads", "reason", "deep", "outcome", "ok"));
  }

  @Test
  void externalSecretsRotationIsSeenWithinTheBound() {
    source.withSecretReferenceMechanism(BOB, JWT_OLD);
    verifier(DEFAULTS);
    assertAccepted(BOB, JWT_OLD);

    source.rotateSecretBehindReference(BOB, JWT_NEW);
    sweepAfterInterval();

    assertRejected(BOB, JWT_OLD);
    assertAccepted(BOB, JWT_NEW);
    assertEquals(2, source.decrypts());
    assertEquals(0.0, counter("om.credential.reads", "reason", "deep", "outcome", "ok"));
  }

  @Test
  void refreshNowReadsNothingForAnUncachedSubject() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);

    verifier.refreshNow(subject(ALICE));

    assertEquals(0, source.fullReads());
  }

  @Test
  void refreshNowBeatsAReadInFlightForTheSameSubject() throws Exception {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    source.blockNextRead();
    Future<Throwable> slow = requireAsync(ALICE, TOKEN_A);
    source.awaitReadStarted();

    source.revokeAll(ALICE);
    ticker.advanceNanos(MILLISECOND);
    verifier.refreshNow(subject(ALICE));
    assertEquals(2, source.fullReads());
    source.releaseReads();

    assertInstanceOf(AuthenticationException.class, slow.get());
    assertRejected(ALICE, TOKEN_A);
    assertEquals(1.0, counter("om.credential.reads", "reason", "refresh", "outcome", "ok"));
  }

  @Test
  void refreshNowSwallowsASourceFailure() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);
    source.failReads();

    assertDoesNotThrow(() -> verifier.refreshNow(subject(ALICE)));

    assertEquals(1.0, counter("om.credential.reads", "reason", "refresh", "outcome", "error"));
    assertAccepted(ALICE, TOKEN_A);
  }

  @Test
  void inPlacePatEditIsCaughtByDeepVerify() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);

    source.replacePatInPlace(ALICE, TOKEN_A, TOKEN_B);
    ticker.advanceNanos(2 * SECOND);
    verifier.sweepOnce();
    assertAccepted(ALICE, TOKEN_A);
    assertRejected(ALICE, TOKEN_B);

    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    verifier.sweepOnce();
    assertRejected(ALICE, TOKEN_A);
    assertAccepted(ALICE, TOKEN_B);
  }

  @Test
  void basicAuthMechanismContributesNoDigest() {
    source.withBasicMechanism(ALICE).withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);

    assertAccepted(ALICE, TOKEN_A);
    assertRejected(ALICE, "basic");
    assertEquals(0, source.decrypts());
  }

  @Test
  void softAndHardDeleteRevokeEveryToken() {
    source.withJwtMechanism(ALICE, JWT_OLD).withPats(ALICE, TOKEN_A);
    source.withPats(BOB, TOKEN_B);
    verifier(DEFAULTS);
    assertAccepted(ALICE, JWT_OLD);
    assertAccepted(ALICE, TOKEN_A);
    assertAccepted(BOB, TOKEN_B);

    source.softDelete(ALICE);
    source.hardDelete(BOB);
    sweepAfterInterval();

    assertRejected(ALICE, JWT_OLD);
    assertRejected(ALICE, TOKEN_A);
    assertRejected(BOB, TOKEN_B);
    assertEquals(2.0, counter("om.credential.sweep.changed.subjects"));
  }

  @Test
  void sweepBatchFailureDoesNotStopOtherBatches() {
    List<String> users = List.of("u1", "u2", "u3", "u4");
    users.forEach(user -> source.withPats(user, "token-" + user));
    verifier(new CredentialVerificationConfig(null, null, null, null, null, null, 4, 2, null));
    users.forEach(user -> assertAccepted(user, "token-" + user));
    users.forEach(source::revokeAll);
    source.failNextFingerprintRead();

    sweepAfterInterval();

    assertEquals(2, source.fingerprintReads());
    long rejectedNow = users.stream().filter(user -> isRejected(user, "token-" + user)).count();
    assertEquals(2, rejectedNow);
    ticker.advanceNanos(MAX_STALENESS_NANOS + 1);
    assertFalse(verifier.healthCheck().execute().isHealthy());

    verifier.sweepOnce();
    assertTrue(verifier.healthCheck().execute().isHealthy());
    users.forEach(user -> assertRejected(user, "token-" + user));
  }

  @Test
  void unrecognizedIsRejectedAndNotStoredPassesWithoutARead() {
    verifier(DEFAULTS);

    AuthenticationException rejected =
        assertThrows(
            AuthenticationException.class,
            () ->
                verifier.require(
                    new OmCredential.Unrecognized("isBot=false, tokenType=BOT"),
                    TOKEN_A,
                    "Invalid personal access token!"));
    assertEquals("Not Authorized! Invalid personal access token!", rejected.getMessage());

    assertDoesNotThrow(() -> verifier.require(new OmCredential.NotStored(), TOKEN_A, REJECTED));
    assertEquals(0, source.fullReads());
  }

  @Test
  void oneEntryHoldsMechanismAndPatDigests() {
    source.withJwtMechanism(BOB, JWT_OLD).withPats(BOB, TOKEN_A, TOKEN_B);
    verifier(DEFAULTS);

    assertAccepted(BOB, JWT_OLD);
    assertAccepted(BOB, TOKEN_A);
    assertAccepted(BOB, TOKEN_B);
    assertAccepted("Bob", TOKEN_B);

    assertEquals(1, verifier.cachedSubjects());
    assertEquals(1, source.fullReads());
    assertEquals(1.0, gauge("om.credential.cached.subjects"));
  }

  @Test
  void cacheNeverExceedsMaxSubjects() {
    IntStream.range(0, 1000).forEach(i -> source.withPats("user-" + i, "token-" + i));
    verifier(new CredentialVerificationConfig(null, null, null, null, null, null, 10, 10, null));

    IntStream.range(0, 1000).forEach(i -> assertAccepted("user-" + i, "token-" + i));

    assertTrue(verifier.cachedSubjects() <= 10, "cached " + verifier.cachedSubjects());
    assertTrue(counter("om.credential.evictions", "cause", "size") >= 990);
    assertAccepted("user-0", "token-0");
    assertRejected("user-0", "token-1");
  }

  @Test
  void sweepsDoNotKeepIdleSubjectsAlive() {
    source.withPats(ALICE, TOKEN_A);
    verifier(
        new CredentialVerificationConfig(
            null, null, null, null, null, Duration.minutes(1), null, null, null));
    assertAccepted(ALICE, TOKEN_A);

    int readsWhileAlive = 0;
    int readsAfterExpiry = 0;
    for (int second = 1; second <= 120; second++) {
      ticker.advanceNanos(SECOND);
      verifier.sweepOnce();
      if (second == 59) {
        readsWhileAlive = source.fingerprintReads();
      }
      if (second == 61) {
        readsAfterExpiry = source.fingerprintReads();
      }
    }

    assertEquals(59, readsWhileAlive);
    assertEquals(readsAfterExpiry, source.fingerprintReads());
    assertTrue(readsAfterExpiry <= 60, "reads after expiry " + readsAfterExpiry);
    assertEquals(0, verifier.cachedSubjects());
    assertEquals(1.0, counter("om.credential.evictions", "cause", "idle"));
  }

  @Test
  void revocationListenerSeesRemovedDigest() {
    source.withPats(ALICE, TOKEN_A, TOKEN_B);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);

    source.revokePat(ALICE, TOKEN_A);
    sweepAfterInterval();
    assertEquals(
        List.of(new Revocation(subject(ALICE), Set.of(TokenDigest.of(TOKEN_A)))), revocations);
    assertEquals(1.0, counter("om.credential.revocations.observed"));

    source.addPat(ALICE, TOKEN_C);
    sweepAfterInterval();
    assertEquals(1, revocations.size());
  }

  @Test
  void aFailingListenerDoesNotBreakTheInstall() {
    source.withPats(ALICE, TOKEN_A);
    verifier =
        new CredentialVerifier(
            DEFAULTS,
            source,
            ticker,
            new CredentialMetrics(registry),
            List.of(
                (subject, removed) -> {
                  throw new IllegalStateException("listener down");
                }));
    assertAccepted(ALICE, TOKEN_A);

    source.revokeAll(ALICE);
    assertDoesNotThrow(this::sweepAfterInterval);

    assertRejected(ALICE, TOKEN_A);
  }

  @Test
  void tickerWrapAroundKeepsTheBound() {
    FakeTicker wrapping = new FakeTicker(Long.MAX_VALUE - SECOND);
    source.withPats(ALICE, TOKEN_A);
    verifier =
        new CredentialVerifier(
            DEFAULTS, source, wrapping, new CredentialMetrics(registry), List.of());
    assertAccepted(ALICE, TOKEN_A);

    wrapping.advanceNanos(2 * SECOND);
    assertAccepted(ALICE, TOKEN_A);
    assertEquals(1, source.fullReads());
    wrapping.advanceNanos(2 * SECOND);
    verifier.sweepOnce();
    wrapping.advanceNanos(4 * SECOND);
    assertAccepted(ALICE, TOKEN_A);
    assertEquals(1, source.fullReads());
    assertTrue(verifier.healthCheck().execute().isHealthy());

    source.revokeAll(ALICE);
    wrapping.advanceNanos(MAX_STALENESS_NANOS + 1);
    assertRejected(ALICE, TOKEN_A);
    assertEquals(2, source.fullReads());
  }

  @Test
  void healthReflectsTheAgeOfTheLastCompleteSweep() {
    verifier(DEFAULTS);
    assertTrue(verifier.healthCheck().execute().isHealthy());

    ticker.advanceNanos(MAX_STALENESS_NANOS);
    assertTrue(verifier.healthCheck().execute().isHealthy());
    assertEquals(5.0, gauge("om.credential.sweep.last.complete.age.seconds"));

    ticker.advanceNanos(1);
    assertFalse(verifier.healthCheck().execute().isHealthy());
    assertEquals(
        "No complete credential sweep for 5000 ms; the bound is 5000 ms",
        verifier.healthCheck().execute().getMessage());

    verifier.sweepOnce();
    assertTrue(verifier.healthCheck().execute().isHealthy());
    assertEquals(0.0, gauge("om.credential.sweep.last.complete.age.seconds"));
  }

  @Test
  void retryAfterRoundsTheSweepIntervalUpToWholeSeconds() {
    assertEquals(2, verifier(DEFAULTS).retryAfterSeconds());
    assertEquals(
        2,
        verifier(
                new CredentialVerificationConfig(
                    null, Duration.milliseconds(1500), null, null, null, null, null, null, null))
            .retryAfterSeconds());
    assertEquals(
        1,
        verifier(
                new CredentialVerificationConfig(
                    null, Duration.seconds(1), null, null, null, null, null, null, null))
            .retryAfterSeconds());
  }

  @Test
  void startIsIdempotentAndSweepsOnOneDaemonThread() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);

    verifier.start();
    verifier.start();

    await().atMost(10, TimeUnit.SECONDS).until(() -> source.fingerprintReads() >= 1);
    List<Thread> sweepThreads = sweepThreads();
    assertEquals(1, sweepThreads.size());
    assertTrue(sweepThreads.getFirst().isDaemon());

    verifier.stop();
    await().atMost(10, TimeUnit.SECONDS).until(() -> sweepThreads().isEmpty());
  }

  @Test
  void nudgeIsDrainedOnTheSweepThreadNotTheCaller() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);
    source.revokeAll(ALICE);

    verifier.nudge(subject(ALICE));
    assertEquals(1, source.fullReads());

    sweepAfterInterval();
    assertEquals(2, source.fullReads());
    assertRejected(ALICE, TOKEN_A);

    verifier.nudge(subject(BOB));
    sweepAfterInterval();
    assertEquals(2, source.fullReads());
    assertEquals(
        2.0, counter("om.credential.nudges", "direction", "received", "outcome", "queued"));
    assertEquals(1.0, counter("om.credential.reads", "reason", "nudge", "outcome", "ok"));
  }

  @Test
  void nudgesBeyondTheCapAreDropped() {
    verifier(new CredentialVerificationConfig(null, null, null, null, null, null, 10, 10, null));

    IntStream.range(0, 11).forEach(i -> verifier.nudge(subject("user-" + i)));

    assertEquals(
        10.0, counter("om.credential.nudges", "direction", "received", "outcome", "queued"));
    assertEquals(
        1.0, counter("om.credential.nudges", "direction", "received", "outcome", "dropped"));
  }

  private CredentialVerifier verifier(CredentialVerificationConfig config) {
    verifier =
        new CredentialVerifier(
            config,
            source,
            ticker,
            new CredentialMetrics(registry),
            List.of(
                (subject, removed) ->
                    revocations.add(new Revocation(subject, Set.copyOf(removed)))));
    return verifier;
  }

  /** A sweep as production runs it: one sweepInterval after whatever happened last. */
  private void sweepAfterInterval() {
    ticker.advanceNanos(2 * SECOND);
    verifier.sweepOnce();
  }

  private static CredentialSubject subject(String principal) {
    return CredentialSubject.of(principal);
  }

  private static OmCredential stored(String principal) {
    return new OmCredential.Stored(subject(principal));
  }

  private void assertAccepted(String principal, String token) {
    assertDoesNotThrow(() -> verifier.require(stored(principal), token, REJECTED));
  }

  private AuthenticationException assertRejected(String principal, String token) {
    return assertThrows(
        AuthenticationException.class, () -> verifier.require(stored(principal), token, REJECTED));
  }

  private CredentialUnavailableException assertUnavailable(String principal, String token) {
    return assertThrows(
        CredentialUnavailableException.class,
        () -> verifier.require(stored(principal), token, REJECTED));
  }

  private boolean isRejected(String principal, String token) {
    try {
      verifier.require(stored(principal), token, REJECTED);
      return false;
    } catch (AuthenticationException rejected) {
      return true;
    }
  }

  private Future<Throwable> requireAsync(String principal, String token) {
    return threads.submit(
        () -> {
          try {
            verifier.require(stored(principal), token, REJECTED);
            return null;
          } catch (RuntimeException failure) {
            return failure;
          }
        });
  }

  private double counter(String name, String... tags) {
    Counter counter = registry.find(name).tags(tags).counter();
    return counter == null ? 0.0 : counter.count();
  }

  private double gauge(String name) {
    return registry.get(name).gauge().value();
  }

  private static List<Thread> sweepThreads() {
    return Thread.getAllStackTraces().keySet().stream()
        .filter(thread -> thread.getName().equals("om-credential-verifier"))
        .toList();
  }
}
