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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Property;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.rdf.model.Statement;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.SKOS;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.AssetRealization;
import org.openmetadata.schema.type.AssetRealizationRole;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyAttributeDataType;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.schema.type.RelationshipCardinality;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.SemanticReference;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.schema.utils.JsonUtils;
import org.semanticweb.owlapi.apibinding.OWLManager;
import org.semanticweb.owlapi.model.IRI;
import org.semanticweb.owlapi.model.OWLAxiom;
import org.semanticweb.owlapi.model.OWLClass;
import org.semanticweb.owlapi.model.OWLDataFactory;
import org.semanticweb.owlapi.model.OWLDataProperty;
import org.semanticweb.owlapi.model.OWLObjectProperty;
import org.semanticweb.owlapi.model.OWLOntology;
import org.semanticweb.owlapi.model.parameters.Imports;
import org.semanticweb.owlapi.vocab.OWL2Datatype;

/**
 * Builds a glossary that uses every seeded relationship type, every attribute datatype, each
 * concept type, mappings, realizations and authored axioms, then reads the projection with OWL API
 * as the reasoner worker does. The whole projection must be OWL 2 DL, and reserved vocabulary must
 * keep its RDFS and SKOS meaning.
 */
class GlossaryOntologyModelBuilderTest {
  private static final URI BASE = URI.create("https://open-metadata.org/");
  private static final String EX = "https://example.org/retail/";
  private static final String OM = "https://open-metadata.org/ontology/";
  private static final OWLDataFactory OWL = OWLManager.getOWLDataFactory();
  private static final List<RelationshipType> SEEDED_TYPES = seededRelationshipTypes();
  private static final UUID EXTERNAL_TERM = UUID.randomUUID();
  private static final String EXTERNAL_IRI = "https://example.org/other/Supplier";

  private final Glossary glossary =
      new Glossary()
          .withId(UUID.randomUUID())
          .withName("Retail")
          .withFullyQualifiedName("Retail")
          .withDescription("Retail concepts");
  private final GlossaryTerm party = term("Party", OntologyConceptType.BOTH, null, null);
  private final GlossaryTerm customer =
      term("Customer", OntologyConceptType.BOTH, URI.create(EX + "Customer"), party);
  private final GlossaryTerm order = term("Order", OntologyConceptType.OWL_CLASS, null, null);
  private final GlossaryTerm retailer =
      term("Retailer", OntologyConceptType.OWL_CLASS, URI.create(EX + "Retailer"), party);
  private final GlossaryTerm finance =
      term("Finance", OntologyConceptType.SKOS_CONCEPT, null, null);
  private final GlossaryTerm revenue =
      term("Revenue", OntologyConceptType.SKOS_CONCEPT, null, finance);
  private final GlossaryTerm legacy = term("Legacy", null, null, null);

  @Test
  void projectsTheGlossaryAsOwl2Dl() {
    withProjection(
        true,
        (model, ontology) -> assertEquals(List.of(), OwlApiProjection.dlViolations(ontology)));
  }

  @Test
  void neverDeclaresReservedVocabularyAsPropertiesWithCharacteristics() {
    withProjection(
        true,
        (model, ontology) -> {
          for (final RelationshipType type : SEEDED_TYPES) {
            final Resource predicate = model.getResource(type.getRdfPredicate().toString());
            if (OwlEntityDeclarations.isBuiltIn(predicate.getURI())) {
              assertFalse(
                  model.listStatements(predicate, null, (RDFNode) null).hasNext(),
                  "built-in " + predicate + " is redefined");
            } else if (OwlEntityDeclarations.isReservedVocabulary(predicate.getURI())) {
              assertEquals(
                  Set.of(OWL2.ObjectProperty),
                  objects(model, predicate, RDF.type),
                  "SKOS " + predicate + " keeps its SKOS kind only");
            }
          }
          assertFalse(model.contains(null, OWL2.inverseOf, RDFS.subClassOf));
          assertTrue(
              objects(model, model.getResource(OM + "superClassOf"), RDF.type)
                  .contains(OWL2.TransitiveProperty));
        });
  }

