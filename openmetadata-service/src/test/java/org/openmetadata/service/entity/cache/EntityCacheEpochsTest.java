package org.openmetadata.service.entity.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.common.base.Ticker;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.service.Entity;

@Isolated("Temporarily changes the default locale")
class EntityCacheEpochsTest {
  @Test
  void advancesBothIdAndQuotedNameAliases() {
    final var epochs = new EntityCacheEpochs();
    final UUID id = UUID.randomUUID();
    final var idKey = EntityCacheKeys.id(Entity.TEAM, id);
    final var nameKey = EntityCacheKeys.name(Entity.TEAM, "team.with.dots");
    final var quotedKey = EntityCacheKeys.name(Entity.TEAM, "\"team.with.dots\"");
    assertEquals(0, epochs.byId(idKey));
    assertEquals(0, epochs.byName(nameKey));
    epochs.advance(Entity.TEAM, id, "team.with.dots");
    assertEquals(1, epochs.byId(idKey));
    assertEquals(1, epochs.byName(nameKey));
    assertEquals(1, epochs.byName(quotedKey));
    epochs.advance(Entity.TEAM, id, "team.with.dots");
    assertEquals(2, epochs.byId(idKey));
  }

  @Test
  void normalizesUserKeysIndependentOfTheDefaultLocale() {
    final Locale original = Locale.getDefault();
    try {
      Locale.setDefault(Locale.forLanguageTag("tr-TR"));
      assertEquals(
          "ingestion@example.com",
          EntityCacheKeys.name(Entity.USER, "INGESTION@example.com").getRight());
      assertEquals("INGESTION", EntityCacheKeys.name(Entity.TEAM, "INGESTION").getRight());
      assertEquals(null, EntityCacheKeys.name(Entity.USER, null).getRight());
    } finally {
      Locale.setDefault(original);
    }
  }

  @Test
  void toleratesMissingAliasesAndKeepsUnrelatedKeysIndependent() {
    final var epochs = new EntityCacheEpochs();
    final UUID id = UUID.randomUUID();
    epochs.advance(Entity.PIPELINE, id, null);
    epochs.advance(Entity.PIPELINE, null, "name");
    epochs.advance(Entity.PIPELINE, null, null);
    assertEquals(1, epochs.byId(EntityCacheKeys.id(Entity.PIPELINE, id)));
    assertEquals(1, epochs.byName(EntityCacheKeys.name(Entity.PIPELINE, "name")));
    assertEquals(0, epochs.byId(EntityCacheKeys.id(Entity.TABLE, id)));
  }

  @Test
  void preservesExistingQuotedAliasesWithoutValidatingOrRewritingThem() {
    final var epochs = new EntityCacheEpochs();
    for (final String fqn : List.of("", "\"simple\"", "parent.\"name.with.dots\"")) {
      epochs.advance(Entity.TEAM, null, fqn);
      assertEquals(1, epochs.byName(EntityCacheKeys.name(Entity.TEAM, fqn)));
    }
    assertEquals(0, epochs.byName(EntityCacheKeys.name(Entity.TEAM, "simple")));
  }

  @Test
  void expiresIdleEpochsAndEnforcesTheConfiguredCapacity() {
    final AtomicLong nanos = new AtomicLong();
    final Ticker ticker =
        new Ticker() {
          @Override
          public long read() {
            return nanos.get();
          }
        };
    final var epochs = new EntityCacheEpochs(2, Duration.ofMinutes(5), ticker);
    final UUID id = UUID.randomUUID();
    epochs.advance(Entity.TABLE, id, "first");
    nanos.set(Duration.ofMinutes(6).toNanos());
    assertEquals(0, epochs.byId(EntityCacheKeys.id(Entity.TABLE, id)));
    assertEquals(0, epochs.byName(EntityCacheKeys.name(Entity.TABLE, "first")));
    final UUID second = UUID.randomUUID();
    final UUID third = UUID.randomUUID();
    epochs.advance(Entity.TABLE, id, "first");
    epochs.advance(Entity.TABLE, second, "second");
    epochs.advance(Entity.TABLE, third, "third");
    assertTrue(
        epochs.byId(EntityCacheKeys.id(Entity.TABLE, id))
                + epochs.byId(EntityCacheKeys.id(Entity.TABLE, second))
                + epochs.byId(EntityCacheKeys.id(Entity.TABLE, third))
            <= 2);
    assertTrue(
        epochs.byName(EntityCacheKeys.name(Entity.TABLE, "first"))
                + epochs.byName(EntityCacheKeys.name(Entity.TABLE, "second"))
                + epochs.byName(EntityCacheKeys.name(Entity.TABLE, "third"))
            <= 2);
  }

  @Test
  void concurrentWritersAdvanceOneCounterPerKey() {
    final var epochs = new EntityCacheEpochs();
    final UUID id = UUID.randomUUID();
    final CompletableFuture<?>[] writers = new CompletableFuture<?>[16];
    for (int index = 0; index < writers.length; index++) {
      writers[index] =
          CompletableFuture.runAsync(
              () -> {
                for (int write = 0; write < 100; write++) {
                  epochs.advance(Entity.TABLE, id, "table");
                }
              });
    }
    CompletableFuture.allOf(writers).join();
    assertEquals(1600, epochs.byId(EntityCacheKeys.id(Entity.TABLE, id)));
    assertEquals(1600, epochs.byName(EntityCacheKeys.name(Entity.TABLE, "table")));
  }
}
