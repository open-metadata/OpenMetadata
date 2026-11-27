package org.openmetadata.service.security;

import java.time.Duration;

/**
 * How the identity provider's key sets are fetched: each URL is downloaded with timeouts, at most
 * {@code fetchBurst} times in quick succession and then once per {@code refillInterval}.
 * ADR:2026-10-20-identity-provider-key-sets-are-fetched-with-timeouts-and-a-rate-limit
 */
record KeySetFetchPolicy(
    Duration connectTimeout, Duration readTimeout, int fetchBurst, Duration refillInterval) {
  static final KeySetFetchPolicy DEFAULT =
      new KeySetFetchPolicy(
          Duration.ofSeconds(5), Duration.ofSeconds(5), 10, Duration.ofSeconds(6));
}
