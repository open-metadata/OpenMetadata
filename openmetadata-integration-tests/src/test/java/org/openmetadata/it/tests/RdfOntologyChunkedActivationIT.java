package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.StringReader;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
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
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.OntologyActiveGraph;
import org.openmetadata.service.rdf.RdfLiveWriteStore;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.RdfUpdater;
import org.openmetadata.service.rdf.storage.ChunkedGraphReplace;
import org.openmetadata.service.rdf.storage.JenaFusekiStorage;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

/**
 * Activates releases whose served graph is larger than one graph-replace chunk (the suite lowers
 * the chunk to 64 KiB), so delivery stages the graph in chunks and moves it into place.
 */
@Tag("rdf")
@EnabledIfSystemProperty(named = "enableRdf", matches = "true")
@Isolated
@ExtendWith(TestNamespaceExtension.class)
public class RdfOntologyChunkedActivationIT extends BaseOntologyApprovalIT {
  private static final int CLASSES = 150;
  private static final int RESTRICTIONS = 20;
  private static final String DESCRIPTION = "A described class. ".repeat(50);

  @AfterEach
  void restoreRdf() {
    RdfTestUtils.restoreSuiteRdf();
  }

  @Test
  void aReleaseLargerThanOneChunkIsServedWhole(TestNamespace ns) {
    final Ontology ontology = describedOntology(ns, "chunked");
    final OntologyRelease release = activate(ns, ontology);
    final Model expected = served(release);
    try {
      assertTrue(chunkCount(expected) > 1, "the release must not fit one chunk");
      awaitServed(ontology, expected);
      assertEquals(List.of(), stagingGraphs());
    } finally {
      expected.close();
    }
  }

  @Test
  void aReplacementInterruptedBeforeTheMoveLeavesTheServedReleaseAndTheRetryReplacesIt(
      TestNamespace ns) {
    final Ontology ontology = describedOntology(ns, "interrupted");
    final OntologyRelease first = activate(ns, ontology);
    final Model firstGraph = served(first);
    Model secondGraph = null;
    try {
      awaitServed(ontology, firstGraph);
      declareDescribedClasses(ontology, "Later", 30);
      final OntologyRelease second = approve(ns, capture(ontology));
      RdfUpdater.disable();
      activateWithoutDelivery(ontology, second);
      RdfUpdater.initialize(TestSuiteBootstrap.getRdfConfiguration());
      secondGraph = served(second);
      final Model next = secondGraph;

      asTheOnlyWriter(
          () -> {
            try (RdfStorageInterface fuseki = servingFuseki()) {
              assertThrows(
                  IllegalStateException.class,
                  () ->
                      new ChunkedGraphReplace(crashingAfter(2, fuseki), chunkBytes())
                          .replace(OntologyActiveGraph.graph(ontology.getId()), next));
            }
            assertIsomorphic(firstGraph, servedGraph(ontology));
            assertEquals(2, stagingGraphs().size(), "the crashed attempt left its staged chunks");

            RdfRepository.getInstance().refreshOntologyGraph(ontology.getId());
            assertIsomorphic(next, servedGraph(ontology));
            assertEquals(List.of(), stagingGraphs());
          });
    } finally {
      firstGraph.close();
      if (secondGraph != null) {
        secondGraph.close();
      }
    }
  }

  /** Holds the delivery lock, as the live drain and a rebuild do, so no queued write interleaves. */
  private static void asTheOnlyWriter(Runnable writes) {
    Entity.getCollectionDAO().useHandle(handle -> RdfLiveWriteStore.withWriterLock(handle, writes));
  }

  private static void assertIsomorphic(Model expected, Model served) {
    try {
      assertEquals(expected.size(), served.size(), "served triples");
      assertTrue(served.isIsomorphicWith(expected), "served graph");
    } finally {
      served.close();
    }
  }

  private static Ontology describedOntology(TestNamespace ns, String name) {
    final Ontology ontology = createOntology(ns, name);
    SdkClients.adminClient()
        .ontologyProperties()
        .create(
            new CreateOntologyProperty()
                .withName("relatedTo")
                .withOntology(ontology.getFullyQualifiedName())
                .withKind(OntologyPropertyKind.OBJECT)
                .withIri(iri(ontology, "relatedTo")));
    declareDescribedClasses(ontology, "C", CLASSES);
    for (int index = 0; index < RESTRICTIONS; index++) {
      SdkClients.adminClient()
          .ontologyAxioms()
          .create(
              new CreateOntologyAxiom()
                  .withName("related" + index)
                  .withDisplayName("Related " + index)
                  .withDescription("Every C" + index + " is related to a C" + (index + 1))
                  .withOntology(ontology.getFullyQualifiedName())
                  .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
                  .withSubjectIri(iri(ontology, "C" + index))
                  .withProvenance(RelationProvenance.MANUAL)
                  .withExpressions(List.of(someRelated(ontology, index + 1))));
    }
    return ontology;
  }

