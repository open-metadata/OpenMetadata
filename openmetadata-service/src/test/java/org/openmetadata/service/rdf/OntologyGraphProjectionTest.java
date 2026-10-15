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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QueryExecutionFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.update.UpdateAction;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.AssetRealization;
import org.openmetadata.schema.type.AssetRealizationRole;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyAttribute;
import org.openmetadata.schema.type.OntologyAttributeDataType;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.SemanticReference;
import org.openmetadata.service.Entity;
import org.semanticweb.owlapi.apibinding.OWLManager;
import org.semanticweb.owlapi.model.AxiomType;
import org.semanticweb.owlapi.model.IRI;
import org.semanticweb.owlapi.model.OWLClass;
import org.semanticweb.owlapi.model.OWLDataFactory;
import org.semanticweb.owlapi.model.OWLDataMinCardinality;
import org.semanticweb.owlapi.model.OWLDataProperty;
import org.semanticweb.owlapi.model.OWLObjectProperty;
import org.semanticweb.owlapi.model.OWLOntology;
import org.semanticweb.owlapi.vocab.OWL2Datatype;

/**
 * Projects ontology entities into the graphs they own, replaces them the way the live writer does,
 * and reads the result with OWL API as the reasoner worker does.
 */
class OntologyGraphProjectionTest {
  private static final String BASE = "https://open-metadata.org/";
  private static final String EX = "https://example.org/retail/";
  private static final String OM = "https://open-metadata.org/ontology/";
  private static final long MAX_UPDATE_BYTES = 4_194_304;
  private static final OWLDataFactory OWL = OWLManager.getOWLDataFactory();
  private static final EntityReference GLOSSARY =
      new EntityReference().withId(UUID.randomUUID()).withType(Entity.GLOSSARY).withName("Retail");

  private final FakeSources sources = new FakeSources();
  private final OntologyGraphProjection projection =
      new OntologyGraphProjection(URI.create(BASE), sources);
  private final Dataset dataset = DatasetFactory.create();

  @AfterEach
  void close() {
    dataset.close();
  }

  @Test
  void axiomGraphIsTheAxiomInTheOwl2MappingAndReadsAttributesAsDataProperties() {
    final GlossaryTerm customer =
        sources.add(term("Customer", OntologyConceptType.BOTH, null, null));
    customer.setAttributes(List.of(attribute("email", OntologyAttributeDataType.STRING)));
    final String email = BASE + "entity/glossaryTerm/" + customer.getId() + "/property/email";
    final OntologyAxiom axiom =
        axiom(
            URI.create(EX + "ContactableCustomer"),
            intersection(named(classIri(customer)), unqualified(email, 1)));

    final OWLOntology ontology = OwlApiProjection.parse(graph(axiom));

    assertEquals(List.of(), OwlApiProjection.dlViolations(ontology));
    assertEquals(1, ontology.getAxiomCount(AxiomType.SUBCLASS_OF));
    assertTrue(
        ontology
            .axioms(AxiomType.SUBCLASS_OF)
            .flatMap(subclass -> subclass.nestedClassExpressions())
            .anyMatch(OWLDataMinCardinality.class::isInstance),
        "a cardinality on a term attribute is a data restriction");
  }

  @Test
  void editingAnAxiomReplacesItsGraphWithoutOrphanedBlankNodesOrLists() {
    final OntologyAxiom axiom =
        axiom(
            URI.create(EX + "RetailCustomer"),
            union(named(EX + "Customer"), some(EX + "hasContact", named(EX + "EmailAddress"))));
    replace(projection.replacements(List.of(axiom)));
    final String graph = axiomGraph(axiom);
    assertTrue(blankNodes(dataset.getNamedModel(graph)) > 0, "the union and restriction");

    axiom.setExpressions(List.of(named(EX + "Customer")));
    replace(projection.replacements(List.of(axiom)));

    final Model replaced = dataset.getNamedModel(graph);
    assertTrue(replaced.isIsomorphicWith(graph(axiom)), "the graph is exactly the edited axiom");
    assertEquals(0, blankNodes(replaced));
    assertFalse(replaced.contains(null, RDF.first));
    assertFalse(replaced.contains(null, null, replaced.createResource(EX + "EmailAddress")));
  }

