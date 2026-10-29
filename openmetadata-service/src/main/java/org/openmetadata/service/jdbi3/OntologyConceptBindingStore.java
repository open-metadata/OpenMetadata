package org.openmetadata.service.jdbi3;

import java.net.URI;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.BiFunction;
import org.apache.commons.codec.digest.DigestUtils;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.type.OntologyConceptBindings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.OntologyClassHierarchy;
import org.openmetadata.service.ontology.OntologyReleaseManifest;
import org.openmetadata.service.util.FreshReadScope;

/** Operational catalog associations share the ontology lock without advancing semantic revisions. */
public final class OntologyConceptBindingStore {
  public static final String EXTENSION = "ontology.conceptBindings";
  private static final String SCHEMA = "ontologyConceptBindings";
  private static final int MAX_ANCESTORS = OntologyReleaseManifest.MAX_MEMBERS;
  private final CollectionDAO dao;

  public OntologyConceptBindingStore(final CollectionDAO dao) {
    this.dao = dao;
  }

  public OntologyConceptBindings read(final UUID conceptId) {
    final String json = dao.entityExtensionDAO().getExtension(conceptId, EXTENSION);
    return json == null
        ? new OntologyConceptBindings().withRevision(0L).withAssets(List.of())
        : JsonUtils.readValue(json, OntologyConceptBindings.class);
  }

  public void requireLiveOntology(final OntologyConcept concept) {
    dao.ontologyEntityDAO().findEntityById(concept.getOntology().getId());
  }

  public OntologyConceptBindings update(
      final OntologyConcept concept,
      final BiFunction<OntologyConcept, OntologyConceptBindings, OntologyConceptBindings>
          mutation) {
    return dao.inTransaction(
        transaction ->
            new OntologyConceptBindingStore(transaction).updateLocked(concept, mutation));
  }

  private OntologyConceptBindings updateLocked(
      final OntologyConcept concept,
      final BiFunction<OntologyConcept, OntologyConceptBindings, OntologyConceptBindings>
          mutation) {
    final UUID ontologyId = concept.getOntology().getId();
    dao.ontologyStateDAO().initialize(ontologyId);
    dao.ontologyStateDAO().lock(ontologyId);
    try (final var ignored = FreshReadScope.enter()) {
      final var currentConcept = dao.ontologyConceptDAO().findEntityById(concept.getId());
      requireLiveOntology(currentConcept);
      return save(currentConcept, mutation);
    }
  }

  private OntologyConceptBindings save(
      final OntologyConcept concept,
      final BiFunction<OntologyConcept, OntologyConceptBindings, OntologyConceptBindings>
          mutation) {
    final var current = read(concept.getId());
    final var updated = mutation.apply(concept, current);
    if (!current.getRevision().equals(updated.getRevision())) {
      dao.entityExtensionDAO()
          .insert(concept.getId(), EXTENSION, SCHEMA, JsonUtils.pojoToJson(updated));
    }
    return updated;
  }

  public Set<String> ancestors(final OntologyConcept concept) {
    final Set<String> visited = new HashSet<>();
    Set<String> pending = Set.of(concept.getIri().toString());
    int traversed = 0;
    while (!pending.isEmpty()) {
      visited.addAll(pending);
      final var axioms =
          dao.ontologyReferenceDAO()
              .ancestors(
                  concept.getOntology().getId(),
                  pending.stream().map(DigestUtils::sha256Hex).toList(),
                  MAX_ANCESTORS + 1,
                  "");
      traversed += axioms.size();
      requireBound(Math.max(visited.size(), traversed));
      pending = parents(axioms, pending, visited);
    }
    return Set.copyOf(visited);
  }

  private static Set<String> parents(
      final List<String> rows, final Set<String> pending, final Set<String> visited) {
    final Set<String> result = new HashSet<>();
    for (final String json : rows) {
      final var axiom = JsonUtils.readValue(json, OntologyAxiom.class);
      if (pending.contains(axiom.getSubjectIri().toString())) {
        OntologyClassHierarchy.namedParents(axiom).stream()
            .map(URI::toString)
            .filter(iri -> !visited.contains(iri))
            .forEach(result::add);
        requireBound(result.size());
      }
    }
    return result;
  }

  private static void requireBound(final int size) {
    if (size > MAX_ANCESTORS) {
      throw new BadRequestException("Binding property inheritance exceeds the 10000 axiom limit");
    }
  }
}
