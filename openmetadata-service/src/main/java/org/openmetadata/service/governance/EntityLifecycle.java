package org.openmetadata.service.governance;

import java.util.Collections;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.type.EntityStatus;

/**
 * The lifecycle stages an entity type uses and the moves allowed between them. Every type draws its
 * stages from the shared {@link EntityStatus} vocabulary. Most use the general stages and can move
 * between any of them; a type with a lifecycle of its own declares the stages it uses, including
 * any that only it has, and each stage's next stages.
 */
public record EntityLifecycle(Map<EntityStatus, Set<EntityStatus>> transitions) {
  /**
   * The stages a type uses unless it declares its own lifecycle. A stage added to the vocabulary for
   * one type is not among them, so it stays out of every lifecycle that does not declare it.
   */
  public static final Set<EntityStatus> GENERAL_STAGES =
      Collections.unmodifiableSet(
          EnumSet.of(
              EntityStatus.DRAFT,
              EntityStatus.IN_REVIEW,
              EntityStatus.APPROVED,
              EntityStatus.ARCHIVED,
              EntityStatus.DEPRECATED,
              EntityStatus.REJECTED,
              EntityStatus.UNPROCESSED));

  /** Any move between the general stages. */
  public static final EntityLifecycle GENERAL = anyMoveBetween(GENERAL_STAGES);

  /** Each stage the type uses, mapped to the stages it can move to; a final stage maps to none. */
  public EntityLifecycle {
    Map<EntityStatus, Set<EntityStatus>> copy = new EnumMap<>(EntityStatus.class);
    transitions.forEach((from, to) -> copy.put(from, unmodifiableStages(to)));
    requireMovesBetweenOwnStages(copy);
    transitions = Collections.unmodifiableMap(copy);
  }

  public Set<EntityStatus> stages() {
    return transitions.keySet();
  }

  public boolean includes(EntityStatus stage) {
    return transitions.containsKey(stage);
  }

  /** Whether an entity can move between two stages; one saved without a stage can take any. */
  public boolean allows(EntityStatus from, EntityStatus to) {
    return from == null ? includes(to) : transitions.getOrDefault(from, Set.of()).contains(to);
  }

  private static EntityLifecycle anyMoveBetween(Set<EntityStatus> stages) {
    Map<EntityStatus, Set<EntityStatus>> transitions = new EnumMap<>(EntityStatus.class);
    for (EntityStatus from : stages) {
      Set<EntityStatus> to = EnumSet.copyOf(stages);
      to.remove(from);
      transitions.put(from, to);
    }
    return new EntityLifecycle(transitions);
  }

  private static Set<EntityStatus> unmodifiableStages(Set<EntityStatus> stages) {
    Set<EntityStatus> copy = EnumSet.noneOf(EntityStatus.class);
    copy.addAll(stages);
    return Collections.unmodifiableSet(copy);
  }

  // A declaration that moves to a stage it does not list is a mistake in the code declaring it,
  // so it fails when the lifecycle is built rather than when an entity first takes that move.
  private static void requireMovesBetweenOwnStages(
      Map<EntityStatus, Set<EntityStatus>> transitions) {
    transitions.values().stream()
        .flatMap(Set::stream)
        .filter(stage -> !transitions.containsKey(stage))
        .findFirst()
        .ifPresent(
            stage -> {
              throw new IllegalArgumentException(
                  "A lifecycle can only move between its own stages, but one moves to "
                      + stage.value());
            });
  }
}
