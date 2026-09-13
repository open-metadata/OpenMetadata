package org.openmetadata.service.entity.bulk;

import com.google.common.base.Suppliers;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Tags;
import io.micrometer.core.instrument.Timer;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

/** Fixed, lazily registered meter references for one entity type's bulk operations. */
public final class EntityBulkMetrics {
  private final MeterRegistry registry;
  private final Tags tags;
  private final Supplier<Timer> successfulLatency;
  private final Supplier<Timer> failedLatency;
  private final Supplier<Timer> queueWait;
  private final Supplier<Timer> operationLatency;
  private final Supplier<DistributionSummary> batchSize;
  private final Supplier<DistributionSummary> successRate;
  private final Supplier<Counter> successfulEntities;
  private final Supplier<Counter> failedEntities;

  public EntityBulkMetrics(final String entityType, final MeterRegistry registry) {
    this.registry = registry;
    tags = Tags.of("entity", entityType);
    successfulLatency = timer("bulk.entity.latency", tags.and("success", "true"), false);
    failedLatency = timer("bulk.entity.latency", tags.and("success", "false"), false);
    queueWait = timer("bulk.entity.queue_wait", tags, false);
    operationLatency = timer("bulk.operation.latency", tags, true);
    batchSize = summary("bulk.operation.batch_size");
    successRate = summary("bulk.operation.success_rate");
    successfulEntities = counter("bulk.operation.entities.success");
    failedEntities = counter("bulk.operation.entities.failed");
  }

  public void recordEntity(
      final long durationNanos, final long queueWaitNanos, final boolean success) {
    (success ? successfulLatency : failedLatency).get().record(durationNanos, TimeUnit.NANOSECONDS);
    queueWait.get().record(queueWaitNanos, TimeUnit.NANOSECONDS);
  }

  public void recordBatch(
      final int totalEntities, final int successCount, final long durationNanos) {
    operationLatency.get().record(durationNanos, TimeUnit.NANOSECONDS);
    batchSize.get().record(totalEntities);
    if (totalEntities > 0) {
      successRate.get().record(successCount * 100.0 / totalEntities);
    }
    successfulEntities.get().increment(successCount);
    failedEntities.get().increment(totalEntities - successCount);
  }

  private Supplier<Timer> timer(final String name, final Tags meterTags, final boolean histogram) {
    return Suppliers.memoize(
        () ->
            Timer.builder(name)
                .tags(meterTags)
                .publishPercentileHistogram(histogram)
                .register(registry));
  }

  private Supplier<DistributionSummary> summary(final String name) {
    return Suppliers.memoize(() -> DistributionSummary.builder(name).tags(tags).register(registry));
  }

  private Supplier<Counter> counter(final String name) {
    return Suppliers.memoize(() -> registry.counter(name, tags));
  }
}
