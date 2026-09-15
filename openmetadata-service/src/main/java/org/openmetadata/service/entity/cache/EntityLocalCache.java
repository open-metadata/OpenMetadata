package org.openmetadata.service.entity.cache;

import com.google.common.base.Ticker;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.function.Function;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.service.config.CacheConfiguration;

/** Owns the byte-bounded local JSON caches and atomically replaces them during configuration. */
public final class EntityLocalCache {
  private static final int STRING_OVERHEAD_BYTES = 40;

  private record Caches(
      LoadingCache<Pair<String, UUID>, String> ids,
      LoadingCache<Pair<String, String>, String> names) {}

  private final CacheLoader<Pair<String, UUID>, String> ids;
  private final CacheLoader<Pair<String, String>, String> names;
  private final Ticker ticker;
  private volatile Caches caches;

  public EntityLocalCache(
      final Function<Pair<String, UUID>, String> ids,
      final Function<Pair<String, String>, String> names,
      final CacheConfiguration config) {
    this(ids, names, config, Ticker.systemTicker());
  }

  EntityLocalCache(
      final Function<Pair<String, UUID>, String> ids,
      final Function<Pair<String, String>, String> names,
      final CacheConfiguration config,
      final Ticker ticker) {
    this.ids = CacheLoader.from(ids::apply);
    this.names = CacheLoader.from(names::apply);
    this.ticker = ticker;
    configure(config);
  }

  public LoadingCache<Pair<String, UUID>, String> byId() {
    return caches.ids();
  }

  public LoadingCache<Pair<String, String>, String> byName() {
    return caches.names();
  }

  public void configure(final CacheConfiguration config) {
    caches = new Caches(build(ids, config), build(names, config));
  }

  private <K> LoadingCache<Pair<String, K>, String> build(
      final CacheLoader<Pair<String, K>, String> loader, final CacheConfiguration config) {
    return CacheBuilder.newBuilder()
        .maximumWeight(config.getEntityCacheMaxSizeBytes())
        .weigher((Pair<String, K> key, String json) -> json.length() * 2 + STRING_OVERHEAD_BYTES)
        .expireAfterWrite(config.getEntityCacheTTLSeconds(), TimeUnit.SECONDS)
        .recordStats()
        .ticker(ticker)
        .build(loader);
  }
}