  private static void declareDescribedClasses(Ontology ontology, String prefix, int count) {
    for (int index = 0; index < count; index++) {
      SdkClients.adminClient()
          .ontologyConcepts()
          .create(
              new CreateOntologyConcept()
                  .withOntology(ontology.getFullyQualifiedName())
                  .withName(prefix + index)
                  .withDescription(DESCRIPTION + index)
                  .withIri(iri(ontology, prefix + index))
                  .withConceptType(OntologyConceptType.OWL_CLASS));
    }
  }

  private static OntologyExpression someRelated(Ontology ontology, int target) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.RESTRICTION)
        .withPropertyIri(iri(ontology, "relatedTo"))
        .withRestrictionKind(OntologyRestrictionKind.SOME)
        .withFiller(
            new OntologyExpression()
                .withKind(OntologyExpressionKind.NAMED_CLASS)
                .withClassIri(iri(ontology, "C" + target)));
  }

  private static URI iri(Ontology ontology, String name) {
    return URI.create(ontology.getIri() + "/" + name);
  }

  private static OntologyRelease approve(TestNamespace ns, OntologyRelease release) {
    final var task = submit(ns, Entity.ONTOLOGY_RELEASE, release.getFullyQualifiedName());
    SdkClients.user1Client()
        .tasks()
        .resolve(task.getId().toString(), decision(TaskResolutionType.Approved));
    return release;
  }

  private static void activateWithoutDelivery(Ontology ontology, OntologyRelease release) {
    SdkClients.adminClient()
        .ontologies()
        .activate(
            ontology.getId(),
            new ActivateOntologyRelease()
                .withReleaseId(release.getId())
                .withExpectedActivationRevision(1L));
  }

  private static Model served(OntologyRelease release) {
    return OntologyActiveGraph.releaseModel(Entity.getCollectionDAO(), release.getId());
  }

  private static int chunkCount(Model model) {
    final List<Model> chunks = ChunkedGraphReplace.chunks(model, chunkBytes());
    chunks.forEach(Model::close);
    return chunks.size();
  }

  private static int chunkBytes() {
    return TestSuiteBootstrap.getRdfConfiguration().getGraphReplaceChunkBytes();
  }

  private static void awaitServed(Ontology ontology, Model expected) {
    Awaitility.await()
        .atMost(Duration.ofSeconds(60))
        .until(() -> servedGraph(ontology).isIsomorphicWith(expected));
  }

  private static Model servedGraph(Ontology ontology) {
    final String triples =
        RdfRepository.getInstance()
            .executeSparqlQueryDirect(
                "CONSTRUCT { ?s ?p ?o } WHERE { GRAPH <"
                    + OntologyActiveGraph.graph(ontology.getId())
                    + "> { ?s ?p ?o } }",
                "ntriples");
    final Model model = ModelFactory.createDefaultModel();
    RDFDataMgr.read(model, new StringReader(triples), null, Lang.NTRIPLES);
    return model;
  }

  private static List<String> stagingGraphs() {
    try (RdfStorageInterface fuseki = servingFuseki()) {
      return fuseki.getAllGraphs().stream()
          .filter(graph -> graph.startsWith(ChunkedGraphReplace.STAGING_PREFIX))
          .toList();
    }
  }

  private static RdfStorageInterface servingFuseki() {
    return new JenaFusekiStorage(
        TestSuiteBootstrap.getRdfConfiguration(), RdfRepository.getInstance().activeDatasetName());
  }

  /** Sends the replacement's requests to Fuseki and stops, as a crashed server would, after a few. */
  private static ChunkedGraphReplace.GraphStore crashingAfter(
      int puts, RdfStorageInterface fuseki) {
    final AtomicInteger sent = new AtomicInteger();
    return new ChunkedGraphReplace.GraphStore() {
      @Override
      public void put(String graph, Model content) {
        if (sent.incrementAndGet() > puts) {
          throw new IllegalStateException("Simulated server crash during the staged upload");
        }
        fuseki.replaceGraph(graph, null, content);
      }

      @Override
      public void update(String sparqlUpdate) {
        fuseki.executeSparqlUpdate(sparqlUpdate);
      }

      @Override
      public List<String> graphs() {
        return fuseki.getAllGraphs();
      }
    };
  }
}
