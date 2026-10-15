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

import java.net.URI;
import java.util.Set;
import java.util.TreeSet;
import org.apache.jena.datatypes.xsd.XSDDatatype;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.Entity;

/**
 * The record that describes one ontology graph in the members graph: whose graph it is, the
 * owner's lifecycle status, and a digest of the graph's triples. It is written in the same SPARQL
 * update as the graph, so a record never describes content the store does not hold, and closure
 * selection reads records instead of graph contents.
 *
 * @param glossaryIri entity IRI of the owning glossary; null for a relationship type
 * @param status the owner's lifecycle status; null when the owner has none
 * @param definesProperty the predicate a relationship type's graph defines; null otherwise
 * @param usesProperties object properties the graph declares and does not define, which is how a
 *     closure finds the relationship-type graphs its members need
 */
record OntologyGraphMember(
    String graphIri,
    String entityType,
    String entityIri,
    String glossaryIri,
    String status,
    String digest,
    long tripleCount,
    String definesProperty,
    Set<String> usesProperties) {

  static OntologyGraphMember of(
      final String graphIri,
      final EntityInterface<?> owner,
      final Model content,
      final URI baseUri) {
    final String entityType = entityType(owner);
    final String definesProperty =
        owner instanceof RelationshipType type && type.getRdfPredicate() != null
            ? type.getRdfPredicate().toString()
            : null;
    final Set<String> uses = new TreeSet<>();
    content
        .listSubjectsWithProperty(RDF.type, OWL2.ObjectProperty)
        .filterKeep(Resource::isURIResource)
        .forEachRemaining(property -> uses.add(property.getURI()));
    if (definesProperty != null) {
      uses.remove(definesProperty);
    }
    return new OntologyGraphMember(
        graphIri,
        entityType,
        baseUri.resolve("entity/" + entityType + "/" + owner.getId()).toString(),
        glossaryIri(owner, baseUri),
        status(owner),
        OntologyGraphDigest.of(content),
        content.size(),
        definesProperty,
        Set.copyOf(uses));
  }

  Model toModel() {
    final Model model = ModelFactory.createDefaultModel();
    final Resource graph = model.createResource(graphIri);
    graph.addProperty(RDF.type, model.createResource(OntologyReasoningVocabulary.ONTOLOGY_GRAPH));
    graph.addProperty(
        model.createProperty(OntologyReasoningVocabulary.GRAPH_OF),
        model.createResource(entityIri));
    graph.addProperty(model.createProperty(OntologyReasoningVocabulary.ENTITY_TYPE), entityType);
    graph.addProperty(model.createProperty(OntologyReasoningVocabulary.CONTENT_DIGEST), digest);
    graph.addProperty(
        model.createProperty(OntologyReasoningVocabulary.TRIPLE_COUNT),
        model.createTypedLiteral(Long.toString(tripleCount), XSDDatatype.XSDinteger));
    if (status != null) {
      graph.addProperty(model.createProperty(OntologyReasoningVocabulary.LIFECYCLE_STATUS), status);
    }
    if (glossaryIri != null) {
      graph.addProperty(
          model.createProperty(OntologyReasoningVocabulary.GLOSSARY),
          model.createResource(glossaryIri));
    }
    if (definesProperty != null) {
      graph.addProperty(
          model.createProperty(OntologyReasoningVocabulary.DEFINES_PROPERTY),
          model.createResource(definesProperty));
    }
    usesProperties.forEach(
        property ->
            graph.addProperty(
                model.createProperty(OntologyReasoningVocabulary.USES_PROPERTY),
                model.createResource(property)));
    return model;
  }

  private static String entityType(final EntityInterface<?> owner) {
    return switch (owner) {
      case OntologyAxiom ignored -> Entity.ONTOLOGY_AXIOM;
      case GlossaryTerm ignored -> Entity.GLOSSARY_TERM;
      case RelationshipType ignored -> Entity.RELATIONSHIP_TYPE;
      default -> throw new IllegalArgumentException(
          "Entity type owns no ontology graph: " + owner.getClass().getSimpleName());
    };
  }

  private static String glossaryIri(final EntityInterface<?> owner, final URI baseUri) {
    final EntityReference glossary =
        switch (owner) {
          case OntologyAxiom axiom -> axiom.getGlossary();
          case GlossaryTerm term -> term.getGlossary();
          default -> null;
        };
    return glossary == null || glossary.getId() == null
        ? null
        : GlossaryOntologyIri.entityIri(glossary.getId(), baseUri);
  }

  private static String status(final EntityInterface<?> owner) {
    final EntityStatus status =
        switch (owner) {
          case OntologyAxiom axiom -> axiom.getEntityStatus();
          case GlossaryTerm term -> term.getEntityStatus();
          case RelationshipType type -> type.getEntityStatus();
          default -> null;
        };
    return status == null ? null : status.value();
  }
}
