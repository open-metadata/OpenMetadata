package org.openmetadata.it.factories;

import java.util.EnumMap;
import java.util.Map;

/**
 * Declarative spec for how many entities of each type {@link EntityLoader} should create.
 *
 * <p>Tests own the absolute counts (typically as {@code private static final int} constants
 * in the test class) so a single line change scales the load up or down. {@link EntityLoader}
 * just executes whatever the spec asks for.
 */
public record EntityLoadSpec(
    int parallelWorkers, Map<EntityKind, Integer> counts, int columnsPerTable) {

  /** Entity types {@link EntityLoader} can create. Add new kinds as we extend coverage. */
  public enum EntityKind {
    TABLE,
    TOPIC,
    DASHBOARD,
    PIPELINE,
    GLOSSARY_TERM
  }

  public int countOf(EntityKind kind) {
    return counts.getOrDefault(kind, 0);
  }

  public int total() {
    return counts.values().stream().mapToInt(Integer::intValue).sum();
  }

  public static Builder builder() {
    return new Builder();
  }

  public static final class Builder {
    private int parallelWorkers = 16;
    private int columnsPerTable = 5;
    private final Map<EntityKind, Integer> counts = new EnumMap<>(EntityKind.class);

    public Builder parallelWorkers(int n) {
      this.parallelWorkers = n;
      return this;
    }

    public Builder columnsPerTable(int n) {
      this.columnsPerTable = n;
      return this;
    }

    public Builder count(EntityKind kind, int n) {
      this.counts.put(kind, n);
      return this;
    }

    public EntityLoadSpec build() {
      return new EntityLoadSpec(parallelWorkers, Map.copyOf(counts), columnsPerTable);
    }
  }
}