  @Test
  void deletingAnAxiomDropsItsGraph() {
    final OntologyAxiom axiom =
        axiom(URI.create(EX + "RetailCustomer"), some(EX + "hasContact", named(EX + "Email")));
    replace(projection.replacements(List.of(axiom)));
    assertTrue(graphNames().contains(axiomGraph(axiom)));

    replace(projection.replacements(List.of(axiom.withDeleted(true))));
    assertFalse(graphNames().contains(axiomGraph(axiom)));

    axiom.setDeleted(false);
    replace(projection.replacements(List.of(axiom)));
    UpdateAction.parseExecute(
        RdfRepository.buildOntologyGraphDeleteUpdate(BASE, Entity.ONTOLOGY_AXIOM, axiom.getId()),
        dataset);
    assertFalse(graphNames().contains(axiomGraph(axiom)), "a hard delete drops the graph too");
  }

  @Test
  void relationshipTypeGraphsCarryEveryPropertyAxiom() {
    final Family family = new Family();
    sources.types.addAll(family.all());

    final OWLOntology ontology = OwlApiProjection.parse(union(projection.graphs(family.all())));

    assertEquals(List.of(), OwlApiProjection.dlViolations(ontology));
    final OWLObjectProperty parentOf = objectProperty("parentOf");
    final OWLClass person = OWL.getOWLClass(IRI.create(EX + "Person"));
    assertTrue(ontology.containsAxiom(OWL.getOWLObjectPropertyDomainAxiom(parentOf, person)));
    assertTrue(ontology.containsAxiom(OWL.getOWLObjectPropertyRangeAxiom(parentOf, person)));
    assertTrue(ontology.containsAxiom(OWL.getOWLIrreflexiveObjectPropertyAxiom(parentOf)));
    assertTrue(ontology.containsAxiom(OWL.getOWLAsymmetricObjectPropertyAxiom(parentOf)));
    assertTrue(
        ontology.containsAxiom(
            OWL.getOWLInverseObjectPropertiesAxiom(parentOf, objectProperty("childOf"))));
    assertTrue(
        ontology.containsAxiom(
            OWL.getOWLDisjointObjectPropertiesAxiom(parentOf, objectProperty("siblingOf"))));
    assertTrue(
        ontology.containsAxiom(
            OWL.getOWLSymmetricObjectPropertyAxiom(objectProperty("siblingOf"))));
    assertTrue(
        ontology.containsAxiom(
            OWL.getOWLSubPropertyChainOfAxiom(
                List.of(parentOf, parentOf), objectProperty("grandparentOf"))));
  }

  @Test
  void aChangedTypeReplacesTheGraphsOfTypesThatNameIt() {
    final Family family = new Family();
    sources.types.addAll(family.all());

    final Set<String> replaced = projection.graphs(List.of(family.parentOf)).keySet();

    assertEquals(
        Set.of(
            typeGraph(family.parentOf), typeGraph(family.childOf), typeGraph(family.grandparentOf)),
        replaced);
  }

  @Test
  void termGraphAssertsSubclassOnlyBetweenOwlClasses() {
    final GlossaryTerm party = sources.add(term("Party", OntologyConceptType.BOTH, null, null));
    final GlossaryTerm customer =
        sources.add(term("Customer", OntologyConceptType.BOTH, null, party));
    final GlossaryTerm thesaurusParent =
        sources.add(term("Topic", OntologyConceptType.SKOS_CONCEPT, null, null));
    final GlossaryTerm underThesaurus =
        sources.add(term("Subtopic", OntologyConceptType.BOTH, null, thesaurusParent));
    final GlossaryTerm skosChild =
        sources.add(term("Narrower", OntologyConceptType.SKOS_CONCEPT, null, party));

    final Map<String, Model> graphs =
        projection.graphs(List.of(customer, underThesaurus, skosChild));

    final Model customerGraph = graphs.get(termGraph(customer));
    assertTrue(
        customerGraph.contains(
            customerGraph.createResource(classIri(customer)),
            RDFS.subClassOf,
            customerGraph.createResource(classIri(party))));
    assertFalse(graphs.get(termGraph(underThesaurus)).contains(null, RDFS.subClassOf));
    assertTrue(graphs.get(termGraph(skosChild)).isEmpty(), "a SKOS concept has no class view");
    assertEquals(List.of(), OwlApiProjection.dlViolations(OwlApiProjection.parse(union(graphs))));
  }

