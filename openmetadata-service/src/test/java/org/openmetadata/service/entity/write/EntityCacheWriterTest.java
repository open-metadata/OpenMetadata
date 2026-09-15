package org.openmetadata.service.entity.write;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CachedEntityDao;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.cache.NoopCacheProvider;
import org.openmetadata.service.util.PostCommitActionQueue;

class EntityCacheWriterTest {
  private final RecordingProvider provider = new RecordingProvider();
  private final CachedEntityDao cache =
      new CachedEntityDao(provider, new CacheKeys("om:writer-test"), new CacheConfig());
  private final AtomicInteger serializations = new AtomicInteger();
  private final EntityCacheWriter<Table> writer =
      new EntityCacheWriter<>("table", () -> cache, this::serialize, true);

  @AfterEach
  void clearDeferrals() {
    PostCommitActionQueue.clear();
  }

  @Test
  void committedBatchUsesStoredJsonAndCapturesFallbackBeforeResponseMutation() {
    final Table stored = table("stored");
    final Table fallback = table("fallback").withDescription("Before response mutation");
    final String storedJson = "{\"name\":\"stored row\"}";
    PostCommitActionQueue.begin();

    writer.writeMany(
        List.of(stored, fallback),
        List.of(new StoredEntity(stored.getId(), stored.getFullyQualifiedName(), storedJson)));
    fallback.setDescription("After response mutation");
    assertTrue(provider.jsons.isEmpty());
    assertEquals(1, serializations.get());

    PostCommitActionQueue.run(PostCommitActionQueue.drain());

    assertEquals(4, provider.jsons.size());
    assertEquals(2, provider.jsons.stream().filter(storedJson::equals).count());
    assertTrue(
        provider.jsons.stream()
            .filter(json -> !storedJson.equals(json))
            .allMatch(
                json ->
                    JsonUtils.readValue(json, Table.class)
                        .getDescription()
                        .equals("Before response mutation")));
  }

  @Test
  void rolledBackBatchDoesNotPublishEitherAlias() {
    PostCommitActionQueue.begin();
    final int checkpoint = PostCommitActionQueue.checkpoint();
    writer.writeMany(List.of(table("rolledBack")), List.of());

    PostCommitActionQueue.rollbackToCheckpoint(checkpoint);
    PostCommitActionQueue.run(PostCommitActionQueue.drain());

    assertTrue(provider.jsons.isEmpty());
  }

  @Test
  void bypassIsEvaluatedWhenPostCommitActionsRun() {
    PostCommitActionQueue.begin();
    try (var ignored = EntityCacheBypass.skip()) {
      writer.writeMany(List.of(table("committed")), List.of());
    }
    PostCommitActionQueue.run(PostCommitActionQueue.drain());
    assertEquals(2, provider.jsons.size());

    provider.jsons.clear();
    PostCommitActionQueue.begin();
    writer.writeMany(List.of(table("skipped")), List.of());
    try (var ignored = EntityCacheBypass.skip()) {
      PostCommitActionQueue.run(PostCommitActionQueue.drain());
    }
    assertTrue(provider.jsons.isEmpty());
  }

  @Test
  void invalidRowsAndSerializationFailureDoNotPreventOtherRowsFromPublishing() {
    final Table failing = table("failing").withDescription("fail");
    writer.writeMany(List.of(new Table(), failing, table("valid")), List.of());

    assertEquals(2, provider.jsons.size());
    assertTrue(
        provider.jsons.stream()
            .allMatch(json -> JsonUtils.readValue(json, Table.class).getName().equals("valid")));
  }

  @Test
  void excludedAndDisabledCachesDoNotSerialize() {
    new EntityCacheWriter<Table>("user", () -> cache, this::serialize, false)
        .writeMany(List.of(table("excluded")), List.of());
    new EntityCacheWriter<Table>("table", () -> null, this::serialize, true)
        .writeMany(List.of(table("disabled")), List.of());
    writer.writeMany(List.of(), List.of());
    writer.write(null, null);

    assertEquals(0, serializations.get());
    assertTrue(provider.jsons.isEmpty());
  }

  @Test
  void singleWritePreservesStoredJsonAndDeferral() {
    PostCommitActionQueue.begin();
    writer.write(table("single"), "{\"name\":\"from storage\"}");
    assertTrue(provider.jsons.isEmpty());
    assertEquals(0, serializations.get());

    PostCommitActionQueue.run(PostCommitActionQueue.drain());

    assertEquals(
        List.of("{\"name\":\"from storage\"}", "{\"name\":\"from storage\"}"), provider.jsons);
  }

  private String serialize(final Table table) {
    serializations.incrementAndGet();
    if ("fail".equals(table.getDescription())) {
      throw new IllegalArgumentException("Injected serialization failure");
    }
    return JsonUtils.pojoToJson(table);
  }

  private Table table(final String name) {
    return new Table()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("service.schema." + name);
  }

  private static final class RecordingProvider extends NoopCacheProvider {
    private final List<String> jsons = new ArrayList<>();

    @Override
    public void set(final String key, final String value, final Duration ttl) {
      jsons.add(value);
    }

    @Override
    public void hset(final String key, final Map<String, String> fields, final Duration ttl) {
      jsons.add(fields.get("base"));
    }
  }
}
