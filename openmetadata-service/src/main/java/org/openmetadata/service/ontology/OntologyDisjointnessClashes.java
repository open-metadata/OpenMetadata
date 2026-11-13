package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpressionKind;

/**
 * Finds classes that cannot have members because a disjointness axiom meets the subclass closure:
 * a class disjoint with one of its ancestors, or a class under two disjoint ancestors. A clash is
 * reported at the most general class that has both sides, so a deep subtree reports it once.
 */
public final class OntologyDisjointnessClashes {
  private OntologyDisjointnessClashes() {}

  /** {@code conceptIds} lists the clashing class first, then each declared class it clashes with. */
  public record Clash(
      OntologyConcept subject,
      List<UUID> conceptIds,
      String message,
      String first,
      String second) {}

  public static List<Clash> find(final List<? extends OntologyDefinition> definitions) {
    final Map<String, OntologyConcept> concepts = new HashMap<>();
    final Map<String, Set<String>> parents = new HashMap<>();
    final Map<String, Set<String>> disjoint = new HashMap<>();
    for (final OntologyDefinition definition : definitions) {
      if (definition instanceof OntologyConcept concept) {
        concepts.putIfAbsent(concept.getIri().toString(), concept);
      } else if (definition instanceof OntologyAxiom axiom && axiom.getSubjectIri() != null) {
        collect(axiom, parents, disjoint);
      }
    }
    if (disjoint.isEmpty()) {
      return List.of();
    }
    final Set<String> candidates = new TreeSet<>(parents.keySet());
    candidates.addAll(disjoint.keySet());
    final Map<String, Set<String>> closures = new HashMap<>();
    candidates.forEach(iri -> closures.put(iri, closure(iri, parents)));
    final List<Clash> clashes = new ArrayList<>();
    for (final String iri : candidates) {
      final OntologyConcept subject = concepts.get(iri);
      if (subject == null) {
        continue;
      }
      final Set<String> own = closures.get(iri);
      for (final String first : new TreeSet<>(own)) {
        for (final String second : disjoint.getOrDefault(first, Set.of())) {
          if (first.compareTo(second) < 0
              && own.contains(second)
              && !coveredByParent(iri, first, second, parents, closures)) {
            clashes.add(clash(subject, first, second, concepts));
          }
        }
      }
    }
    clashes.sort(
        Comparator.comparing((Clash clash) -> clash.subject().getIri().toString())
            .thenComparing(Clash::first)
            .thenComparing(Clash::second));
    return List.copyOf(clashes);
  }

  private static void collect(
      final OntologyAxiom axiom,
      final Map<String, Set<String>> parents,
      final Map<String, Set<String>> disjoint) {
    final String subject = axiom.getSubjectIri().toString();
    if (axiom.getAxiomType() == OntologyAxiomType.SUBCLASS_OF) {
      OntologyClassHierarchy.namedParents(axiom)
          .forEach(
              parent ->
                  parents.computeIfAbsent(subject, k -> new HashSet<>()).add(parent.toString()));
    } else if (axiom.getAxiomType() == OntologyAxiomType.DISJOINT_WITH) {
      listOrEmpty(axiom.getExpressions()).stream()
          .filter(
              expression ->
                  expression != null
                      && expression.getKind() == OntologyExpressionKind.NAMED_CLASS
                      && expression.getClassIri() != null)
          .map(expression -> expression.getClassIri().toString())
          .filter(other -> !other.equals(subject))
          .forEach(
              other -> {
                disjoint.computeIfAbsent(subject, k -> new HashSet<>()).add(other);
                disjoint.computeIfAbsent(other, k -> new HashSet<>()).add(subject);
              });
    }
  }

  private static Set<String> closure(final String start, final Map<String, Set<String>> parents) {
    final Set<String> seen = new LinkedHashSet<>();
    final var pending = new ArrayDeque<String>();
    pending.add(start);
    while (!pending.isEmpty()) {
      final String current = pending.removeLast();
      if (seen.add(current)) {
        pending.addAll(parents.getOrDefault(current, Set.of()));
      }
    }
    return seen;
  }

  private static boolean coveredByParent(
      final String iri,
      final String first,
      final String second,
      final Map<String, Set<String>> parents,
      final Map<String, Set<String>> closures) {
    return parents.getOrDefault(iri, Set.of()).stream()
        .filter(parent -> !parent.equals(iri))
        .map(parent -> closures.getOrDefault(parent, Set.of(parent)))
        .anyMatch(parentClosure -> parentClosure.contains(first) && parentClosure.contains(second));
  }

  private static Clash clash(
      final OntologyConcept subject,
      final String first,
      final String second,
      final Map<String, OntologyConcept> concepts) {
    final String subjectIri = subject.getIri().toString();
    final String message =
        subjectIri.equals(first) || subjectIri.equals(second)
            ? label(subject)
                + " is disjoint with its ancestor "
                + label(concepts, subjectIri.equals(first) ? second : first)
            : label(subject)
                + " has disjoint ancestors "
                + label(concepts, first)
                + " and "
                + label(concepts, second);
    final Set<UUID> ids = new LinkedHashSet<>();
    ids.add(subject.getId());
    for (final String iri : List.of(first, second)) {
      final OntologyConcept declared = concepts.get(iri);
      if (declared != null) {
        ids.add(declared.getId());
      }
    }
    return new Clash(subject, List.copyOf(ids), message, first, second);
  }

  private static String label(final Map<String, OntologyConcept> concepts, final String iri) {
    final OntologyConcept concept = concepts.get(iri);
    return concept == null ? iri : label(concept);
  }

  private static String label(final OntologyConcept concept) {
    return concept.getName() == null ? concept.getIri().toString() : concept.getName();
  }
}