  @Test
  void attributeDatatypesRoundTripAndSkosConceptAttributesHaveNoDomain() {
    final GlossaryTerm customer =
        sources.add(term("Customer", OntologyConceptType.BOTH, URI.create(EX + "Customer"), null));
    final List<OntologyAttribute> attributes = new ArrayList<>();
    for (final OntologyAttributeDataType dataType : OntologyAttributeDataType.values()) {
      attributes.add(attribute(dataType.value().toLowerCase(), dataType));
    }
    customer.setAttributes(attributes);
    final GlossaryTerm topic =
        sources.add(
            term("Topic", OntologyConceptType.SKOS_CONCEPT, URI.create(EX + "Topic"), null));
    topic.setAttributes(List.of(attribute("weight", OntologyAttributeDataType.DECIMAL)));
    final OntologyAxiom assertion =
        new OntologyAxiom()
            .withId(UUID.randomUUID())
            .withName("customerBalance")
            .withGlossary(GLOSSARY)
            .withAxiomType(OntologyAxiomType.DATA_PROPERTY_ASSERTION)
            .withSubjectIri(URI.create(EX + "alice"))
            .withPropertyIri(URI.create(EX + "Customer/property/decimal"))
            .withLiteral(
                new OntologyLiteral()
                    .withValue("12.50")
                    .withDatatypeIri(URI.create(OWL2Datatype.XSD_DECIMAL.getIRI().toString())));

    final OWLOntology ontology =
        OwlApiProjection.parse(union(projection.graphs(List.of(customer, topic, assertion))));

    assertEquals(List.of(), OwlApiProjection.dlViolations(ontology));
    assertRange(ontology, "Customer/property/string", OWL2Datatype.XSD_STRING);
    assertRange(ontology, "Customer/property/integer", OWL2Datatype.XSD_INTEGER);
    assertRange(ontology, "Customer/property/decimal", OWL2Datatype.XSD_DECIMAL);
    assertRange(ontology, "Customer/property/boolean", OWL2Datatype.XSD_BOOLEAN);
    assertRange(ontology, "Customer/property/date", OWL2Datatype.XSD_DATE_TIME);
    assertRange(ontology, "Topic/property/weight", OWL2Datatype.XSD_DECIMAL);
    assertEquals(
        0, ontology.dataPropertyDomainAxioms(dataProperty("Topic/property/weight")).count());
    assertTrue(
        ontology.containsAxiom(
            OWL.getOWLDataPropertyAssertionAxiom(
                dataProperty("Customer/property/decimal"),
                OWL.getOWLNamedIndividual(IRI.create(EX + "alice")),
                OWL.getOWLLiteral("12.50", OWL2Datatype.XSD_DECIMAL))));
  }

  @Test
  void mappedTableIsFoundThroughASubclassChain() {
    final String table = BASE + "entity/table/" + UUID.randomUUID();
    final GlossaryTerm party =
        sources.add(term("Party", OntologyConceptType.BOTH, URI.create(EX + "Party"), null));
    final GlossaryTerm customer =
        sources.add(term("Customer", OntologyConceptType.BOTH, null, party));
    final GlossaryTerm retailCustomer =
        sources.add(
            term(
                "RetailCustomer",
                OntologyConceptType.BOTH,
                URI.create(EX + "RetailCustomer"),
                null));
    retailCustomer.setRealizedIn(List.of(realization(table)));
    final OntologyAxiom subclass =
        axiom(URI.create(EX + "RetailCustomer"), named(classIri(customer)));

    replace(projection.replacements(List.of(party, customer, retailCustomer, subclass)));

    final String bridge =
        """
        PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
        PREFIX om: <https://open-metadata.org/ontology/>
        SELECT ?asset WHERE { ?c rdfs:subClassOf* <%s> . ?c om:mappedTo ?asset }
        """
            .formatted(EX + "Party");
    final Model union = ModelFactory.createModelForGraph(dataset.asDatasetGraph().getUnionGraph());
    try (QueryExecution execution = QueryExecutionFactory.create(bridge, union)) {
      final List<String> assets = new ArrayList<>();
      execution.execSelect().forEachRemaining(row -> assets.add(row.getResource("asset").getURI()));
      assertEquals(List.of(table), assets);
    }
    assertFalse(
        union.contains(null, union.createProperty("http://www.w3.org/2002/07/owl#sameAs")),
        "classes and records are never joined with owl:sameAs");

    UpdateAction.parseExecute(
        RdfRepository.buildOntologyGraphDeleteUpdate(BASE, Entity.TABLE, idOf(table)), dataset);
    assertFalse(
        dataset
            .getNamedModel(termGraph(retailCustomer))
            .contains(null, null, union.createResource(table)),
        "deleting the asset removes its copies on class IRIs");
  }

