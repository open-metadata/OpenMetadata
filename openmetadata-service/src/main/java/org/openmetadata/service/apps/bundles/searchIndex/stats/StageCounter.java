package org.openmetadata.service.apps.bundles.searchIndex.stats;

import java.util.concurrent.atomic.AtomicLong;
import lombok.Getter;

public class StageCounter {
  @Getter private final AtomicLong success = new AtomicLong(0);
  @Getter private final AtomicLong failed = new AtomicLong(0);
  @Getter private final AtomicLong warnings = new AtomicLong(0);

  @Getter private final AtomicLong cumulativeSuccess = new AtomicLong(0);
  @Getter private final AtomicLong cumulativeFailed = new AtomicLong(0);

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
      case WARNING -> warnings.incrementAndGet();
    }
  }

  public void add(long successCount, long failedCount, long warningCount) {
    success.addAndGet(successCount);
    failed.addAndGet(failedCount);
    warnings.addAndGet(warningCount);
    cumulativeSuccess.addAndGet(successCount);
    cumulativeFailed.addAndGet(failedCount);
  }

  public void reset() {
    success.set(0);
    failed.set(0);
    warnings.set(0);
  }

  public long getTotal() {
    return success.get() + failed.get();
  }
}
