package org.openmetadata.service.entity.bootstrap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;

class EntitySeedResourcesTest {
  @Test
  void resourcesRetainDiscoveryOrderAndSeparatorExpansion() throws IOException {
    final List<String> patterns = new ArrayList<>();
    final AtomicInteger failures = new AtomicInteger();
    final Map<String, String> resources =
        Map.of(
            "last.json",
            "{\"name\":\"last\",\"fullyQualifiedName\":\"db<separator>last\"}",
            "first.json",
            "{\"name\":\"first\"}");
    final EntitySeedResources loader =
        new EntitySeedResources(
            new EntitySeedResources.Source(
                pattern -> {
                  patterns.add(pattern);
                  return List.of("last.json", "first.json");
                },
                resources::get),
            failures::incrementAndGet);
    final List<Table> tables = loader.read(Entity.TABLE, "seed-pattern", Table.class);
    assertEquals(List.of("last", "first"), tables.stream().map(Table::getName).toList());
    assertEquals("db" + Entity.SEPARATOR + "last", tables.getFirst().getFullyQualifiedName());
    assertEquals(List.of("seed-pattern"), patterns);
    assertEquals(0, failures.get());
    tables.clear();
  }

  @Test
  void oneUnreadableOrMalformedResourceDoesNotHideTheRemainingSeeds() throws IOException {
    final AtomicInteger failures = new AtomicInteger();
    final EntitySeedResources loader =
        new EntitySeedResources(
            new EntitySeedResources.Source(
                pattern -> List.of("missing", "malformed", "good"),
                resource -> {
                  if (resource.equals("missing")) {
                    throw new IOException("Injected read failure");
                  }
                  return resource.equals("malformed") ? "invalid" : "{\"name\":\"survivor\"}";
                }),
            failures::incrementAndGet);
    final List<Table> tables = loader.read(Entity.TABLE, "pattern", Table.class);
    assertEquals(List.of("survivor"), tables.stream().map(Table::getName).toList());
    assertEquals(2, failures.get());
  }

  @Test
  void discoveryFailuresPropagateWithoutBeingRecordedAsIndividualSeedFailures() {
    final AtomicInteger failures = new AtomicInteger();
    final IOException failure = new IOException("Discovery failed");
    final EntitySeedResources loader =
        new EntitySeedResources(
            new EntitySeedResources.Source(
                pattern -> {
                  throw failure;
                },
                resource -> "{}"),
            failures::incrementAndGet);
    assertSame(
        failure,
        assertThrows(IOException.class, () -> loader.read(Entity.TABLE, "pattern", Table.class)));
    assertEquals(0, failures.get());
  }
}
