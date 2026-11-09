package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.net.URI;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.jena.vocabulary.OWL2;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.RelationshipCharacteristic;

/**
 * OWL 2 DL simplicity, chain regularity and superproperty acyclicity for the supported
 * named-property vocabulary. Object properties are grouped with their inverses, because an inverse
 * pair shares its simplicity and its place in the regular order.
 */
final class OntologyPropertyHierarchy {
  private static final Set<String> COMPOSITE_BUILTINS =
      Set.of(OWL2.topObjectProperty.getURI(), OWL2.bottomObjectProperty.getURI());
  private static final Set<RelationshipCharacteristic> SIMPLE_ONLY =
      Set.of(
          RelationshipCharacteristic.FUNCTIONAL,
          RelationshipCharacteristic.INVERSE_FUNCTIONAL,
          RelationshipCharacteristic.ASYMMETRIC,
          RelationshipCharacteristic.IRREFLEXIVE);
  private final Map<String, String> inverseGroups = new HashMap<>();
  private final Map<String, Set<String>> superGroups = new HashMap<>();
  private final Map<String, List<OntologyProperty>> membersByGroup = new HashMap<>();
  private final Set<String> nonSimple;
  private final Set<String> irregular;
  private final Set<String> cyclic;

  OntologyPropertyHierarchy(final List<OntologyProperty> properties) {
    final Set<String> objects =
        properties.stream()
            .filter(property -> property.getKind() == OntologyPropertyKind.OBJECT)
            .map(property -> property.getIri().toString())
            .collect(Collectors.toCollection(HashSet::new));
    objects.addAll(COMPOSITE_BUILTINS);
    properties.stream()
        .filter(property -> objects.contains(property.getIri().toString()))
        .filter(
            property ->
                property.getInverse() != null && objects.contains(property.getInverse().toString()))
        .forEach(property -> join(property.getIri().toString(), property.getInverse().toString()));
    final Map<String, Set<String>> named = new HashMap<>();
    for (final OntologyProperty property : properties) {
      final String iri = property.getIri().toString();
      for (final URI superProperty : listOrEmpty(property.getSuperProperties())) {
        named.computeIfAbsent(iri, ignored -> new HashSet<>()).add(superProperty.toString());
        if (objects.contains(iri) && objects.contains(superProperty.toString())) {
          superGroups
              .computeIfAbsent(group(iri), ignored -> new HashSet<>())
              .add(group(superProperty.toString()));
        }
      }
      if (objects.contains(iri)) {
        membersByGroup.computeIfAbsent(group(iri), ignored -> new ArrayList<>()).add(property);
      }
    }
    cyclic = OntologyClassHierarchy.cycleSources(named);
    nonSimple =
        properties.stream()
            .filter(OwlProfileGuard::isNonSimple)
            .map(property -> group(property.getIri().toString()))
            .collect(Collectors.toCollection(HashSet::new));
    COMPOSITE_BUILTINS.forEach(iri -> nonSimple.add(group(iri)));
    // A composite property makes every superproperty above it non-simple.
    final Deque<String> pending = new ArrayDeque<>(nonSimple);
    while (!pending.isEmpty()) {
      for (final String superGroup : superGroups.getOrDefault(pending.pop(), Set.of())) {
        if (nonSimple.add(superGroup)) {
          pending.push(superGroup);
        }
      }
    }
    final Map<String, Set<String>> order = new HashMap<>();
    properties.forEach(property -> addChainOrder(order, property));
    // OWL 2 DL asks for a strict partial order that puts each chain element below the chain's
    // superproperty and never puts a property below one of its own subproperties. The chain edges
    // alone fix the smallest candidate, so the hierarchy is irregular exactly where that candidate
    // loops or runs against a superproperty path.
    irregular = new HashSet<>();
    for (final String group : order.keySet()) {
      final Set<String> below = reachable(order, group);
      final Set<String> above = reachable(superGroups, group);
      above.add(group);
      if (below.stream().anyMatch(above::contains)) {
        irregular.add(group);
      }
    }
  }

  private static Set<String> reachable(final Map<String, Set<String>> edges, final String start) {
    final Set<String> visited = new HashSet<>();
    final Deque<String> pending = new ArrayDeque<>(edges.getOrDefault(start, Set.of()));
    while (!pending.isEmpty()) {
      final String next = pending.pop();
      if (visited.add(next)) {
        pending.addAll(edges.getOrDefault(next, Set.of()));
      }
    }
    return visited;
  }

  /** Whether the property carries a characteristic or disjointness OWL 2 DL reserves for simple properties. */
  static boolean requiresSimplicity(final OntologyProperty property) {
    return (!nullOrEmpty(property.getCharacteristics())
            && property.getCharacteristics().stream().anyMatch(SIMPLE_ONLY::contains))
        || !listOrEmpty(property.getDisjointWith()).isEmpty();
  }

  boolean isNonSimple(final URI iri) {
    return nonSimple.contains(group(iri.toString()));
  }

  boolean isIrregular(final URI iri) {
    return irregular.contains(group(iri.toString()));
  }

  /** Whether the property's named superproperty links, of any kind, run in a cycle. */
  boolean isCyclic(final URI iri) {
    return cyclic.contains(iri.toString());
  }

  /**
   * The properties above this non-simple property's own superproperty links that require
   * simplicity and lose it through those links; empty for a simple property or one without links.
   */
  List<String> simpleOnlyAncestors(final OntologyProperty property) {
    if (!isNonSimple(property.getIri()) || property.getKind() != OntologyPropertyKind.OBJECT) {
      return List.of();
    }
    final Set<String> ancestors = new HashSet<>();
    for (final URI superProperty : listOrEmpty(property.getSuperProperties())) {
      final String superGroup = group(superProperty.toString());
      ancestors.add(superGroup);
      ancestors.addAll(reachable(superGroups, superGroup));
    }
    ancestors.remove(group(property.getIri().toString()));
    return ancestors.stream()
        .flatMap(ancestor -> membersByGroup.getOrDefault(ancestor, List.of()).stream())
        .filter(OntologyPropertyHierarchy::requiresSimplicity)
        .map(member -> member.getIri().toString())
        .sorted()
        .toList();
  }

  private void addChainOrder(
      final Map<String, Set<String>> order, final OntologyProperty property) {
    final String superProperty = property.getIri().toString();
    final List<String> chain =
        listOrEmpty(property.getPropertyChain()).stream().map(URI::toString).toList();
    if (OWL2.topObjectProperty.getURI().equals(superProperty)
        || chain.equals(List.of(superProperty, superProperty))) {
      return;
    }
    final long recursive = chain.stream().filter(superProperty::equals).count();
    for (int index = 0; index < chain.size(); index++) {
      final String element = chain.get(index);
      if (!(recursive == 1
          && superProperty.equals(element)
          && (index == 0 || index == chain.size() - 1))) {
        order.computeIfAbsent(group(superProperty), ignored -> new HashSet<>()).add(group(element));
      }
    }
  }

  private void join(final String first, final String second) {
    final String left = group(first);
    final String right = group(second);
    if (!left.equals(right)) {
      inverseGroups.put(
          left.compareTo(right) < 0 ? right : left, left.compareTo(right) < 0 ? left : right);
    }
  }

  private String group(final String iri) {
    String root = inverseGroups.computeIfAbsent(iri, value -> value);
    while (!root.equals(inverseGroups.get(root))) {
      root = inverseGroups.get(root);
    }
    String current = iri;
    while (!current.equals(root)) {
      current = inverseGroups.put(current, root);
    }
    return root;
  }
}
