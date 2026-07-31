package org.openmetadata.it.factories;

import java.time.Duration;
import java.util.EnumMap;
import java.util.Map;
import org.openmetadata.it.factories.EntityLoadSpec.EntityKind;

/**
 * Result of an {@link EntityLoader} run. Tests use it to drive ES-side count assertions
 * after triggering reindex without re-querying OM for what they just created.
 */
public record EntityLoadSummary(
    Map<EntityKind, Integer> created,
    int totalColumns,
    Duration totalDuration,
    Map<EntityKind, Duration> perKindDuration) {

  public int countOf(EntityKind kind) {
    return created.getOrDefault(kind, 0);
  }

  public int totalEntities() {
    return created.values().stream().mapToInt(Integer::intValue).sum();
  }

  static final class Builder {
    private final Map<EntityKind, Integer> created = new EnumMap<>(EntityKind.class);
    private final Map<EntityKind, Duration> perKindDuration = new EnumMap<>(EntityKind.class);
    private int totalColumns;

    Builder recordCreated(EntityKind kind, int n) {
      created.merge(kind, n, Integer::sum);
      return this;
    }

    Builder recordColumns(int n) {
      totalColumns += n;
      return this;
    }

    Builder recordKindDuration(EntityKind kind, Duration d) {
      perKindDuration.put(kind, d);
      return this;
    }

    EntityLoadSummary build(Duration total) {
      return new EntityLoadSummary(
          Map.copyOf(created), totalColumns, total, Map.copyOf(perKindDuration));
    }
  }
}
