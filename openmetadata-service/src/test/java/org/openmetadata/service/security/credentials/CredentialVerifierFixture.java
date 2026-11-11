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
import io.micrometer.core.instrument.MeterRegistry;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * A real {@link CredentialVerifier} over an in-memory source, for tests outside this package. The
 * verifier is not started until {@link #start()}; {@link #close()} stops it.
 */
public final class CredentialVerifierFixture implements AutoCloseable {
  private final FakeCredentialSource source = new FakeCredentialSource();
  private final CredentialVerifier verifier;
  private final AtomicBoolean closed = new AtomicBoolean();

  public CredentialVerifierFixture(
      MeterRegistry registry, Ticker ticker, CredentialVerificationConfig config) {
    this.verifier =
        new CredentialVerifier(config, source, ticker, new CredentialMetrics(registry), List.of());
  }

  /** Stores each principal's tokens as personal access token rows. */
  public CredentialVerifierFixture withPats(Map<String, List<String>> tokensByPrincipal) {
    tokensByPrincipal.forEach(
        (principal, tokens) -> source.withPats(principal, tokens.toArray(String[]::new)));
    return this;
  }

  /** Stores each principal's token as its bot authentication mechanism. */
  public CredentialVerifierFixture withJwtMechanisms(Map<String, String> tokenByPrincipal) {
    tokenByPrincipal.forEach(source::withJwtMechanism);
    return this;
  }

  /**
   * Removes every stored token of {@code principal}, then refreshes it as the post-commit {@link
   * Credentials#changed} hint does, so this verifier's next check sees the change.
   */
  public void revoke(String principal) {
    source.revokeAll(principal);
    verifier.refreshNow(CredentialSubject.of(principal));
  }

  /**
   * Removes every stored token of {@code principal} and tells nobody, so this verifier notices
   * only through a {@link Credentials#changed} hint or its sweep.
   */
  public void removeTokensSilently(String principal) {
    source.revokeAll(principal);
  }

  /** From now on every statement against the source throws, as an unreachable database does. */
  public void failReads() {
    source.failReads();
  }

  public CredentialVerifier verifier() {
    return verifier;
  }

  public void start() {
    verifier.start();
  }

  /** Statements that fingerprint subjects, which is what the sweep issues. */
  public int fingerprintReads() {
    return source.fingerprintReads();
  }

  /** Statements that read whole records, from request threads, the sweep or a refresh alike. */
  public int fullReads() {
    return source.fullReads();
  }

  public int fullReadsOf(String principal) {
    return source.fullReadsOf(principal);
  }

  @Override
  public void close() {
    if (closed.compareAndSet(false, true)) {
      verifier.stop();
    }
  }
}
