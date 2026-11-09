package org.openmetadata.service.context.center;

import io.dropwizard.lifecycle.Managed;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextFileRepository;

/**
 * Sweeps for text extraction a stopped server stranded. A surge-first rollout runs the new server's
 * startup scan before the old one stops, so only a periodic sweep on a live server sees those files.
 * ADR:2026-11-09-a-server-stop-leaves-memory-extraction-for-recovery
 */
@Slf4j
public final class ContextFileRecoveryScheduler implements Managed {
  private static final long PERIOD_MINUTES = 5;
  private final Supplier<ContextFileProcessingService> serviceSupplier;
  private ScheduledExecutorService executor;

  public ContextFileRecoveryScheduler() {
    this(
        () ->
            new ContextFileProcessingService(
                (ContextFileRepository) Entity.getEntityRepository(Entity.CONTEXT_FILE)));
  }

  ContextFileRecoveryScheduler(Supplier<ContextFileProcessingService> serviceSupplier) {
    this.serviceSupplier = serviceSupplier;
  }

  @Override
  public void start() {
    executor =
        Executors.newSingleThreadScheduledExecutor(
            runnable -> {
              Thread thread = new Thread(runnable, "context-file-recovery");
              thread.setDaemon(true);
              return thread;
            });
    executor.scheduleWithFixedDelay(
        this::runSafely, PERIOD_MINUTES, PERIOD_MINUTES, TimeUnit.MINUTES);
  }

  @Override
  public void stop() {
    if (executor != null) {
      executor.shutdownNow();
    }
  }

  // An exception escaping a scheduleWithFixedDelay task would end the sweep for good.
  void runSafely() {
    try {
      int resubmitted =
          serviceSupplier.get().resubmitStaleTextExtraction(System.currentTimeMillis());
      if (resubmitted > 0) {
        LOG.info("Resubmitted {} context files whose text extraction was stranded", resubmitted);
      }
    } catch (RuntimeException e) {
      LOG.warn("Failed to resubmit stranded context file text extraction", e);
    }
  }
}
