package org.openmetadata.service.glossary;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EffectiveGlossaryTermProperty;
import org.openmetadata.schema.type.GlossaryTermProperty;

/** Works out which properties a term has and which stored entry gives each its values. */
public final class GlossaryTermPropertyResolver {
  /** A property definition and the term that declares it. */
  public record DeclaredProperty(GlossaryTerm declaredBy, GlossaryTermProperty property) {}

  private GlossaryTermPropertyResolver() {}

  /** A definition applies below its declaring term unless it says otherwise. */
  public static boolean isInheritable(final GlossaryTermProperty property) {
    return !Boolean.FALSE.equals(property.getInheritable());
  }

  /**
   * The term's own definitions in declared order, then the inheritable definitions of its
   * ancestors, nearest first. When two definitions share a name ignoring case, the nearest wins.
   */
  public static List<DeclaredProperty> declaredProperties(
      final GlossaryTerm term, final List<GlossaryTerm> ancestorsNearestFirst) {
    final List<DeclaredProperty> declared = new ArrayList<>();
    final Set<String> seenNames = new HashSet<>();
    addUnseen(declared, seenNames, term, listOrEmpty(term.getPropertyDefinitions()));
    for (final GlossaryTerm ancestor : listOrEmpty(ancestorsNearestFirst)) {
      final List<GlossaryTermProperty> inheritable =
          listOrEmpty(ancestor.getPropertyDefinitions()).stream()
              .filter(GlossaryTermPropertyResolver::isInheritable)
              .toList();
      addUnseen(declared, seenNames, ancestor, inheritable);
    }
    return declared;
  }

  public static List<EffectiveGlossaryTermProperty> resolve(
      final GlossaryTerm term, final List<GlossaryTerm> ancestorsNearestFirst) {
    return declaredProperties(term, ancestorsNearestFirst).stream()
        .map(declared -> effective(term, ancestorsNearestFirst, declared))
        .toList();
  }

  private static void addUnseen(
      final List<DeclaredProperty> declared,
      final Set<String> seenNames,
      final GlossaryTerm declaredBy,
      final List<GlossaryTermProperty> properties) {
    for (final GlossaryTermProperty property : properties) {
      if (seenNames.add(property.getName().toLowerCase(Locale.ROOT))) {
        declared.add(new DeclaredProperty(declaredBy, property));
      }
    }
  }

  private static EffectiveGlossaryTermProperty effective(
      final GlossaryTerm term,
      final List<GlossaryTerm> ancestorsNearestFirst,
      final DeclaredProperty declared) {
    final GlossaryTerm source =
        entrySource(term, ancestorsNearestFirst, declared.declaredBy(), declared.property());
    final List<String> values =
        source == null ? List.of() : source.getPropertyValues().get(declared.property().getName());
    return new EffectiveGlossaryTermProperty()
        .withProperty(declared.property())
        .withDeclaredBy(declared.declaredBy().getEntityReference())
        .withInherited(!isSameTerm(term, declared.declaredBy()))
        .withValues(new ArrayList<>(values))
        .withValuesFrom(source == null ? null : source.getEntityReference());
  }

  /** The nearest term, from {@code term} up to the declaring term, that stores an entry. */
  private static GlossaryTerm entrySource(
      final GlossaryTerm term,
      final List<GlossaryTerm> ancestorsNearestFirst,
      final GlossaryTerm declaredBy,
      final GlossaryTermProperty property) {
    return chainUpTo(term, ancestorsNearestFirst, declaredBy).stream()
        .filter(candidate -> hasEntry(candidate, property))
        .findFirst()
        .orElse(null);
  }

  private static List<GlossaryTerm> chainUpTo(
      final GlossaryTerm term,
      final List<GlossaryTerm> ancestorsNearestFirst,
      final GlossaryTerm declaredBy) {
    final List<GlossaryTerm> chain = new ArrayList<>();
    chain.add(term);
    for (final GlossaryTerm ancestor : listOrEmpty(ancestorsNearestFirst)) {
      if (isSameTerm(chain.getLast(), declaredBy)) {
        break;
      }
      chain.add(ancestor);
    }
    return chain;
  }

  private static boolean hasEntry(final GlossaryTerm term, final GlossaryTermProperty property) {
    final Map<String, List<String>> values = term.getPropertyValues();
    return values != null && values.containsKey(property.getName());
  }

  static boolean isSameTerm(final GlossaryTerm left, final GlossaryTerm right) {
    return left.getFullyQualifiedName().equals(right.getFullyQualifiedName());
  }
}
