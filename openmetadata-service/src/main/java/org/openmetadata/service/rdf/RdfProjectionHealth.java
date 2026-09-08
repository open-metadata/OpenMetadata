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

import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;

/** SQL is authoritative once RDF is initialized; local failures are flushed after SQL recovers. */
@Slf4j
public final class RdfProjectionHealth {
  private static final AtomicLong LOCAL_FAILURES = new AtomicLong();
  private static final AtomicLong LOCAL_REPAIRED = new AtomicLong();
  private static final ThreadLocal<Boolean> DURABLE_RECOVERY = new ThreadLocal<>();
  private static volatile RdfLiveWriteStore store;

  private RdfProjectionHealth() {}

  public static void initialize(final RdfLiveWriteStore liveWriteStore) {
    store = liveWriteStore;
    flushLocalFailures();
  }

  public static boolean isDegraded() {
    try {
      flushLocalFailures();
      return store != null ? store.isDegraded() : LOCAL_FAILURES.get() > LOCAL_REPAIRED.get();
    } catch (RuntimeException exception) {
      LOG.warn("Cannot read shared RDF projection health", exception);
      return true;
    }
  }

  public static void markDegraded() {
    markDegraded(new IllegalStateException("RDF operation failed without durable recovery"));
  }

  public static void markDegraded(final Throwable failure) {
    if (Boolean.TRUE.equals(DURABLE_RECOVERY.get())) {
      return;
    }
    if (store == null) {
      LOCAL_FAILURES.incrementAndGet();
      return;
    }
    try {
      store.markDegraded(RdfLiveWriteStore.failureReason(failure));
    } catch (RuntimeException exception) {
      LOCAL_FAILURES.incrementAndGet();
      LOG.error("Could not persist RDF projection failure", exception);
    }
  }

  public static long failureVersion() {
    flushLocalFailures();
    return store != null ? store.failureVersion() : LOCAL_FAILURES.get();
  }

  public static void markReady(final long failureVersion) {
    if (store != null) {
      store.markRebuilt(failureVersion);
    } else {
      LOCAL_REPAIRED.accumulateAndGet(failureVersion, Math::max);
    }
  }

  public static void markReady() {
    markReady(failureVersion());
  }

  static synchronized void flushLocalFailures() {
    final long failures = LOCAL_FAILURES.get();
    if (store != null && failures > LOCAL_REPAIRED.get()) {
      store.markDegraded("RDF operation failed while shared health storage was unavailable");
      LOCAL_REPAIRED.set(failures);
    }
  }

  static void withDurableRecovery(final Runnable write) {
    final Boolean previous = DURABLE_RECOVERY.get();
    DURABLE_RECOVERY.set(true);
    try {
      // The queue row owns this failure until acknowledgement. A second, sticky failure marker
      // would incorrectly require a full rebuild even after that row has been retried successfully.
      write.run();
    } finally {
      if (previous == null) {
        DURABLE_RECOVERY.remove();
      } else {
        DURABLE_RECOVERY.set(previous);
      }
    }
  }
}
