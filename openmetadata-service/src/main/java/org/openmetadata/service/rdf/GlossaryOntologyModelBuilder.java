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
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.DCTerms;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.SKOS;
import org.apache.jena.vocabulary.XSD;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyNamespace;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.rdf.OwlEntityDeclarations.EntityKind;

/** Builds a glossary vocabulary with its released hierarchy, mappings and term relations. */
final class GlossaryOntologyModelBuilder {
  private static final String OM = "https://open-metadata.org/ontology/";
  static final String GLOSSARY_TERM_CLASS = OM + "GlossaryTerm";
  private static final String RELATED_TO_TYPE = "relatedTo";
  private static final Set<String> CLASS_AXIOM_PREDICATES =
      Set.of(RDFS.subClassOf.getURI(), OWL2.equivalentClass.getURI(), OWL2.disjointWith.getURI());
  private final URI publicBaseUri;

  GlossaryOntologyModelBuilder(final URI publicBaseUri) {
    this.publicBaseUri = publicBaseUri;
  }

  Model build(final GlossaryOntologySource source, final boolean includeRelations) {
    final Model model = ontologyModel(source.glossary());
    final Resource scheme = glossaryResource(model, source.glossary());
    final GlossaryTermProjection terms = new GlossaryTermProjection(model, publicBaseUri);
    final Map<UUID, Resource> resources = terms.addTerms(scheme, source.terms());
    addTermSemantics(model, scheme, source, resources, includeRelations);
    return model;
  }

  private static Model ontologyModel(final Glossary glossary) {
    final Model model = ModelFactory.createDefaultModel();
    model.setNsPrefix("dct", DCTerms.NS);
    model.setNsPrefix("om", OM);
    model.setNsPrefix("owl", OWL2.NS);
    model.setNsPrefix("rdf", RDF.uri);
    model.setNsPrefix("rdfs", RDFS.uri);
    model.setNsPrefix("skos", SKOS.uri);
    model.setNsPrefix("xsd", XSD.NS);
    addConfiguredPrefixes(model, glossary);
    return model;
  }

  private static void addConfiguredPrefixes(final Model model, final Glossary glossary) {
    for (final OntologyNamespace namespace : listOrEmpty(glossary.getNamespaces())) {
      model.setNsPrefix(namespace.getPrefix(), namespace.getNamespace().toString());
    }
  }

  private Resource glossaryResource(final Model model, final Glossary glossary) {
    final Resource resource = model.createResource(glossaryIri(glossary));
    resource.addProperty(RDF.type, OWL2.Ontology);
    addType(model, resource, SKOS.ConceptScheme.getURI());
    addType(model, resource, OM + "Glossary");
    resource.addProperty(RDFS.label, displayName(glossary));
    addFullyQualifiedName(model, resource, glossary.getFullyQualifiedName());
    addLiteral(model, resource, SKOS.definition, glossary.getDescription());
    return resource;
  }

  private String glossaryIri(final Glossary glossary) {
    return publicBaseUri.resolve("entity/glossary/" + glossary.getId()).toString();
  }

  private void addTermSemantics(
      final Model model,
      final Resource scheme,
      final GlossaryOntologySource source,
      final Map<UUID, Resource> resources,
      final boolean includeRelations) {
    final Map<UUID, GlossaryTerm> termsById = new HashMap<>();
    source.terms().forEach(term -> termsById.put(term.getId(), term));
    final Set<String> usedTypes = new HashSet<>();
    final RelationContext relations = new RelationContext(model, resources, source);
    for (final GlossaryTerm term : source.terms()) {
      final Resource resource = resources.get(term.getId());
      addHierarchy(model, scheme, term, termsById, resources, includeRelations);
      addMappings(model, resource, term.getConceptMappings());
      if (includeRelations) {
        relations.addRelations(resource, term.getRelatedTerms(), usedTypes);
      }
    }
    addRelationshipTypes(model, usedTypes, source);
  }

  private static void addHierarchy(
      final Model model,
      final Resource scheme,
      final GlossaryTerm term,
      final Map<UUID, GlossaryTerm> termsById,
      final Map<UUID, Resource> resources,
      final boolean includeRelations) {
    final Resource resource = resources.get(term.getId());
    final GlossaryTerm parentTerm =
        term.getParent() == null ? null : termsById.get(term.getParent().getId());
    if (parentTerm == null) {
      addObjectProperty(model, scheme, SKOS.hasTopConcept, resource);
      addObjectProperty(model, resource, SKOS.topConceptOf, scheme);
    } else if (includeRelations) {
      final Resource parent = resources.get(parentTerm.getId());
      addObjectProperty(model, resource, SKOS.broader, parent);
      addObjectProperty(model, parent, SKOS.narrower, resource);
    }
  }

