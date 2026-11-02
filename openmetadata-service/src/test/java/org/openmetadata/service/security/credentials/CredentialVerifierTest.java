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

  /**
   * Until missRefreshMinAge after the read that accepted token A, the unknown token cannot be
   * confirmed either way. The read it then starts shows the token withdrawn, so it is rejected
   * without a read until the window ends again.
   */
  @Test
  void unknownTokenReloadsAreRateLimited() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);

    checkEveryMillisecond(1000, ALICE, NEVER_ISSUED);

    assertEquals(3, source.fullReads());
    assertEquals(499.0, counter("om.credential.checks", "decision", "defer"));
    assertEquals(499.0, counter("om.credential.unavailable", "cause", "deferred"));
    assertEquals(501.0, counter("om.credential.checks", "decision", "reject"));
  }

  @Test
  void aTokenCreatedOnAPeerJustAfterThisServerReadItsOwnerIsAcceptedOnceTheWindowEnds() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);

    source.addPat(ALICE, TOKEN_B);
    ticker.advanceNanos(100 * MILLISECOND);

    assertEquals(2, assertUnavailable(ALICE, TOKEN_B).retryAfterSeconds());
    assertEquals(1.0, counter("om.credential.unavailable", "cause", "deferred"));
    assertEquals(1, source.fullReads());
    ticker.advanceNanos(400 * MILLISECOND);
    assertAccepted(ALICE, TOKEN_B);
    assertEquals(2, source.fullReads());
  }

  @Test
  void aCheckThatJoinsAReadLackingItsTokenCannotConfirmUntilTheWindowEnds() throws Exception {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    source.blockNextRead();
    RunningCheck starter = startCheck(ALICE, TOKEN_A);
    source.awaitReadStarted();
    source.addPat(ALICE, TOKEN_B);
    RunningCheck joiner = startCheck(ALICE, TOKEN_B);
    awaitParked(joiner.thread());
    source.releaseReads();

    assertNull(starter.result());
    assertInstanceOf(CredentialUnavailableException.class, joiner.result());
    assertEquals(1, source.fullReads());
    ticker.advanceNanos(MISS_REFRESH_MIN_AGE);
    assertAccepted(ALICE, TOKEN_B);
    assertEquals(2, source.fullReads());
  }

  @Test
  void aTokenTheCheckReadLacksIsRejectedAgainWithoutAReadInsideTheWindow() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);

    assertRejected(ALICE, NEVER_ISSUED);
    ticker.advanceNanos(MISS_REFRESH_MIN_AGE - 1);
    assertRejected(ALICE, NEVER_ISSUED);

    assertEquals(1, source.fullReads());
    assertEquals(0.0, counter("om.credential.checks", "decision", "defer"));
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
  void anInterruptedWaitCannotConfirmUnderItsOwnCauseAndKeepsTheInterruptFlag() throws Exception {
    source.withPats(ALICE, TOKEN_A);
    verifier(loadTimeoutOf(Duration.seconds(4)));
    source.blockNextRead();
    AtomicBoolean interruptedAfterwards = new AtomicBoolean();
    CompletableFuture<Throwable> outcome = new CompletableFuture<>();
    Thread waiting =
        Thread.ofVirtual()
            .start(
                () -> {
                  Throwable failure = checkOutcome(ALICE, TOKEN_A);
                  interruptedAfterwards.set(Thread.currentThread().isInterrupted());
                  outcome.complete(failure);
                });
    source.awaitReadStarted();
    awaitParked(waiting);

    waiting.interrupt();

    assertInstanceOf(CredentialUnavailableException.class, outcome.get(30, TimeUnit.SECONDS));
    assertTrue(interruptedAfterwards.get(), "the check restores the interrupt flag");
    assertEquals(1.0, counter("om.credential.unavailable", "cause", "interrupted"));
    assertEquals(0.0, counter("om.credential.unavailable", "cause", "timeout"));
    source.releaseReads();
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
  void aSweepRereadOfAnUnchangedMechanismAddsNoDecryptAndEveryCheckReadDecrypts() {
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
    assertEquals(11, source.decrypts());

    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    verifier.sweepOnce();
    assertEquals(12, source.decrypts());
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
    assertEquals(499.0, counter("om.credential.checks", "decision", "defer"));
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

  /** Nine users and bob fill one deep read, so the read that throws is every user's deep read. */
  @Test
  void subjectsSharingADeepReadWithOneWhoseReadThrowsAnErrorAreAcceptedOnTheirNextCheck() {
    List<String> users = IntStream.range(0, 9).mapToObj(i -> "u" + i).toList();
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
    assertEquals(20, source.fullReads());
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
   * A check's read at 600 ms leaves alice out and opens a backoff window to 1100 ms. A sweep
   * re-read at 700 ms converts her, but her entry idles out while it runs, so it installs nothing;
   * it still ends the window, so the check at 950 ms, which needs a read, is accepted.
   */
  @Test
  void aReadThatConvertsTheSubjectEndsItsBackoffEvenWhenItInstallsNothing() {
    source.withPats(ALICE, TOKEN_A);
    verifier(
        new CredentialVerificationConfig(
            null, null, null, null, null, Duration.milliseconds(300), null, null, null));
    assertAccepted(ALICE, TOKEN_A);
    source.failConversionOf(ALICE);
    ticker.advanceNanos(200 * MILLISECOND);
    assertAccepted(ALICE, TOKEN_A);
    ticker.advanceNanos(200 * MILLISECOND);
    assertAccepted(ALICE, TOKEN_A);
    ticker.advanceNanos(200 * MILLISECOND);
    assertUnavailable(ALICE, NEVER_ISSUED);
    source.restoreConversionOf(ALICE);
    source.addPat(ALICE, TOKEN_B);
    source.duringNextRead(() -> ticker.advanceNanos(250 * MILLISECOND));
    ticker.advanceNanos(100 * MILLISECOND);
    verifier.sweepOnce();

    assertEquals(0, verifier.cachedSubjects());
    assertAccepted(ALICE, TOKEN_B);
    assertEquals(0.0, counter("om.credential.unavailable", "cause", "backoff"));
  }

  /**
   * A sweep re-read leaves alice out at 2 s, which no check started, so it opens no window. A
   * check of her new token 100 ms later reads and is accepted.
   */
  @Test
  void aSweepRereadThatLeavesASubjectOutDoesNotBackOffItsChecks() {
    source.withPats(ALICE, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(ALICE, TOKEN_A);
    source.failConversionOf(ALICE);
    source.addPat(ALICE, TOKEN_B);
    sweepAfterInterval();
    source.restoreConversionOf(ALICE);
    ticker.advanceNanos(100 * MILLISECOND);

    assertAccepted(ALICE, TOKEN_B);
    assertEquals(0.0, counter("om.credential.unavailable", "cause", "backoff"));
  }

  @Test
  void aSubjectLeftOutAgainAndAgainIsWarnedAboutOnceAMinute() {
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
      assertEquals(1, conversionWarningsAbout(events, ALICE), "one warning for three reads");

      ticker.advanceNanos(MINUTE);
      verifier.refreshNow(subject(ALICE));

      assertEquals(5, source.fullReadsOf(ALICE));
      assertEquals(2, conversionWarningsAbout(events, ALICE), "and one more a minute later");
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

  /**
   * Bob's rows stop converting before the deep pass at 10 min, which leaves him out. Each pass is
   * still a success, so the next ones run at 20 and 30 min, and each healthy bot is decrypted once
   * per pass. The idle expiry is raised so the bots outlive the passes without checks.
   */
  @Test
  void aSubjectTheDeepReadCannotConvertDoesNotBringTheNextDeepPassForward() {
    List<String> bots = List.of("u1", "u2", "u3");
    bots.forEach(bot -> source.withJwtMechanism(bot, "jwt-" + bot));
    source.withPats(BOB, TOKEN_A);
    verifier(
        new CredentialVerificationConfig(
            null, null, null, null, null, Duration.hours(1), null, null, null));
    bots.forEach(bot -> assertAccepted(bot, "jwt-" + bot));
    assertAccepted(BOB, TOKEN_A);
    source.failConversionOf(BOB);

    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    verifier.sweepOnce();
    assertEquals(6, source.decrypts(), "the deep pass at 10 min decrypts each healthy bot once");
    sweepsAfterInterval(299);
    assertEquals(6, source.decrypts(), "no deep pass before 20 min");
    sweepAfterInterval();
    assertEquals(9, source.decrypts(), "the deep pass at 20 min decrypts each healthy bot once");
    sweepsAfterInterval(299);
    assertEquals(9, source.decrypts(), "no deep pass before 30 min");
    sweepAfterInterval();

    assertEquals(12, source.decrypts(), "the deep pass at 30 min decrypts each healthy bot once");
    assertEquals(3.0, counter("om.credential.reads", "reason", "deep", "outcome", "ok"));
    assertEquals(4, source.fullReadsOf(BOB), "bob is read by his first check and each deep pass");
    bots.forEach(bot -> assertAccepted(bot, "jwt-" + bot));
    assertEquals(4, source.fullReadsOf("u1"));
  }

  /**
   * Each decrypt takes 150 ms, so one deep read of ten bots overruns the one-second deep budget of
   * a pass. The verify of 25 bots then finishes over three passes, each of which reconfirms every
   * bot first, so no check needs a read.
   */
  @Test
  void aDeepVerifyOfSlowDecryptsSpreadsOverPassesSoNoEntryOutlivesMaxStaleness() {
    List<String> bots = IntStream.range(0, 25).mapToObj(i -> "bot-" + i).toList();
    bots.forEach(bot -> source.withJwtMechanism(bot, "jwt-" + bot));
    verifier(DEFAULTS);
    bots.forEach(bot -> assertAccepted(bot, "jwt-" + bot));
    sweepsAfterInterval(299);
    source.duringEachDecrypt(() -> ticker.advanceNanos(150 * MILLISECOND));

    for (int pass = 0; pass < 3; pass++) {
      ticker.advanceNanos(2 * SECOND);
      bots.forEach(bot -> assertAccepted(bot, "jwt-" + bot));
      assertEquals(25 + pass, source.fullReads());
      verifier.sweepOnce();
    }
    sweepAfterInterval();

    assertEquals(28, source.fullReads());
    assertEquals(50, source.decrypts());
    assertEquals(3.0, counter("om.credential.reads", "reason", "deep", "outcome", "ok"));
  }

  /**
   * The first of the three reads of that slow deep verify throws, and the other two succeed on the
   * next passes. The verify still counts as failed, so the next one begins a minute after this one
   * began, and not ten minutes after it or a minute after it ended.
   */
  @Test
  void aDeepVerifyWhoseFirstReadThrowsIsRetriedAMinuteAfterItBegan() {
    List<String> bots = IntStream.range(0, 25).mapToObj(i -> "bot-" + i).toList();
    bots.forEach(bot -> source.withJwtMechanism(bot, "jwt-" + bot));
    verifier(DEFAULTS);
    bots.forEach(bot -> assertAccepted(bot, "jwt-" + bot));
    sweepsAfterInterval(299);
    source.duringEachDecrypt(() -> ticker.advanceNanos(150 * MILLISECOND));
    source.duringNextRead(
        () -> {
          throw new IllegalStateException("injected statement failure");
        });

    ticker.advanceNanos(2 * SECOND);
    long began = ticker.read();
    verifier.sweepOnce();
    sweepsAfterInterval(2);
    assertEquals(1.0, counter("om.credential.reads", "reason", "deep", "outcome", "error"));
    assertEquals(2.0, counter("om.credential.reads", "reason", "deep", "outcome", "ok"));
    int decrypts = source.decrypts();

    ticker.advanceNanos(began + MINUTE - 1 - ticker.read());
    verifier.sweepOnce();
    assertEquals(decrypts, source.decrypts(), "no deep read until a minute after the verify began");
    ticker.advanceNanos(1);
    verifier.sweepOnce();

    assertEquals(decrypts + 10, source.decrypts(), "the retry reads its first ten bots");
    bots.forEach(bot -> assertAccepted(bot, "jwt-" + bot));
  }

  /**
   * The deep pass at 10 min reconfirms bob by fingerprint and then cannot convert him. From then on
   * his checks read instead of trusting the entry: unavailable while his rows still do not convert,
   * at most one read per missRefreshMinAge, and the first read that converts them decides.
   */
  @Test
  void aSubjectTheDeepReadCannotConvertIsReadAgainByItsNextCheck() {
    source.withPats(BOB, TOKEN_A).withJwtMechanism(ALICE, JWT_OLD);
    verifier(DEFAULTS);
    assertAccepted(BOB, TOKEN_A);
    assertAccepted(ALICE, JWT_OLD);
    source.failConversionOf(BOB);

    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    verifier.sweepOnce();

    assertUnavailable(BOB, TOKEN_A);
    assertUnavailable(BOB, TOKEN_A);
    assertEquals(3, source.fullReadsOf(BOB));
    assertAccepted(ALICE, JWT_OLD);
    assertEquals(2, source.fullReadsOf(ALICE));
    ticker.advanceNanos(MISS_REFRESH_MIN_AGE);
    assertUnavailable(BOB, TOKEN_A);
    assertEquals(4, source.fullReadsOf(BOB));
    source.restoreConversionOf(BOB);
    source.replacePatInPlace(BOB, TOKEN_A, TOKEN_B);
    ticker.advanceNanos(MISS_REFRESH_MIN_AGE);

    assertAccepted(BOB, TOKEN_B);
    assertRejected(BOB, TOKEN_A);
    assertEquals(5, source.fullReadsOf(BOB));
    assertEquals(2.0, counter("om.credential.unavailable", "cause", "subject_read_failed"));
    assertEquals(1.0, counter("om.credential.unavailable", "cause", "backoff"));
  }

  /**
   * Bob's entry is stale at 10 min, so a check reads him; that read is stamped first and converts
   * him. While it is in flight the deep pass runs, stamped 1 ms later, and cannot convert him. The
   * check's record is older than the deep read's verdict, so it confirms nothing, and the entry
   * stays unconfirmed until a read stamped after the deep read converts him.
   */
  @Test
  void aCheckReadStampedBeforeADeepReadThatCannotConvertItsSubjectDoesNotRestoreTheOlderRecord() {
    source.withSecretReferenceMechanism(BOB, JWT_OLD);
    verifier(loadTimeoutOf(Duration.seconds(4)));
    assertAccepted(BOB, JWT_OLD);
    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    source.duringNextRead(
        () -> {
          ticker.advanceNanos(MILLISECOND);
          source.failConversionOf(BOB);
          verifier.sweepOnce();
        });

    assertUnavailable(BOB, JWT_OLD);

    assertEquals(3, source.fullReadsOf(BOB));
    assertUnavailable(BOB, JWT_OLD);
    source.restoreConversionOf(BOB);
    ticker.advanceNanos(MISS_REFRESH_MIN_AGE);
    assertAccepted(BOB, JWT_OLD);
    assertEquals(5, source.fullReadsOf(BOB));
    assertEquals(2.0, counter("om.credential.unavailable", "cause", "subject_read_failed"));
  }

  /**
   * The deep pass at 10 min has seen bob's rows and cannot convert them when a token added to him
   * is checked 1 ms later. That check's read converts him and installs its entry. The deep read's
   * verdict is older than that entry, so it leaves the entry confirmed, and bob's next check is
   * answered from it without a read.
   */
  @Test
  void aDeepReadThatCannotConvertASubjectLeavesTheEntryALaterCheckReadInstalled() {
    source.withPats(BOB, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(BOB, TOKEN_A);
    source.failConversionOf(BOB);
    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    AtomicReference<Throwable> checkDuringTheDeepRead =
        new AtomicReference<>(new AssertionError("no check ran during the deep read"));
    source.duringNextRead(
        () -> {
          source.restoreConversionOf(BOB);
          source.addPat(BOB, TOKEN_B);
          ticker.advanceNanos(MILLISECOND);
          checkDuringTheDeepRead.set(checkOutcome(BOB, TOKEN_B));
        });

    verifier.sweepOnce();

    assertNull(checkDuringTheDeepRead.get());
    assertAccepted(BOB, TOKEN_A);
    assertEquals(
        3, source.fullReadsOf(BOB), "bob's first check, the deep read and the later check");
  }

  @Test
  void aSweepDoesNotConfirmAnUnconfirmedEntryByItsFingerprint() {
    source.withPats(BOB, TOKEN_A);
    verifier(DEFAULTS);
    assertAccepted(BOB, TOKEN_A);
    source.failConversionOf(BOB);
    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    verifier.sweepOnce();

    sweepsAfterInterval(30);

    assertEquals(31, source.fingerprintReads());
    assertEquals(2, source.fullReadsOf(BOB), "no sweep re-read and no deep retry");
    assertEquals(0.0, counter("om.credential.sweep.changed.subjects"));
    assertUnavailable(BOB, TOKEN_A);
    assertEquals(3, source.fullReadsOf(BOB));
  }

  /**
   * A check read stamped after the deep read converts bob; while it is in flight a sweep finds his
   * fingerprint unchanged. The sweep must not move the unconfirmed entry's stamp past that read, or
   * the read could never replace it.
   */
  @Test
  void aSweepDoesNotMoveAnUnconfirmedEntryPastAConvertingReadInFlight() throws Exception {
    source.withPats(BOB, TOKEN_A);
    verifier(loadTimeoutOf(Duration.seconds(4)));
    assertAccepted(BOB, TOKEN_A);
    source.failConversionOf(BOB);
    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    verifier.sweepOnce();
    source.restoreConversionOf(BOB);
    ticker.advanceNanos(MILLISECOND);
    source.blockNextRead();
    RunningCheck check = startCheck(BOB, TOKEN_A);
    source.awaitReadStarted();

    sweepAfterInterval();
    source.releaseReads();

    assertNull(check.result());
    assertAccepted(BOB, TOKEN_A);
    assertEquals(3, source.fullReadsOf(BOB));
  }

  /**
   * Bob's secret cannot be read during the deep pass, then reads with a new value, while his row
   * keeps its stored mechanism version. A PAT added to him moves his fingerprint, so the sweep
   * re-reads him: it decrypts instead of reusing the digest from before the deep pass.
   */
  @Test
  void aSweepRereadOfAnUnconfirmedSubjectDecryptsInsteadOfReusingItsDigest() {
    source.withSecretReferenceMechanism(BOB, JWT_OLD);
    verifier(DEFAULTS);
    assertAccepted(BOB, JWT_OLD);
    source.failConversionOf(BOB);
    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    verifier.sweepOnce();
    source.restoreConversionOf(BOB);
    source.rotateSecretWithoutTouchingTheRow(BOB, JWT_NEW);
    source.addPat(BOB, TOKEN_A);

    sweepAfterInterval();

    assertAccepted(BOB, JWT_NEW);
    assertRejected(BOB, JWT_OLD);
    assertAccepted(BOB, TOKEN_A);
    assertEquals(2, source.decrypts());
    assertEquals(3, source.fullReadsOf(BOB));
    assertEquals(0.0, counter("om.credential.decrypts", "outcome", "skipped_unchanged"));
  }

  @Test
  void aDeepPassThatLeavesOneSubjectOutStillInstallsTheOthers() {
    source.withPats(BOB, TOKEN_A).withPats(ALICE, "alice-old");
    verifier(DEFAULTS);
    assertAccepted(BOB, TOKEN_A);
    assertAccepted(ALICE, "alice-old");
    source.failConversionOf(BOB);
    source.replacePatInPlace(ALICE, "alice-old", "alice-new");

    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    verifier.sweepOnce();

    assertRejected(ALICE, "alice-old");
    assertAccepted(ALICE, "alice-new");
  }

  @Test
  void aSoftAndAHardDeletedPrincipalDoNotFailTheDeepPass() {
    source.withJwtMechanism(ALICE, JWT_OLD).withJwtMechanism(BOB, JWT_NEW);
    source.withJwtMechanism("carol", "bot-jwt-carol").withJwtMechanism("dave", "bot-jwt-dave");
    verifier(DEFAULTS);
    assertAccepted(ALICE, JWT_OLD);
    assertAccepted(BOB, JWT_NEW);
    assertAccepted("carol", "bot-jwt-carol");
    assertAccepted("dave", "bot-jwt-dave");
    source.softDelete(ALICE);
    source.hardDelete(BOB);

    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    verifier.sweepOnce();
    int decryptsAfterDeepPass = source.decrypts();
    ticker.advanceNanos(MINUTE);
    verifier.sweepOnce();

    assertEquals(decryptsAfterDeepPass, source.decrypts(), "no deep read ran a minute later");
    assertRejected(ALICE, JWT_OLD);
    assertRejected(BOB, JWT_NEW);
  }

  @Test
  void aDeepPassCountsOneDecryptPerBotAndAnUnchangedSweepRereadCountsAReuse() {
    List<String> bots = List.of("u1", "u2", "u3");
    bots.forEach(bot -> source.withJwtMechanism(bot, "jwt-" + bot));
    verifier(DEFAULTS);
    bots.forEach(bot -> assertAccepted(bot, "jwt-" + bot));
    assertEquals(3.0, counter("om.credential.decrypts", "outcome", "performed"));
    assertEquals(0.0, counter("om.credential.decrypts", "outcome", "skipped_unchanged"));

    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    verifier.sweepOnce();
    assertEquals(6.0, counter("om.credential.decrypts", "outcome", "performed"));

    source.addPat("u1", TOKEN_A);
    sweepAfterInterval();
    assertEquals(6.0, counter("om.credential.decrypts", "outcome", "performed"));
    assertEquals(1.0, counter("om.credential.decrypts", "outcome", "skipped_unchanged"));
  }

  @Test
  void aCheckReadStartedInsideADeepPassNeverReplacesItsResultWithAnOlderDigest() throws Exception {
    source.withSecretReferenceMechanism(BOB, JWT_OLD);
    verifier(DEFAULTS);
    assertAccepted(BOB, JWT_OLD);
    source.rotateSecretWithoutTouchingTheRow(BOB, JWT_NEW);
    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    AtomicReference<Future<Throwable>> checkInsideThePass = new AtomicReference<>();
    source.duringNextRead(
        () -> {
          ticker.advanceNanos(MILLISECOND);
          checkInsideThePass.set(requireAsync(BOB, JWT_NEW));
          await().atMost(10, TimeUnit.SECONDS).until(() -> checkInsideThePass.get().isDone());
        });

    verifier.sweepOnce();

    assertNull(checkInsideThePass.get().get(10, TimeUnit.SECONDS));
    assertAccepted(BOB, JWT_NEW);
    assertRejected(BOB, JWT_OLD);
  }

  @Test
  void aRefreshStartedInsideADeepPassNeverReplacesItsResultWithAnOlderDigest() throws Exception {
    source.withSecretReferenceMechanism(BOB, JWT_OLD);
    verifier(DEFAULTS);
    assertAccepted(BOB, JWT_OLD);
    source.rotateSecretWithoutTouchingTheRow(BOB, JWT_NEW);
    ticker.advanceNanos(DEEP_VERIFY_INTERVAL_NANOS);
    AtomicReference<Future<?>> refreshInsideThePass = new AtomicReference<>();
    source.duringNextRead(
        () -> {
          ticker.advanceNanos(MILLISECOND);
          refreshInsideThePass.set(threads.submit(() -> verifier.refreshNow(subject(BOB))));
          await().atMost(10, TimeUnit.SECONDS).until(() -> refreshInsideThePass.get().isDone());
        });

    verifier.sweepOnce();

    refreshInsideThePass.get().get(10, TimeUnit.SECONDS);
    assertAccepted(BOB, JWT_NEW);
    assertRejected(BOB, JWT_OLD);
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
    ticker.advanceNanos(MISS_REFRESH_MIN_AGE);
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
    ticker.advanceNanos(MISS_REFRESH_MIN_AGE);
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
    Set<Thread> before = Set.copyOf(sweepThreads());

    verifier.start();
    verifier.start();

    await().atMost(10, TimeUnit.SECONDS).until(() -> source.fingerprintReads() >= 1);
    List<Thread> started = sweepThreadsSince(before);
    assertEquals(1, started.size());
    assertTrue(started.getFirst().isDaemon());

    verifier.stop();
    await().atMost(10, TimeUnit.SECONDS).until(() -> sweepThreadsSince(before).isEmpty());
  }

  @Test
  void concurrentStartsAndStopsLeaveNoSweepThreadAfterAFinalStop() throws Exception {
    verifier(DEFAULTS);
    Set<Thread> before = Set.copyOf(sweepThreads());
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

    await().atMost(10, TimeUnit.SECONDS).until(() -> sweepThreadsSince(before).isEmpty());
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

  private void sweepsAfterInterval(int sweeps) {
    for (int sweep = 0; sweep < sweeps; sweep++) {
      sweepAfterInterval();
    }
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

  /**
   * The sweep threads alive now that {@code before} lacks, so a verifier that another test in this
   * JVM still runs does not count.
   */
  private static List<Thread> sweepThreadsSince(Set<Thread> before) {
    return sweepThreads().stream().filter(thread -> !before.contains(thread)).toList();
  }
}
