/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.rdf;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.ontology.RelationshipTypeResolver;

/**
 * Builds the graphs ontology entities own (see {@link OntologyGraphs}) from current metadata. A
 * deleted entity owns an empty graph, which replacing drops.
 *
 * <p>See ADR:2026-10-14-ontology-entities-own-their-named-graphs.
 */
final class OntologyGraphProjection {
  private final URI baseUri;
  private final Sources sources;

  /** The metadata a projection reads beyond the entity itself. */
  interface Sources {
    /** Every relationship type that is not deleted. */
    List<RelationshipType> relationshipTypes();

    /** A term, or empty when it does not exist. */
    Optional<GlossaryTerm> glossaryTerm(UUID termId);

    /**
     * Every term of a glossary that is not deleted, with its attributes. An axiom's restriction on
     * one of their attributes is a data restriction, as in the glossary export.
     */
    List<GlossaryTerm> glossaryTerms(EntityReference glossary);
  }

  OntologyGraphProjection(final URI baseUri, final Sources sources) {
    this.baseUri = baseUri;
    this.sources = sources;
  }

  /**
   * The graphs to replace for these entities, keyed by graph IRI. A relationship type also
   * replaces the graphs of the types whose inverse, chain, disjointness or replacement name it,
   * since their axioms name its predicate.
   */
  Map<String, Model> graphs(final List<? extends EntityInterface<?>> entities) {
    final Map<String, Model> graphs = new LinkedHashMap<>();
    final BatchSources batch = new BatchSources();
    final List<RelationshipType> changedTypes = new ArrayList<>();
    for (final EntityInterface<?> entity : entities) {
      switch (entity) {
        case OntologyAxiom axiom -> graphs.put(
            graphIri(Entity.ONTOLOGY_AXIOM, axiom.getId()), axiomGraph(axiom, batch));
        case GlossaryTerm term -> graphs.put(
            graphIri(Entity.GLOSSARY_TERM, term.getId()), termGraph(term, batch));
        case RelationshipType type -> changedTypes.add(type);
        default -> {}
      }
    }
    if (!changedTypes.isEmpty()) {
      relationshipTypeGraphs(changedTypes, batch.relationshipTypes()).forEach(graphs::put);
    }
    return graphs;
  }

  private String graphIri(final String entityType, final UUID id) {
    return OntologyGraphs.graphIri(baseUri.toString(), entityType, id).orElseThrow();
  }

  private Model axiomGraph(final OntologyAxiom axiom, final BatchSources batch) {
    final Model model = ModelFactory.createDefaultModel();
    if (!Boolean.TRUE.equals(axiom.getDeleted())) {
      final Set<String> attributeIris =
          axiom.getGlossary() == null ? Set.of() : batch.attributeIris(axiom.getGlossary());
      new OntologyExpressionRdfWriter(attributeIris::contains).write(model, axiom);
    }
    return model;
  }

  private Model termGraph(final GlossaryTerm term, final BatchSources batch) {
    final GlossaryTerm parent =
        term.getParent() == null || term.getParent().getId() == null
            ? null
            : batch.glossaryTerm(term.getParent().getId()).orElse(null);
    return GlossaryTermClassGraph.build(term, parent, baseUri);
  }

  private Map<String, Model> relationshipTypeGraphs(
      final List<RelationshipType> changed, final List<RelationshipType> active) {
    final Map<UUID, RelationshipType> types = new LinkedHashMap<>();
    active.forEach(type -> types.put(type.getId(), type));
    changed.stream()
        .filter(type -> !Boolean.TRUE.equals(type.getDeleted()))
        .forEach(type -> types.put(type.getId(), type));
    final Set<UUID> changedIds = new HashSet<>();
    changed.forEach(type -> changedIds.add(type.getId()));
    final RelationshipTypeRdfWriter writer =
        new RelationshipTypeRdfWriter(List.copyOf(types.values()));
    final Map<String, Model> graphs = new LinkedHashMap<>();
    for (final RelationshipType type : changed) {
      graphs.put(graphIri(Entity.RELATIONSHIP_TYPE, type.getId()), typeGraph(writer, type));
    }
    types.values().stream()
        .filter(type -> !changedIds.contains(type.getId()))
        .filter(type -> references(type).anyMatch(changedIds::contains))
        .forEach(
            type ->
                graphs.put(
                    graphIri(Entity.RELATIONSHIP_TYPE, type.getId()), typeGraph(writer, type)));
    return graphs;
  }

