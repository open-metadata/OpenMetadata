package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.net.URI;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.jena.vocabulary.OWL2;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.OntologyPropertyKind;

/** OWL 2 DL simplicity and chain regularity for the supported named-property vocabulary. */
final class OntologyPropertyHierarchy {
  private static final Set<String> COMPOSITE_BUILTINS =
      Set.of(OWL2.topObjectProperty.getURI(), OWL2.bottomObjectProperty.getURI());
  private final Map<String, String> inverseGroups = new HashMap<>();
  private final Set<String> nonSimple;
  private final Set<String> irregular;

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
    nonSimple =
        properties.stream()
            .filter(OwlProfileGuard::isNonSimple)
            .map(property -> group(property.getIri().toString()))
            .collect(Collectors.toCollection(HashSet::new));
    COMPOSITE_BUILTINS.forEach(iri -> nonSimple.add(group(iri)));
    final Map<String, Set<String>> order = new HashMap<>();
    properties.forEach(property -> addChainOrder(order, property));
    irregular = OntologyClassHierarchy.cycleSources(order);
  }

  boolean isNonSimple(final URI iri) {
    return nonSimple.contains(group(iri.toString()));
  }

  boolean isIrregular(final URI iri) {
    return irregular.contains(group(iri.toString()));
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
