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
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.github.benmanes.caffeine.cache.Ticker;
import io.dropwizard.util.Duration;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;
import java.util.stream.IntStream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.service.security.AuthenticationException;
import org.slf4j.LoggerFactory;

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
  private static final long MINUTE = TimeUnit.MINUTES.toNanos(1);
  private static final long MAX_STALENESS_NANOS = 5 * SECOND;
  private static final long MISS_REFRESH_MIN_AGE = 500 * MILLISECOND;
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

  /** A check on its own thread, so a test can wait until it is parked and read its outcome. */
  private record RunningCheck(Thread thread, CompletableFuture<Throwable> outcome) {
    Throwable result() throws Exception {
      return outcome.get(30, TimeUnit.SECONDS);
    }
  }

  /** A read of alice other than a check's; the test holds it in the source until it releases it. */
  enum SlowRead {
    REFRESH {
      @Override
      Future<?> start(CredentialVerifierTest test) {
        return test.threads.submit(() -> test.verifier.refreshNow(subject(ALICE)));
      }
    },
    /**
     * The sweep pass that drains the nudge. Its fingerprint read fails, because the pass would
     * otherwise re-read alice after the drain and so repair whatever the nudge read installed.
     */
    NUDGE {
      @Override
      Future<?> start(CredentialVerifierTest test) {
        test.verifier.nudge(subject(ALICE));
        test.source.failNextFingerprintRead();
        return test.threads.submit(test.verifier::sweepOnce);
      }
    },
    /** A sweep pass that re-reads alice in full, because a new token moved her fingerprint. */
    SWEEP {
      @Override
      Future<?> start(CredentialVerifierTest test) {
        test.source.addPat(ALICE, TOKEN_B);
        return test.threads.submit(test.verifier::sweepOnce);
      }
    };

    abstract Future<?> start(CredentialVerifierTest test);
  }

  /** How a full read that includes the failing subject ends. */
  enum ReadFailure {
    EXCEPTION {
      @Override
      void injectInto(FakeCredentialSource source, String principal) {
        source.poisonReadsOf(principal);
      }
    },
    ERROR {
      @Override
      void injectInto(FakeCredentialSource source, String principal) {
        source.failReadsOfWithError(principal);
      }
    };

    abstract void injectInto(FakeCredentialSource source, String principal);
  }

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
  void aReconfirmationIsTrustedFromBeforeItsFingerprintStatement() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);
    source.duringNextFingerprints(revokeAliceThenWait(3 * SECOND));

    sweepAfterInterval();
    ticker.advanceNanos(2 * SECOND + 1);
    source.failReads();

    assertEquals(1, source.fullReads());
    assertUnavailable(ALICE, TOKEN_A);
  }

  @Test
  void aSweepRereadIsTrustedFromBeforeItsReadStatement() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);
    source.addPat(ALICE, TOKEN_B);
    source.duringNextRead(revokeAliceThenWait(3 * SECOND));

    sweepAfterInterval();
    ticker.advanceNanos(2 * SECOND + 1);
    source.failReads();

    assertEquals(2, source.fullReads());
    assertUnavailable(ALICE, TOKEN_A);
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
    ticker.advanceNanos(MILLISECOND);
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
    verifier(loadTimeoutOf(Duration.seconds(4)));
    source.blockNextRead();
    List<RunningCheck> checks =
        IntStream.range(0, 100).mapToObj(i -> startCheck(ALICE, TOKEN_A)).toList();
    source.awaitReadStarted();
    await("every check waits on the one read")
        .atMost(10, TimeUnit.SECONDS)
        .until(() -> checks.stream().allMatch(check -> isParked(check.thread())));
    source.releaseReads();
    for (RunningCheck check : checks) {
      assertNull(check.result());
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

    assertEquals(2, assertUnavailable(ALICE, TOKEN_A).retryAfterSeconds());
    assertEquals(0, verifier.cachedSubjects());

    source.heal();
    ticker.advanceNanos(MISS_REFRESH_MIN_AGE);
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
            null, null, null, Duration.seconds(1), 1, null, null, null, null));
    source.blockNextRead();
    Future<Throwable> holder = requireAsync(ALICE, TOKEN_A);
    source.awaitReadStarted();

    assertUnavailable(BOB, TOKEN_B);

    assertEquals(0, source.fullReadsOf(BOB));
    assertEquals(1.0, counter("om.credential.unavailable", "cause", "no_permit"));
    assertEquals(1.0, counter("om.credential.reads", "reason", "miss", "outcome", "no_permit"));
    assertInstanceOf(CredentialUnavailableException.class, holder.get());
    assertEquals(1.0, counter("om.credential.unavailable", "cause", "timeout"));
    source.releaseReads();
    await().atMost(10, TimeUnit.SECONDS).until(() -> verifier.cachedSubjects() == 1);
    ticker.advanceNanos(MISS_REFRESH_MIN_AGE);
    assertAccepted(BOB, TOKEN_B);
  }

  @Test
  void anErrorWhileAWithdrawnReadIsRecordedStillWithdrawsItsRegistration() throws Exception {
    source.withPats(ALICE, TOKEN_A).withPats(BOB, TOKEN_B);
    AtomicReference<Thread> armed = new AtomicReference<>();
    Ticker failingOnceOnTheArmedThread =
        () -> {
          if (Thread.currentThread() == armed.get()) {
            armed.set(null);
            throw new OutOfMemoryError("injected while the withdrawn read is recorded");
          }
          return ticker.read();
        };
    verifier =
        new CredentialVerifier(
            new CredentialVerificationConfig(
                null, null, null, Duration.seconds(1), 1, null, null, null, null),
            source,
            failingOnceOnTheArmedThread,
            new CredentialMetrics(registry),
            List.of());
    source.blockNextRead();
    RunningCheck holder = startCheck(ALICE, TOKEN_A);
    source.awaitReadStarted();
    RunningCheck waiter = startCheck(BOB, TOKEN_B);
    awaitParked(waiter.thread());

    armed.set(waiter.thread());
    assertInstanceOf(OutOfMemoryError.class, waiter.result());
    source.releaseReads();
    holder.result();

    assertAccepted(BOB, TOKEN_B);
    assertEquals(1, source.fullReadsOf(BOB));
  }

  @Test
  void aBlockedReadAnswersCannotConfirmWithinLoadTimeoutAndStartsNoSecondRead() throws Exception {
    source.withPats(ALICE, TOKEN_A).withPats(BOB, TOKEN_B);
    verifier(
        new CredentialVerificationConfig(
            null, null, null, Duration.seconds(1), 2, null, null, null, null));
    source.blockNextRead();

    assertUnavailable(ALICE, TOKEN_A);
    ticker.advanceNanos(600 * MILLISECOND);
    assertUnavailable(ALICE, TOKEN_A);
    assertAccepted(BOB, TOKEN_B);

    assertEquals(1, source.fullReadsOf(ALICE));
    assertEquals(1, source.fullReadsOf(BOB));
    assertEquals(2.0, counter("om.credential.unavailable", "cause", "timeout"));
    source.releaseReads();
    await().atMost(10, TimeUnit.SECONDS).until(() -> verifier.cachedSubjects() == 2);
    assertAccepted(ALICE, TOKEN_A);
    assertEquals(1, source.fullReadsOf(ALICE));
  }

  @Test
  void anErrorInsideTheSourceFailsTheStarterAndItsJoinerAtOnce() throws Exception {
    source.withPats(ALICE, TOKEN_A);
    verifier(loadTimeoutOf(Duration.seconds(4)));
    source.blockNextRead();
    source.failReadsWithError();
    RunningCheck starter = startCheck(ALICE, TOKEN_A);
    source.awaitReadStarted();
    RunningCheck joiner = startCheck(ALICE, TOKEN_A);
    awaitParked(joiner.thread());

    source.releaseReads();

    assertInstanceOf(CredentialUnavailableException.class, starter.result());
    assertInstanceOf(CredentialUnavailableException.class, joiner.result());
    assertEquals(2.0, counter("om.credential.unavailable", "cause", "read_failed"));
    assertEquals(0.0, counter("om.credential.unavailable", "cause", "timeout"));
    assertEquals(1.0, counter("om.credential.reads", "reason", "miss", "outcome", "error"));
  }

  @Test
  void aReadWhosePoolThreadCannotBeCreatedLeavesNothingForLaterChecksToJoin() {
    source.withPats(ALICE, TOKEN_A);
    AtomicBoolean failNextThread = new AtomicBoolean(true);
    ThreadFactory threadsThatFailOnce =
        task -> {
          if (failNextThread.compareAndSet(true, false)) {
            throw new OutOfMemoryError("unable to create native thread: possibly out of memory");
          }
          return Thread.ofPlatform().daemon().unstarted(task);
        };
    verifier =
        new CredentialVerifier(
            loadTimeoutOf(Duration.seconds(1)),
            source,
            ticker,
            new CredentialMetrics(registry),
            List.of(),
            threadsThatFailOnce);

    assertThrows(OutOfMemoryError.class, () -> verifier.require(stored(ALICE), TOKEN_A, REJECTED));
    ticker.advanceNanos(5 * MINUTE);
    assertAccepted(ALICE, TOKEN_A);
    ticker.advanceNanos(5 * MINUTE);
    assertAccepted(ALICE, TOKEN_A);

    assertEquals(2, source.fullReadsOf(ALICE));
  }

  @Test
  void aCheckThatJoinsAnOldReadLackingItsTokenReadsAgainBeforeAnswering() throws Exception {
    source.withPats(ALICE, TOKEN_A);
    verifier(loadTimeoutOf(Duration.seconds(4)));
    source.blockNextRead();
    RunningCheck first = startCheck(ALICE, TOKEN_A);
    source.awaitReadStarted();
    ticker.advanceNanos(600 * MILLISECOND);
    source.addPat(ALICE, TOKEN_B);
    RunningCheck second = startCheck(ALICE, TOKEN_B);
    awaitParked(second.thread());

    source.releaseReads();

    assertNull(first.result());
    assertNull(second.result());
    assertEquals(2, source.fullReads());
  }

  @Test
  void aCheckThatJoinsAReadThatNeverReturnsCannotConfirm() throws Exception {
    source.withPats(ALICE, TOKEN_A);
    verifier(
        new CredentialVerificationConfig(
            null, null, null, Duration.seconds(1), null, null, null, null, null));
    source.blockNextRead();
    RunningCheck first = startCheck(ALICE, TOKEN_A);
    source.awaitReadStarted();
    ticker.advanceNanos(600 * MILLISECOND);
    source.addPat(ALICE, TOKEN_B);

    assertUnavailable(ALICE, TOKEN_B);

    assertEquals(1, source.fullReads());
    assertInstanceOf(CredentialUnavailableException.class, first.result());
    source.releaseReads();
  }

  @Test
  void aCheckThatBecomesTheOwnerAfterTheReadInstalledReadsNothing() throws Exception {
    source.withPats(ALICE, TOKEN_A);
    CountDownLatch gate = new CountDownLatch(1);
    AtomicReference<Thread> gatedThread = new AtomicReference<>();
    AtomicBoolean gateArmed = new AtomicBoolean(true);
    Ticker gatedTicker =
        () -> {
          if (Thread.currentThread() == gatedThread.get() && gateArmed.compareAndSet(true, false)) {
            awaitLatch(gate);
          }
          return ticker.read();
        };
    verifier =
        new CredentialVerifier(
            DEFAULTS, source, gatedTicker, new CredentialMetrics(registry), List.of());
    RunningCheck second = startCheck(ALICE, TOKEN_A, gatedThread::set);
    awaitParked(second.thread());

    assertAccepted(ALICE, TOKEN_A);
    gate.countDown();

    assertNull(second.result());
    assertEquals(1, source.fullReads());
    assertEquals(2.0, counter("om.credential.checks", "decision", "accept"));
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
  void aSubjectWhoseRowsCannotBeConvertedLeavesTheRestOfItsBatchConfirmed() {
    List<String> users = List.of("u1", "u2", "u3");
    users.forEach(user -> source.withJwtMechanism(user, "jwt-" + user));
    verifier(DEFAULTS);
    users.forEach(user -> assertAccepted(user, "jwt-" + user));
    users.forEach(user -> source.addPat(user, "pat-" + user));
    source.failConversionOf("u2");

    sweepAfterInterval();

    assertAccepted("u1", "pat-u1");
    assertAccepted("u3", "pat-u3");
    assertEquals(4, source.fullReads());
    assertAccepted("u2", "jwt-u2");
    ticker.advanceNanos(MAX_STALENESS_NANOS + 1);
    assertUnavailable("u2", "jwt-u2");
    assertEquals(1.0, counter("om.credential.unavailable", "cause", "subject_read_failed"));
    assertEquals(2.0, counter("om.credential.reads.unreadable.subjects"));
  }

  @Test
  void aColdCheckOfASubjectWhoseRowsCannotBeConvertedCannotConfirm() {
    source.withPats(ALICE, TOKEN_A);
    source.failConversionOf(ALICE);
    verifier(DEFAULTS);

    assertUnavailable(ALICE, TOKEN_A);

    assertEquals(0, verifier.cachedSubjects());
    assertEquals(1, source.fullReads());
    assertEquals(1.0, counter("om.credential.unavailable", "cause", "subject_read_failed"));
  }

  @Test
  void aSubjectTheSourceLeavesOutIsReadOncePerMissRefreshMinAgeHoweverOftenItIsChecked() {
    source.withJwtMechanism(BOB, JWT_OLD);
    verifier(DEFAULTS);
    assertAccepted(BOB, JWT_OLD);
    source.failConversionOf(BOB);

    checkEveryMillisecond(2000, BOB, NEVER_ISSUED);

    assertEquals(5, source.fullReadsOf(BOB));
    assertEquals(499.0, counter("om.credential.checks", "decision", "reject"));
    assertEquals(4.0, counter("om.credential.unavailable", "cause", "subject_read_failed"));
    assertEquals(1497.0, counter("om.credential.unavailable", "cause", "backoff"));
  }

  @ParameterizedTest
  @EnumSource(ReadFailure.class)
  void aSubjectWhoseReadsThrowIsReadOncePerMissRefreshMinAgeHoweverOftenItIsChecked(
      ReadFailure failure) {
    source.withJwtMechanism(BOB, JWT_OLD);
    verifier(DEFAULTS);
    assertAccepted(BOB, JWT_OLD);
    failure.injectInto(source, BOB);

    checkEveryMillisecond(2000, BOB, NEVER_ISSUED);

    assertEquals(5, source.fullReadsOf(BOB));
    assertEquals(4.0, counter("om.credential.unavailable", "cause", "read_failed"));
    assertEquals(1497.0, counter("om.credential.unavailable", "cause", "backoff"));
  }

  /**
   * The failed read is stamped at 0, alice becomes readable at T = 1 ns while that read is in
   * flight, and the read returns 100 ms after T. The backoff runs from the stamp, so a check at T +
   * missRefreshMinAge reads alice again.
   */
  @Test
  void aSubjectMadeReadableAfterAFailedReadIsAcceptedMissRefreshMinAgeAfterTheWrite() {
    source.withPats(ALICE, TOKEN_A);
    source.failConversionOf(ALICE);
    verifier(DEFAULTS);
    source.duringNextRead(
        () -> {
          ticker.advanceNanos(1);
          source.restoreConversionOf(ALICE);
          ticker.advanceNanos(100 * MILLISECOND);
        });
    assertUnavailable(ALICE, TOKEN_A);

    ticker.advanceNanos(300 * MILLISECOND);
    assertUnavailable(ALICE, TOKEN_A);
    ticker.advanceNanos(100 * MILLISECOND);
    assertAccepted(ALICE, TOKEN_A);

    assertEquals(2, source.fullReads());
    assertEquals(1.0, counter("om.credential.unavailable", "cause", "subject_read_failed"));
    assertEquals(1.0, counter("om.credential.unavailable", "cause", "backoff"));
  }

  @Test
  void subjectsSharingADeepReadWithOneWhoseReadThrowsAnErrorAreAcceptedOnTheirNextCheck() {
    List<String> users = IntStream.range(0, 50).mapToObj(i -> "u" + i).toList();
    users.forEach(user -> source.withPats(user, "first-" + user));
    source.withJwtMechanism(BOB, JWT_OLD);
    verifier(new CredentialVerificationConfig(null, null, null, null, null, null, 100, 100, null));
    users.forEach(user -> assertAccepted(user, "first-" + user));
    assertAccepted(BOB, JWT_OLD);
    source.failReadsOfWithError(BOB);
    source.duringNextFingerprints(() -> users.forEach(user -> source.addPat(user, "new-" + user)));

    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    assertNull(sweepAsScheduled());
    ticker.advanceNanos(100 * MILLISECOND);

    users.forEach(user -> assertAccepted(user, "new-" + user));
    assertEquals(0.0, counter("om.credential.unavailable", "cause", "backoff"));
    assertEquals(102, source.fullReads());
  }

  @Test
  void aSubjectWhoseSweepRereadFailedIsAcceptedAtItsFirstCheckAfterTheSourceRecovers() {
    source.withPats(ALICE, TOKEN_A).withJwtMechanism(BOB, JWT_OLD);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);
    assertAccepted(BOB, JWT_OLD);
    source.addPat(ALICE, TOKEN_B);
    source.withJwtMechanism(BOB, JWT_NEW);
    source.duringNextFingerprints(source::failReads);

    sweepAfterInterval();
    source.heal();
    ticker.advanceNanos(100 * MILLISECOND);

    assertAccepted(ALICE, TOKEN_B);
    assertAccepted(BOB, JWT_NEW);
    assertEquals(0.0, counter("om.credential.unavailable", "cause", "backoff"));
    assertEquals(1.0, counter("om.credential.reads", "reason", "sweep", "outcome", "error"));
  }

  @Test
  void aTokenCreatedAndUsedOnTheWritingServerIsAcceptedAfterOneFailedRefresh() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);
    ticker.advanceNanos(MISS_REFRESH_MIN_AGE);
    source.addPat(ALICE, TOKEN_B);
    source.failReads();

    verifier.refreshNow(subject(ALICE));
    source.heal();
    ticker.advanceNanos(50 * MILLISECOND);

    assertAccepted(ALICE, TOKEN_B);
    assertEquals(1.0, counter("om.credential.reads", "reason", "refresh", "outcome", "error"));
    assertEquals(0.0, counter("om.credential.unavailable", "cause", "backoff"));
  }

  /**
   * The failed read is stamped at 0 and throws 100 ms later, so its window ends at missRefreshMinAge
   * and not 100 ms after that.
   */
  @Test
  void aReadThatThrowsBacksOffFromItsStampNotFromWhenItFailed() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    source.duringNextRead(
        () -> {
          ticker.advanceNanos(100 * MILLISECOND);
          throw new IllegalStateException("statement failed late");
        });
    assertUnavailable(ALICE, TOKEN_A);

    ticker.advanceNanos(300 * MILLISECOND);
    assertUnavailable(ALICE, TOKEN_A);
    ticker.advanceNanos(100 * MILLISECOND);
    assertAccepted(ALICE, TOKEN_A);

    assertEquals(2, source.fullReadsOf(ALICE));
    assertEquals(1.0, counter("om.credential.unavailable", "cause", "read_failed"));
    assertEquals(1.0, counter("om.credential.unavailable", "cause", "backoff"));
  }

  /**
   * Bob's read is stamped at 0 and withdrawn after the 1 s wait, while the fake clock has moved to
   * 400 ms. His window runs from the stamp: a check at 400 ms is refused without a read, and one at
   * 500 ms reads.
   */
  @Test
  void aReadWithdrawnForWantOfASlotBacksOffFromItsStamp() throws Exception {
    source.withPats(ALICE, TOKEN_A).withPats(BOB, TOKEN_B);
    verifier(
        new CredentialVerificationConfig(
            null, null, null, Duration.seconds(1), 1, null, null, null, null));
    source.blockNextRead();
    RunningCheck holder = startCheck(ALICE, TOKEN_A);
    source.awaitReadStarted();
    RunningCheck waiter = startCheck(BOB, TOKEN_B);
    awaitParked(waiter.thread());
    ticker.advanceNanos(400 * MILLISECOND);
    assertInstanceOf(CredentialUnavailableException.class, waiter.result());

    assertUnavailable(BOB, TOKEN_B);
    assertEquals(1.0, counter("om.credential.unavailable", "cause", "backoff"));
    assertEquals(0, source.fullReadsOf(BOB));
    source.releaseReads();
    holder.result();
    ticker.advanceNanos(100 * MILLISECOND);
    assertAccepted(BOB, TOKEN_B);

    assertEquals(1, source.fullReadsOf(BOB));
  }

  @Test
  void aFreshEntryIsStillAcceptedWhileItsSubjectBacksOff() {
    source.withJwtMechanism(BOB, JWT_OLD);
    verifier(DEFAULTS);
    assertAccepted(BOB, JWT_OLD);
    source.failConversionOf(BOB);
    ticker.advanceNanos(MISS_REFRESH_MIN_AGE);
    assertUnavailable(BOB, NEVER_ISSUED);

    assertAccepted(BOB, JWT_OLD);
    assertUnavailable(BOB, NEVER_ISSUED);

    assertEquals(2, source.fullReadsOf(BOB));
    assertEquals(1.0, counter("om.credential.unavailable", "cause", "backoff"));
  }

  /**
   * A sweep re-read leaves alice out at 100 ms. The next one, stamped at 200 ms, converts her, but
   * her entry idles out while it runs, so it installs nothing; it still ends her backoff.
   */
  @Test
  void aReadThatConvertsTheSubjectEndsItsBackoffEvenWhenItInstallsNothing() {
    source.withPats(ALICE, TOKEN_A);
    verifier(
        new CredentialVerificationConfig(
            null, null, null, null, null, Duration.milliseconds(300), null, null, null));
    assertAccepted(ALICE, TOKEN_A);
    source.failConversionOf(ALICE);
    source.addPat(ALICE, TOKEN_B);
    ticker.advanceNanos(100 * MILLISECOND);
    verifier.sweepOnce();
    source.restoreConversionOf(ALICE);
    source.duringNextRead(() -> ticker.advanceNanos(250 * MILLISECOND));
    ticker.advanceNanos(100 * MILLISECOND);
    verifier.sweepOnce();

    assertEquals(0, verifier.cachedSubjects());
    assertAccepted(ALICE, TOKEN_B);
    assertEquals(4, source.fullReadsOf(ALICE));
  }

  @Test
  void aSubjectLeftOutAgainWithinItsBackoffIsWarnedAboutOnce() {
    Logger logger = (Logger) LoggerFactory.getLogger(CredentialVerifier.class);
    ListAppender<ILoggingEvent> events = new ListAppender<>();
    events.start();
    logger.addAppender(events);
    try {
      source.withPats(ALICE, TOKEN_A);
      verifier(DEFAULTS);
      assertAccepted(ALICE, TOKEN_A);
      source.failConversionOf(ALICE);
      source.addPat(ALICE, TOKEN_B);

      sweepAfterInterval();
      ticker.advanceNanos(100 * MILLISECOND);
      verifier.refreshNow(subject(ALICE));
      ticker.advanceNanos(MISS_REFRESH_MIN_AGE);
      verifier.refreshNow(subject(ALICE));

      assertEquals(4, source.fullReadsOf(ALICE));
      assertEquals(2, conversionWarningsAbout(events, ALICE));
    } finally {
      logger.detachAppender(events);
      events.stop();
    }
  }

  @Test
  void aFailingDeepReadLeavesTheBatchReconfirmedAndTheSweepComplete() {
    source.withJwtMechanism(ALICE, JWT_OLD).withJwtMechanism(BOB, JWT_NEW);
    verifier(DEFAULTS);
    assertAccepted(ALICE, JWT_OLD);
    assertAccepted(BOB, JWT_NEW);
    source.poisonReadsOf(BOB);

    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    verifier.sweepOnce();

    assertAccepted(ALICE, JWT_OLD);
    assertAccepted(BOB, JWT_NEW);
    assertEquals(1, source.fingerprintReads());
    assertEquals(3, source.fullReads());
    assertEquals(0.0, gauge("om.credential.sweep.last.complete.age.seconds"));
    for (int sweep = 1; sweep <= 30; sweep++) {
      sweepAfterInterval();
      assertAccepted(ALICE, JWT_OLD);
      assertAccepted(BOB, JWT_NEW);
    }
    assertEquals(31, source.fingerprintReads());
    assertEquals(4, source.fullReads());
    assertEquals(2, source.decrypts());
    assertEquals(2.0, counter("om.credential.reads", "reason", "deep", "outcome", "error"));
  }

  @Test
  void aFailedDeepPassCostsNoDecryptsOnTheFollowingSweeps() {
    List<String> users = List.of("u1", "u2", "u3", "u4");
    users.forEach(user -> source.withJwtMechanism(user, "jwt-" + user));
    verifier(new CredentialVerificationConfig(null, null, null, null, null, null, 4, 2, null));
    users.forEach(user -> assertAccepted(user, "jwt-" + user));
    assertEquals(4, source.decrypts());
    source.poisonReadsOf("u4");

    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    verifier.sweepOnce();
    for (int sweep = 0; sweep < 5; sweep++) {
      sweepAfterInterval();
    }

    assertEquals(6, source.decrypts());
    assertEquals(12, source.fingerprintReads());
    users.forEach(user -> assertAccepted(user, "jwt-" + user));
  }

  /** Each user takes a turn, so the batch the cache lists first holds the failing one in a case. */
  @ParameterizedTest
  @ValueSource(strings = {"u1", "u2", "u3", "u4", "u5", "u6"})
  void anErrorInOneDeepReadLeavesEveryBatchReconfirmedAndThePassComplete(String failing) {
    List<String> users = List.of("u1", "u2", "u3", "u4", "u5", "u6");
    users.forEach(user -> source.withJwtMechanism(user, "jwt-" + user));
    verifier(new CredentialVerificationConfig(null, null, null, null, null, null, 6, 2, null));
    users.forEach(user -> assertAccepted(user, "jwt-" + user));
    source.failReadsOfWithError(failing);

    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    Throwable escaped = sweepAsScheduled();

    assertEquals(3, source.fingerprintReads());
    assertEquals(0.0, gauge("om.credential.sweep.last.complete.age.seconds"));
    assertEquals(2.0, counter("om.credential.reads", "reason", "deep", "outcome", "ok"));
    assertNull(escaped);
  }

  @ParameterizedTest
  @EnumSource(ReadFailure.class)
  void aFailedDeepPassIsRetriedAMinuteLaterWhateverItsReadThrew(ReadFailure failure) {
    List<String> users = List.of("u1", "u2", "u3", "u4");
    users.forEach(user -> source.withJwtMechanism(user, "jwt-" + user));
    verifier(new CredentialVerificationConfig(null, null, null, null, null, null, 4, 2, null));
    users.forEach(user -> assertAccepted(user, "jwt-" + user));
    failure.injectInto(source, "u4");

    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    for (int sweep = 0; sweep < 30; sweep++) {
      sweepAsScheduled();
      ticker.advanceNanos(2 * SECOND);
    }
    assertEquals(6, source.decrypts(), "the healthy batch is deep-read once in the first minute");
    sweepAsScheduled();
    assertEquals(8, source.decrypts(), "and once more by the retry a minute later");
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
  void aCheckReadStampedBeforeARefreshCannotRecreateTheEntryAfterItIdlesOut() throws Exception {
    source.withPats(ALICE, TOKEN_A);
    verifier(idleExpiryOfOneSecond(Duration.seconds(4)));
    source.blockNextRead();
    RunningCheck slow = startCheck(ALICE, TOKEN_A);
    source.awaitReadStarted();

    source.revokeAll(ALICE);
    ticker.advanceNanos(MILLISECOND);
    verifier.refreshNow(subject(ALICE));
    ticker.advanceNanos(1100 * MILLISECOND);
    assertEquals(0, verifier.cachedSubjects());
    source.releaseReads();

    assertNull(slow.result());
    assertRejected(ALICE, TOKEN_A);
    assertEquals(3, source.fullReads());
  }

  @ParameterizedTest
  @EnumSource(SlowRead.class)
  void aRereadStampedBeforeARefreshCannotRecreateTheEntryAfterItIdlesOut(SlowRead slowRead)
      throws Exception {
    source.withPats(ALICE, TOKEN_A);
    verifier(idleExpiryOfOneSecond(null));
    assertAccepted(ALICE, TOKEN_A);
    source.blockNextRead();
    Future<?> slow = slowRead.start(this);
    source.awaitReadStarted();

    source.revokeAll(ALICE);
    ticker.advanceNanos(MILLISECOND);
    verifier.refreshNow(subject(ALICE));
    ticker.advanceNanos(1100 * MILLISECOND);
    assertEquals(0, verifier.cachedSubjects());
    source.releaseReads();
    slow.get(30, TimeUnit.SECONDS);

    assertRejected(ALICE, TOKEN_A);
    assertEquals(4, source.fullReads());
  }

  @Test
  void aCheckThatMissesAfterARefreshReadsAgainInsteadOfJoiningTheOlderRead() throws Exception {
    source.withPats(ALICE, TOKEN_A);
    verifier(idleExpiryOfOneSecond(Duration.seconds(1)));
    source.blockNextRead();
    RunningCheck slow = startCheck(ALICE, TOKEN_A);
    source.awaitReadStarted();

    source.revokeAll(ALICE);
    ticker.advanceNanos(MILLISECOND);
    verifier.refreshNow(subject(ALICE));
    ticker.advanceNanos(1100 * MILLISECOND);

    assertRejected(ALICE, TOKEN_A);
    assertEquals(3, source.fullReads());
    assertInstanceOf(CredentialUnavailableException.class, slow.result());
    source.releaseReads();
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
  void aRefreshThatFailsAfterRegisteringLeavesNothingForLaterChecksToJoin() throws Exception {
    source.withPats(ALICE, TOKEN_A);
    AtomicReference<Thread> refresher = new AtomicReference<>();
    Ticker failingOnTheRefresher =
        () -> {
          if (Thread.currentThread() == refresher.get()) {
            throw new OutOfMemoryError("injected while the refresh read is stamped");
          }
          return ticker.read();
        };
    verifier =
        new CredentialVerifier(
            loadTimeoutOf(Duration.seconds(1)),
            source,
            failingOnTheRefresher,
            new CredentialMetrics(registry),
            List.of());
    source.blockNextRead();
    RunningCheck first = startCheck(ALICE, TOKEN_A);
    source.awaitReadStarted();

    Future<?> refresh =
        threads.submit(
            () -> {
              refresher.set(Thread.currentThread());
              verifier.refreshNow(subject(ALICE));
            });
    await().atMost(10, TimeUnit.SECONDS).until(refresh::isDone);
    source.releaseReads();
    first.result();

    assertAccepted(ALICE, TOKEN_A);
    assertEquals(2, source.fullReads());
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
    assertEquals(1, source.fullReads());

    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    verifier.sweepOnce();
    assertRejected(ALICE, TOKEN_A);
    assertAccepted(ALICE, TOKEN_B);
    assertEquals(2, source.fullReads());
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
    assertEquals(7.000000001, gauge("om.credential.sweep.last.complete.age.seconds"));

    verifier.sweepOnce();
    assertEquals(0.0, gauge("om.credential.sweep.last.complete.age.seconds"));
    users.forEach(user -> assertRejected(user, "token-" + user));
  }

  @ParameterizedTest
  @ValueSource(strings = {"u1", "u2", "u3", "u4", "u5", "u6"})
  void anErrorInOneSweepRereadLeavesEveryOtherBatchReconfirmed(String failing) {
    List<String> users = List.of("u1", "u2", "u3", "u4", "u5", "u6");
    users.forEach(user -> source.withJwtMechanism(user, "jwt-" + user));
    verifier(new CredentialVerificationConfig(null, null, null, null, null, null, 6, 2, null));
    users.forEach(user -> assertAccepted(user, "jwt-" + user));
    source.withJwtMechanism(failing, "jwt-rotated");
    source.failReadsOfWithError(failing);

    ticker.advanceNanos(2 * SECOND);
    Throwable escaped = sweepAsScheduled();
    ticker.advanceNanos(4 * SECOND);

    assertEquals(3, source.fingerprintReads());
    users.stream()
        .filter(user -> !user.equals(failing))
        .forEach(user -> assertAccepted(user, "jwt-" + user));
    assertEquals(7, source.fullReads());
    assertNull(escaped);
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
  void sweepsDoNotChangeWhichSubjectsTheCacheKeeps() {
    assertEquals(newcomerReadsAfterResidents(0), newcomerReadsAfterResidents(30));
  }

  /**
   * Ten residents fill a cache of ten, optionally reconfirmed by {@code sweeps} sweeps, then three
   * newcomers check twenty times each with a maintenance pass after every check. Returns the full
   * reads the newcomers cost; a sweep that counted as a cache write would raise the residents'
   * frequency and make the newcomers lose admission.
   */
  private static int newcomerReadsAfterResidents(int sweeps) {
    FakeCredentialSource isolatedSource = new FakeCredentialSource();
    FakeTicker isolatedTicker = new FakeTicker();
    CredentialVerifier isolated =
        new CredentialVerifier(
            new CredentialVerificationConfig(null, null, null, null, null, null, 10, 10, null),
            isolatedSource,
            isolatedTicker,
            new CredentialMetrics(new SimpleMeterRegistry()),
            List.of());
    IntStream.range(0, 10).forEach(i -> isolatedSource.withPats("resident-" + i, "token-" + i));
    IntStream.range(0, 3).forEach(i -> isolatedSource.withPats("newcomer-" + i, "new-" + i));
    IntStream.range(0, 10)
        .forEach(
            i ->
                assertDoesNotThrow(
                    () -> isolated.require(stored("resident-" + i), "token-" + i, REJECTED)));
    for (int sweep = 0; sweep < sweeps; sweep++) {
      isolatedTicker.advanceNanos(2 * SECOND);
      isolated.sweepOnce();
    }
    int readsBefore = isolatedSource.fullReads();
    for (int check = 0; check < 60; check++) {
      int newcomer = check % 3;
      assertDoesNotThrow(
          () -> isolated.require(stored("newcomer-" + newcomer), "new-" + newcomer, REJECTED));
      isolated.cachedSubjects();
    }
    return isolatedSource.fullReads() - readsBefore;
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
    assertEquals(4.0, gauge("om.credential.sweep.last.complete.age.seconds"));

    source.revokeAll(ALICE);
    wrapping.advanceNanos(MAX_STALENESS_NANOS + 1);
    assertRejected(ALICE, TOKEN_A);
    assertEquals(2, source.fullReads());
  }

  @Test
  void theSweepAgeGaugeCountsFromTheLastCompleteSweep() {
    verifier(DEFAULTS);
    assertEquals(0.0, gauge("om.credential.sweep.last.complete.age.seconds"));

    ticker.advanceNanos(MAX_STALENESS_NANOS + 1);
    assertEquals(5.000000001, gauge("om.credential.sweep.last.complete.age.seconds"));

    verifier.sweepOnce();
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
  void concurrentStartsAndStopsLeaveNoSweepThreadAfterAFinalStop() throws Exception {
    verifier(DEFAULTS);
    Runnable start = verifier::start;
    Runnable stop = verifier::stop;
    for (int round = 0; round < 200; round++) {
      List<Future<?>> calls =
          IntStream.range(0, 8)
              .<Future<?>>mapToObj(call -> threads.submit(call % 2 == 0 ? start : stop))
              .toList();
      for (Future<?> call : calls) {
        call.get(30, TimeUnit.SECONDS);
      }
    }

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
  void anErrorInANudgeReadDoesNotEndTheSweepPass() {
    source.withPats(ALICE, TOKEN_A).withPats(BOB, TOKEN_B);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);
    assertAccepted(BOB, TOKEN_B);
    source.failReadsOfWithError(ALICE);
    verifier.nudge(subject(ALICE));

    ticker.advanceNanos(2 * SECOND);
    Throwable escaped = sweepAsScheduled();

    assertEquals(1, source.fingerprintReads());
    assertEquals(0.0, gauge("om.credential.sweep.last.complete.age.seconds"));
    assertEquals(1.0, counter("om.credential.reads", "reason", "nudge", "outcome", "error"));
    assertNull(escaped);
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

  /** A revocation that commits while a statement is in flight, which then takes {@code nanos}. */
  private Runnable revokeAliceThenWait(long nanos) {
    return () -> {
      source.revokeAll(ALICE);
      ticker.advanceNanos(nanos);
    };
  }

  /**
   * Checks wait for a read in real time, so a test that stages a read across several steps gives
   * them a budget with room for a loaded machine.
   */
  private static CredentialVerificationConfig loadTimeoutOf(Duration loadTimeout) {
    return new CredentialVerificationConfig(
        null, null, null, loadTimeout, null, null, null, null, null);
  }

  private static CredentialVerificationConfig idleExpiryOfOneSecond(Duration loadTimeout) {
    return new CredentialVerificationConfig(
        null, null, null, loadTimeout, null, Duration.seconds(1), null, null, null);
  }

  /** A sweep as production runs it: one sweepInterval after whatever happened last. */
  private void sweepAfterInterval() {
    ticker.advanceNanos(2 * SECOND);
    verifier.sweepOnce();
  }

  /** Sequential checks one millisecond apart; the meters record what each one answered. */
  private void checkEveryMillisecond(int checks, String principal, String token) {
    for (int check = 0; check < checks; check++) {
      ticker.advanceNanos(MILLISECOND);
      checkOutcome(principal, token);
    }
  }

  private static long conversionWarningsAbout(
      ListAppender<ILoggingEvent> events, String principal) {
    return events.list.stream()
        .filter(event -> event.getLevel() == Level.WARN)
        .filter(event -> event.getFormattedMessage().contains("credentials of " + principal))
        .count();
  }

  /** One pass the way the scheduler runs it, which drops what escapes; returned here instead. */
  private Throwable sweepAsScheduled() {
    try {
      verifier.sweepOnce();
      return null;
    } catch (Throwable escaped) {
      return escaped;
    }
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

  private RunningCheck startCheck(String principal, String token) {
    return startCheck(principal, token, thread -> {});
  }

  /** {@code beforeStart} sees the thread before it runs, so a hook can key on its identity. */
  private RunningCheck startCheck(String principal, String token, Consumer<Thread> beforeStart) {
    CompletableFuture<Throwable> outcome = new CompletableFuture<>();
    Thread thread =
        Thread.ofVirtual().unstarted(() -> outcome.complete(checkOutcome(principal, token)));
    beforeStart.accept(thread);
    thread.start();
    return new RunningCheck(thread, outcome);
  }

  private Throwable checkOutcome(String principal, String token) {
    try {
      verifier.require(stored(principal), token, REJECTED);
      return null;
    } catch (Throwable failure) {
      return failure;
    }
  }

  private static void awaitParked(Thread thread) {
    await().atMost(10, TimeUnit.SECONDS).until(() -> isParked(thread));
  }

  private static boolean isParked(Thread thread) {
    Thread.State state = thread.getState();
    return state == Thread.State.WAITING || state == Thread.State.TIMED_WAITING;
  }

  private static void awaitLatch(CountDownLatch latch) {
    try {
      assertTrue(latch.await(10, TimeUnit.SECONDS), "the gate should open");
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(interrupted);
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