  private static Model typeGraph(
      final RelationshipTypeRdfWriter writer, final RelationshipType type) {
    final Model model = ModelFactory.createDefaultModel();
    if (!Boolean.TRUE.equals(type.getDeleted())) {
      writer.write(model, type);
    }
    return model;
  }

  private static Stream<UUID> references(final RelationshipType type) {
    return Stream.of(
            Stream.ofNullable(type.getInverse()),
            Stream.ofNullable(type.getReplacedBy()),
            listOrEmpty(type.getPropertyChain()).stream(),
            type.getDisjointWith() == null
                ? Stream.<EntityReference>empty()
                : type.getDisjointWith().stream())
        .flatMap(references -> references)
        .map(EntityReference::getId)
        .filter(id -> id != null);
  }

  /**
   * Reads each source at most once per projection call, so a reindex batch of terms from one
   * glossary lists that glossary's attributes once. Scoped to the call, it never serves a later
   * write stale data and is bounded by the batch.
   */
  private final class BatchSources {
    private List<RelationshipType> relationshipTypes;
    private final Map<UUID, Set<String>> attributeIris = new HashMap<>();
    private final Map<UUID, Optional<GlossaryTerm>> terms = new HashMap<>();

    private List<RelationshipType> relationshipTypes() {
      if (relationshipTypes == null) {
        relationshipTypes = sources.relationshipTypes();
      }
      return relationshipTypes;
    }

    private Set<String> attributeIris(final EntityReference glossary) {
      return attributeIris.computeIfAbsent(
          glossary.getId(), ignored -> attributeIrisOf(sources.glossaryTerms(glossary)));
    }

    private Optional<GlossaryTerm> glossaryTerm(final UUID termId) {
      return terms.computeIfAbsent(termId, sources::glossaryTerm);
    }
  }

  private Set<String> attributeIrisOf(final List<GlossaryTerm> terms) {
    final Set<String> iris = new HashSet<>();
    for (final GlossaryTerm term : terms) {
      final String classIri = GlossaryTermClassIri.of(term, baseUri);
      listOrEmpty(term.getAttributes())
          .forEach(attribute -> iris.add(GlossaryTermProjection.attributeIri(classIri, attribute)));
    }
    return iris;
  }

  /** Reads sources from the metadata store. */
  static Sources databaseSources() {
    return new DatabaseSources();
  }

  private static final class DatabaseSources implements Sources {
    private static final String TERM_FIELDS = "attributes";

    @Override
    public List<RelationshipType> relationshipTypes() {
      return new RelationshipTypeResolver(Entity.getCollectionDAO().relationshipTypeDAO()).list();
    }

    @Override
    public Optional<GlossaryTerm> glossaryTerm(final UUID termId) {
      try {
        return Optional.of(Entity.getEntity(Entity.GLOSSARY_TERM, termId, "", Include.ALL));
      } catch (EntityNotFoundException missing) {
        return Optional.empty();
      }
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<GlossaryTerm> glossaryTerms(final EntityReference glossary) {
      final String glossaryFqn =
          glossary.getFullyQualifiedName() == null
              ? Entity.getEntityReferenceById(Entity.GLOSSARY, glossary.getId(), Include.ALL)
                  .getFullyQualifiedName()
              : glossary.getFullyQualifiedName();
      final EntityRepository<GlossaryTerm> repository =
          (EntityRepository<GlossaryTerm>) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
      final ListFilter filter = new ListFilter(Include.NON_DELETED);
      filter.addQueryParam("parent", glossaryFqn);
      return repository.listAll(repository.getFields(TERM_FIELDS), filter);
    }
  }
}
