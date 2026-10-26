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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.dropwizard.util.Duration;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.openmetadata.service.security.AuthenticationException;
import org.openmetadata.service.util.PostCommitActionQueue;

@Timeout(30)
class CredentialsTest {
  private static final String ALICE = "Alice";
  private static final String TOKEN_A = "pat-token-a";
  private static final String REJECTED = "rejected";
  private static final OmCredential ALICE_STORED =
      new OmCredential.Stored(CredentialSubject.of(ALICE));

  private final FakeCredentialSource source = new FakeCredentialSource().withPats(ALICE, TOKEN_A);
  private final FakeTicker ticker = new FakeTicker();
  private CredentialVerifier verifier;

  @BeforeEach
  void installVerifier() {
    verifier = verifier(CredentialVerificationConfig.defaults());
    Credentials.install(verifier);
  }

  @AfterEach
  void uninstall() {
    Credentials.uninstall();
    PostCommitActionQueue.clear();
    Thread.interrupted();
  }

  @Test
  void installedVerifierIsTheOneReturned() {
    assertSame(verifier, Credentials.verifier());
    assertThrows(NullPointerException.class, () -> Credentials.install(null));
  }

  @Test
  void changedInsideAScopeRunsOnlyAfterTheScopeCompletes() {
    Credentials.verifier().require(ALICE_STORED, TOKEN_A, REJECTED);
    assertTrue(PostCommitActionQueue.begin());
    source.revokeAll(ALICE);
    ticker.advanceNanos(1);

    Credentials.changed("alice");
    assertEquals(1, source.fullReadsOf(ALICE));
    assertDoesNotThrow(() -> Credentials.verifier().require(ALICE_STORED, TOKEN_A, REJECTED));

    PostCommitActionQueue.run(PostCommitActionQueue.drain());
    assertEquals(2, source.fullReadsOf(ALICE));
    assertThrows(
        AuthenticationException.class,
        () -> Credentials.verifier().require(ALICE_STORED, TOKEN_A, REJECTED));
  }

  @Test
  void changedOutsideAScopeRefreshesAtOnce() {
    Credentials.verifier().require(ALICE_STORED, TOKEN_A, REJECTED);
    source.revokeAll(ALICE);
    ticker.advanceNanos(1);

    Credentials.changed(ALICE);

    assertEquals(2, source.fullReadsOf(ALICE));
    assertThrows(
        AuthenticationException.class,
        () -> Credentials.verifier().require(ALICE_STORED, TOKEN_A, REJECTED));
  }

  @Test
  void changedWithoutAVerifierDoesNothing() {
    Credentials.uninstall();
    assertDoesNotThrow(() -> Credentials.changed(ALICE));
    assertDoesNotThrow(() -> Credentials.nudgeFromPeer(ALICE));
    assertEquals(0, source.fullReads());

    Credentials.install(verifier);
    Credentials.verifier().require(ALICE_STORED, TOKEN_A, REJECTED);
    Credentials.changed(ALICE);
    assertEquals(2, source.fullReads());
  }

  @Test
  void changedWithABlankNameNeverFailsTheWrite() {
    assertDoesNotThrow(() -> Credentials.changed("  "));
    assertDoesNotThrow(() -> Credentials.nudgeFromPeer(""));
  }

  @Test
  void verifierBeforeInstallFailsClosedAsUnavailable() {
    Credentials.uninstall();

    assertThrows(
        CredentialUnavailableException.class,
        () -> Credentials.verifier().require(ALICE_STORED, TOKEN_A, REJECTED));
    assertDoesNotThrow(
        () -> Credentials.verifier().require(new OmCredential.NotStored(), TOKEN_A, REJECTED));
    assertEquals(0, source.fullReads());
  }

  @Test
  void nudgeFromPeerQueuesForTheSweepThread() {
    Credentials.verifier().require(ALICE_STORED, TOKEN_A, REJECTED);
    source.revokeAll(ALICE);
    ticker.advanceNanos(1);

    Credentials.nudgeFromPeer(ALICE);
    assertEquals(1, source.fullReads());

    verifier.sweepOnce();
    assertEquals(2, source.fullReads());
    assertThrows(
        AuthenticationException.class,
        () -> Credentials.verifier().require(ALICE_STORED, TOKEN_A, REJECTED));
  }

  @Test
  void awaitPropagationWaitsMaxStalenessPlusTheMargin() {
    Credentials.install(
        verifier(configWith(Duration.milliseconds(200), Duration.milliseconds(100))));
    long started = System.nanoTime();

    Credentials.awaitPropagation();

    long waitedNanos = System.nanoTime() - started;
    assertTrue(
        waitedNanos >= TimeUnit.MILLISECONDS.toNanos(250),
        "waited " + TimeUnit.NANOSECONDS.toMillis(waitedNanos) + " ms");
  }

  @Test
  void awaitPropagationRestoresTheInterruptFlag() {
    Thread.currentThread().interrupt();

    CredentialUnavailableException unfinished =
        assertThrows(CredentialUnavailableException.class, Credentials::awaitPropagation);

    assertTrue(Thread.interrupted(), "the interrupt flag was restored");
    assertEquals(2, unfinished.retryAfterSeconds());
  }

  @Test
  void awaitPropagationInterruptedWhileWaitingAnswersUnavailable() throws Exception {
    Credentials.install(verifier(configWith(Duration.minutes(1), Duration.seconds(3))));
    CompletableFuture<CredentialUnavailableException> unfinished = new CompletableFuture<>();
    AtomicBoolean flagRestored = new AtomicBoolean();
    Thread waiter =
        Thread.ofPlatform().daemon().start(() -> awaitPropagationInto(unfinished, flagRestored));
    Awaitility.await()
        .until(() -> waiter.getState() == Thread.State.TIMED_WAITING || unfinished.isDone());

    waiter.interrupt();

    assertEquals(3, unfinished.get(10, TimeUnit.SECONDS).retryAfterSeconds());
    assertTrue(flagRestored.get(), "the interrupt flag was restored");
  }

  @Test
  void awaitPropagationWithoutAVerifierAnswersUnavailable() {
    Credentials.uninstall();

    CredentialUnavailableException unbounded =
        assertThrows(CredentialUnavailableException.class, Credentials::awaitPropagation);

    assertEquals(2, unbounded.retryAfterSeconds());
  }

  private static void awaitPropagationInto(
      CompletableFuture<CredentialUnavailableException> unfinished, AtomicBoolean flagRestored) {
    try {
      Credentials.awaitPropagation();
      unfinished.completeExceptionally(new AssertionError("the wait returned normally"));
    } catch (CredentialUnavailableException unavailable) {
      flagRestored.set(Thread.currentThread().isInterrupted());
      unfinished.complete(unavailable);
    }
  }

  private static CredentialVerificationConfig configWith(
      Duration maxStaleness, Duration sweepInterval) {
    return new CredentialVerificationConfig(
        maxStaleness,
        sweepInterval,
        Duration.milliseconds(50),
        Duration.milliseconds(100),
        null,
        null,
        null,
        null,
        null);
  }

  private CredentialVerifier verifier(CredentialVerificationConfig config) {
    return new CredentialVerifier(
        config, source, ticker, new CredentialMetrics(new SimpleMeterRegistry()), List.of());
  }
}
