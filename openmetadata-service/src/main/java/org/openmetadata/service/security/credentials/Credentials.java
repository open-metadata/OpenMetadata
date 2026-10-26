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

import com.github.benmanes.caffeine.cache.Ticker;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.util.PostCommitActionQueue;

/**
 * Process-wide entry point. {@link #verifier()} is what the authentication filter checks tokens
 * against; {@link #changed} is the write side's whole API and is optional for correctness, since
 * the sweep finds every committed change by itself; {@link #awaitPropagation} is the opt-in
 * synchronous revoke. Before a verifier is installed (early startup, the ops CLI) every Stored check
 * answers "cannot confirm", never "unchecked", and the write-side calls are no-ops.
 */
@Slf4j
public final class Credentials {
  private static final Duration PROPAGATION_MARGIN = Duration.ofMillis(50);
  private static final CredentialVerifier UNINSTALLED =
      new CredentialVerifier(
          CredentialVerificationConfig.defaults(),
          new NoSource(),
          Ticker.systemTicker(),
          new CredentialMetrics(new SimpleMeterRegistry()),
          List.of());
  private static volatile CredentialVerifier installed;

  private Credentials() {}

  public static void install(CredentialVerifier verifier) {
    installed = Objects.requireNonNull(verifier, "verifier");
  }

  static void uninstall() {
    installed = null;
  }

  public static CredentialVerifier verifier() {
    CredentialVerifier verifier = installed;
    return verifier == null ? UNINSTALLED : verifier;
  }

  /**
   * A stored credential of {@code principalName} changed: created, rotated, revoked, or its user
   * created, deleted or restored. Safe inside a transaction: the refresh runs after the surrounding
   * {@link PostCommitActionQueue} scope commits, and at once outside one. Never fails the write.
   */
  public static void changed(String principalName) {
    CredentialVerifier verifier = installed;
    if (verifier != null) {
      PostCommitActionQueue.runOrDefer(() -> refreshQuietly(verifier, principalName));
    }
  }

  /** A peer's hint from pub/sub; the read happens on the verifier's sweep thread. */
  public static void nudgeFromPeer(String principalName) {
    CredentialVerifier verifier = installed;
    if (verifier != null) {
      try {
        verifier.nudge(CredentialSubject.of(principalName));
      } catch (IllegalArgumentException malformed) {
        LOG.warn("Ignoring a credential nudge without a principal", malformed);
      }
    }
  }

  /**
   * Blocks for maxStaleness plus a margin for clock-rate differences between servers. By the
   * design's guarantee, every server rejects a revoked token on every check that begins at or after
   * commit + maxStaleness on its own clock, so once this returns no server accepts it for a new
   * request. An interrupt restores the flag and throws, so a caller never reports a wait it did not
   * complete.
   */
  public static void awaitPropagation() {
    CredentialVerifier verifier = installed;
    if (verifier != null) {
      sleep(verifier.maxStaleness().plus(PROPAGATION_MARGIN), verifier.retryAfterSeconds());
    }
  }

  private static void refreshQuietly(CredentialVerifier verifier, String principalName) {
    try {
      verifier.refreshNow(CredentialSubject.of(principalName));
    } catch (RuntimeException failure) {
      LOG.warn(
          "Credential refresh for {} failed; the sweep converges within the bound",
          principalName,
          failure);
    }
    announceQuietly(principalName);
  }

  private static void announceQuietly(String principalName) {
    try {
      CredentialChangeAnnouncer.announce(principalName);
    } catch (RuntimeException failure) {
      LOG.warn(
          "Credential change of {} was not announced to other servers", principalName, failure);
    }
  }

  private static void sleep(Duration bound, long retryAfterSeconds) {
    try {
      Thread.sleep(bound);
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new CredentialUnavailableException(
          "Interrupted before the revocation had propagated to every server",
          retryAfterSeconds,
          interrupted);
    }
  }

  /** The source of the uninstalled verifier: it has no database, so every read fails. */
  private static final class NoSource implements CredentialSource {
    @Override
    public Map<CredentialSubject, SourceFingerprint> fingerprints(
        Collection<CredentialSubject> subjects) {
      throw new IllegalStateException("No credential verifier has been installed");
    }

    @Override
    public Map<CredentialSubject, CredentialRecord> read(
        Collection<CredentialSubject> subjects, Map<CredentialSubject, CredentialRecord> previous) {
      throw new IllegalStateException("No credential verifier has been installed");
    }
  }
}
