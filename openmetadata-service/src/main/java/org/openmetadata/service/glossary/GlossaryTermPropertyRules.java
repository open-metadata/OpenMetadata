package org.openmetadata.service.glossary;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.nio.charset.StandardCharsets;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.GlossaryTermProperty;
import org.openmetadata.schema.type.GlossaryTermPropertyDatatype;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.glossary.GlossaryTermPropertyResolver.DeclaredProperty;

/**
 * The write rules for glossary term properties that need no database, see
 * docs/plans/2026-11-12-glossary-term-properties.md. A violation of a definition or a value throws
 * {@link IllegalArgumentException} (400). A clash between terms or a change that would break stored
 * values throws a 409 through {@link TermPropertyViolations}.
 */
public final class GlossaryTermPropertyRules {
  public static final int MAX_DEFINITIONS = 50;
  public static final int MAX_STORED_BYTES = 256 * 1024;
  private static final int MIN_ENUM_VALUES = 2;
  private static final int MAX_ENUM_VALUES = 1000;
  private static final int MAX_UNIT_LENGTH = 256;
  private static final int MAX_NAME_LENGTH = 256;
  private static final int MAX_DISPLAY_NAME_LENGTH = 256;
  private static final Pattern NAME_PATTERN =
      Pattern.compile("^[A-Za-z0-9][A-Za-z0-9 _\\-.,;%#@!'(){}\\[\\]|=+?`]*$");
  private static final Set<GlossaryTermPropertyDatatype> MULTI_VALUED_DATATYPES =
      Set.of(GlossaryTermPropertyDatatype.STRING, GlossaryTermPropertyDatatype.ENUM);

  private GlossaryTermPropertyRules() {}

  /** Rule 1: each definition follows the definition table and names are unique ignoring case. */
  public static void validateDefinitions(final List<GlossaryTermProperty> definitions) {
    final List<GlossaryTermProperty> checked = listOrEmpty(definitions);
    if (checked.size() > MAX_DEFINITIONS) {
      throw badRequest(
          "A term declares at most %d properties, got %d"
              .formatted(MAX_DEFINITIONS, checked.size()));
    }
    final Set<String> names = new HashSet<>();
    for (final GlossaryTermProperty definition : checked) {
      validateDefinition(definition);
      if (!names.add(definition.getName().toLowerCase(Locale.ROOT))) {
        throw badRequest(
            "Property name '%s' is declared twice; names are unique ignoring case"
                .formatted(definition.getName()));
      }
    }
  }

  /** Rule 1: the serialized definitions and values of one term fit the per-term cap. */
  public static void validateStoredSize(
      final List<GlossaryTermProperty> definitions, final Map<String, List<String>> values) {
    final int bytes =
        JsonUtils.pojoToJson(listOrEmpty(definitions)).getBytes(StandardCharsets.UTF_8).length
            + JsonUtils.pojoToJson(nullOrEmpty(values) ? Map.of() : values)
                .getBytes(StandardCharsets.UTF_8)
                .length;
    if (bytes > MAX_STORED_BYTES) {
      throw badRequest(
          "A term's property definitions and values take at most %d bytes, got %d"
              .formatted(MAX_STORED_BYTES, bytes));
    }
  }

  /** Rule 2 against ancestors: no own name equals a name an ancestor makes inheritable. */
  public static Optional<String> ancestorClash(
      final GlossaryTerm term, final List<GlossaryTerm> ancestorsNearestFirst) {
    final Set<String> own = lowerCaseNames(term.getPropertyDefinitions());
    return listOrEmpty(ancestorsNearestFirst).stream()
        .flatMap(
            ancestor ->
                listOrEmpty(ancestor.getPropertyDefinitions()).stream()
                    .filter(GlossaryTermPropertyResolver::isInheritable)
                    .filter(def -> own.contains(def.getName().toLowerCase(Locale.ROOT)))
                    .map(
                        def ->
                            "Term '%s' declares '%s', which ancestor '%s' already makes inheritable as '%s'"
                                .formatted(
                                    term.getFullyQualifiedName(),
                                    matchingOwnName(term, def),
                                    ancestor.getFullyQualifiedName(),
                                    def.getName())))
        .findFirst();
  }

