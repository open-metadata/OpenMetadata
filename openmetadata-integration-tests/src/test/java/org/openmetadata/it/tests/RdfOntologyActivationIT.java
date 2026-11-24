package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.OntologyActiveGraph;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.RdfUpdater;

@Tag("rdf")
@EnabledIfSystemProperty(named = "enableRdf", matches = "true")
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class RdfOntologyActivationIT extends BaseOntologyApprovalIT {
  @AfterEach
  void restoreRdf() {
    RdfTestUtils.restoreSuiteRdf();
  }

  @Test
  void activationRollbackAndArchiveSurviveRebuildingTheServingDataset(TestNamespace ns) {
    final var ontology = createOntology(ns);
    final var customer = declareClass(ontology, "Customer", URI.create("urn:Customer"));
    final var party = declareClass(ontology, "Party", URI.create("urn:Party"));
    final var legal = declareClass(ontology, "LegalEntity", URI.create("urn:LegalEntity"));
    final var client = SdkClients.adminClient();
    final var axiom =
        client
            .ontologyAxioms()
            .create(
                new CreateOntologyAxiom()
                    .withName("Parents")
                    .withDisplayName("Parents")
                    .withDescription("A named class hierarchy")
                    .withOntology(ontology.getFullyQualifiedName())
                    .withSubjectIri(customer.getIri())
                    .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
                    .withProvenance(RelationProvenance.MANUAL)
                    .withExpressions(List.of(named(party.getIri()))));
    final var first = approve(ns, capture(ontology));
    assertFalse(ask(ontology, "?s ?p ?o"));
    activate(ontology, first, 0);
    await(
        ontology,
        "<urn:Customer> <http://www.w3.org/2000/01/rdf-schema#subClassOf> <urn:Party>",
        true);
    assertTrue(
        ask(
            ontology,
            "?s <http://www.w3.org/2002/07/owl#versionIRI> <" + first.getVersionIri() + ">"));
    client
        .ontologyAxioms()
        .update(axiom.getId(), axiom.withExpressions(List.of(named(legal.getIri()))));
    assertTrue(
        ask(
            ontology,
            "<urn:Customer> <http://www.w3.org/2000/01/rdf-schema#subClassOf> <urn:Party>"));
    assertFalse(
        ask(
            ontology,
            "<urn:Customer> <http://www.w3.org/2000/01/rdf-schema#subClassOf> <urn:LegalEntity>"));
    final var repository = RdfRepository.getInstance();
    final var build = repository.beginBlueGreenRebuild();
    try {
      final var target = repository.forRun(build.dataset(), build.id(), 0);
      target.clearAll();
      copyServingGraphs(repository, target);
      target.reloadOntologies();
      target.rebuildOntologyGraphs();
      final var second = approve(ns, capture(ontology));
      activate(ontology, second, 1);
      await(
          ontology,
          "<urn:Customer> <http://www.w3.org/2000/01/rdf-schema#subClassOf> <urn:LegalEntity>",
          true);
      repository.activateDataset(build.dataset(), build.id(), "admin");
      assertTrue(
          ask(
              ontology,
              "<urn:Customer> <http://www.w3.org/2000/01/rdf-schema#subClassOf> <urn:LegalEntity>"));
      assertFalse(
          ask(
              ontology,
              "<urn:Customer> <http://www.w3.org/2000/01/rdf-schema#subClassOf> <urn:Party>"));
    } catch (RuntimeException | AssertionError failure) {
      repository.abandonBuild(build);
      throw failure;
    }
    activate(ontology, first, 2);
    await(
        ontology,
        "<urn:Customer> <http://www.w3.org/2000/01/rdf-schema#subClassOf> <urn:Party>",
        true);
    client.ontologies().delete(ontology.getId().toString(), Map.of("recursive", "true"));
    await(ontology, "?s ?p ?o", false);
    client.ontologies().restore(ontology.getId());
    await(
        ontology,
        "<urn:Customer> <http://www.w3.org/2000/01/rdf-schema#subClassOf> <urn:Party>",
        true);
    // The promotion outlives this class; later classes that query the store directly must read
    // the promoted dataset, not the stale configured one.
    assertTrue(
        RdfTestUtils.executeSparqlAsk(
            activeGraphAsk(
                ontology,
                "<urn:Customer> <http://www.w3.org/2000/01/rdf-schema#subClassOf> <urn:Party>")));
  }

  @Test
  void rdfDisabledActivationIsProjectedWhenTheGraphIsRebuilt(TestNamespace ns) {
    RdfUpdater.disable();
    final var ontology = createOntology(ns);
    final var release = approve(ns, capture(ontology));
    activate(ontology, release, 0);
    RdfUpdater.initialize(TestSuiteBootstrap.getRdfConfiguration());
    assertFalse(ask(ontology, "?s ?p ?o"));
    RdfRepository.getInstance().rebuildOntologyGraphs();
    assertTrue(
        ask(
            ontology,
            "?s <http://www.w3.org/2002/07/owl#versionIRI> <" + release.getVersionIri() + ">"));
  }

  private static OntologyRelease approve(TestNamespace ns, OntologyRelease release) {
    final var task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());
    SdkClients.user1Client()
        .tasks()
        .resolve(task.getId().toString(), decision(TaskResolutionType.Approved));
    return release;
  }

  private static void activate(Ontology ontology, OntologyRelease release, long revision) {
    final var state =
        SdkClients.adminClient()
            .ontologies()
            .activate(
                ontology.getId(),
                new ActivateOntologyRelease()
                    .withReleaseId(release.getId())
                    .withExpectedActivationRevision(revision));
    assertEquals(release.getId(), state.getActiveReleaseId());
  }

  private static OntologyExpression named(URI iri) {
    return new OntologyExpression().withKind(OntologyExpressionKind.NAMED_CLASS).withClassIri(iri);
  }

  private static void copyServingGraphs(RdfRepository serving, RdfRepository target) {
    final var graphs =
        JsonUtils.readTree(serving.executeSparqlQuery("SELECT ?g WHERE { GRAPH ?g { } }", "json"))
            .path("results")
            .path("bindings");
    for (var graph : graphs) {
      final String iri = graph.path("g").path("value").asText();
      final String triples =
          serving.executeSparqlQuery(
              "CONSTRUCT { ?s ?p ?o } WHERE { GRAPH <" + iri + "> { ?s ?p ?o } }", "ntriples");
      target.executeSparqlUpdate("INSERT DATA { GRAPH <" + iri + "> { " + triples + " } }");
    }
  }

  private static void await(Ontology ontology, String pattern, boolean expected) {
    Awaitility.await()
        .atMost(Duration.ofSeconds(30))
        .until(() -> ask(ontology, pattern) == expected);
  }

  private static boolean ask(Ontology ontology, String pattern) {
    return JsonUtils.readTree(
            RdfRepository.getInstance()
                .executeSparqlQuery(activeGraphAsk(ontology, pattern), "json"))
        .path("boolean")
        .asBoolean();
  }

  private static String activeGraphAsk(Ontology ontology, String pattern) {
    return "ASK { GRAPH <"
        + OntologyActiveGraph.graph(ontology.getId())
        + "> { "
        + pattern
        + " } }";
  }
}