  @Test
  void readsReservedRelationshipEdgesWithTheirRdfsMeaning() {
    withProjection(
        true,
        (model, ontology) -> {
          final Set<OWLAxiom> axioms = axioms(ontology);
          assertTrue(
              axioms.contains(OWL.getOWLSubClassOfAxiom(owlClass(customer), owlClass(order))));
          assertTrue(
              axioms.contains(
                  OWL.getOWLAnnotationAssertionAxiom(
                      OWL.getRDFSSeeAlso(), classIri(customer), classIri(order))));
          assertTrue(
              axioms.contains(
                  OWL.getOWLSymmetricObjectPropertyAxiom(objectProperty(OM + "relatedTo"))));
          assertTrue(
              axioms.contains(
                  OWL.getOWLInverseObjectPropertiesAxiom(
                      objectProperty(OM + "partOf"), objectProperty(OM + "hasPart"))));
          assertFalse(
              axioms.contains(
                  OWL.getOWLTransitiveObjectPropertyAxiom(objectProperty(SKOS.broader.getURI()))));
        });
  }

  @Test
  void assertsSubclassForHierarchyOnlyBetweenOwlClasses() {
    withProjection(
        true,
        (model, ontology) -> {
          final Set<OWLAxiom> axioms = axioms(ontology);
          assertTrue(
              axioms.contains(OWL.getOWLSubClassOfAxiom(owlClass(customer), owlClass(party))));
          assertTrue(
              axioms.contains(OWL.getOWLSubClassOfAxiom(owlClass(retailer), owlClass(party))));
          assertFalse(
              model.contains(resource(model, revenue), RDFS.subClassOf, resource(model, finance)));
          assertTrue(
              model.contains(resource(model, revenue), SKOS.broader, resource(model, finance)));
          assertFalse(ontology.isDeclared(owlClass(revenue), Imports.EXCLUDED));
        });
  }

  @Test
  void namesClassesByAuthoredIriElseEntityIri() {
    withProjection(
        true,
        (model, ontology) -> {
          assertEquals(EX + "Customer", GlossaryTermClassIri.of(customer, BASE));
          assertEquals(
              BASE + "entity/glossaryTerm/" + party.getId(), GlossaryTermClassIri.of(party, BASE));
          assertTrue(ontology.isDeclared(owlClass(customer), Imports.EXCLUDED));
          assertTrue(ontology.isDeclared(owlClass(party), Imports.EXCLUDED));
          assertFalse(
              model.containsResource(
                  model.getResource(BASE + "entity/glossaryTerm/" + customer.getId())));
          assertFalse(model.contains(null, OWL2.sameAs, resource(model, party)));
        });
  }

  @Test
  void mapsAttributesIntoTheOwl2DatatypeMap() {
    withProjection(
        true,
        (model, ontology) -> {
          final Set<OWLAxiom> axioms = axioms(ontology);
          assertTrue(
              axioms.contains(
                  OWL.getOWLDataPropertyRangeAxiom(
                      attribute("joinedOn"), OWL2Datatype.XSD_DATE_TIME.getDatatype(OWL))));
          assertTrue(
              axioms.contains(OWL.getOWLFunctionalDataPropertyAxiom(attribute("customerCode"))));
          assertTrue(
              axioms.contains(
                  OWL.getOWLSubClassOfAxiom(
                      owlClass(customer),
                      OWL.getOWLDataExactCardinality(1, attribute("customerCode")))));
        });
  }

  @Test
  void omitsPropertyAxiomsThatWouldRedefineReservedVocabulary() {
    final RelationshipType chainedThroughSubclass =
        customType("refines", EX + "refines")
            .withPropertyChain(List.of(reference("subClassOf"), reference("partOf")))
            .withDisjointWith(Set.of(reference("seeAlso")));
    final GlossaryOntologySource source = source(true, List.of(chainedThroughSubclass));
    withProjection(
        source,
        true,
        (model, ontology) -> {
          final Resource refines = model.getResource(EX + "refines");
          assertFalse(model.contains(refines, OWL2.propertyChainAxiom));
          assertFalse(model.contains(refines, OWL2.propertyDisjointWith));
          assertEquals(List.of(), OwlApiProjection.dlViolations(ontology));
        });
  }

  @Test
  void owlApiGateRejectsReservedVocabularyDeclaredAsTransitive() {
    final Model model = ModelFactory.createDefaultModel();
    try {
      final Resource subClassOf = model.getResource(RDFS.subClassOf.getURI());
      subClassOf.addProperty(RDF.type, OWL2.ObjectProperty);
      subClassOf.addProperty(RDF.type, OWL2.TransitiveProperty);

      final AssertionError rejection =
          assertThrows(AssertionError.class, () -> rejectUnlessDl(model));

      assertTrue(rejection.getMessage() != null, "the gate must report why");
    } finally {
      model.close();
    }
  }

