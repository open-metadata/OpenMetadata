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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.api.data.CreateGlossaryTerm;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.data.CreateRelationshipType;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.AssetRealization;
import org.openmetadata.schema.type.AssetRealizationRole;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.RelationshipPaletteKey;
import org.openmetadata.schema.type.RelationshipTypeCategory;
import org.openmetadata.schema.type.SemanticReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.OntologyExpressionRdfWriter;

/**
 * Ontology entities written through the REST API reach their own Fuseki graphs: an edit replaces an
 * axiom's graph without leaving restriction or list triples behind, a delete drops it, relationship
 * types carry their property axioms, and a mapped table is discoverable through a subclass chain.
 */
@Tag("rdf")
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@EnabledIfSystemProperty(named = "enableRdf", matches = "true")
public class RdfOntologyProjectionIT {
  private static final String BASE_URI = "https://open-metadata.org/";
  private static final String PREFIXES =
      """
      PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
      PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
      PREFIX owl: <http://www.w3.org/2002/07/owl#>
      PREFIX om: <https://open-metadata.org/ontology/>
      """;
  private static final Duration PROJECTION_WAIT = Duration.ofSeconds(90);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(1);

  @AfterEach
  void cleanup(final TestNamespace namespace) {
    NamespaceCleanup.deleteRoots(namespace.drainTrackedRoots());
  }

  @Test
  void editingAnAxiomReplacesItsGraphAndDeletingItDropsIt(final TestNamespace namespace) {
    final String ex = exampleNamespace(namespace);
    final Glossary glossary = createGlossary(namespace, "axiomGraphs");
    final CreateOntologyAxiom request =
        axiomRequest(
            glossary,
            "contactable",
            ex + "ContactableCustomer",
            union(named(ex + "Customer"), some(ex + "hasContact", named(ex + "EmailAddress"))));
    final OntologyAxiom created = SdkClients.adminClient().ontologyAxioms().create(request);
    final String graph = BASE_URI + "graph/axiom/" + created.getId();
    awaitAsk(true, "ASK { GRAPH <%s> { ?class owl:unionOf ?members } }".formatted(graph));

    final OntologyAxiom edited =
        SdkClients.adminClient()
            .ontologyAxioms()
            .upsert(request.withExpressions(List.of(named(ex + "Customer"))));

    final long expectedTriples = projectedSize(edited);
    awaitAsk(
        true,
        "ASK { { SELECT (COUNT(*) AS ?n) WHERE { GRAPH <%s> { ?s ?p ?o } } } FILTER(?n = %d) }"
            .formatted(graph, expectedTriples));
    awaitAsk(true, "ASK { GRAPH <%s> { ?s rdfs:subClassOf <%sCustomer> } }".formatted(graph, ex));
    assertAsk(false, "ASK { GRAPH <%s> { ?s ?p ?o FILTER(isBlank(?s) || isBlank(?o)) } }", graph);
    assertNotMentioned(ex + "EmailAddress");
    assertNotMentioned(ex + "hasContact");
    assertAsk(
        false,
        "ASK { <%sentity/ontologyAxiom/%s> om:expressions ?json }",
        BASE_URI,
        created.getId());

    SdkClients.adminClient()
        .ontologyAxioms()
        .delete(created.getId().toString(), Map.of("hardDelete", "true"));
    awaitAsk(false, "ASK { GRAPH <%s> { ?s ?p ?o } }".formatted(graph));
  }

