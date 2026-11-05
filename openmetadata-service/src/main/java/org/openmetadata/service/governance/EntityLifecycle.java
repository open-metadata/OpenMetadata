package org.openmetadata.service.governance;

import java.util.Collections;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.type.EntityStatus;

/** A lifecycle policy using the status vocabulary generated from its entity's schema. */
public record EntityLifecycle<S extends Enum<S>>(
    EntityStatusAdapter<S> adapter, Map<S, Set<S>> transitions) {
  public static final Set<EntityStatus> GENERAL_STAGES =
      Collections.unmodifiableSet(EnumSet.allOf(EntityStatus.class));
  public static final EntityLifecycle<EntityStatus> GENERAL = anyMoveBetween(EntityStatus.class);

  public EntityLifecycle(Class<S> statusType, Map<S, Set<S>> transitions) {
    this(new EntityStatusAdapter<>(statusType), transitions);
  }

  public EntityLifecycle {
    Map<S, Set<S>> copy = new EnumMap<>(adapter.statusType());
    transitions.forEach((from, to) -> copy.put(from, Set.copyOf(to)));
    requireMovesBetweenOwnStages(copy);
    requireSchemaVocabulary(adapter, copy.keySet());
    transitions = Collections.unmodifiableMap(copy);
  }

  public Set<S> stages() {
    return transitions.keySet();
  }

  public List<String> stageCodes() {
    return adapter.codes();
  }

  public Map<String, List<String>> transitionCodes() {
    Map<String, List<String>> codes = new LinkedHashMap<>();
    transitions.forEach(
        (from, to) ->
            codes.put(adapter.code(from), to.stream().map(adapter::code).sorted().toList()));
    return Collections.unmodifiableMap(codes);
  }

  public boolean includes(S stage) {
    return transitions.containsKey(stage);
  }

  public boolean includesCode(String code) {
    return stageCodes().contains(code);
  }

  public boolean allows(S from, S to) {
    return from == null ? includes(to) : transitions.getOrDefault(from, Set.of()).contains(to);
  }

  public boolean allowsCodes(String from, String to) {
    return includesCode(to)
        && (from == null
            || (includesCode(from) && allows(adapter.resolve(from), adapter.resolve(to))));
  }

  private static <S extends Enum<S>> EntityLifecycle<S> anyMoveBetween(Class<S> statusType) {
    Map<S, Set<S>> transitions = new EnumMap<>(statusType);
    for (S from : statusType.getEnumConstants()) {
      Set<S> to = EnumSet.allOf(statusType);
      to.remove(from);
      transitions.put(from, to);
    }
    return new EntityLifecycle<>(statusType, transitions);
  }

  private static <S extends Enum<S>> void requireMovesBetweenOwnStages(Map<S, Set<S>> transitions) {
    transitions.values().stream()
        .flatMap(Set::stream)
        .filter(stage -> !transitions.containsKey(stage))
        .findFirst()
        .ifPresent(
            stage -> {
              throw new IllegalArgumentException(
                  "A lifecycle can only move between its own stages, but one moves to " + stage);
            });
  }

  private static <S extends Enum<S>> void requireSchemaVocabulary(
      EntityStatusAdapter<S> adapter, Set<S> stages) {
    if (!stages.equals(Set.copyOf(adapter.statuses()))) {
      throw new IllegalArgumentException(
          "Lifecycle stages must match "
              + adapter.statusType().getSimpleName()
              + " schema vocabulary: "
              + adapter.codes());
    }
  }
}