  public static void validateNoAncestorClash(
      final GlossaryTerm term, final List<GlossaryTerm> ancestorsNearestFirst) {
    ancestorClash(term, ancestorsNearestFirst)
        .ifPresent(
            reason -> {
              throw TermPropertyViolations.conflict(reason);
            });
  }

  /** Rule 3: each key names an effective property of the term and each value fits it. */
  public static Optional<String> keyProblem(
      final GlossaryTerm term,
      final List<GlossaryTerm> ancestorsNearestFirst,
      final Collection<String> keys) {
    final Map<String, GlossaryTermProperty> effective =
        GlossaryTermPropertyResolver.declaredProperties(term, ancestorsNearestFirst).stream()
            .map(DeclaredProperty::property)
            .collect(Collectors.toMap(GlossaryTermProperty::getName, def -> def, (a, b) -> a));
    return keys.stream()
        .map(key -> problemForKey(term, effective.get(key), key))
        .flatMap(Optional::stream)
        .findFirst();
  }

  public static void validateKeys(
      final GlossaryTerm term,
      final List<GlossaryTerm> ancestorsNearestFirst,
      final Collection<String> keys) {
    keyProblem(term, ancestorsNearestFirst, keys)
        .ifPresent(
            reason -> {
              throw badRequest(reason);
            });
  }

  /** Keys whose list differs from the original, or that the original did not have. */
  public static Set<String> changedKeys(
      final Map<String, List<String>> original, final Map<String, List<String>> updated) {
    final Map<String, List<String>> before = nullOrEmpty(original) ? Map.of() : original;
    return (nullOrEmpty(updated) ? Map.<String, List<String>>of() : updated)
        .entrySet().stream()
            .filter(entry -> !entry.getValue().equals(before.get(entry.getKey())))
            .map(Map.Entry::getKey)
            .collect(Collectors.toSet());
  }

  /** The datatype is what stored values are checked against, so it never changes. */
  public static void validateDatatypesUnchanged(
      final List<GlossaryTermProperty> original, final List<GlossaryTermProperty> updated) {
    final Map<String, GlossaryTermPropertyDatatype> before =
        listOrEmpty(original).stream()
            .collect(
                Collectors.toMap(
                    GlossaryTermProperty::getName, GlossaryTermProperty::getDatatype, (a, b) -> a));
    for (final GlossaryTermProperty definition : listOrEmpty(updated)) {
      final GlossaryTermPropertyDatatype was = before.get(definition.getName());
      if (was != null && was != definition.getDatatype()) {
        throw badRequest(
            "The datatype of property '%s' cannot change from %s to %s; delete the property and declare it again"
                .formatted(definition.getName(), was.value(), definition.getDatatype().value()));
      }
    }
  }

  /** Rule 2 below the declaring term: terms in {@code page} that declare one of the names. */
  public static void collectNameClashes(
      final Collection<GlossaryTermProperty> nowInheritable,
      final List<GlossaryTerm> page,
      final TermPropertyViolations violations) {
    final Set<String> names =
        nowInheritable.stream()
            .map(def -> def.getName().toLowerCase(Locale.ROOT))
            .collect(Collectors.toSet());
    page.stream()
        .filter(
            term ->
                lowerCaseNames(term.getPropertyDefinitions()).stream().anyMatch(names::contains))
        .forEach(term -> violations.add(term.getFullyQualifiedName()));
  }

  /** Rule 4: terms in {@code page} whose stored entry for the property breaks the new shape. */
  public static void collectBrokenValues(
      final GlossaryTermProperty definition,
      final List<GlossaryTerm> page,
      final TermPropertyViolations violations) {
    page.stream()
        .filter(term -> hasBrokenEntry(term, definition))
        .forEach(term -> violations.add(term.getFullyQualifiedName()));
  }

  /** Rule 7: whether a moved term still fits the ancestors it will have. */
  public static boolean fitsAncestors(
      final GlossaryTerm term, final List<GlossaryTerm> ancestorsNearestFirst) {
    final Set<String> keys =
        nullOrEmpty(term.getPropertyValues()) ? Set.of() : term.getPropertyValues().keySet();
    return ancestorClash(term, ancestorsNearestFirst).isEmpty()
        && keyProblem(term, ancestorsNearestFirst, keys).isEmpty();
  }