  @Test
  void keepsTheExportShapeWithoutRelations() {
    withProjection(
        false,
        (model, ontology) -> {
          assertFalse(model.contains(null, SKOS.broader));
          assertFalse(model.contains(null, RDFS.subClassOf, resource(model, party)));
          assertEquals(List.of(), OwlApiProjection.dlViolations(ontology));
        });
  }

  private static void rejectUnlessDl(final Model model) {
    final List<String> violations = OwlApiProjection.dlViolations(OwlApiProjection.parse(model));
    if (!violations.isEmpty()) {
      throw new AssertionError(String.join("\n", violations));
    }
  }

  private void withProjection(final boolean includeRelations, final ProjectionCheck check) {
    withProjection(source(includeRelations, List.of()), includeRelations, check);
  }

  private void withProjection(
      final GlossaryOntologySource source,
      final boolean includeRelations,
      final ProjectionCheck check) {
    final Model model = new GlossaryOntologyModelBuilder(BASE).build(source, includeRelations);
    try {
      check.accept(model, OwlApiProjection.parse(model));
    } finally {
      model.close();
    }
  }

  @FunctionalInterface
  private interface ProjectionCheck {
    void accept(Model model, OWLOntology ontology);
  }

  private GlossaryOntologySource source(
      final boolean includeRelations, final List<RelationshipType> extraTypes) {
    customer
        .withAttributes(customerAttributes())
        .withConceptMappings(
            List.of(
                new ConceptMapping()
                    .withConceptIri(URI.create("https://schema.org/Person"))
                    .withMappingType(ConceptMapping.ConceptMappingType.CLOSE_MATCH)))
        .withRealizedIn(
            List.of(
                realization("table", AssetRealizationRole.PRIMARY_STORE),
                realization("table", AssetRealizationRole.DERIVED)))
        .withSynonyms(List.of("Client"));
    if (includeRelations) {
      addSeededRelations();
    }
    final List<RelationshipType> types = new ArrayList<>(SEEDED_TYPES);
    types.add(customType("competesWith", EX + "competesWith"));
    types.addAll(extraTypes);
    return new GlossaryOntologySource(
        glossary,
        List.of(party, customer, order, retailer, finance, revenue, legacy),
        List.of(customerCodeAxiom()),
        types,
        Map.of(EXTERNAL_TERM, EXTERNAL_IRI));
  }

  /** Each seeded type once, stored with its inverse edge as the repository stores it. */
  private void addSeededRelations() {
    relate(customer, "subClassOf", order);
    relate(order, "superClassOf", customer);
    relate(customer, "seeAlso", order);
    relate(order, "seeAlso", customer);
    relate(customer, "relatedTo", order);
    relate(order, "relatedTo", customer);
    relate(customer, "synonym", party);
    relate(party, "synonym", customer);
    relate(customer, "antonym", retailer);
    relate(retailer, "antonym", customer);
    relate(revenue, "broader", finance);
    relate(finance, "narrower", revenue);
    relate(order, "partOf", customer);
    relate(customer, "hasPart", order);
    relate(revenue, "calculatedFrom", order);
    relate(order, "usedToCalculate", revenue);
    relate(retailer, "competesWith", customer);
    customer.getRelatedTerms().add(relation("relatedTo", EXTERNAL_TERM));
  }

  private static void relate(
      final GlossaryTerm source, final String type, final GlossaryTerm target) {
    source.getRelatedTerms().add(relation(type, target.getId()));
  }

  private static TermRelation relation(final String type, final UUID target) {
    return new TermRelation()
        .withRelationType(type)
        .withTerm(new EntityReference().withId(target).withType("glossaryTerm"));
  }

  private GlossaryTerm term(
      final String name,
      final OntologyConceptType conceptType,
      final URI iri,
      final GlossaryTerm parent) {
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("Retail." + name)
        .withDescription(name + " concept")
        .withConceptType(conceptType)
        .withIri(iri)
        .withEntityStatus("Legacy".equals(name) ? EntityStatus.DEPRECATED : EntityStatus.APPROVED)
        .withRelatedTerms(new ArrayList<>())
        .withParent(
            parent == null
                ? null
                : new EntityReference().withId(parent.getId()).withType("glossaryTerm"));
  }

