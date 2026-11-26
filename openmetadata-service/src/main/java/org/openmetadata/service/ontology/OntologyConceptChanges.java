package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Stream;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyConceptChange;
import org.openmetadata.schema.type.OntologyReleaseChangeType;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyReleaseMemberChange;

/** Regroups working changes by the concept they define, so a class and its parts page together. */
final class OntologyConceptChanges {
  private final Map<String, OntologyDefinition> before;
  private final Map<String, OntologyDefinition> after;
  private final View previous;
  private final View current;

  private OntologyConceptChanges(
      final Map<String, OntologyDefinition> before, final Map<String, OntologyDefinition> after) {
    this.before = before;
    this.after = after;
    previous = new View(before.values());
    current = new View(after.values());
  }

  static List<OntologyConceptChange> group(
      final Map<String, OntologyDefinition> before,
      final Map<String, OntologyDefinition> after,
      final List<OntologyReleaseMemberChange> changes) {
    return new OntologyConceptChanges(before, after).group(changes);
  }

  private List<OntologyConceptChange> group(final List<OntologyReleaseMemberChange> changes) {
    final Map<String, List<OntologyReleaseMemberChange>> byConcept = new LinkedHashMap<>();
    final List<OntologyConceptChange> unowned = new ArrayList<>();
    for (final var change : changes) {
      final String concept = conceptOf(definition(change));
      if (concept == null) {
        unowned.add(
            new OntologyConceptChange()
                .withChangeType(change.getChangeType())
                .withParents(List.of())
                .withPropertyCount(0)
                .withChanges(List.of(change)));
      } else {
        byConcept.computeIfAbsent(concept, ignored -> new ArrayList<>()).add(change);
      }
    }
    final List<OntologyConceptChange> rows = new ArrayList<>();
    byConcept.forEach((iri, members) -> rows.add(row(iri, members)));
    rows.sort(
        Comparator.comparing(OntologyConceptChange::getConcept, String.CASE_INSENSITIVE_ORDER)
            .thenComparing(row -> row.getIri().toString()));
    rows.addAll(unowned);
    return rows;
  }

  private OntologyDefinition definition(final OntologyReleaseMemberChange change) {
    final String key =
        OntologyReleaseComparison.key(change.getMemberKind(), change.getEntity().getId());
    return after.containsKey(key) ? after.get(key) : before.get(key);
  }

  private String conceptOf(final OntologyDefinition definition) {
    final Stream<URI> candidates =
        switch (definition) {
          case OntologyConcept concept -> Stream.of(concept.getIri());
          case OntologyAxiom axiom -> Stream.ofNullable(axiom.getSubjectIri());
          case OntologyProperty property -> listOrEmpty(property.getDomain()).stream();
          default -> Stream.empty();
        };
    return candidates
        .map(URI::toString)
        .filter(iri -> current.concepts.containsKey(iri) || previous.concepts.containsKey(iri))
        .findFirst()
        .orElse(null);
  }

  private OntologyConceptChange row(
      final String iri, final List<OntologyReleaseMemberChange> changes) {
    final View view = current.concepts.containsKey(iri) ? current : previous;
    final OntologyConcept concept = view.concepts.get(iri);
    return new OntologyConceptChange()
        .withConcept(label(concept))
        .withIri(concept.getIri())
        .withChangeType(
            changes.stream()
                .filter(
                    change ->
                        change.getMemberKind() == MemberKind.CONCEPT
                            && concept.getId().equals(change.getEntity().getId()))
                .map(OntologyReleaseMemberChange::getChangeType)
                .findFirst()
                .orElse(OntologyReleaseChangeType.CHANGED))
        .withParents(
            view.parents.getOrDefault(iri, Set.of()).stream().map(view::label).sorted().toList())
        .withPropertyCount(view.propertyCounts.getOrDefault(iri, 0))
        .withChanges(List.copyOf(changes));
  }

  private static String label(final OntologyConcept concept) {
    return nullOrEmpty(concept.getDisplayName()) ? concept.getName() : concept.getDisplayName();
  }

  private static final class View {
    private final Map<String, OntologyConcept> concepts = new HashMap<>();
    private final Map<String, Set<String>> parents = new HashMap<>();
    private final Map<String, Integer> propertyCounts = new HashMap<>();

    private View(final Collection<OntologyDefinition> definitions) {
      for (final OntologyDefinition definition : definitions) {
        switch (definition) {
          case OntologyConcept concept -> concepts.putIfAbsent(
              concept.getIri().toString(), concept);
          case OntologyAxiom axiom -> OntologyClassHierarchy.namedParents(axiom)
              .forEach(
                  parent ->
                      parents
                          .computeIfAbsent(
                              axiom.getSubjectIri().toString(), ignored -> new TreeSet<>())
                          .add(parent.toString()));
          case OntologyProperty property -> listOrEmpty(property.getDomain()).stream()
              .map(URI::toString)
              .distinct()
              .forEach(domain -> propertyCounts.merge(domain, 1, Integer::sum));
          default -> {}
        }
      }
    }

    private String label(final String iri) {
      final OntologyConcept concept = concepts.get(iri);
      return concept == null ? iri : OntologyConceptChanges.label(concept);
    }
  }
}