  @Test
  void relationshipTypesProjectTheirPropertyAxiomsAndRejectWhatDlCannotExpress(
      final TestNamespace namespace) {
    final String ex = exampleNamespace(namespace);
    final List<RelationshipType> created = new ArrayList<>();
    try {
      final RelationshipType partOf =
          create(
              created,
              typeRequest(namespace.prefix("partOf"), ex + "partOf")
                  .withCharacteristics(Set.of(RelationshipCharacteristic.IRREFLEXIVE))
                  .withDomain(List.of(new SemanticReference().withIri(URI.create(ex + "Part")))));
      final CreateRelationshipType chainRequest =
          typeRequest(namespace.prefix("withinPartOf"), ex + "withinPartOf")
              .withPropertyChain(List.of(partOf.getName(), partOf.getName()));
      final RelationshipType within = create(created, chainRequest);
      final String partOfGraph = BASE_URI + "graph/relationshipType/" + partOf.getId();
      final String withinGraph = BASE_URI + "graph/relationshipType/" + within.getId();
      awaitAsk(
          true,
          "ASK { GRAPH <%s> { <%spartOf> a owl:IrreflexiveProperty ; rdfs:domain <%sPart> } }"
              .formatted(partOfGraph, ex, ex));
      awaitAsk(
          true,
          "ASK { GRAPH <%s> { <%swithinPartOf> owl:propertyChainAxiom ?chain } }"
              .formatted(withinGraph, ex));

      SdkClients.adminClient()
          .relationshipTypes()
          .upsert(
              chainRequest.withPropertyChain(
                  List.of(partOf.getName(), partOf.getName(), partOf.getName())));
      awaitAsk(
          true,
          "ASK { { SELECT (COUNT(?member) AS ?n) WHERE { GRAPH <%s> { ?list rdf:first ?member } } }"
                  .formatted(withinGraph)
              + " FILTER(?n = 3) }");

      assertRejected(
          typeRequest(namespace.prefix("ancestorOf"), ex + "ancestorOf")
              .withCharacteristics(
                  Set.of(
                      RelationshipCharacteristic.TRANSITIVE,
                      RelationshipCharacteristic.IRREFLEXIVE)),
          "not simple");
      assertRejected(
          typeRequest(namespace.prefix("broaderChain"), ex + "broaderChain")
              .withPropertyChain(List.of("broader", partOf.getName())),
          "reserved");
      assertRejected(
          typeRequest(namespace.prefix("disjointWithin"), ex + "disjointWithin")
              .withDisjointWith(Set.of(within.getName())),
          "not simple");
    } finally {
      created
          .reversed()
          .forEach(
              type ->
                  SdkClients.adminClient()
                      .relationshipTypes()
                      .delete(type.getId().toString(), true));
    }
  }

  @Test
  void mappedTableIsFoundThroughTheSubclassChain(final TestNamespace namespace) {
    final String ex = exampleNamespace(namespace);
    final String schema = DatabaseSchemaTestFactory.createSimple(namespace).getFullyQualifiedName();
    final Table retailTable = createTable(namespace, schema, "retail_customers");
    final Table customerTable = createTable(namespace, schema, "customers");
    final Glossary glossary = createGlossary(namespace, "partyBridge");
    final GlossaryTerm party = createTerm(glossary, "Party", ex + "Party", null, null);
    final GlossaryTerm customer =
        createTerm(glossary, "Customer", null, party, realization(customerTable));
    createTerm(glossary, "RetailCustomer", ex + "RetailCustomer", null, realization(retailTable));
    SdkClients.adminClient()
        .ontologyAxioms()
        .create(
            axiomRequest(
                glossary,
                "retailCustomerIsCustomer",
                ex + "RetailCustomer",
                named(BASE_URI + "entity/glossaryTerm/" + customer.getId())));

    final String bridge =
        PREFIXES
            + "SELECT ?asset WHERE { ?c rdfs:subClassOf* <%sParty> . ?c om:mappedTo ?asset }"
                .formatted(ex);
    Awaitility.await("bridge query finds both mapped tables")
        .atMost(PROJECTION_WAIT)
        .pollInterval(POLL_INTERVAL)
        .until(
            () ->
                selectIris(bridge, "asset")
                    .containsAll(
                        List.of(
                            entityIri(Entity.TABLE, retailTable.getId()),
                            entityIri(Entity.TABLE, customerTable.getId()))));
    assertAsk(false, "ASK { ?record owl:sameAs <%sRetailCustomer> }", ex);
  }

  private static String exampleNamespace(final TestNamespace namespace) {
    return "https://example.org/" + namespace.prefix("onto") + "/";
  }

  private static long projectedSize(final OntologyAxiom axiom) {
    final Model model = ModelFactory.createDefaultModel();
    new OntologyExpressionRdfWriter().write(model, axiom);
    return model.size();
  }

  private static void awaitAsk(final boolean expected, final String ask) {
    Awaitility.await(ask)
        .atMost(PROJECTION_WAIT)
        .pollInterval(POLL_INTERVAL)
        .until(() -> RdfTestUtils.executeSparqlAsk(PREFIXES + ask) == expected);
  }

