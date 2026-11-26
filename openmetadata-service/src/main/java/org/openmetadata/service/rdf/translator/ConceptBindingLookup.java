package org.openmetadata.service.rdf.translator;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.service.Entity;

/**
 * The Ontology Studio bindings of catalog assets that the serving graph can state: those whose
 * concept the active release of its ontology describes
 * (ADR:2026-10-19-native-concept-bindings-remain-operational-metadata). Nothing is cached, as for
 * {@link LiveTagLookup}: another server can change a binding or activate a release.
 */
@FunctionalInterface
public interface ConceptBindingLookup {
  ConceptBindingLookup NONE = assetIds -> Map.of();

  /** The served bindings of {@code assetIds}, keyed by asset id; an unbound asset is absent. */
  Map<UUID, List<ServedBinding>> servedBindings(Collection<UUID> assetIds);

  static ConceptBindingLookup database() {
    return assetIds ->
        new DatabaseConceptBindingLookup(Entity.getCollectionDAO()).servedBindings(assetIds);
  }

  /** A binding of one asset to a concept, under the IRI the concept has in its release. */
  record ServedBinding(String conceptIri, List<ServedColumn> columns) {}

  /** A column assignment, under the IRI its property has in its release. */
  record ServedColumn(String propertyIri, List<String> columnPath) {}
}
