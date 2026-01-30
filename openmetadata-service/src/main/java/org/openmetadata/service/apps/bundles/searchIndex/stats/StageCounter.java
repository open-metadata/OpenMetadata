package org.openmetadata.service.apps.bundles.searchIndex.stats;

import java.util.concurrent.atomic.AtomicLong;
import lombok.Getter;

public class StageCounter {
  @Getter private final AtomicLong success = new AtomicLong(0);
  @Getter private final AtomicLong failed = new AtomicLong(0);
  @Getter private final AtomicLong warnings = new AtomicLong(0);

  public void record(StatsResult result) {
    switch (result) {
      case SUCCESS -> success.incrementAndGet();
      case FAILED -> failed.incrementAndGet();
      case WARNING -> warnings.incrementAndGet();
    }
  }

  public void add(long successCount, long failedCount, long warningCount) {
    success.addAndGet(successCount);
    failed.addAndGet(failedCount);
    warnings.addAndGet(warningCount);
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
