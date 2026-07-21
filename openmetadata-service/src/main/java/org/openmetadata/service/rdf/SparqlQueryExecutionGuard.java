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

package org.openmetadata.service.rdf;

import java.util.Objects;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;

/** Bounded admission and runtime guard for user-authored SPARQL. */
public final class SparqlQueryExecutionGuard {
  private static final int GLOBAL_CONCURRENCY = 8;
  private static final int PRINCIPAL_CONCURRENCY = 2;
  private static final int PRINCIPAL_STRIPES = 64;
  private static final ExecutorService EXECUTOR =
      Executors.newThreadPerTaskExecutor(
          Thread.ofVirtual().name("sparql-user-query-", 0).factory());
  private static final SparqlQueryExecutionGuard INSTANCE =
      new SparqlQueryExecutionGuard(
          GLOBAL_CONCURRENCY,
          PRINCIPAL_CONCURRENCY,
          PRINCIPAL_STRIPES,
          SparqlQueryLimits.TIMEOUT_MILLIS,
          EXECUTOR);

  private final Semaphore globalPermits;
  private final Semaphore[] principalPermits;
  private final long timeoutMillis;
  private final ExecutorService executor;

  SparqlQueryExecutionGuard(
      final int globalConcurrency,
      final int principalConcurrency,
      final int principalStripes,
      final long timeoutMillis,
      final ExecutorService executor) {
    globalPermits = new Semaphore(globalConcurrency);
    principalPermits = createStripes(principalConcurrency, principalStripes);
    this.timeoutMillis = timeoutMillis;
    this.executor = Objects.requireNonNull(executor);
  }

  public static SparqlQueryExecutionGuard shared() {
    return INSTANCE;
  }

  public <T> T execute(final String principal, final Supplier<T> query) {
    final Semaphore principalPermit = permitFor(principal);
    acquire(principalPermit);
    final Future<T> future = submit(query, principalPermit);
    return await(future);
  }

  private <T> Future<T> submit(final Supplier<T> query, final Semaphore principalPermit) {
    try {
      return executor.submit(() -> executeAndRelease(query, principalPermit));
    } catch (final RuntimeException exception) {
      release(principalPermit);
      throw exception;
    }
  }

  private <T> T executeAndRelease(final Supplier<T> query, final Semaphore principalPermit) {
    try {
      return query.get();
    } finally {
      release(principalPermit);
    }
  }

  private void release(final Semaphore principalPermit) {
    principalPermit.release();
    globalPermits.release();
  }

  private <T> T await(final Future<T> future) {
    try {
      return future.get(timeoutMillis, TimeUnit.MILLISECONDS);
    } catch (final TimeoutException exception) {
      future.cancel(true);
      throw new QueryTimeoutException(timeoutMillis, exception);
    } catch (final InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new QueryTimeoutException(timeoutMillis, exception);
    } catch (final ExecutionException exception) {
      throw propagate(exception);
    }
  }

  private void acquire(final Semaphore principalPermit) {
    if (!globalPermits.tryAcquire()) {
      throw new QueryCapacityException("SPARQL server concurrency limit reached");
    }
    if (!principalPermit.tryAcquire()) {
      globalPermits.release();
      throw new QueryCapacityException("SPARQL principal concurrency limit reached");
    }
  }

  private Semaphore permitFor(final String principal) {
    final int index =
        Math.floorMod(Objects.requireNonNull(principal).hashCode(), principalPermits.length);
    return principalPermits[index];
  }

  private static Semaphore[] createStripes(final int concurrency, final int stripeCount) {
    final Semaphore[] stripes = new Semaphore[stripeCount];
    for (int index = 0; index < stripeCount; index++) {
      stripes[index] = new Semaphore(concurrency);
    }
    return stripes;
  }

  private static RuntimeException propagate(final ExecutionException exception) {
    final Throwable cause = exception.getCause();
    if (cause instanceof RuntimeException runtimeException) {
      return runtimeException;
    }
    return new IllegalStateException("SPARQL query execution failed", cause);
  }

  public static final class QueryCapacityException extends RuntimeException {
    public QueryCapacityException(final String message) {
      super(message);
    }
  }

  public static final class QueryTimeoutException extends RuntimeException {
    public QueryTimeoutException(final long timeoutMillis, final Throwable cause) {
      super("SPARQL query timed out after %d ms".formatted(timeoutMillis), cause);
    }
  }
}