  @Test
  void writesNoMappingCopyWhenTheClassIriIsTheEntityIri() {
    final GlossaryTerm customer =
        sources.add(term("Customer", OntologyConceptType.BOTH, null, null));
    customer.setRealizedIn(List.of(realization(BASE + "entity/table/" + UUID.randomUUID())));

    final Model graph = projection.graphs(List.of(customer)).get(termGraph(customer));

    assertFalse(graph.contains(null, graph.createProperty(OM + "mappedTo")));
  }

  private Model graph(final OntologyAxiom axiom) {
    return projection.graphs(List.of(axiom)).get(axiomGraph(axiom));
  }

  private void replace(final Map<String, OntologyGraphs.Replacement> graphs) {
    OntologyGraphs.replaceUpdates(BASE, graphs, MAX_UPDATE_BYTES)
        .forEach(update -> UpdateAction.parseExecute(update, dataset));
  }

  private Set<String> graphNames() {
    final Set<String> names = new HashSet<>();
    dataset.listNames().forEachRemaining(names::add);
    return names;
  }

  private static Model union(final Map<String, Model> graphs) {
    final Model union = ModelFactory.createDefaultModel();
    graphs.values().forEach(union::add);
    return union;
  }

  private static long blankNodes(final Model model) {
    return model.listStatements().toList().stream()
        .filter(statement -> statement.getSubject().isAnon() || statement.getObject().isAnon())
        .count();
  }

  private static void assertRange(
      final OWLOntology ontology, final String attribute, final OWL2Datatype datatype) {
    assertTrue(
        ontology.containsAxiom(
            OWL.getOWLDataPropertyRangeAxiom(dataProperty(attribute), datatype.getDatatype(OWL))),
        attribute + " ranges over " + datatype);
  }

  private static OWLDataProperty dataProperty(final String localName) {
    return OWL.getOWLDataProperty(IRI.create(EX + localName));
  }

  private static OWLObjectProperty objectProperty(final String localName) {
    return OWL.getOWLObjectProperty(IRI.create(EX + localName));
  }

  private static String axiomGraph(final OntologyAxiom axiom) {
    return BASE + "graph/axiom/" + axiom.getId();
  }

  private static String typeGraph(final RelationshipType type) {
    return BASE + "graph/relationshipType/" + type.getId();
  }

  private static String termGraph(final GlossaryTerm term) {
    return BASE + "graph/glossaryTerm/" + term.getId();
  }

  private static String classIri(final GlossaryTerm term) {
    return GlossaryTermClassIri.of(term, URI.create(BASE));
  }

  private static UUID idOf(final String entityIri) {
    return UUID.fromString(entityIri.substring(entityIri.lastIndexOf('/') + 1));
  }

  private static GlossaryTerm term(
      final String name,
      final OntologyConceptType conceptType,
      final URI iri,
      final GlossaryTerm parent) {
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("Retail." + name)
        .withGlossary(GLOSSARY)
        .withConceptType(conceptType)
        .withIri(iri)
        .withParent(
            parent == null
                ? null
                : new EntityReference().withId(parent.getId()).withType(Entity.GLOSSARY_TERM));
  }

  private static OntologyAttribute attribute(
      final String name, final OntologyAttributeDataType dataType) {
    return new OntologyAttribute().withId(UUID.randomUUID()).withName(name).withDataType(dataType);
  }

