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
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.SKOS;
import org.apache.jena.vocabulary.XSD;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyAttributeDataType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.service.rdf.OwlEntityDeclarations.EntityKind;

/** Projects glossary terms as SKOS concepts and OWL classes, with their attributes. */
final class GlossaryTermProjection {
  private final Model model;
  private final URI publicBaseUri;
  private final Set<String> dataPropertyIris = new HashSet<>();

  GlossaryTermProjection(final Model model, final URI publicBaseUri) {
    this.model = model;
    this.publicBaseUri = publicBaseUri;
  }

  Map<UUID, Resource> addTerms(final Resource scheme, final List<GlossaryTerm> terms) {
    final Map<UUID, Resource> resources = new HashMap<>();
    terms.forEach(term -> resources.put(term.getId(), addTerm(scheme, term)));
    return resources;
  }

  /** Attribute properties of the projected terms, which restrictions read as data properties. */
  Set<String> dataPropertyIris() {
    return Set.copyOf(dataPropertyIris);
  }

  /** A term is an OWL class unless the source asserted it as a SKOS concept only. */
  static boolean isOwlClass(final GlossaryTerm term) {
    return conceptType(term) != OntologyConceptType.SKOS_CONCEPT;
  }

  private Resource addTerm(final Resource scheme, final GlossaryTerm term) {
    final Resource resource = model.createResource(GlossaryTermClassIri.of(term, publicBaseUri));
    addConceptTypes(resource, term);
    GlossaryOntologyModelBuilder.addType(
        model, resource, GlossaryOntologyModelBuilder.GLOSSARY_TERM_CLASS);
    GlossaryOntologyModelBuilder.addObjectProperty(model, resource, SKOS.inScheme, scheme);
    GlossaryOntologyModelBuilder.addLiteral(model, resource, SKOS.prefLabel, displayName(term));
    GlossaryOntologyModelBuilder.addFullyQualifiedName(
        model, resource, term.getFullyQualifiedName());
    GlossaryOntologyModelBuilder.addLiteral(
        model, resource, SKOS.definition, term.getDescription());
    listOrEmpty(term.getSynonyms())
        .forEach(
            value ->
                GlossaryOntologyModelBuilder.addLiteral(model, resource, SKOS.altLabel, value));
    if (term.getEntityStatus() == EntityStatus.DEPRECATED) {
      resource.addLiteral(OWL2.deprecated, true);
    }
    addAttributes(resource, term.getAttributes());
    return resource;
  }

  /**
   * Emit the vocabulary the term was authored with. A term imported from a pure SKOS thesaurus
   * round-trips as a {@code skos:Concept} alone, and one imported from an OWL ontology as an {@code
   * owl:Class} alone. Terms created in OpenMetadata carry no preference and are emitted as both, so
   * they remain usable from either vocabulary; OWL 2 DL reads that as a class punned with an
   * individual of {@code skos:Concept}.
   */
  private void addConceptTypes(final Resource resource, final GlossaryTerm term) {
    if (isOwlClass(term)) {
      OwlEntityDeclarations.declare(model, resource, EntityKind.CLASS);
    }
    if (conceptType(term) != OntologyConceptType.OWL_CLASS) {
      GlossaryOntologyModelBuilder.addType(model, resource, SKOS.Concept.getURI());
    }
  }

  private static OntologyConceptType conceptType(final GlossaryTerm term) {
    return term.getConceptType() == null ? OntologyConceptType.BOTH : term.getConceptType();
  }

  private void addAttributes(final Resource domain, final List<OntologyAttribute> attributes) {
    for (final OntologyAttribute attribute : listOrEmpty(attributes)) {
      final String propertyIri = attributeIri(domain, attribute);
      final Resource property = model.createResource(propertyIri);
      OwlEntityDeclarations.declare(model, property, EntityKind.DATA_PROPERTY);
      dataPropertyIris.add(propertyIri);
      property.addProperty(RDFS.domain, domain);
      property.addProperty(RDFS.range, model.createResource(datatypeIri(attribute)));
      property.addProperty(RDFS.label, attribute.getName());
      if (attribute.getDescription() != null && !attribute.getDescription().isBlank()) {
        property.addProperty(RDFS.comment, attribute.getDescription());
      }
      if (Boolean.TRUE.equals(attribute.getIsIdentifier())) {
        property.addProperty(RDF.type, OWL2.FunctionalProperty);
      }
    }
  }

  private static String attributeIri(final Resource domain, final OntologyAttribute attribute) {
    final String iri =
        attribute.getIri() == null
            ? domain.getURI() + "/property/" + attribute.getName()
            : attribute.getIri().toString();
    return iri;
  }

  /**
   * An authored {@code datatypeIri} is kept exactly, for round trips; a datatype outside the OWL 2
   * datatype map then fails the DL profile check rather than being rewritten.
   */
  private static String datatypeIri(final OntologyAttribute attribute) {
    final String iri =
        attribute.getDatatypeIri() == null
            ? defaultDatatype(attribute.getDataType())
            : attribute.getDatatypeIri().toString();
    return iri;
  }

  /**
   * Defaults inside the OWL 2 datatype map. {@code xsd:date} is not in it, so a DATE attribute
   * ranges over {@code xsd:dateTime}: a calendar date is the instant at its start, and unlike
   * {@code xsd:dateTimeStamp} no timezone is required. See
   * ADR:2026-10-11-glossary-dates-are-xsd-datetime-and-skos-parents-are-not-superclasses.
   */
  static String defaultDatatype(final OntologyAttributeDataType dataType) {
    final String iri =
        switch (dataType) {
          case STRING, ENUM -> XSD.xstring.getURI();
          case INTEGER -> XSD.integer.getURI();
          case DECIMAL -> XSD.decimal.getURI();
          case BOOLEAN -> XSD.xboolean.getURI();
          case DATE -> XSD.dateTime.getURI();
        };
    return iri;
  }

  private static String displayName(final GlossaryTerm term) {
    return term.getDisplayName() == null ? term.getName() : term.getDisplayName();
  }
}