  private static void assertAsk(final boolean expected, final String ask, final Object... args) {
    final String query = PREFIXES + ask.formatted(args);
    assertTrue(RdfTestUtils.executeSparqlAsk(query) == expected, query);
  }

  /** No graph names the IRI as subject or object, so the replaced union left nothing behind. */
  private static void assertNotMentioned(final String iri) {
    assertAsk(false, "ASK { GRAPH ?g { { ?s ?p <%1$s> } UNION { <%1$s> ?p ?o } } }", iri);
  }

  private static List<String> selectIris(final String query, final String variable) {
    final String json = RdfTestUtils.executeSparqlSelect(query);
    final List<String> iris = new ArrayList<>();
    if (json != null) {
      for (final JsonNode row : JsonUtils.readTree(json).path("results").path("bindings")) {
        iris.add(row.path(variable).path("value").asText());
      }
    }
    return iris;
  }

  private static void assertRejected(final CreateRelationshipType request, final String message) {
    final InvalidRequestException rejected =
        assertThrows(
            InvalidRequestException.class,
            () -> SdkClients.adminClient().relationshipTypes().create(request));
    assertTrue(rejected.getMessage().contains(message), rejected.getMessage());
  }

  private static RelationshipType create(
      final List<RelationshipType> created, final CreateRelationshipType request) {
    final RelationshipType type = SdkClients.adminClient().relationshipTypes().create(request);
    created.add(type);
    return type;
  }

  private static CreateRelationshipType typeRequest(final String name, final String predicate) {
    return new CreateRelationshipType()
        .withName(name)
        .withDisplayName(name)
        .withDescription("Ontology projection relationship " + name)
        .withRdfPredicate(URI.create(predicate))
        .withCategory(RelationshipTypeCategory.CUSTOM)
        .withCrossGlossaryAllowed(true)
        .withPaletteKey(RelationshipPaletteKey.VIOLET);
  }

  private static Glossary createGlossary(final TestNamespace namespace, final String name) {
    return namespace.trackRoot(
        Entity.GLOSSARY,
        SdkClients.adminClient()
            .glossaries()
            .create(
                new CreateGlossary()
                    .withName(namespace.prefix(name))
                    .withDescription("Ontology entities projected into their own graphs")));
  }

  private static GlossaryTerm createTerm(
      final Glossary glossary,
      final String name,
      final String iri,
      final GlossaryTerm parent,
      final AssetRealization realization) {
    return SdkClients.adminClient()
        .glossaryTerms()
        .create(
            new CreateGlossaryTerm()
                .withName(name)
                .withDescription(name + " concept")
                .withGlossary(glossary.getFullyQualifiedName())
                .withIri(iri == null ? null : URI.create(iri))
                .withParent(parent == null ? null : parent.getFullyQualifiedName())
                .withRealizedIn(realization == null ? null : List.of(realization)));
  }

  private static CreateOntologyAxiom axiomRequest(
      final Glossary glossary,
      final String name,
      final String subject,
      final OntologyExpression expression) {
    return new CreateOntologyAxiom()
        .withName(name)
        .withDescription("Axiom projected into its own graph")
        .withGlossary(glossary.getFullyQualifiedName())
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(URI.create(subject))
        .withExpressions(List.of(expression))
        .withProvenance(RelationProvenance.MANUAL)
        .withEntityStatus(EntityStatus.DRAFT);
  }

  private static OntologyExpression named(final String iri) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.NAMED_CLASS)
        .withClassIri(URI.create(iri));
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

  private static AssetRealization realization(final Table table) {
    return new AssetRealization()
        .withAsset(table.getEntityReference())
        .withRole(AssetRealizationRole.PRIMARY_STORE);
  }

  private static Table createTable(
      final TestNamespace namespace, final String schemaFqn, final String name) {
    return SdkClients.adminClient()
        .tables()
        .create(
            new CreateTable()
                .withName(namespace.shortPrefix(name))
                .withDatabaseSchema(schemaFqn)
                .withColumns(
                    List.of(ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build())));
  }

  private static String entityIri(final String entityType, final UUID id) {
    return BASE_URI + "entity/" + entityType + "/" + id;
  }
}