  private static AssetRealization realization(final String tableIri) {
    return new AssetRealization()
        .withRole(AssetRealizationRole.PRIMARY_STORE)
        .withAsset(new EntityReference().withId(idOf(tableIri)).withType(Entity.TABLE));
  }

  private static OntologyAxiom axiom(final URI subject, final OntologyExpression expression) {
    return new OntologyAxiom()
        .withId(UUID.randomUUID())
        .withName("axiom" + UUID.randomUUID().toString().substring(0, 8))
        .withGlossary(GLOSSARY)
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(subject)
        .withExpressions(List.of(expression));
  }

  private static OntologyExpression named(final String classIri) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.NAMED_CLASS)
        .withClassIri(URI.create(classIri));
  }

  private static OntologyExpression intersection(final OntologyExpression... operands) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.INTERSECTION)
        .withOperands(List.of(operands));
  }

  private static OntologyExpression union(final OntologyExpression... operands) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.UNION)
        .withOperands(List.of(operands));
  }

  private static OntologyExpression some(final String property, final OntologyExpression filler) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.RESTRICTION)
        .withPropertyIri(URI.create(property))
        .withRestrictionKind(OntologyRestrictionKind.SOME)
        .withFiller(filler);
  }

  private static OntologyExpression unqualified(final String property, final int cardinality) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.RESTRICTION)
        .withPropertyIri(URI.create(property))
        .withRestrictionKind(OntologyRestrictionKind.MIN)
        .withCardinality(cardinality);
  }

  /** Four types that use every relationship-type axiom the projection writes. */
  private static final class Family {
    private final RelationshipType parentOf = type("parentOf");
    private final RelationshipType childOf = type("childOf");
    private final RelationshipType siblingOf = type("siblingOf");
    private final RelationshipType grandparentOf = type("grandparentOf");

    private Family() {
      final Set<SemanticReference> person =
          Set.of(new SemanticReference().withIri(URI.create(EX + "Person")));
      parentOf
          .withCharacteristics(
              Set.of(RelationshipCharacteristic.IRREFLEXIVE, RelationshipCharacteristic.ASYMMETRIC))
          .withDomain(person)
          .withRange(person)
          .withInverse(reference(childOf))
          .withDisjointWith(Set.of(reference(siblingOf)));
      childOf.withInverse(reference(parentOf));
      siblingOf
          .withCharacteristics(Set.of(RelationshipCharacteristic.SYMMETRIC))
          .withInverse(reference(siblingOf));
      grandparentOf.withPropertyChain(List.of(reference(parentOf), reference(parentOf)));
    }

    private List<RelationshipType> all() {
      return List.of(parentOf, childOf, siblingOf, grandparentOf);
    }

    private static RelationshipType type(final String name) {
      return new RelationshipType()
          .withId(UUID.randomUUID())
          .withName(name)
          .withFullyQualifiedName(name)
          .withDisplayName(name)
          .withRdfPredicate(URI.create(EX + name))
          .withCharacteristics(Set.of())
          .withDomain(Set.of())
          .withRange(Set.of())
          .withPropertyChain(List.of())
          .withDisjointWith(Set.of());
    }

    private static EntityReference reference(final RelationshipType type) {
      return new EntityReference()
          .withId(type.getId())
          .withType(Entity.RELATIONSHIP_TYPE)
          .withName(type.getName())
          .withFullyQualifiedName(type.getFullyQualifiedName());
    }
  }

  private static final class FakeSources implements OntologyGraphProjection.Sources {
    private final List<RelationshipType> types = new ArrayList<>();
    private final Map<UUID, GlossaryTerm> terms = new HashMap<>();

    private GlossaryTerm add(final GlossaryTerm term) {
      terms.put(term.getId(), term);
      return term;
    }

    @Override
    public List<RelationshipType> relationshipTypes() {
      return List.copyOf(types);
    }

    @Override
    public Optional<GlossaryTerm> glossaryTerm(final UUID termId) {
      return Optional.ofNullable(terms.get(termId));
    }

    @Override
    public List<GlossaryTerm> glossaryTerms(final EntityReference glossary) {
      return terms.values().stream()
          .filter(term -> glossary.getId().equals(term.getGlossary().getId()))
          .toList();
    }
  }
}
