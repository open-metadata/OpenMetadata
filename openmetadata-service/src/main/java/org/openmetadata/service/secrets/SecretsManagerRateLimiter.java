/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.secrets;

import com.google.common.util.concurrent.RateLimiter;

/**
 * Paces calls to an external secrets backend so a single encrypt operation — which persists every
 * {@code @PasswordField} of a connection in a tight loop — stays within the provider's write quota
 * (AWS Secrets Manager, SSM {@code PutParameter}, GCP Secret Manager, Azure Key Vault).
 *
 * <p>This replaces a fixed {@code Thread.sleep} after every call. A token bucket only blocks when
 * the configured rate is actually exceeded: the first calls after an idle period and short bursts
 * pass through with no delay, so the common single-field connection is no longer penalised. The
 * limiter is interrupt-safe — it restores the thread's interrupt flag instead of surfacing a
 * spurious server error.
 */
@FunctionalInterface
interface SecretsManagerRateLimiter {

  /** Blocks only as long as needed to honour the configured rate; returns at once when under it. */
  void acquire();

  /** Limits calls to at most {@code permitsPerSecond}, absorbing bursts up to one second's worth. */
  static SecretsManagerRateLimiter perSecond(double permitsPerSecond) {
    RateLimiter rateLimiter = RateLimiter.create(permitsPerSecond);
    return () -> rateLimiter.acquire();
  }

  /** A limiter that never blocks, for backends without an API quota (in-memory) and for tests. */
  static SecretsManagerRateLimiter noOp() {
    return () -> {};
  }
}
