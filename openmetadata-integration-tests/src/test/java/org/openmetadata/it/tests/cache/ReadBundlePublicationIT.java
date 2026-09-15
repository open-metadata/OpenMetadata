package org.openmetadata.it.tests.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CachedReadBundle;
import org.openmetadata.service.cache.RedisCacheProvider;

class ReadBundlePublicationIT {
  private CachedReadBundle cache;

  @BeforeEach
  void initialize() {
    SdkClients.adminClient();
    cache = CacheBundle.getCachedReadBundle();
    assumeTrue(cache != null, "Requires a Redis integration profile");
  }

  @Test
  void partialFillRetainsPreviouslyLoadedEmptyTagsAndNullCertification() {
    UUID id = UUID.randomUUID();
    var original = relations(Entity.FIELD_OWNERS);
    original.tagsLoaded = true;
    original.tags = List.of();
    original.certificationLoaded = true;
    cache.put(Entity.TABLE, id, original);
    var observed = cache.getSnapshot(Entity.TABLE, id);

    publish(id, observed, relations(Entity.FIELD_DOMAINS));

    var result = cache.get(Entity.TABLE, id);
    assertTrue(result.tagsLoaded);
    assertTrue(result.certificationLoaded);
    assertNull(result.certification);
    assertEquals(List.of(), result.tags);
    assertTrue(result.relations.containsKey(Entity.FIELD_OWNERS));
    assertTrue(result.relations.containsKey(Entity.FIELD_DOMAINS));
  }

  @Test
  void partialFillCannotRecreateAnInvalidatedSnapshot() {
    UUID id = UUID.randomUUID();
    cache.put(Entity.TABLE, id, relations(Entity.FIELD_OWNERS));
    var observed = cache.getSnapshot(Entity.TABLE, id);
    cache.invalidate(Entity.TABLE, id);

    publish(id, observed, relations(Entity.FIELD_DOMAINS));

    assertNull(cache.get(Entity.TABLE, id));
  }

  @Test
  void partialFillCannotReplaceANewerSnapshot() {
    UUID id = UUID.randomUUID();
    cache.put(Entity.TABLE, id, relations(Entity.FIELD_OWNERS));
    var observed = cache.getSnapshot(Entity.TABLE, id);
    var newer = relations(Entity.FIELD_FOLLOWERS);
    cache.put(Entity.TABLE, id, newer);

    publish(id, observed, relations(Entity.FIELD_DOMAINS));

    assertEquals(newer.relations, cache.get(Entity.TABLE, id).relations);
  }

  @Test
  void coldFillCannotReplaceAConcurrentFill() {
    UUID id = UUID.randomUUID();
    var observed = cache.getSnapshot(Entity.TABLE, id);
    var newer = relations(Entity.FIELD_FOLLOWERS);
    cache.put(Entity.TABLE, id, newer);

    publish(id, observed, relations(Entity.FIELD_OWNERS));

    assertEquals(newer.relations, cache.get(Entity.TABLE, id).relations);
  }

  @Test
  void expiryRefreshRetainsThePayloadAndRestoresItsConfiguredLifetime() {
    UUID id = UUID.randomUUID();
    cache.put(Entity.TABLE, id, relations(Entity.FIELD_OWNERS));
    var provider = (RedisCacheProvider) CacheBundle.getCacheProvider();
    var config = CacheBundle.getCacheConfig();
    String key = new CacheKeys(config.redis.keyspace).bundle(Entity.TABLE, id);
    String original = provider.get(key).orElseThrow();
    provider.getSyncCommands().expire(key, 10);

    cache.refresh(Entity.TABLE, id);

    assertEquals(original, provider.get(key).orElseThrow());
    assertTrue(provider.getSyncCommands().ttl(key) >= config.entityTtlSeconds - 1);
  }

  @Test
  void expiryRefreshCannotRecreateAnInvalidatedKey() {
    UUID id = UUID.randomUUID();
    cache.put(Entity.TABLE, id, relations(Entity.FIELD_OWNERS));
    cache.invalidate(Entity.TABLE, id);

    cache.refresh(Entity.TABLE, id);

    assertNull(cache.get(Entity.TABLE, id));
  }

  private void publish(UUID id, CachedReadBundle.Snapshot observed, CachedReadBundle.Dto loaded) {
    cache.publish(Entity.TABLE, id, observed, loaded);
  }

  private CachedReadBundle.Dto relations(String field) {
    var dto = new CachedReadBundle.Dto();
    dto.relations =
        Map.of(
            field, List.of(new EntityReference().withType(Entity.USER).withId(UUID.randomUUID())));
    return dto;
  }
}