  private static void addMappings(
      final Model model, final Resource term, final List<ConceptMapping> mappings) {
    for (final ConceptMapping mapping : listOrEmpty(mappings)) {
      final Property property = OntologyRdfVocabulary.mapping(mapping.getMappingType());
      addObjectProperty(
          model, term, property, model.createResource(mapping.getConceptIri().toString()));
    }
  }

  private static void addRelationshipTypes(
      final Model model, final Set<String> usedTypes, final GlossaryOntologySource source) {
    final RelationshipTypeRdfWriter writer =
        new RelationshipTypeRdfWriter(source.relationshipTypes());
    final Set<String> termIris = new HashSet<>();
    model
        .listSubjectsWithProperty(RDF.type, model.createResource(GLOSSARY_TERM_CLASS))
        .forEachRemaining(term -> termIris.add(term.getURI()));
    source.relationshipTypes().stream()
        .filter(type -> isRelevant(type, usedTypes, termIris))
        .forEach(type -> writer.write(model, type));
  }

  private static boolean isRelevant(
      final RelationshipType type, final Set<String> usedTypes, final Set<String> termIris) {
    return usedTypes.contains(type.getName())
        || type.getDomain().stream()
            .anyMatch(reference -> termIris.contains(reference.getIri().toString()))
        || type.getRange().stream()
            .anyMatch(reference -> termIris.contains(reference.getIri().toString()));
  }

  static void addType(final Model model, final Resource resource, final String classIri) {
    OwlEntityDeclarations.declare(model, classIri, EntityKind.CLASS);
    resource.addProperty(RDF.type, model.createResource(classIri));
  }

  static void addObjectProperty(
      final Model model, final Resource subject, final Property property, final Resource object) {
    OwlEntityDeclarations.declare(model, property, EntityKind.OBJECT_PROPERTY);
    subject.addProperty(property, object);
  }

  static void addFullyQualifiedName(final Model model, final Resource resource, final String fqn) {
    final Property property = model.createProperty(OM, "fullyQualifiedName");
    if (fqn != null && !fqn.isBlank()) {
      OwlEntityDeclarations.declare(model, property, EntityKind.DATA_PROPERTY);
      resource.addProperty(property, fqn);
    }
  }

  static void addLiteral(
      final Model model, final Resource resource, final Property property, final String value) {
    if (value != null && !value.isBlank()) {
      OwlEntityDeclarations.declare(model, property, EntityKind.ANNOTATION_PROPERTY);
      resource.addProperty(property, value);
    }
  }

  private static String displayName(final Glossary glossary) {
    return glossary.getDisplayName() == null ? glossary.getName() : glossary.getDisplayName();
  }

  /** Writes authored term relations; a class-axiom predicate makes both ends OWL classes. */
  private static final class RelationContext {
    private final Model model;
    private final Map<UUID, Resource> resources;
    private final GlossaryOntologySource source;

    private RelationContext(
        final Model model,
        final Map<UUID, Resource> resources,
        final GlossaryOntologySource source) {
      this.model = model;
      this.resources = resources;
      this.source = source;
    }

    private void addRelations(
        final Resource subject, final List<TermRelation> relations, final Set<String> usedTypes) {
      for (final TermRelation relation : listOrEmpty(relations)) {
        final RelationshipType type = relationshipType(relation.getRelationType());
        final Resource target = target(relation.getTerm());
        final String predicate = type.getRdfPredicate().toString();
        subject.addProperty(model.createProperty(predicate), target);
        if (CLASS_AXIOM_PREDICATES.contains(predicate)) {
          OwlEntityDeclarations.declare(model, subject, EntityKind.CLASS);
          OwlEntityDeclarations.declare(model, target, EntityKind.CLASS);
        }
        if (RELATED_TO_TYPE.equals(type.getName())) {
          addObjectProperty(model, subject, SKOS.related, target);
        }
        usedTypes.add(type.getName());
      }
    }

    private RelationshipType relationshipType(final String name) {
      return source.relationshipTypes().stream()
          .filter(type -> type.getName().equalsIgnoreCase(name))
          .findFirst()
          .orElseThrow(
              () ->
                  new IllegalArgumentException(
                      "Relationship type '" + name + "' is not registered"));
    }

    private Resource target(final EntityReference reference) {
      final Resource local = resources.get(reference.getId());
      final Resource target =
          local == null ? model.createResource(requireExternalIri(reference)) : local;
      return target;
    }

    private String requireExternalIri(final EntityReference reference) {
      final String iri = source.externalTermIris().get(reference.getId());
      if (iri == null) {
        throw new IllegalArgumentException(
            "Related glossary term '" + reference.getId() + "' was not loaded for the export");
      }
      return iri;
    }
  }
}
