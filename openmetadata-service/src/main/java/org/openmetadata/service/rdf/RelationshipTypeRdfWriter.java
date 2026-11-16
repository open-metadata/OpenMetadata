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

import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.DCTerms;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.SemanticReference;
import org.openmetadata.service.rdf.OwlEntityDeclarations.EntityKind;

/**
 * Projects relationship types as OWL object properties. A type whose predicate is reserved
 * vocabulary ({@code rdfs:subClassOf}, {@code rdfs:seeAlso}, SKOS, OWL, RDF) keeps that predicate's
 * own meaning: its edges are written as they are, so an {@code rdfs:subClassOf} edge is a subclass
 * axiom and an {@code rdfs:seeAlso} edge an annotation. Such a type never becomes an {@code
 * owl:ObjectProperty} with characteristics, and other types never declare it as their inverse,
 * chain member or disjoint property; OWL 2 DL forbids all of these on reserved vocabulary. See
 * ADR:2026-10-11-glossary-ontology-projection-is-owl2-dl-with-one-class-iri-rule.
 */
@Slf4j
final class RelationshipTypeRdfWriter {
  private final List<RelationshipType> allTypes;

  RelationshipTypeRdfWriter(final List<RelationshipType> allTypes) {
    this.allTypes = List.copyOf(allTypes);
  }

  void write(final Model model, final RelationshipType type) {
    final String predicate = type.getRdfPredicate().toString();
    if (OwlEntityDeclarations.isReservedVocabulary(predicate)) {
      OwlEntityDeclarations.declare(model, predicate, EntityKind.OBJECT_PROPERTY);
    } else {
      writeObjectProperty(model, type, model.createResource(predicate));
    }
  }

  private void writeObjectProperty(
      final Model model, final RelationshipType type, final Resource property) {
    OwlEntityDeclarations.declare(model, property, EntityKind.OBJECT_PROPERTY);
    property.addProperty(RDFS.label, type.getDisplayName());
    addLiteral(property, RDFS.comment, type.getDescription());
    addCharacteristics(property, type.getCharacteristics());
    addClassReferences(model, property, RDFS.domain, type.getDomain());
    addClassReferences(model, property, RDFS.range, type.getRange());
    setOrEmpty(type.getDisjointWith())
        .forEach(reference -> addDisjointProperty(model, property, type, reference));
    addInverse(model, property, type);
    addPropertyChain(model, property, type);
    addDeprecation(model, property, type);
  }

  private static void addCharacteristics(
      final Resource property, final Set<RelationshipCharacteristic> characteristics) {
    for (final RelationshipCharacteristic characteristic : setOrEmpty(characteristics)) {
      property.addProperty(RDF.type, OntologyRdfVocabulary.characteristic(characteristic));
    }
  }

  private static void addClassReferences(
      final Model model,
      final Resource property,
      final Property predicate,
      final Set<SemanticReference> references) {
    for (final SemanticReference reference : setOrEmpty(references)) {
      final Resource referencedClass = model.createResource(reference.getIri().toString());
      OwlEntityDeclarations.declare(model, referencedClass, EntityKind.CLASS);
      property.addProperty(predicate, referencedClass);
    }
  }

  private void addDisjointProperty(
      final Model model,
      final Resource property,
      final RelationshipType type,
      final EntityReference reference) {
    final String disjointPredicate = predicateIri(reference);
    if (isProjectable(type, disjointPredicate, "disjoint property")) {
      property.addProperty(OWL2.propertyDisjointWith, objectProperty(model, disjointPredicate));
    }
  }

  /**
   * Inverse edges are stored as edges of the inverse type, so skipping an {@code owl:inverseOf}
   * onto reserved vocabulary (superClassOf's inverse is {@code rdfs:subClassOf}) loses nothing.
   */
  private void addInverse(final Model model, final Resource property, final RelationshipType type) {
    if (type.getInverse() != null) {
      final String inversePredicate = predicateIri(type.getInverse());
      if (!OwlEntityDeclarations.isReservedVocabulary(inversePredicate)) {
        property.addProperty(OWL2.inverseOf, objectProperty(model, inversePredicate));
      }
    }
  }

  private void addPropertyChain(
      final Model model, final Resource property, final RelationshipType type) {
    final List<String> chain =
        listOrEmpty(type.getPropertyChain()).stream().map(this::predicateIri).toList();
    final boolean isProjectable =
        !chain.isEmpty()
            && chain.stream().allMatch(link -> isProjectable(type, link, "property chain link"));
    if (isProjectable) {
      final List<RDFNode> links =
          chain.stream().map(link -> (RDFNode) objectProperty(model, link)).toList();
      property.addProperty(OWL2.propertyChainAxiom, model.createList(links.iterator()));
    }
  }

  private static boolean isProjectable(
      final RelationshipType type, final String predicate, final String role) {
    final boolean isReserved = OwlEntityDeclarations.isReservedVocabulary(predicate);
    if (isReserved) {
      LOG.warn(
          "Relationship type '{}' names reserved vocabulary <{}> as a {}; OWL 2 DL cannot express"
              + " it, so the ontology projection omits that axiom",
          type.getName(),
          predicate,
          role);
    }
    return !isReserved;
  }

  private void addDeprecation(
      final Model model, final Resource property, final RelationshipType type) {
    if (type.getEntityStatus() == EntityStatus.DEPRECATED) {
      property.addLiteral(OWL2.deprecated, true);
    }
    if (type.getReplacedBy() != null) {
      OwlEntityDeclarations.declare(
          model, DCTerms.isReplacedBy.getURI(), EntityKind.ANNOTATION_PROPERTY);
      property.addProperty(
          DCTerms.isReplacedBy, model.createResource(predicateIri(type.getReplacedBy())));
    }
  }

  private static Resource objectProperty(final Model model, final String predicate) {
    OwlEntityDeclarations.declare(model, predicate, EntityKind.OBJECT_PROPERTY);
    return model.createResource(predicate);
  }

  private String predicateIri(final EntityReference reference) {
    final String referenceFqn = reference.getFullyQualifiedName();
    return allTypes.stream()
        .filter(
            type ->
                (reference.getId() != null && type.getId().equals(reference.getId()))
                    || (referenceFqn != null && referenceFqn.equals(type.getFullyQualifiedName())))
        .findFirst()
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    "Relationship type '"
                        + (reference.getId() != null ? reference.getId() : referenceFqn)
                        + "' is not registered"))
        .getRdfPredicate()
        .toString();
  }

  private static <T> Set<T> setOrEmpty(final Set<T> values) {
    return values == null ? Set.of() : values;
  }

  private static void addLiteral(
      final Resource resource, final Property property, final String value) {
    if (value != null && !value.isBlank()) {
      resource.addProperty(property, value);
    }
  }
}
