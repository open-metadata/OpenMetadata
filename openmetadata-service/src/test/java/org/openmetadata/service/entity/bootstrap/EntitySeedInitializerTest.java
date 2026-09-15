package org.openmetadata.service.entity.bootstrap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;

class EntitySeedInitializerTest {
  @Test
  void existingSeedsKeepTheirValuesAndDoNotCreate() {
    final Fixture fixture = new Fixture();
    fixture.existing = new Table();
    final Table requested =
        table("existing").withId(UUID.randomUUID()).withUpdatedBy("original").withUpdatedAt(1L);
    final UUID id = requested.getId();
    fixture.initializer.initialize(requested);
    assertEquals(id, requested.getId());
    assertEquals("original", requested.getUpdatedBy());
    assertEquals(1L, requested.getUpdatedAt());
    assertTrue(fixture.created.isEmpty());
    assertEquals(List.of("existing"), fixture.lookups);
  }

  @Test
  void missingSeedsAreInitializedByTheAdministratorBeforeCreating() {
    final Fixture fixture = new Fixture();
    final Table requested = table("new");
    fixture.initializer.initialize(requested);
    assertNotNull(requested.getId());
    assertEquals(Entity.ADMIN_USER_NAME, requested.getUpdatedBy());
    assertEquals(fixture.clock.millis(), requested.getUpdatedAt());
    assertSame(requested, fixture.created.getFirst());
  }

  @Test
  void batchInitializationRecordsEachFailureAndContinues() {
    final Fixture fixture = new Fixture();
    fixture.failName = "bad";
    final Table first = table("first");
    final Table last = table("last");
    fixture.initializer.initializeAll(List.of(first, table("bad"), last));
    assertEquals(List.of(first, last), fixture.created);
    assertEquals(1, fixture.failures);
    assertEquals(List.of("first", "bad", "last"), fixture.lookups);
  }

  @Test
  void explicitSingleSeedFailuresPropagateToTheirCaller() {
    final Fixture fixture = new Fixture();
    fixture.failName = "bad";
    assertThrows(
        IllegalArgumentException.class, () -> fixture.initializer.initialize(table("bad")));
    assertEquals(0, fixture.failures);
  }

  private static Table table(final String name) {
    return new Table().withName(name).withFullyQualifiedName(name);
  }

  private static final class Fixture {
    private final Clock clock = Clock.fixed(Instant.ofEpochMilli(1234), ZoneOffset.UTC);
    private final List<Table> created = new ArrayList<>();
    private final List<String> lookups = new ArrayList<>();
    private Table existing;
    private String failName;
    private int failures;
    private final EntitySeedInitializer<Table> initializer =
        new EntitySeedInitializer<>(
            Entity.TABLE,
            new EntitySeedInitializer.Operations<>(
                fqn -> {
                  lookups.add(fqn);
                  return existing;
                },
                entity -> {
                  assertNotNull(entity.getId());
                  assertEquals(Entity.ADMIN_USER_NAME, entity.getUpdatedBy());
                  assertEquals(clock.millis(), entity.getUpdatedAt());
                  if (entity.getName().equals(failName)) {
                    throw new IllegalArgumentException("Injected creation failure");
                  }
                  created.add(entity);
                },
                () -> failures++),
            clock);
  }
}
