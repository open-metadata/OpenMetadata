package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * An entity cached by name occupies two keys - the entity alias and the reference alias. Evicting
 * them with two round trips leaves a window in which a concurrent reader sees one alias gone and
 * the other still live, and caches a view of the entity assembled from both halves.
 */
class CachedEntityDaoAliasEvictionTest {

  private static final String TYPE = "table";
  private static final String FQN = "svc.db.schema.orders";

  @Test
  void invalidateByNameEvictsBothAliasesInOneCall() {
    RecordingCacheProvider cache = new RecordingCacheProvider();
    CacheKeys keys = new CacheKeys("om");
    CachedEntityDao dao = new CachedEntityDao(cache, keys, new CacheConfig());

    dao.invalidateByName(TYPE, FQN);

    assertEquals(1, cache.deletes.size(), "both aliases must be evicted in a single del");
    assertEquals(
        List.of(keys.entityByName(TYPE, FQN), keys.refByName(TYPE, FQN)), cache.deletes.getFirst());
  }

  @Test
  void deleteByNameEvictsBothAliasesInOneCall() {
    RecordingCacheProvider cache = new RecordingCacheProvider();
    CacheKeys keys = new CacheKeys("om");
    CachedEntityDao dao = new CachedEntityDao(cache, keys, new CacheConfig());

    dao.deleteByName(TYPE, FQN);

    assertEquals(1, cache.deletes.size(), "both aliases must be evicted in a single del");
    assertEquals(
        List.of(keys.entityByName(TYPE, FQN), keys.refByName(TYPE, FQN)), cache.deletes.getFirst());
  }

  @Test
  void invalidateByIdStillEvictsTheSingleKeyItOwns() {
    RecordingCacheProvider cache = new RecordingCacheProvider();
    CacheKeys keys = new CacheKeys("om");
    CachedEntityDao dao = new CachedEntityDao(cache, keys, new CacheConfig());
    UUID id = UUID.randomUUID();

    dao.invalidate(id, TYPE);

    assertEquals(1, cache.deletes.size());
    assertEquals(List.of(keys.entity(TYPE, id)), cache.deletes.getFirst());
    assertTrue(cache.deletes.getFirst().size() == 1, "the id alias is a single key");
  }

  private static final class RecordingCacheProvider extends NoopCacheProvider {
    private final List<List<String>> deletes = new ArrayList<>();

    @Override
    public void del(String... keys) {
      deletes.add(List.of(keys));
    }
  }
}