  public static IllegalArgumentException badRequest(final String message) {
    return new IllegalArgumentException(message);
  }

  private static boolean hasBrokenEntry(
      final GlossaryTerm term, final GlossaryTermProperty definition) {
    final List<String> entry =
        nullOrEmpty(term.getPropertyValues())
            ? null
            : term.getPropertyValues().get(definition.getName());
    return entry != null && GlossaryTermPropertyValues.problem(definition, entry).isPresent();
  }

  private static Optional<String> problemForKey(
      final GlossaryTerm term, final GlossaryTermProperty definition, final String key) {
    return definition == null
        ? Optional.of(
            "Term '%s' has no property named '%s'; declare it on the term or an ancestor that makes it inheritable"
                .formatted(term.getFullyQualifiedName(), key))
        : GlossaryTermPropertyValues.problem(definition, term.getPropertyValues().get(key));
  }

  private static void validateDefinition(final GlossaryTermProperty definition) {
    validateName(definition);
    if (definition.getDatatype() == null) {
      throw badRequest("Property '%s' needs a datatype".formatted(definition.getName()));
    }
    validateEnumValues(definition);
    validateUnitAndLabel(definition);
    if (Boolean.TRUE.equals(definition.getMultiValued())
        && !MULTI_VALUED_DATATYPES.contains(definition.getDatatype())) {
      throw badRequest(
          "Property '%s' of datatype %s cannot be multi-valued; only string and enum can"
              .formatted(definition.getName(), definition.getDatatype().value()));
    }
  }

  private static void validateName(final GlossaryTermProperty definition) {
    final String name = definition.getName();
    if (name == null || name.length() > MAX_NAME_LENGTH || !NAME_PATTERN.matcher(name).matches()) {
      throw badRequest(
          "Invalid property name '%s'; it starts with a letter or digit and cannot contain / ~ \" \\ * & < > : ^ $"
              .formatted(name));
    }
  }

  private static void validateEnumValues(final GlossaryTermProperty definition) {
    final Set<String> enumValues = definition.getEnumValues();
    final boolean isEnum = definition.getDatatype() == GlossaryTermPropertyDatatype.ENUM;
    final int size = enumValues == null ? 0 : enumValues.size();
    if (isEnum && (size < MIN_ENUM_VALUES || size > MAX_ENUM_VALUES)) {
      throw badRequest(
          "Enum property '%s' needs %d to %d allowed values, got %d"
              .formatted(definition.getName(), MIN_ENUM_VALUES, MAX_ENUM_VALUES, size));
    }
    if (!isEnum && size > 0) {
      throw badRequest(
          "Property '%s' is not an enum, so it cannot list allowed values"
              .formatted(definition.getName()));
    }
  }

  private static void validateUnitAndLabel(final GlossaryTermProperty definition) {
    final String unit = definition.getUnit();
    if (unit != null && (unit.isEmpty() || unit.length() > MAX_UNIT_LENGTH)) {
      throw badRequest(
          "The unit of property '%s' is 1 to %d characters"
              .formatted(definition.getName(), MAX_UNIT_LENGTH));
    }
    final String label = definition.getDisplayName();
    if (label != null && label.length() > MAX_DISPLAY_NAME_LENGTH) {
      throw badRequest(
          "The display name of property '%s' is at most %d characters"
              .formatted(definition.getName(), MAX_DISPLAY_NAME_LENGTH));
    }
  }

  private static Set<String> lowerCaseNames(final List<GlossaryTermProperty> definitions) {
    return listOrEmpty(definitions).stream()
        .map(def -> def.getName().toLowerCase(Locale.ROOT))
        .collect(Collectors.toSet());
  }

  private static String matchingOwnName(
      final GlossaryTerm term, final GlossaryTermProperty inherited) {
    return term.getPropertyDefinitions().stream()
        .map(GlossaryTermProperty::getName)
        .filter(name -> name.equalsIgnoreCase(inherited.getName()))
        .findFirst()
        .orElse(inherited.getName());
  }
}
