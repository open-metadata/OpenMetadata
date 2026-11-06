/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.apps.bundles.searchIndex;

import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryUsage;
import lombok.extern.slf4j.Slf4j;

/**
 * Runtime heap backpressure for the reindex reader.
 *
 * <p>AutoTune sizes batch/queue once at job start from a fixed per-entity estimate. Real
 * entities (wide tables, vector embeddings, large status history) and anything else sharing the pod
 * push actual heap far past any single estimate, so a static count-based buffer silently overflows a
 * heap — a 748 MB pod OOM'd on 2026-08-03 seconds after AutoTune upsized its queue to 1840 entities.
 * No formula can predict runtime pressure; the only thing that works in all situations is to react
 * to it.
 *
 * <p>This gate pauses the calling reader — never the in-flight writes — while used heap is above
 * {@link #PAUSE_ABOVE}, letting in-flight docs drain and GC reclaim before the reader allocates the
 * next batch. It is a no-op on a healthy heap (the common case), so it costs nothing until the pod
 * is actually close to OOM.
 */
@Slf4j
public final class HeapBackpressure {
  private HeapBackpressure() {}

  /** Pause reading at/above this fraction of max heap. */
  static final double PAUSE_ABOVE = 0.80;

  /** Resume once heap drains below this fraction (hysteresis avoids pause/resume flapping). */
  static final double RESUME_BELOW = 0.68;

  private static final long POLL_MS = 250;
  private static final long MAX_WAIT_MS = 30_000;

  private static final MemoryMXBean MEMORY = ManagementFactory.getMemoryMXBean();

  /** True when used heap is at/above the pause threshold. Unknown max ({@code <= 0}) is never a pause. */
  static boolean underPressure(long usedBytes, long maxBytes) {
    return maxBytes > 0 && (double) usedBytes / maxBytes >= PAUSE_ABOVE;
  }

  /** True when used heap is below the resume threshold, or max is unknown. */
  static boolean hasHeadroom(long usedBytes, long maxBytes) {
    return maxBytes <= 0 || (double) usedBytes / maxBytes < RESUME_BELOW;
  }

  /**
   * Blocks the caller while heap is under pressure, up to {@link #MAX_WAIT_MS}, so a burst of large
   * entities cannot push the heap into OOM. Returns immediately on a healthy heap.
   */
  public static void awaitHeadroom() {
    MemoryUsage usage = MEMORY.getHeapMemoryUsage();
    if (underPressure(usage.getUsed(), usage.getMax())) {
      drainUntilHeadroom(usage.getMax());
    }
  }

  private static void drainUntilHeadroom(long maxBytes) {
    LOG.warn(
        "Reindex reader pausing: heap at {}% of {} MB (>= {}% threshold); draining in-flight work",
        percentUsed(MEMORY.getHeapMemoryUsage().getUsed(), maxBytes),
        maxBytes / (1024 * 1024),
        Math.round(PAUSE_ABOVE * 100));
    long waited = 0;
    long usedBytes = maxBytes;
    while (waited < MAX_WAIT_MS && !Thread.currentThread().isInterrupted()) {
      sleep(POLL_MS);
      waited += POLL_MS;
      usedBytes = MEMORY.getHeapMemoryUsage().getUsed();
      if (hasHeadroom(usedBytes, maxBytes)) {
        break;
      }
    }
    logResume(usedBytes, maxBytes, waited);
  }

  private static void logResume(long usedBytes, long maxBytes, long waited) {
    if (hasHeadroom(usedBytes, maxBytes)) {
      LOG.info(
          "Reindex reader resuming after {} ms; heap back to {}%",
          waited, percentUsed(usedBytes, maxBytes));
    } else {
      LOG.warn(
          "Reindex reader proceeding after {} ms; heap still {}% — GC could not free enough. "
              + "Reduce batch/queue size or raise the heap for this reindex.",
          waited, percentUsed(usedBytes, maxBytes));
    }
  }

  private static long percentUsed(long usedBytes, long maxBytes) {
    return maxBytes > 0 ? Math.round(100.0 * usedBytes / maxBytes) : 0;
  }

  private static void sleep(long millis) {
    try {
      Thread.sleep(millis);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
