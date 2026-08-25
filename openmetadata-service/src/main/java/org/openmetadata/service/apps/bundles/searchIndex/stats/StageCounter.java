package org.openmetadata.service.apps.bundles.searchIndex.stats;

import java.util.concurrent.atomic.AtomicLong;
import lombok.Getter;

public class StageCounter {
  @Getter private final AtomicLong success = new AtomicLong(0);
  @Getter private final AtomicLong failed = new AtomicLong(0);
  @Getter private final AtomicLong warnings = new AtomicLong(0);

  /**
   * Cumulative wall-clock time spent in this stage, in nanoseconds. Reader timing measures DB
   * fetches; Process timing measures doc build (CPU); Sink timing measures OpenSearch bulk
   * round-trip; Vector timing measures embedding API. Reset to zero on each flush along with the
   * count fields.
   */
  @Getter private final AtomicLong totalTimeNanos = new AtomicLong(0);

  @Getter private final AtomicLong cumulativeSuccess = new AtomicLong(0);
  @Getter private final AtomicLong cumulativeFailed = new AtomicLong(0);
  @Getter private final AtomicLong cumulativeWarnings = new AtomicLong(0);

  public void record(StatsResult result) {
    switch (result) {
      case SUCCESS -> {
        success.incrementAndGet();
        cumulativeSuccess.incrementAndGet();
      }
      case FAILED -> {
        failed.incrementAndGet();
        cumulativeFailed.incrementAndGet();
      }
      case WARNING -> {
        warnings.incrementAndGet();
        cumulativeWarnings.incrementAndGet();
      }
    }
  }

  public void add(long successCount, long failedCount, long warningCount) {
    add(successCount, failedCount, warningCount, 0L);
  }

  /**
   * Add a batch of results plus the wall-clock duration the batch took. Duration may be 0 when the
   * caller has no timing source (legacy paths) but should be set when the batch is the unit of
   * work measured by the stage.
   */
  public void add(long successCount, long failedCount, long warningCount, long durationNanos) {
    success.addAndGet(successCount);
    failed.addAndGet(failedCount);
    warnings.addAndGet(warningCount);
    cumulativeSuccess.addAndGet(successCount);
    cumulativeFailed.addAndGet(failedCount);
    cumulativeWarnings.addAndGet(warningCount);
    if (durationNanos > 0) {
      totalTimeNanos.addAndGet(durationNanos);
    }
  }

  public void reset() {
    success.set(0);
    failed.set(0);
    warnings.set(0);
    totalTimeNanos.set(0);
  }

  public long getTotal() {
    return success.get() + failed.get();
  }
}
