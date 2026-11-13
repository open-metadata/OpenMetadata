package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import org.apache.jena.dboe.base.file.Location;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.sparql.core.DatasetDescription;
import org.apache.jena.sparql.core.DatasetGraph;
import org.apache.jena.sparql.core.DynamicDatasets;
import org.apache.jena.system.Txn;
import org.apache.jena.tdb2.TDB2;
import org.apache.jena.tdb2.TDB2Factory;
import org.apache.jena.vocabulary.OWL2;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.service.rdf.OntologySparqlQueryService.QueryResult;
import org.openmetadata.service.rdf.OntologySparqlQueryService.ServedGraph;
import org.openmetadata.service.rdf.SparqlQueryLimits.OntologyTooLargeException;
import org.openmetadata.service.rdf.SparqlQueryLimits.QueryLimitExceededException;
import org.openmetadata.service.security.AuthorizationException;

class OntologyReleaseQueryTest {
  private static final String ONTOLOGY_IRI = "https://example.com/onto";
  private static final String SERVED_GRAPH = "https://open-metadata.org/graph/ontology/served";
  private static final String OTHER_GRAPH = "https://open-metadata.org/graph/ontology/other";

  private static final QueryResult SERVED_RESULT =
      new QueryResult("served", "json", "application/sparql-results+json");
  private static final Function<OntologyTooLargeException, QueryResult> SERVED =
      tooLarge -> SERVED_RESULT;

  private Dataset dataset;

  @BeforeEach
  void createStore() {
    dataset = TDB2Factory.connectDataset(Location.mem());
    dataset.getContext().set(TDB2.symUnionDefaultGraph, true);
  }

  @Test
  void aGraphHoldingTheActiveReleaseServesIt() {
    store(SERVED_GRAPH, "https://example.com/onto/2");

    assertTrue(
        OntologyReleaseQuery.servesRelease(graph(), release("https://example.com/onto/2"), 1_000));
  }

  @Test
  void aGraphStillHoldingThePreviousReleaseDoesNotServeTheNewOne() {
    store(SERVED_GRAPH, "https://example.com/onto/1");

    assertFalse(
        OntologyReleaseQuery.servesRelease(graph(), release("https://example.com/onto/2"), 1_000));
  }

  @Test
  void anotherGraphHoldingTheReleaseDoesNotCount() {
    store(OTHER_GRAPH, "https://example.com/onto/2");

    assertFalse(
        OntologyReleaseQuery.servesRelease(graph(), release("https://example.com/onto/2"), 1_000));
  }

  @Test
  void aReleaseRefusedForItsSizeSkipsTheWorkerOnLaterQueries() {
    final UUID releaseId = UUID.randomUUID();
    final AtomicInteger workerRuns = new AtomicInteger();
    final AtomicInteger authorizations = new AtomicInteger();
    final Supplier<QueryResult> oversized =
        () -> {
          workerRuns.incrementAndGet();
          throw new OntologyTooLargeException("too large");
        };

    OntologyReleaseQuery.answer(releaseId, oversized, authorizations::incrementAndGet, SERVED);
    final QueryResult second =
        OntologyReleaseQuery.answer(releaseId, oversized, authorizations::incrementAndGet, SERVED);

    assertEquals(SERVED_RESULT, second);
    assertEquals(1, workerRuns.get());
    assertEquals(1, authorizations.get());
  }

  @Test
  void aCallerDeniedAMemberOfARememberedReleaseGetsNoAnswer() {
    final UUID releaseId = UUID.randomUUID();
    final Supplier<QueryResult> oversized =
        () -> {
          throw new OntologyTooLargeException("too large");
        };
    OntologyReleaseQuery.answer(releaseId, oversized, () -> {}, SERVED);
    final AtomicInteger servedReads = new AtomicInteger();

    assertThrows(
        AuthorizationException.class,
        () ->
            OntologyReleaseQuery.answer(
                releaseId,
                oversized,
                () -> {
                  throw new AuthorizationException("denied");
                },
                tooLarge -> {
                  servedReads.incrementAndGet();
                  return SERVED_RESULT;
                }));
    assertEquals(0, servedReads.get());
  }

  @Test
  void aQueryLimitThatIsNotTheReleaseSizeIsNotRemembered() {
    final UUID releaseId = UUID.randomUUID();
    final AtomicInteger workerRuns = new AtomicInteger();
    final Supplier<QueryResult> costly =
        () -> {
          workerRuns.incrementAndGet();
          throw new QueryLimitExceededException("query exhausted memory");
        };

    for (int attempt = 0; attempt < 2; attempt++) {
      assertThrows(
          QueryLimitExceededException.class,
          () -> OntologyReleaseQuery.answer(releaseId, costly, () -> {}, SERVED));
    }

    assertEquals(2, workerRuns.get());
  }

  private void store(final String graph, final String versionIri) {
    final Model model = ModelFactory.createDefaultModel();
    model.add(
        model.createResource(ONTOLOGY_IRI), OWL2.versionIRI, model.createResource(versionIri));
    Txn.executeWrite(dataset, () -> dataset.addNamedModel(graph, model));
  }

  private static OntologyRelease release(final String versionIri) {
    return new OntologyRelease()
        .withOntologyIri(URI.create(ONTOLOGY_IRI))
        .withVersionIri(URI.create(versionIri));
  }

  private ServedGraph graph() {
    return new ServedGraph() {
      @Override
      public String graphUri() {
        return SERVED_GRAPH;
      }

      @Override
      public void read(
          final Query query, final long timeoutMillis, final Consumer<QueryExecution> reader) {
        Txn.executeRead(
            dataset,
            () -> {
              try (QueryExecution execution =
                  QueryExecution.dataset(DatasetFactory.wrap(asFusekiServes(dataset, query)))
                      .query(query)
                      .timeout(timeoutMillis, TimeUnit.MILLISECONDS)
                      .build()) {
                reader.accept(execution);
              }
            });
      }
    };
  }

  /**
   * Fuseki's query service builds a dynamic dataset from a request that names its graphs; the
   * in-process engine would ignore FROM and evaluate against the whole store.
   */
  static DatasetGraph asFusekiServes(final Dataset dataset, final Query query) {
    return query.hasDatasetDescription()
        ? DynamicDatasets.dynamicDataset(
            DatasetDescription.create(query), dataset.asDatasetGraph(), false)
        : dataset.asDatasetGraph();
  }
}
