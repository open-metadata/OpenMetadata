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

package org.openmetadata.service.jobs;

import io.dropwizard.lifecycle.Managed;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.EntityExtensionReferenceCompaction;

/**
 * Rewrites custom-property values whose referenced entity was hard-deleted. The delete only marks
 * ledger rows; this sweep drains them on every server, so the JSON churn of a widely referenced
 * entity never sits inside the delete transaction. Servers claim value rows with {@code SKIP
 * LOCKED}, so concurrent runs take disjoint work. A delete on this server requests an immediate
 * run so small deletes are compacted within seconds rather than at the next interval.
 */
@Slf4j
public class EntityExtensionReferenceCompactionScheduler implements Managed {
  private static final long INTERVAL_MINUTES = 5L;
  private static final long INITIAL_DELAY_SECONDS = 60L;
  private static final int PAGE_SIZE = 100;
  private static final int MAX_PAGES_PER_RUN = 1_000;

  private static volatile EntityExtensionReferenceCompactionScheduler current;

  private final EntityExtensionReferenceCompaction compaction;
  private final AtomicBoolean running = new AtomicBoolean();
  private final AtomicBoolean rerunRequested = new AtomicBoolean();
  private ScheduledExecutorService scheduler;

  public EntityExtensionReferenceCompactionScheduler(
      EntityExtensionReferenceCompaction compaction) {
    this.compaction = compaction;
  }

  /** Single-flight nudge from a hard delete; a no-op before start, after stop, or mid-run. */
  public static void requestRun() {
    EntityExtensionReferenceCompactionScheduler scheduler = current;
    if (scheduler != null && scheduler.scheduler != null) {
      scheduler.scheduler.execute(scheduler::runSafely);
    }
  }

  @Override
  public void start() {
    scheduler =
        Executors.newSingleThreadScheduledExecutor(
            runnable -> {
              Thread thread = new Thread(runnable, "om-custom-property-reference-compaction");
              thread.setDaemon(true);
              return thread;
            });
    scheduler.scheduleWithFixedDelay(
        this::runSafely,
        INITIAL_DELAY_SECONDS,
        TimeUnit.MINUTES.toSeconds(INTERVAL_MINUTES),
        TimeUnit.SECONDS);
    current = this;
  }

  @Override
  public void stop() {
    current = null;
    if (scheduler != null) {
      scheduler.shutdownNow();
    }
  }

  /** A request that lands mid-run is honoured by one more pass, not dropped until the next tick. */
  void runSafely() {
    if (!running.compareAndSet(false, true)) {
      rerunRequested.set(true);
      return;
    }
    try {
      do {
        rerunRequested.set(false);
        runOnce();
      } while (rerunRequested.get());
    } catch (RuntimeException exception) {
      LOG.warn("Failed to compact custom-property references", exception);
    } finally {
      running.set(false);
    }
  }

  int runOnce() {
    int rewritten = 0;
    for (int page = 0; page < MAX_PAGES_PER_RUN; page++) {
      EntityExtensionReferenceCompaction.CompactionPage result =
          compaction.compactPending(PAGE_SIZE);
      rewritten += result.rewritten();
      // A full page with no progress means every candidate is held by another transaction.
      if (result.fetched() < PAGE_SIZE || result.processed() == 0) {
        break;
      }
    }
    if (rewritten > 0) {
      LOG.info("Compacted {} custom-property values with hard-deleted references", rewritten);
    }
    logBacklog(rewritten);
    return rewritten;
  }

  /**
   * A backlog that survives a run is normal while writers hold rows; one that survives a run that
   * rewrote nothing means compaction is not converging, which is what the warning is for.
   */
  private void logBacklog(int rewritten) {
    long pending = compaction.pendingCount();
    if (pending > 0 && rewritten == 0) {
      LOG.warn(
          "{} custom-property references are pending compaction and none could be processed",
          pending);
    } else if (pending > 0) {
      LOG.info("{} custom-property references are still pending compaction", pending);
    }
  }
}
