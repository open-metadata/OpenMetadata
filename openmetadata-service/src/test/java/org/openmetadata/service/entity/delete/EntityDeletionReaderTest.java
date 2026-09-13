package org.openmetadata.service.entity.delete;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.EntityRelationshipNotFoundException;

class EntityDeletionReaderTest {
  private static final UUID ID = UUID.randomUUID();

  @Test
  void completeReadRetainsHydratedValues() {
    final Chart hydrated = new Chart().withId(ID).withDescription("hydrated");
    final var reader =
        reader(
            id -> hydrated,
            id -> {
              throw new AssertionError("Unexpected fallback");
            });
    assertSame(hydrated, reader.load(ID));
    reader.hydrate(hydrated);
    assertEquals("prepared", hydrated.getDisplayName());
  }

  @ParameterizedTest
  @MethodSource("danglingReferences")
  void danglingReadUsesTheStoredRow(RuntimeException failure) {
    final Chart stored = new Chart().withId(ID).withFullyQualifiedName("service.chart");
    final var reader =
        reader(
            id -> {
              throw failure;
            },
            id -> stored);
    assertSame(stored, reader.load(ID));
    assertEquals("service.chart", stored.getFullyQualifiedName());
  }

  @ParameterizedTest
  @MethodSource("danglingReferences")
  void danglingHydrationRetainsFieldsAlreadyResolved(RuntimeException failure) {
    final Chart chart = new Chart().withId(ID);
    final var reader =
        new EntityDeletionReader<Chart>(
            "chart",
            entity -> {
              entity.setDescription("resolved before missing relationship");
              throw failure;
            },
            new EntityDeletionReader.Queries<>(id -> chart, id -> chart));
    reader.hydrate(chart);
    assertEquals("resolved before missing relationship", chart.getDescription());
  }

  @Test
  void unrelatedReadFailurePropagatesWithoutStoredFallback() {
    final var failure = new IllegalStateException("database unavailable");
    final var reader =
        reader(
            id -> {
              throw failure;
            },
            id -> {
              throw new AssertionError("Unexpected fallback");
            });
    assertSame(failure, assertThrows(IllegalStateException.class, () -> reader.load(ID)));
  }

  @Test
  void failureToLoadTheStoredRowPropagates() {
    final var missing = EntityNotFoundException.byId(ID.toString());
    final var reader =
        reader(
            id -> {
              throw new EntityRelationshipNotFoundException("missing parent");
            },
            id -> {
              throw missing;
            });
    assertSame(missing, assertThrows(EntityNotFoundException.class, () -> reader.load(ID)));
  }

  @Test
  void unrelatedHydrationFailurePropagates() {
    final var failure = new IllegalStateException("database unavailable");
    final var reader =
        new EntityDeletionReader<Chart>(
            "chart",
            entity -> {
              throw failure;
            },
            new EntityDeletionReader.Queries<>(id -> new Chart(), id -> new Chart()));
    assertSame(
        failure, assertThrows(IllegalStateException.class, () -> reader.hydrate(new Chart())));
  }

  private static EntityDeletionReader<Chart> reader(
      Function<UUID, Chart> hydrated, Function<UUID, Chart> stored) {
    return new EntityDeletionReader<>(
        "chart",
        entity -> entity.setDisplayName("prepared"),
        new EntityDeletionReader.Queries<>(hydrated, stored));
  }

  private static Stream<RuntimeException> danglingReferences() {
    return Stream.of(
        EntityNotFoundException.byId(ID.toString()),
        new EntityRelationshipNotFoundException("missing parent"));
  }
}