  private static List<OntologyAttribute> customerAttributes() {
    return Arrays.stream(OntologyAttributeDataType.values())
        .map(
            dataType ->
                new OntologyAttribute()
                    .withId(UUID.randomUUID())
                    .withName(attributeName(dataType))
                    .withDataType(dataType)
                    .withIsIdentifier(dataType == OntologyAttributeDataType.STRING)
                    .withDescription(dataType + " attribute"))
        .toList();
  }

  private static String attributeName(final OntologyAttributeDataType dataType) {
    return switch (dataType) {
      case STRING -> "customerCode";
      case INTEGER -> "loyaltyPoints";
      case DECIMAL -> "balance";
      case BOOLEAN -> "active";
      case DATE -> "joinedOn";
      case ENUM -> "tier";
    };
  }

  private static OWLDataProperty attribute(final String name) {
    return OWL.getOWLDataProperty(IRI.create(EX + "Customer/property/" + name));
  }

  private OntologyAxiom customerCodeAxiom() {
    final OntologyExpression exactlyOneCode =
        new OntologyExpression()
            .withKind(OntologyExpressionKind.RESTRICTION)
            .withPropertyIri(URI.create(attribute("customerCode").getIRI().toString()))
            .withRestrictionKind(OntologyRestrictionKind.EXACT)
            .withCardinality(1);
    return new OntologyAxiom()
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(customer.getIri())
        .withExpressions(List.of(exactlyOneCode));
  }

  private static AssetRealization realization(final String type, final AssetRealizationRole role) {
    return new AssetRealization()
        .withRole(role)
        .withAsset(new EntityReference().withId(UUID.randomUUID()).withType(type));
  }

  private RelationshipType customType(final String name, final String predicate) {
    return new RelationshipType()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(name)
        .withDisplayName(name)
        .withRdfPredicate(URI.create(predicate))
        .withCharacteristics(Set.of(RelationshipCharacteristic.ASYMMETRIC))
        .withCardinality(new RelationshipCardinality())
        .withDomain(Set.of(new SemanticReference().withIri(URI.create(EX + "Retailer"))))
        .withRange(Set.of(new SemanticReference().withIri(URI.create(EX + "Customer"))))
        .withDisjointWith(Set.of(reference("antonym")));
  }

  private static EntityReference reference(final String name) {
    final RelationshipType type =
        SEEDED_TYPES.stream().filter(seed -> seed.getName().equals(name)).findFirst().orElseThrow();
    return new EntityReference()
        .withId(type.getId())
        .withName(name)
        .withFullyQualifiedName(name)
        .withType("relationshipType");
  }

  private static List<RelationshipType> seededRelationshipTypes() {
    try (InputStream input =
        GlossaryOntologyModelBuilderTest.class
            .getClassLoader()
            .getResourceAsStream("json/data/ontology/relationshipTypes.json")) {
      final String json = new String(input.readAllBytes(), StandardCharsets.UTF_8);
      return List.of(JsonUtils.readValue(json, RelationshipType[].class));
    } catch (IOException exception) {
      throw new IllegalStateException("Seeded relationship types are unreadable", exception);
    }
  }

  private static Set<OWLAxiom> axioms(final OWLOntology ontology) {
    return ontology.axioms().collect(Collectors.toSet());
  }

  private static Set<RDFNode> objects(
      final Model model, final Resource subject, final Property predicate) {
    final Set<RDFNode> objects = new HashSet<>();
    model
        .listStatements(subject, predicate, (RDFNode) null)
        .mapWith(Statement::getObject)
        .forEachRemaining(objects::add);
    return objects;
  }

  private static Resource resource(final Model model, final GlossaryTerm term) {
    return model.getResource(GlossaryTermClassIri.of(term, BASE));
  }

  private static IRI classIri(final GlossaryTerm term) {
    return IRI.create(GlossaryTermClassIri.of(term, BASE));
  }

  private static OWLClass owlClass(final GlossaryTerm term) {
    return OWL.getOWLClass(classIri(term));
  }

  private static OWLObjectProperty objectProperty(final String iri) {
    return OWL.getOWLObjectProperty(IRI.create(iri));
  }
}
