package org.openmetadata.service.entity.bulk;

import java.util.ArrayList;
import java.util.BitSet;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.jdbi3.EntityDAO;

/** Bounds loaded parents without re-reading parents shared by distant input rows. */
public final class EntityBulkPreparation<T extends EntityInterface> {
  public static final int MAX_PARENTS = EntityDAO.MAX_IN_LIST_CHUNK_SIZE;

  public record Hooks<T>(
      Function<T, EntityReference> parent,
      Consumer<List<EntityReference>> preload,
      Consumer<T> prepare,
      Runnable clear) {}

  public record Failure<T>(int index, T entity, String message) {}

  public record Result<T>(List<T> prepared, List<Failure<T>> failures) {
    public Result {
      prepared = List.copyOf(prepared);
      failures = List.copyOf(failures);
    }
  }

  private final Hooks<T> hooks;
  private final int capacity;

  public EntityBulkPreparation(Hooks<T> hooks) {
    this(hooks, MAX_PARENTS);
  }

  EntityBulkPreparation(Hooks<T> hooks, int capacity) {
    if (capacity < 1 || capacity > MAX_PARENTS) {
      throw new IllegalArgumentException(
          "Parent preparation capacity must be between 1 and " + MAX_PARENTS);
    }
    this.hooks = hooks;
    this.capacity = capacity;
  }

  public Result<T> prepare(List<T> entities) {
    final var state = new Results<T>(entities);
    try {
      final var references = references(entities);
      if (references.size() <= capacity) {
        hooks.preload().accept(List.copyOf(references.values()));
        IntStream.range(0, entities.size()).forEach(index -> prepare(state, index));
      } else {
        prepareBatches(state, references);
      }
      return state.finish();
    } finally {
      hooks.clear().run();
    }
  }

  public void preload(List<T> entities) {
    final var references = references(entities);
    if (references.size() > capacity) {
      throw new IllegalArgumentException(
          "Use bulkPreparation().prepare() for more than " + capacity + " parents");
    }
    hooks.preload().accept(List.copyOf(references.values()));
  }

  private Map<UUID, EntityReference> references(List<T> entities) {
    final Map<UUID, EntityReference> references = new LinkedHashMap<>();
    for (final T entity : entities) {
      final EntityReference reference = hooks.parent().apply(entity);
      if (reference != null && reference.getId() != null)
        references.putIfAbsent(reference.getId(), reference);
    }
    return references;
  }

  private void prepareBatches(Results<T> state, Map<UUID, EntityReference> references) {
    final var positions = positions(state.input);
    final var byType =
        references.values().stream().collect(Collectors.groupingBy(EntityReference::getType));
    for (final List<EntityReference> typed : byType.values()) {
      for (int start = 0; start < typed.size(); start += capacity) {
        prepareBatch(
            state, positions, typed.subList(start, Math.min(start + capacity, typed.size())));
      }
    }
    hooks.clear().run();
    positions.getOrDefault(null, List.of()).forEach(index -> prepare(state, index));
  }

  private Map<UUID, List<Integer>> positions(List<T> entities) {
    final Map<UUID, List<Integer>> positions = new HashMap<>();
    for (int index = 0; index < entities.size(); index++) {
      final EntityReference reference = hooks.parent().apply(entities.get(index));
      final UUID id = reference == null ? null : reference.getId();
      positions.computeIfAbsent(id, ignored -> new ArrayList<>()).add(index);
    }
    return positions;
  }

  private void prepareBatch(
      Results<T> state, Map<UUID, List<Integer>> positions, List<EntityReference> references) {
    hooks.clear().run();
    hooks.preload().accept(references);
    references.stream()
        .flatMap(reference -> positions.get(reference.getId()).stream())
        .sorted()
        .forEach(index -> prepare(state, index));
  }

  private void prepare(Results<T> state, int index) {
    final T entity = state.input.get(index);
    try {
      hooks.prepare().accept(entity);
    } catch (Exception failure) {
      // Legacy preparation hooks can propagate checked validation failures through @SneakyThrows.
      state.fail(index, entity, failure.getMessage());
    }
  }

  private static final class Results<T> {
    private final List<T> input;
    private final BitSet failed = new BitSet();
    private final List<Failure<T>> failures = new ArrayList<>();

    private Results(List<T> input) {
      this.input = input;
    }

    private void fail(int index, T entity, String message) {
      failed.set(index);
      failures.add(new Failure<>(index, entity, message));
    }

    private Result<T> finish() {
      final List<T> prepared =
          failures.isEmpty()
              ? input
              : IntStream.range(0, input.size())
                  .filter(index -> !failed.get(index))
                  .mapToObj(input::get)
                  .toList();
      failures.sort(Comparator.comparingInt(Failure::index));
      return new Result<>(prepared, failures);
    }
  }
}
