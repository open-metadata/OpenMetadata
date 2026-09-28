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
package org.openmetadata.service.rdf.storage;

import java.io.IOException;
import java.net.ConnectException;
import java.net.http.HttpConnectTimeoutException;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.BooleanSupplier;
import java.util.function.LongConsumer;
import java.util.function.LongSupplier;
import org.apache.jena.atlas.web.HttpException;

/** Retries only failures known to precede a write, within one absolute operation budget. */
final class RdfWriteRetry {
  private RdfWriteRetry() {}

  static void run(
      final LongConsumer operation,
      final String description,
      final Policy policy,
      final Circuit circuit,
      final LongConsumer delay) {
    run(operation, description, policy, circuit, delay, System::nanoTime);
  }

  static void run(
      final LongConsumer operation,
      final String description,
      final Policy policy,
      final Circuit circuit,
      final LongConsumer delay,
      final LongSupplier nanoTime) {
    final long deadline =
        nanoTime.getAsLong() + TimeUnit.MILLISECONDS.toNanos(policy.budgetMillis());
    for (int attempt = 0; ; attempt++) {
      circuit.check().run();
      try {
        operation.accept(
            Math.max(1, TimeUnit.NANOSECONDS.toMillis(deadline - nanoTime.getAsLong())));
        circuit.success().run();
        return;
      } catch (RuntimeException exception) {
        if (!JenaFusekiStorage.isCircuitBreakerFailure(exception) && !isUncertain(exception)) {
          throw exception;
        }
        circuit.failure().run();
        if (isUncertain(exception)) {
          throw new RdfWriteOutcomeUnknownException(description, exception);
        }
        if (circuit.isOpen().getAsBoolean()) {
          throw new RdfStorageCircuitOpenException(description, exception);
        }
        final long remaining = TimeUnit.NANOSECONDS.toMillis(deadline - nanoTime.getAsLong());
        final long backoff = policy.backoff(attempt);
        if (attempt >= policy.maxRetries() || remaining <= backoff) {
          throw exception;
        }
        delay.accept(backoff);
        if (nanoTime.getAsLong() >= deadline) {
          throw exception;
        }
      }
    }
  }

  static boolean isUncertain(final Throwable failure) {
    final Set<Throwable> visited = Collections.newSetFromMap(new IdentityHashMap<>());
    Throwable cause = failure;
    boolean unknown = false;
    while (cause != null && visited.add(cause)) {
      if (cause instanceof ConnectException || cause instanceof HttpConnectTimeoutException) {
        return false;
      }
      unknown |=
          cause instanceof IOException
              || cause instanceof TimeoutException
              || cause instanceof InterruptedException
              || cause instanceof RdfWriteOutcomeUnknownException
              || (cause instanceof HttpException http && http.getStatusCode() >= 500);
      cause = cause.getCause();
    }
    return unknown;
  }

  record Policy(
      int maxRetries, long initialBackoffMillis, long maxBackoffMillis, long budgetMillis) {
    long backoff(final int attempt) {
      final long multiplier = 1L << Math.min(attempt, 30);
      return initialBackoffMillis > Long.MAX_VALUE / multiplier
          ? maxBackoffMillis
          : Math.min(maxBackoffMillis, initialBackoffMillis * multiplier);
    }
  }

  record Circuit(Runnable check, Runnable success, Runnable failure, BooleanSupplier isOpen) {}
}
