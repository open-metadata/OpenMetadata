package org.openmetadata.service.cache;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
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
  // Reads that exceeded the slow-read threshold (default 50ms). Watch in dashboards as a
  // leading indicator of Redis pressure or network glitches — a sustained nonzero rate here
  // means cache GETs are no longer "free" and the cache is hurting tail latency.
  private final Counter cacheSlowReads;

  private final Timer cacheReadLatency;
  private final Timer cacheWriteLatency;

  private final AtomicLong cacheSize = new AtomicLong();
  private final AtomicLong warmupEntities = new AtomicLong();
  private final AtomicLong warmupRelationships = new AtomicLong();
  private final AtomicLong warmupTags = new AtomicLong();
  private final AtomicLong warmupCompletedRuns = new AtomicLong();
  // Coverage gauges are registered lazily per entity type so we don't need to know the type list
  // at startup. Holders keep the AtomicLong reference alive so the gauge stays observable.
  private final Map<String, AtomicLong> coverageGauges = new ConcurrentHashMap<>();
  private final Map<String, AtomicLong> bundleCoverageGauges = new ConcurrentHashMap<>();
  // Per-type layer counters — registered lazily on first use. Distinct from the untagged
  // counters above: these track *logical* hits at a cache layer (e.g. CachedSearchLayer,
  // CachedEntityDao for type=table), while the untagged counters track *every* Redis op
  // including those issued by sub-operations of a single layer call. The two views are
  // related but not identical; use byType for "is this entity type's cache effective?"
  // and the aggregate for "what's our Redis traffic look like?".
  private final Map<String, Counter> typedHits = new ConcurrentHashMap<>();
  private final Map<String, Counter> typedMisses = new ConcurrentHashMap<>();
  private final Map<String, Counter> typedWrites = new ConcurrentHashMap<>();

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

    this.cacheSlowReads =
        Counter.builder("cache.reads.slow")
            .description("Number of cache reads exceeding the slow-read threshold")
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

    Gauge.builder("cache.warmup.completed_runs", warmupCompletedRuns, AtomicLong::get)
        .description("Number of completed warmup runs since process start")
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
      // DEBUG, not WARN: callers (eg admin /cache/stats poller) hit this every refresh on
      // any deployment where cache isn't configured. WARN would spam ops logs for the
      // entirely-normal "cache off" state.
      LOG.debug("Cache metrics not initialized, returning null");
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

  /** Record a read that exceeded the configured slow-read threshold. */
  public void recordSlowRead() {
    if (cacheSlowReads != null) {
      cacheSlowReads.increment();
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

  /**
   * Record post-warmup coverage for an entity type as the ratio (cached keys / DB row count). A
   * value below 1.0 indicates cache+DB drift; below ~0.95 signals an unfinished warmup or Redis
   * outage during warmup. Stored as a percentage 0-100 to keep gauge values intuitive in
   * dashboards.
   */
  public void recordCoverage(String entityType, double ratio) {
    setOrRegisterCoverageGauge(coverageGauges, "cache.warmup.coverage", entityType, ratio);
  }

  /** Same as {@link #recordCoverage} but for the bundle pre-warm pass. */
  public void recordBundleCoverage(String entityType, double ratio) {
    setOrRegisterCoverageGauge(
        bundleCoverageGauges, "cache.warmup.bundle.coverage", entityType, ratio);
  }

  public void recordWarmupCompleted() {
    warmupCompletedRuns.incrementAndGet();
  }

  /**
   * Layer-level hit recording. {@code type} is a free-form discriminator chosen by the calling
   * cache layer — entity types like "table" / "container" for {@link CachedEntityDao}, or category
   * names like "search" / "lineage" for the higher-level layers. {@code null} is a no-op (the
   * aggregate counters above are untouched, so the call is safe from any context).
   */
  public void recordLayerHit(String type) {
    if (type != null) {
      typedHits
          .computeIfAbsent(
              type,
              t ->
                  Counter.builder("cache.layer.hits")
                      .description("Per-type cache hits at the layer level")
                      .tag("cache", "redis")
                      .tag("type", t)
                      .register(meterRegistry))
          .increment();
    }
  }

  /** See {@link #recordLayerHit(String)}. */
  public void recordLayerMiss(String type) {
    if (type != null) {
      typedMisses
          .computeIfAbsent(
              type,
              t ->
                  Counter.builder("cache.layer.misses")
                      .description("Per-type cache misses at the layer level")
                      .tag("cache", "redis")
                      .tag("type", t)
                      .register(meterRegistry))
          .increment();
    }
  }

  /** See {@link #recordLayerHit(String)}. */
  public void recordLayerWrite(String type) {
    if (type != null) {
      typedWrites
          .computeIfAbsent(
              type,
              t ->
                  Counter.builder("cache.layer.writes")
                      .description("Per-type cache writes at the layer level")
                      .tag("cache", "redis")
                      .tag("type", t)
                      .register(meterRegistry))
          .increment();
    }
  }

  private void setOrRegisterCoverageGauge(
      Map<String, AtomicLong> holders, String metricName, String entityType, double ratio) {
    long value = Math.round(Math.max(0.0, Math.min(1.0, ratio)) * 100.0);
    holders
        .computeIfAbsent(
            entityType,
            type -> {
              AtomicLong holder = new AtomicLong();
              Gauge.builder(metricName, holder, AtomicLong::get)
                  .description("Warmup coverage as percent (cached keys / DB rows)")
                  .tag("cache", "redis")
                  .tag("type", type)
                  .register(meterRegistry);
              return holder;
            })
        .set(value);
  }

  private double getHitRatio() {
    double hits = cacheHits != null ? cacheHits.count() : 0;
    double misses = cacheMisses != null ? cacheMisses.count() : 0;
    double total = hits + misses;
    return total > 0 ? hits / total : 0.0;
  }

  /**
   * Snapshot of all application-level cache counters and gauges. Intended to be merged into the
   * {@code /api/v1/system/cache/stats} response so operators can read hit/miss/latency without
   * scraping Prometheus. Distinct from the provider-side stats (which expose Redis
   * keyspace_hits/misses) — these counters track decisions made by OM read paths
   * (EntityRepository, CachedReadBundle, etc.) so a hit here means "OM avoided a DB query," not
   * "Redis returned data for some internal call."
   */
  public Map<String, Object> snapshot() {
    Map<String, Object> snap = new LinkedHashMap<>();
    snap.put("hits", cacheHits != null ? (long) cacheHits.count() : 0L);
    snap.put("misses", cacheMisses != null ? (long) cacheMisses.count() : 0L);
    snap.put("hitRatio", getHitRatio());
    snap.put("evictions", cacheEvictions != null ? (long) cacheEvictions.count() : 0L);
    snap.put("errors", cacheErrors != null ? (long) cacheErrors.count() : 0L);
    snap.put("writes", cacheWrites != null ? (long) cacheWrites.count() : 0L);
    snap.put("slowReads", cacheSlowReads != null ? (long) cacheSlowReads.count() : 0L);
    snap.put("size", cacheSize.get());
    Map<String, Object> warmup = new LinkedHashMap<>();
    warmup.put("entities", warmupEntities.get());
    warmup.put("relationships", warmupRelationships.get());
    warmup.put("tags", warmupTags.get());
    warmup.put("completedRuns", warmupCompletedRuns.get());
    snap.put("warmup", warmup);
    if (cacheReadLatency != null) {
      Map<String, Object> readLatency = new LinkedHashMap<>();
      readLatency.put("count", cacheReadLatency.count());
      readLatency.put(
          "totalMs", cacheReadLatency.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS));
      readLatency.put("meanMs", cacheReadLatency.mean(java.util.concurrent.TimeUnit.MILLISECONDS));
      readLatency.put("maxMs", cacheReadLatency.max(java.util.concurrent.TimeUnit.MILLISECONDS));
      snap.put("readLatency", readLatency);
    }
    if (cacheWriteLatency != null) {
      Map<String, Object> writeLatency = new LinkedHashMap<>();
      writeLatency.put("count", cacheWriteLatency.count());
      writeLatency.put(
          "totalMs", cacheWriteLatency.totalTime(java.util.concurrent.TimeUnit.MILLISECONDS));
      writeLatency.put(
          "meanMs", cacheWriteLatency.mean(java.util.concurrent.TimeUnit.MILLISECONDS));
      writeLatency.put("maxMs", cacheWriteLatency.max(java.util.concurrent.TimeUnit.MILLISECONDS));
      snap.put("writeLatency", writeLatency);
    }
    Map<String, Map<String, Object>> byType = new LinkedHashMap<>();
    java.util.Set<String> types = new java.util.TreeSet<>();
    types.addAll(typedHits.keySet());
    types.addAll(typedMisses.keySet());
    types.addAll(typedWrites.keySet());
    for (String type : types) {
      long h = typedHits.containsKey(type) ? (long) typedHits.get(type).count() : 0L;
      long miss = typedMisses.containsKey(type) ? (long) typedMisses.get(type).count() : 0L;
      long w = typedWrites.containsKey(type) ? (long) typedWrites.get(type).count() : 0L;
      long totalLookups = h + miss;
      Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("hits", h);
      entry.put("misses", miss);
      entry.put("writes", w);
      entry.put("hitRatio", totalLookups > 0 ? (double) h / totalLookups : 0.0);
      byType.put(type, entry);
    }
    snap.put("byType", byType);
    return snap;
  }
}
