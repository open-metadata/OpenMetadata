package org.openmetadata.service.entity.cache;

import static org.openmetadata.schema.utils.EntityInterfaceUtil.quoteName;

import com.google.common.base.Ticker;
import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import org.apache.commons.lang3.tuple.Pair;

/** Bounds write epochs to the local cache working set so loaders can detect concurrent writes. */
public final class EntityCacheEpochs {
  private final Cache<Pair<String, UUID>, AtomicLong> ids;
  private final Cache<Pair<String, String>, AtomicLong> names;

  public EntityCacheEpochs() {
    this(200_000, Duration.ofMinutes(5), Ticker.systemTicker());
  }

  EntityCacheEpochs(final long capacity, final Duration ttl, final Ticker ticker) {
    ids =
        CacheBuilder.newBuilder()
            .maximumSize(capacity)
            .expireAfterAccess(ttl)
            .ticker(ticker)
            .build();
    names =
        CacheBuilder.newBuilder()
            .maximumSize(capacity)
            .expireAfterAccess(ttl)
            .ticker(ticker)
            .build();
  }

  public long byId(final Pair<String, UUID> key) {
    final AtomicLong epoch = ids.getIfPresent(key);
    return epoch == null ? 0 : epoch.get();
  }

  public long byName(final Pair<String, String> key) {
    final AtomicLong epoch = names.getIfPresent(key);
    return epoch == null ? 0 : epoch.get();
  }

  public void advance(final String type, final UUID id, final String fqn) {
    if (id != null) {
      ids.asMap()
          .computeIfAbsent(EntityCacheKeys.id(type, id), ignored -> new AtomicLong())
          .incrementAndGet();
    }
    if (fqn != null) {
      advanceName(type, fqn);
    }
  }

  private void advanceName(final String type, final String fqn) {
    incrementName(EntityCacheKeys.name(type, fqn));
    final String quoted = quoteName(fqn);
    // Readers quote flat entity names; writers can receive either representation.
    if (!quoted.equals(fqn)) {
      incrementName(EntityCacheKeys.name(type, quoted));
    }
  }

  private void incrementName(final Pair<String, String> key) {
    names.asMap().computeIfAbsent(key, ignored -> new AtomicLong()).incrementAndGet();
  }
}
