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

import java.io.StringWriter;
import java.net.URI;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFParser;
import org.apache.jena.vocabulary.DCTerms;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.SKOS;
import org.apache.jena.vocabulary.XSD;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyAttributeDataType;
import org.openmetadata.schema.type.OntologyNamespace;
import org.openmetadata.schema.type.OntologyPrefix;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.SemanticReference;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO.OntologyAnnexDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.OntologyAnnexRow;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.ontology.RelationshipTypeResolver;

public final class GlossaryOntologyExporter {
  private static final String OM = "https://open-metadata.org/ontology/";
  private static final String RELATED_TO_TYPE = "relatedTo";
  private static final String DEFAULT_TERM_FIELDS =
      "attributes,conceptMappings,entityStatus,parent,relatedTerms,synonyms";
  private final URI publicBaseUri;
  private final OntologyAnnexDAO annexDAO;
  private final OntologyExpressionRdfWriter expressionWriter;

  public GlossaryOntologyExporter(final URI publicBaseUri, final OntologyAnnexDAO annexDAO) {
    this.publicBaseUri = publicBaseUri;
    this.annexDAO = annexDAO;
    expressionWriter = new OntologyExpressionRdfWriter();
  }

  public String export(
      final UUID glossaryId, final String requestedFormat, final boolean includeRelations) {
    final Model model = materialize(glossaryId, includeRelations);
    try {
      return serialize(model, exportFormat(requestedFormat));
    } finally {
      model.close();
    }
  }

  private static RdfSerializationFormat exportFormat(final String requestedFormat) {
    try {
      return RdfSerializationFormat.parse(requestedFormat);
    } catch (IllegalArgumentException e) {
      return RdfSerializationFormat.TURTLE;
    }
  }

  public Model materialize(final UUID glossaryId, final boolean includeRelations) {
    final Model model = buildModel(glossaryId, includeRelations);
    try {
      mergeAnnex(model, glossaryId);
    } catch (RuntimeException exception) {
      model.close();
      throw exception;
    }
    return model;
  }

  Model buildModel(final UUID glossaryId, final boolean includeRelations) {
    final Glossary glossary = glossary(glossaryId);
    final List<GlossaryTerm> terms = terms(glossary);
    final Model model = ontologyModel(glossary);
    final Resource scheme = glossaryResource(model, glossary);
    final Map<UUID, Resource> resources = addTerms(model, scheme, terms);
    addTermSemantics(model, scheme, terms, resources, includeRelations);
    addAxioms(model, glossaryId);
    return model;
  }

