package org.openmetadata.service.glossary;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.type.GlossaryTermProperty;

/**
 * What an edit does to a term's own definitions, matched by name because the name is the key
 * values are stored under. Renaming a property is a removal and a new declaration.
 */
public record GlossaryTermPropertyChange(
    List<GlossaryTermProperty> removed,
    List<GlossaryTermProperty> added,
    List<GlossaryTermProperty> becameInheritable,
    List<GlossaryTermProperty> lostInheritance,
    List<GlossaryTermProperty> shapeChanged) {

  public static GlossaryTermPropertyChange between(
      final List<GlossaryTermProperty> original, final List<GlossaryTermProperty> updated) {
    final Map<String, GlossaryTermProperty> before = byName(original);
    final Map<String, GlossaryTermProperty> after = byName(updated);
    return new GlossaryTermPropertyChange(
        before.values().stream().filter(def -> !after.containsKey(def.getName())).toList(),
        after.values().stream().filter(def -> !before.containsKey(def.getName())).toList(),
        after.values().stream()
            .filter(def -> inheritanceTurnedOn(before.get(def.getName()), def))
            .toList(),
        before.values().stream()
            .filter(def -> after.containsKey(def.getName()))
            .filter(def -> inheritanceTurnedOn(after.get(def.getName()), def))
            .toList(),
        after.values().stream()
            .filter(def -> shapeDiffers(before.get(def.getName()), def))
            .toList());
  }

  /** Definitions whose inheritance starts below the declaring term, so old entries must go. */
  public List<GlossaryTermProperty> startingToReachBelow() {
    return Stream.concat(
            added.stream().filter(GlossaryTermPropertyResolver::isInheritable),
            becameInheritable.stream())
        .toList();
  }

  /** Definitions whose entries below the declaring term no longer apply to any property. */
  public List<GlossaryTermProperty> stoppingToReachBelow() {
    return Stream.concat(
            removed.stream().filter(GlossaryTermPropertyResolver::isInheritable),
            lostInheritance.stream())
        .toList();
  }

  public boolean changesWhatReachesBelow() {
    return !startingToReachBelow().isEmpty() || !stoppingToReachBelow().isEmpty();
  }

  public boolean isEmpty() {
    return removed.isEmpty()
        && added.isEmpty()
        && becameInheritable.isEmpty()
        && lostInheritance.isEmpty()
        && shapeChanged.isEmpty();
  }

  private static Map<String, GlossaryTermProperty> byName(final List<GlossaryTermProperty> defs) {
    return listOrEmpty(defs).stream()
        .collect(
            Collectors.toMap(
                GlossaryTermProperty::getName,
                Function.identity(),
                (first, second) -> first,
                LinkedHashMap::new));
  }

  private static boolean inheritanceTurnedOn(
      final GlossaryTermProperty off, final GlossaryTermProperty on) {
    return off != null
        && !GlossaryTermPropertyResolver.isInheritable(off)
        && GlossaryTermPropertyResolver.isInheritable(on);
  }

  private static boolean shapeDiffers(
      final GlossaryTermProperty before, final GlossaryTermProperty after) {
    return before != null
        && (!Objects.equals(before.getEnumValues(), after.getEnumValues())
            || isMultiValued(before) != isMultiValued(after));
  }

  private static boolean isMultiValued(final GlossaryTermProperty property) {
    return Boolean.TRUE.equals(property.getMultiValued());
  }
}
