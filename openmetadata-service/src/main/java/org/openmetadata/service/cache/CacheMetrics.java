package org.openmetadata.service.cache;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.concurrent.atomic.AtomicLong;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class CacheMetrics {

  private static CacheMetrics instance;
  private final MeterRegistry meterRegistry;

  private final Counter cacheHits;
  private final Counter cacheMisses;
  private final Counter cacheEvictions;
  private final Counter cacheErrors;
  private final Counter cacheWrites;

  private final Timer cacheReadLatency;
  private final Timer cacheWriteLatency;

  private final AtomicLong cacheSize = new AtomicLong();
  private final AtomicLong warmupEntities = new AtomicLong();
  private final AtomicLong warmupRelationships = new AtomicLong();
  private final AtomicLong warmupTags = new AtomicLong();

  private CacheMetrics(MeterRegistry meterRegistry) {
    this.meterRegistry = meterRegistry;

    this.cacheHits =
        Counter.builder("cache.hits")
            .description("Number of cache hits")
            .tag("cache", "redis")
            .register(meterRegistry);

    this.cacheMisses =
        Counter.builder("cache.misses")
            .description("Number of cache misses")
            .tag("cache", "redis")
            .register(meterRegistry);

    this.cacheEvictions =
        Counter.builder("cache.evictions")
            .description("Number of cache evictions")
            .tag("cache", "redis")
            .register(meterRegistry);

    this.cacheErrors =
        Counter.builder("cache.errors")
            .description("Number of cache errors")
            .tag("cache", "redis")
            .register(meterRegistry);

    this.cacheWrites =
        Counter.builder("cache.writes")
            .description("Number of cache writes")
            .tag("cache", "redis")
            .register(meterRegistry);

    this.cacheReadLatency =
        Timer.builder("cache.read.latency")
            .description("Cache read latency")
            .tag("cache", "redis")
            .register(meterRegistry);

    this.cacheWriteLatency =
        Timer.builder("cache.write.latency")
            .description("Cache write latency")
            .tag("cache", "redis")
            .register(meterRegistry);

    Gauge.builder("cache.size", cacheSize, AtomicLong::get)
        .description("Current cache size")
        .tag("cache", "redis")
        .register(meterRegistry);

    Gauge.builder("cache.warmup.entities", warmupEntities, AtomicLong::get)
        .description("Number of entities warmed up")
        .tag("cache", "redis")
        .register(meterRegistry);

    Gauge.builder("cache.warmup.relationships", warmupRelationships, AtomicLong::get)
        .description("Number of relationships warmed up")
        .tag("cache", "redis")
        .register(meterRegistry);

    Gauge.builder("cache.warmup.tags", warmupTags, AtomicLong::get)
        .description("Number of tags warmed up")
        .tag("cache", "redis")
        .register(meterRegistry);

    Gauge.builder("cache.hit.ratio", this, CacheMetrics::getHitRatio)
        .description("Cache hit ratio")
        .tag("cache", "redis")
        .register(meterRegistry);
  }

  public static void initialize(MeterRegistry meterRegistry) {
    if (instance == null) {
      instance = new CacheMetrics(meterRegistry);
      LOG.info("Cache metrics initialized");
    }
  }

  public static CacheMetrics getInstance() {
    if (instance == null) {
      LOG.warn("Cache metrics not initialized, returning null");
    }
    return instance;
  }

  public void recordHit() {
    if (cacheHits != null) {
      cacheHits.increment();
    }
  }

  public void recordMiss() {
    if (cacheMisses != null) {
      cacheMisses.increment();
    }
  }

  public void recordEviction() {
    if (cacheEvictions != null) {
      cacheEvictions.increment();
    }
  }

  public void recordError() {
    if (cacheErrors != null) {
      cacheErrors.increment();
    }
  }

  public void recordWrite() {
    if (cacheWrites != null) {
      cacheWrites.increment();
    }
  }

  public Timer.Sample startReadTimer() {
    return Timer.start(meterRegistry);
  }

  public void recordReadTime(Timer.Sample sample) {
    if (sample != null && cacheReadLatency != null) {
      sample.stop(cacheReadLatency);
    }
  }

  public Timer.Sample startWriteTimer() {
    return Timer.start(meterRegistry);
  }

  public void recordWriteTime(Timer.Sample sample) {
    if (sample != null && cacheWriteLatency != null) {
      sample.stop(cacheWriteLatency);
    }
  }

  public void updateCacheSize(long size) {
    cacheSize.set(size);
  }

  public void updateWarmupStats(long entities, long relationships, long tags) {
    warmupEntities.set(entities);
    warmupRelationships.set(relationships);
    warmupTags.set(tags);
  }

  private double getHitRatio() {
    double hits = cacheHits != null ? cacheHits.count() : 0;
    double misses = cacheMisses != null ? cacheMisses.count() : 0;
    double total = hits + misses;
    return total > 0 ? hits / total : 0.0;
  }
}