  private Glossary glossary(final UUID glossaryId) {
    final GlossaryRepository repository =
        (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
    return repository.get(
        null,
        glossaryId,
        repository.getFields("namespaces,ontologyConfiguration"),
        Include.NON_DELETED,
        false);
  }

  @SuppressWarnings("unchecked")
  private List<GlossaryTerm> terms(final Glossary glossary) {
    final EntityRepository<GlossaryTerm> repository =
        (EntityRepository<GlossaryTerm>) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    final ListFilter filter = new ListFilter(Include.NON_DELETED);
    filter.addQueryParam("parent", glossary.getFullyQualifiedName());
    return repository.listAll(repository.getFields(DEFAULT_TERM_FIELDS), filter);
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
    if (glossary.getOntologyConfiguration() != null) {
      for (final OntologyPrefix prefix : glossary.getOntologyConfiguration().getPrefixes()) {
        model.setNsPrefix(prefix.getPrefix(), prefix.getNamespace().toString());
      }
    }
  }

  private Resource glossaryResource(final Model model, final Glossary glossary) {
    final Resource resource = model.createResource(glossaryIri(glossary));
    resource.addProperty(RDF.type, OWL2.Ontology);
    resource.addProperty(RDF.type, SKOS.ConceptScheme);
    resource.addProperty(RDF.type, model.createResource(OM + "Glossary"));
    resource.addProperty(RDFS.label, displayName(glossary));
    addLiteral(
        resource, model.createProperty(OM, "fullyQualifiedName"), glossary.getFullyQualifiedName());
    addLiteral(resource, SKOS.definition, glossary.getDescription());
    return resource;
  }

  private String glossaryIri(final Glossary glossary) {
    final URI configuredIri =
        glossary.getOntologyConfiguration() == null
            ? null
            : glossary.getOntologyConfiguration().getBaseIri();
    final String iri =
        configuredIri == null
            ? publicBaseUri.resolve("entity/glossary/" + glossary.getId()).toString()
            : configuredIri.toString();
    return iri;
  }

  private Map<UUID, Resource> addTerms(
      final Model model, final Resource scheme, final List<GlossaryTerm> terms) {
    final Map<UUID, Resource> resources = new HashMap<>();
    for (final GlossaryTerm term : terms) {
      final Resource resource = addTerm(model, scheme, term);
      resources.put(term.getId(), resource);
    }
    return resources;
  }

  private Resource addTerm(final Model model, final Resource scheme, final GlossaryTerm term) {
    final Resource resource = model.createResource(termIri(term));
    resource.addProperty(RDF.type, OWL2.Class);
    resource.addProperty(RDF.type, SKOS.Concept);
    resource.addProperty(RDF.type, model.createResource(OM + "GlossaryTerm"));
    resource.addProperty(SKOS.inScheme, scheme);
    resource.addProperty(SKOS.prefLabel, displayName(term));
    addLiteral(
        resource, model.createProperty(OM, "fullyQualifiedName"), term.getFullyQualifiedName());
    addLiteral(resource, SKOS.definition, term.getDescription());
    listOrEmpty(term.getSynonyms()).forEach(value -> resource.addProperty(SKOS.altLabel, value));
    if (term.getEntityStatus() == EntityStatus.DEPRECATED) {
      resource.addLiteral(OWL2.deprecated, true);
    }
    addAttributes(model, resource, term.getAttributes());
    return resource;
  }

  private String termIri(final GlossaryTerm term) {
    final String iri =
        term.getIri() == null
            ? publicBaseUri.resolve("entity/glossaryTerm/" + term.getId()).toString()
            : term.getIri().toString();
    return iri;
  }

  private void addAttributes(
      final Model model, final Resource domain, final List<OntologyAttribute> attributes) {
    for (final OntologyAttribute attribute : listOrEmpty(attributes)) {
      final Resource property = model.createResource(attributeIri(domain, attribute));
      property.addProperty(RDF.type, OWL2.DatatypeProperty);
      property.addProperty(RDFS.domain, domain);
      property.addProperty(RDFS.range, model.createResource(datatypeIri(attribute)));
      property.addProperty(RDFS.label, attribute.getName());
      addLiteral(property, RDFS.comment, attribute.getDescription());
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

  private static String datatypeIri(final OntologyAttribute attribute) {
    final String iri =
        attribute.getDatatypeIri() == null
            ? defaultDatatype(attribute.getDataType())
            : attribute.getDatatypeIri().toString();
    return iri;
  }

  private static String defaultDatatype(final OntologyAttributeDataType dataType) {
    final String iri =
        switch (dataType) {
          case STRING, ENUM -> XSD.xstring.getURI();
          case INTEGER -> XSD.integer.getURI();
          case DECIMAL -> XSD.decimal.getURI();
          case BOOLEAN -> XSD.xboolean.getURI();
          case DATE -> XSD.date.getURI();
        };
    return iri;
  }

  private void addTermSemantics(
      final Model model,
      final Resource scheme,
      final List<GlossaryTerm> terms,
      final Map<UUID, Resource> resources,
      final boolean includeRelations) {
    final Set<String> usedTypes = new HashSet<>();
    for (final GlossaryTerm term : terms) {
      addHierarchy(model, scheme, term, resources, includeRelations);
      addMappings(model, resources.get(term.getId()), term.getConceptMappings());
      if (includeRelations) {
        addRelations(
            model, resources.get(term.getId()), term.getRelatedTerms(), resources, usedTypes);
      }
    }
    addRelationshipTypes(model, usedTypes, terms);
  }

  private void addHierarchy(
      final Model model,
      final Resource scheme,
      final GlossaryTerm term,
      final Map<UUID, Resource> resources,
      final boolean includeRelations) {
    final Resource resource = resources.get(term.getId());
    final Resource parent =
        term.getParent() == null ? null : resources.get(term.getParent().getId());
    if (parent == null) {
      scheme.addProperty(SKOS.hasTopConcept, resource);
      resource.addProperty(SKOS.topConceptOf, scheme);
    } else if (includeRelations) {
      resource.addProperty(SKOS.broader, parent);
      resource.addProperty(RDFS.subClassOf, parent);
      parent.addProperty(SKOS.narrower, resource);
    }
  }

  private void addMappings(
      final Model model, final Resource term, final List<ConceptMapping> mappings) {
    for (final ConceptMapping mapping : listOrEmpty(mappings)) {
      term.addProperty(
          mappingProperty(mapping.getMappingType()),
          model.createResource(mapping.getConceptIri().toString()));
    }
  }

  private static Property mappingProperty(final ConceptMapping.ConceptMappingType mappingType) {
    final Property property =
        switch (mappingType) {
          case EXACT_MATCH -> SKOS.exactMatch;
          case CLOSE_MATCH -> SKOS.closeMatch;
          case BROAD_MATCH -> SKOS.broadMatch;
          case NARROW_MATCH -> SKOS.narrowMatch;
          case RELATED_MATCH -> SKOS.relatedMatch;
          case SAME_AS -> OWL2.sameAs;
        };
    return property;
  }

  private void addRelations(
      final Model model,
      final Resource source,
      final List<TermRelation> relations,
      final Map<UUID, Resource> resources,
      final Set<String> usedTypes) {
    for (final TermRelation relation : listOrEmpty(relations)) {
      final RelationshipType type = relationshipType(relation.getRelationType());
      final Resource target = relatedResource(model, relation.getTerm(), resources);
      source.addProperty(model.createProperty(type.getRdfPredicate().toString()), target);
      if (RELATED_TO_TYPE.equals(type.getName())) {
        source.addProperty(SKOS.related, target);
      }
      usedTypes.add(type.getName());
    }
  }

  private static RelationshipType relationshipType(final String name) {
    final RelationshipTypeResolver resolver =
        new RelationshipTypeResolver(Entity.getCollectionDAO().relationshipTypeDAO());
    return resolver.require(name);
  }

  private Resource relatedResource(
      final Model model, final EntityReference reference, final Map<UUID, Resource> resources) {
    Resource resource = resources.get(reference.getId());
    if (resource == null) {
      final GlossaryTerm term =
          Entity.getEntity(Entity.GLOSSARY_TERM, reference.getId(), "", Include.NON_DELETED);
      resource = model.createResource(termIri(term));
    }
    return resource;
  }

  private void addRelationshipTypes(
      final Model model, final Set<String> usedTypes, final List<GlossaryTerm> terms) {
    final RelationshipTypeResolver resolver =
        new RelationshipTypeResolver(Entity.getCollectionDAO().relationshipTypeDAO());
    final List<RelationshipType> allTypes = resolver.list();
    final Set<String> termIris = termIris(terms);
    allTypes.stream()
        .filter(type -> isRelevant(type, usedTypes, termIris))
        .forEach(type -> addRelationshipType(model, type, allTypes));
  }

  private Set<String> termIris(final List<GlossaryTerm> terms) {
    final Set<String> iris = new HashSet<>();
    terms.forEach(term -> iris.add(termIri(term)));
    return iris;
  }

  private static boolean isRelevant(
      final RelationshipType type, final Set<String> usedTypes, final Set<String> termIris) {
    return usedTypes.contains(type.getName())
        || type.getDomain().stream()
            .anyMatch(reference -> termIris.contains(reference.getIri().toString()))
        || type.getRange().stream()
            .anyMatch(reference -> termIris.contains(reference.getIri().toString()));
  }

  private void addRelationshipType(
      final Model model, final RelationshipType type, final List<RelationshipType> allTypes) {
    final Resource property = model.createResource(type.getRdfPredicate().toString());
    property.addProperty(RDF.type, OWL2.ObjectProperty);
    property.addProperty(RDFS.label, type.getDisplayName());
    addLiteral(property, RDFS.comment, type.getDescription());
    addCharacteristics(property, type.getCharacteristics());
    addSemanticReferences(model, property, RDFS.domain, type.getDomain());
    addSemanticReferences(model, property, RDFS.range, type.getRange());
    addTypeReferences(model, property, OWL2.propertyDisjointWith, type.getDisjointWith(), allTypes);
    addInverse(model, property, type.getInverse(), allTypes);
    addPropertyChain(model, property, type.getPropertyChain(), allTypes);
    addDeprecation(model, property, type, allTypes);
  }

  private static void addCharacteristics(
      final Resource property, final Set<RelationshipCharacteristic> characteristics) {
    for (final RelationshipCharacteristic characteristic : characteristics) {
      property.addProperty(RDF.type, characteristicResource(characteristic));
    }
  }

  private static Resource characteristicResource(final RelationshipCharacteristic characteristic) {
    final Resource resource =
        switch (characteristic) {
          case SYMMETRIC -> OWL2.SymmetricProperty;
          case TRANSITIVE -> OWL2.TransitiveProperty;
          case FUNCTIONAL -> OWL2.FunctionalProperty;
          case INVERSE_FUNCTIONAL -> OWL2.InverseFunctionalProperty;
          case REFLEXIVE -> OWL2.ReflexiveProperty;
          case IRREFLEXIVE -> OWL2.IrreflexiveProperty;
          case ASYMMETRIC -> OWL2.AsymmetricProperty;
        };
    return resource;
  }

  private static void addSemanticReferences(
      final Model model,
      final Resource property,
      final Property predicate,
      final Set<SemanticReference> references) {
    references.forEach(
        reference ->
            property.addProperty(predicate, model.createResource(reference.getIri().toString())));
  }

  private static void addTypeReferences(
      final Model model,
      final Resource property,
      final Property predicate,
      final Set<EntityReference> references,
      final List<RelationshipType> allTypes) {
    references.forEach(
        reference ->
            property.addProperty(
                predicate, model.createResource(predicateIri(reference, allTypes))));
  }

  private static void addInverse(
      final Model model,
      final Resource property,
      final EntityReference inverse,
      final List<RelationshipType> allTypes) {
    if (inverse != null) {
      property.addProperty(OWL2.inverseOf, model.createResource(predicateIri(inverse, allTypes)));
    }
  }

  private static void addPropertyChain(
      final Model model,
      final Resource property,
      final List<EntityReference> chain,
      final List<RelationshipType> allTypes) {
    if (!listOrEmpty(chain).isEmpty()) {
      final List<RDFNode> predicates =
          chain.stream()
              .map(reference -> (RDFNode) model.createResource(predicateIri(reference, allTypes)))
              .toList();
      property.addProperty(OWL2.propertyChainAxiom, model.createList(predicates.iterator()));
    }
  }

  private static void addDeprecation(
      final Model model,
      final Resource property,
      final RelationshipType type,
      final List<RelationshipType> allTypes) {
    if (type.getEntityStatus() == EntityStatus.DEPRECATED) {
      property.addLiteral(OWL2.deprecated, true);
    }
    if (type.getReplacedBy() != null) {
      property.addProperty(
          DCTerms.isReplacedBy, model.createResource(predicateIri(type.getReplacedBy(), allTypes)));
    }
  }

  private static String predicateIri(
      final EntityReference reference, final List<RelationshipType> allTypes) {
    return allTypes.stream()
        .filter(type -> type.getId().equals(reference.getId()))
        .findFirst()
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    "Relationship type '" + reference.getId() + "' is not registered"))
        .getRdfPredicate()
        .toString();
  }

  @SuppressWarnings("unchecked")
  private void addAxioms(final Model model, final UUID glossaryId) {
    final EntityRepository<OntologyAxiom> repository =
        (EntityRepository<OntologyAxiom>) Entity.getEntityRepository(Entity.ONTOLOGY_AXIOM);
    final ListFilter filter = new ListFilter(Include.NON_DELETED);
    filter.addQueryParam("glossaryId", glossaryId.toString());
    repository
        .listAll(repository.getFields(""), filter)
        .forEach(axiom -> expressionWriter.write(model, axiom));
  }

  private void mergeAnnex(final Model model, final UUID glossaryId) {
    final OntologyAnnexRow annex = annexDAO.findLatest(glossaryId);
    if (annex != null && !annex.canonicalNQuads().isBlank()) {
      final Model annexModel = parseAnnex(annex.canonicalNQuads());
      try {
        model.add(annexModel);
      } finally {
        annexModel.close();
      }
    }
  }

  private static Model parseAnnex(final String nQuads) {
    final Dataset dataset = DatasetFactory.createTxnMem();
    final Model annex = ModelFactory.createDefaultModel();
    try {
      RDFParser.fromString(nQuads).lang(Lang.NQUADS).parse(dataset.asDatasetGraph());
      annex.add(dataset.getDefaultModel());
      dataset.listNames().forEachRemaining(name -> annex.add(dataset.getNamedModel(name)));
    } finally {
      dataset.close();
    }
    return annex;
  }

  private static String serialize(final Model model, final RdfSerializationFormat format) {
    final StringWriter writer = new StringWriter();
    RDFDataMgr.write(writer, model, format.rdfFormat());
    return writer.toString();
  }

  private static void addLiteral(
      final Resource resource, final Property property, final String value) {
    if (value != null && !value.isBlank()) {
      resource.addProperty(property, value);
    }
  }

  private static String displayName(final Glossary glossary) {
    return glossary.getDisplayName() == null ? glossary.getName() : glossary.getDisplayName();
  }

  private static String displayName(final GlossaryTerm term) {
    return term.getDisplayName() == null ? term.getName() : term.getDisplayName();
  }
}
