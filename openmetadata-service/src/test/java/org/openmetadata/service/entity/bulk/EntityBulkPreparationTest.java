package org.openmetadata.service.entity.bulk;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.type.EntityReference;

class EntityBulkPreparationTest {
  @Test
  void ordinaryBatchKeepsPreparationOrderAndReusesEachParent() {
    final Fixture fixture = new Fixture(2);
    final List<Chart> input = fixture.charts(0, 1, 0);
    final var result = fixture.preparation.prepare(input);
    assertEquals(List.of("0", "1", "2"), fixture.visited);
    assertEquals(input, result.prepared());
    assertTrue(result.failures().isEmpty());
    assertEquals(2, fixture.loaded.size());
    assertEquals(1, fixture.reads);
    assertTrue(fixture.active.isEmpty());
  }

  @Test
  void overflowLoadsEachUniqueParentOnceAndReturnsOriginalOrder() {
    final Fixture fixture = new Fixture(2);
    final List<Chart> input = fixture.charts(0, 2, 4, 1, 3, 0, 4, 1, 3, 2);
    final var result = fixture.preparation.prepare(input);
    assertEquals(3, fixture.reads);
    assertEquals(5, fixture.loaded.size());
    assertEquals(input, result.prepared());
    for (int index = 0; index < input.size(); index++) {
      assertSame(input.get(index), result.prepared().get(index));
      assertEquals(
          input.get(index).getService().getName(), result.prepared().get(index).getDescription());
    }
    assertEquals(2, fixture.maximumActive);
    assertTrue(fixture.active.isEmpty());
  }

  @Test
  void failuresRemainInInputOrderAcrossParentBatches() {
    final Fixture fixture = new Fixture(2);
    final List<Chart> input = fixture.charts(0, 1, 2, 0, 1, 2);
    input.get(1).setDisplayName("reject");
    input.get(2).setDisplayName("reject");
    input.get(3).setDisplayName("reject");
    final var result = fixture.preparation.prepare(input);
    assertEquals(List.of(input.get(0), input.get(4), input.get(5)), result.prepared());
    assertEquals(
        List.of(input.get(1), input.get(2), input.get(3)),
        result.failures().stream().map(EntityBulkPreparation.Failure::entity).toList());
    assertTrue(
        result.failures().stream().allMatch(failure -> failure.message().equals("invalid row")));
    assertTrue(fixture.active.isEmpty());
  }

  @Test
  void readFailureAbortsBeforeAnyWriteAndAlwaysClearsTheScope() {
    final Fixture fixture = new Fixture(2);
    fixture.failRead = true;
    assertThrows(
        IllegalStateException.class, () -> fixture.preparation.prepare(fixture.charts(0, 1)));
    assertTrue(fixture.visited.isEmpty());
    assertTrue(fixture.active.isEmpty());
    assertEquals(1, fixture.clears);
  }

  @Test
  void parentsOfDifferentTypesRetainOneReadPerTypeAndChunk() {
    final Fixture fixture = new Fixture(2);
    final List<Chart> input = fixture.charts(0, 1, 2, 3, 4, 5);
    input.get(1).getService().setType("alternate");
    input.get(3).getService().setType("alternate");
    input.get(5).getService().setType("alternate");
    assertEquals(input, fixture.preparation.prepare(input).prepared());
    assertEquals(4, fixture.reads);
    assertEquals(6, fixture.loaded.size());
  }

  @Test
  void missingParentIdentifiersKeepTheirIndividualPreparationPath() {
    final Fixture fixture = new Fixture(2);
    final List<Chart> input = fixture.charts(0, 1, 2, 3, 4);
    input.get(1).setService(null);
    input.get(3).getService().setId(null);
    assertEquals(input, fixture.preparation.prepare(input).prepared());
    assertEquals(3, fixture.loaded.size());
    assertEquals(2, fixture.reads);
  }

  @Test
  void emptyInputsDoNoReadsAndClearPriorState() {
    final Fixture fixture = new Fixture(2);
    assertTrue(fixture.preparation.prepare(List.of()).prepared().isEmpty());
    assertEquals(0, fixture.reads);
    assertEquals(1, fixture.clears);
  }

  @Test
  void invalidCapacityCannotCreateAnUnboundedPreparationCache() {
    assertThrows(IllegalArgumentException.class, () -> new Fixture(0));
    assertThrows(IllegalArgumentException.class, () -> new Fixture(Integer.MAX_VALUE));
  }

  @Test
  void legacyPreloadDeduplicatesParentsAndRejectsOverflowBeforeReading() {
    final Fixture fixture = new Fixture(2);
    fixture.preparation.preload(fixture.charts(0, 1, 0));
    assertEquals(2, fixture.active.size());
    assertThrows(
        IllegalArgumentException.class, () -> fixture.preparation.preload(fixture.charts(0, 1, 2)));
    assertEquals(1, fixture.reads);
    fixture.clear();
  }

  @Test
  void defaultCapacityMatchesTheSqlChunkAndReturnsImmutableResults() {
    final Fixture fixture = new Fixture(EntityBulkPreparation.MAX_PARENTS);
    final var preparation =
        new EntityBulkPreparation<>(
            new EntityBulkPreparation.Hooks<>(
                Chart::getService, fixture::load, fixture::prepare, fixture::clear));
    final var result = preparation.prepare(fixture.charts(0, 1, 0));
    assertEquals(1, fixture.reads);
    assertThrows(UnsupportedOperationException.class, () -> result.prepared().clear());
    assertThrows(UnsupportedOperationException.class, () -> result.failures().clear());
  }

  private static final class Fixture {
    final int capacity;
    final Map<UUID, EntityReference> active = new HashMap<>();
    final List<UUID> loaded = new ArrayList<>();
    final List<String> visited = new ArrayList<>();
    final EntityBulkPreparation<Chart> preparation;
    long reads;
    int clears;
    int maximumActive;
    boolean failRead;

    Fixture(int capacity) {
      this.capacity = capacity;
      preparation =
          new EntityBulkPreparation<>(
              new EntityBulkPreparation.Hooks<>(
                  Chart::getService, this::load, this::prepare, this::clear),
              capacity);
    }

    List<Chart> charts(int... parents) {
      return IntStream.range(0, parents.length)
          .mapToObj(
              index ->
                  new Chart()
                      .withId(UUID.randomUUID())
                      .withName(Integer.toString(index))
                      .withService(
                          new EntityReference()
                              .withId(new UUID(0, parents[index] + 1))
                              .withType("parent")
                              .withName("parent" + parents[index])))
          .toList();
    }

    void load(List<EntityReference> references) {
      assertTrue(references.size() <= capacity);
      if (!references.isEmpty())
        reads += references.stream().map(EntityReference::getType).distinct().count();
      for (var ref : references) {
        assertTrue(active.size() < capacity);
        assertTrue(!loaded.contains(ref.getId()), "A parent was loaded more than once");
        active.put(ref.getId(), ref);
        loaded.add(ref.getId());
      }
      maximumActive = Math.max(maximumActive, active.size());
      if (failRead) throw new IllegalStateException("Read failed");
    }

    void prepare(Chart chart) {
      visited.add(chart.getName());
      if ("reject".equals(chart.getDisplayName()))
        throw new IllegalArgumentException("invalid row");
      if (chart.getService() != null && chart.getService().getId() != null) {
        assertTrue(
            active.containsKey(chart.getService().getId()),
            "Preparation must use the already loaded parent");
        chart.setDescription(active.get(chart.getService().getId()).getName());
      }
    }

    void clear() {
      active.clear();
      clears++;
    }
  }
}
