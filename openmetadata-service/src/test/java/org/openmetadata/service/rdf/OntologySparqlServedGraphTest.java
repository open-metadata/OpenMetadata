package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.apache.jena.dboe.base.file.Location;
import org.apache.jena.query.Dataset;
import org.apache.jena.query.DatasetFactory;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.RDFLanguages;
import org.apache.jena.riot.RDFParser;
import org.apache.jena.sparql.core.DatasetDescription;
import org.apache.jena.sparql.core.DatasetGraph;
import org.apache.jena.sparql.core.DynamicDatasets;
import org.apache.jena.system.Txn;
import org.apache.jena.tdb2.TDB2;
import org.apache.jena.tdb2.TDB2Factory;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.service.rdf.OntologySparqlQueryService.QueryResult;
import org.openmetadata.service.rdf.OntologySparqlQueryService.ServedGraph;
import org.openmetadata.service.rdf.SparqlQueryExecutionGuard.QueryTimeoutException;
import org.openmetadata.service.rdf.SparqlQueryLimits.QueryLimitExceededException;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard.FederationDisallowedException;

/**
 * The served-graph path answers as the in-memory worker would over the same triples. The store is
 * TDB2 with a union default graph, as Fuseki runs it, so an unscoped query would see every graph.
 */
class OntologySparqlServedGraphTest {
  private static final String ONTOLOGY_GRAPH = "https://open-metadata.org/graph/ontology/served";
  private static final String OTHER_GRAPH = "https://open-metadata.org/graph/ontology/other";

  private Dataset dataset;
  private Model ontology;
  private TdbGraph served;

  @BeforeEach
  void loadTwoOntologies() {
    dataset = TDB2Factory.connectDataset(Location.mem());
    dataset.getContext().set(TDB2.symUnionDefaultGraph, true);
    ontology = ModelFactory.createDefaultModel();
    ontology.add(ontology.createResource("urn:concept:a"), RDFS.label, "Alpha");
    ontology.add(ontology.createResource("urn:concept:b"), RDFS.label, "Beta");
    ontology.add(
        ontology.createResource("urn:concept:b"),
        RDFS.subClassOf,
        ontology.createResource("urn:concept:a"));
    final Model other = ModelFactory.createDefaultModel();
    other.add(other.createResource("urn:secret"), RDFS.label, "Hidden");
    Txn.executeWrite(
        dataset,
        () -> {
          dataset.addNamedModel(ONTOLOGY_GRAPH, ontology);
          dataset.addNamedModel(OTHER_GRAPH, other);
        });
    served = new TdbGraph(ONTOLOGY_GRAPH, dataset, new AtomicInteger(), new ArrayList<>());
  }

  @Test
  void anUnscopedQueryOnThisStoreSeesEveryGraph() {
    final String unscoped = "ASK { <urn:secret> ?p ?o }";
    final boolean[] seen = new boolean[1];

    served.read(QueryFactory.create(unscoped), 1_000, execution -> seen[0] = execution.execAsk());

    assertTrue(seen[0], "the fixture must expose other graphs to an unscoped query");
  }

  @Test
  void answersFromItsOwnGraphAndNoOther() {
    final QueryResult result =
        service()
            .queryServedGraph(
                request("SELECT ?s WHERE { ?s ?p ?o } ORDER BY ?s"), served, System.nanoTime());

    assertTrue(result.body().contains("urn:concept:a"), result.body());
    assertFalse(result.body().contains("urn:secret"), result.body());
  }

  @Test
  void graphPatternsReachOnlyItsOwnGraph() {
    final QueryResult result =
        service()
            .queryServedGraph(
                request("SELECT DISTINCT ?g WHERE { GRAPH ?g { ?s ?p ?o } }")
                    .withFormat(SparqlQuery.Format.CSV),
                served,
                System.nanoTime());

    assertEquals("g\r\n" + ONTOLOGY_GRAPH + "\r\n", result.body());
  }

  @ParameterizedTest
  @MethodSource("tupleQueries")
  void answersTupleQueriesExactlyAsTheInMemoryWorker(
      final String query, final SparqlQuery.Format format) {
    final SparqlQuery request = request(query).withFormat(format);

    final QueryResult local = localService().query(null, request);
    final QueryResult remote = service().queryServedGraph(request, served, System.nanoTime());

    assertEquals(local, remote);
  }

  static Stream<Arguments> tupleQueries() {
    final String select = "SELECT ?s ?l WHERE { ?s <" + RDFS.label + "> ?l } ORDER BY ?s";
    final String ask = "ASK { <urn:concept:b> <" + RDFS.subClassOf + "> <urn:concept:a> }";
    return Stream.of(
        Arguments.of(select, SparqlQuery.Format.JSON),
        Arguments.of(select, SparqlQuery.Format.XML),
        Arguments.of(select, SparqlQuery.Format.CSV),
        Arguments.of(select, SparqlQuery.Format.TSV),
        Arguments.of(ask, SparqlQuery.Format.JSON),
        Arguments.of(ask, SparqlQuery.Format.XML));
  }

  @ParameterizedTest
  @EnumSource(
      value = SparqlQuery.Format.class,
      names = {"TURTLE", "NTRIPLES", "RDFXML", "JSONLD"})
  void answersGraphQueriesWithTheSameGraphAsTheInMemoryWorker(final SparqlQuery.Format format) {
    final SparqlQuery request =
        request("CONSTRUCT { ?s <urn:named> ?l } WHERE { ?s <" + RDFS.label + "> ?l }")
            .withFormat(format);

    final QueryResult local = localService().query(null, request);
    final QueryResult remote = service().queryServedGraph(request, served, System.nanoTime());

    assertEquals(local.mediaType(), remote.mediaType());
    assertTrue(parse(local).isIsomorphicWith(parse(remote)), remote.body());
  }

  @Test
  void refusesInferenceItCannotRunInTheStore() {
    final var failure =
        assertThrows(
            QueryLimitExceededException.class,
            () ->
                service()
                    .queryServedGraph(
                        request("ASK {}").withInference(SparqlQuery.Inference.RDFS),
                        served,
                        System.nanoTime()));

    assertEquals(OntologySparqlQueryService.SERVED_GRAPH_INFERENCE_MESSAGE, failure.getMessage());
    assertEquals(0, served.reads().get());
  }

  @Test
  void refusesAServiceClauseBeforeReadingTheStore() {
    assertThrows(
        FederationDisallowedException.class,
        () ->
            service()
                .queryServedGraph(
                    request("SELECT * WHERE { SERVICE <http://127.0.0.1:1/sparql> { ?s ?p ?o } }"),
                    served,
                    System.nanoTime()));

    assertEquals(0, served.reads().get());
  }

  @Test
  void refusesAResultLargerThanTheResponseBudget() {
    final Model large = ModelFactory.createDefaultModel();
    final String text = "x".repeat(8 * 1024);
    for (int index = 0; index < 2_000; index++) {
      large.add(large.createResource("urn:large:" + index), RDFS.comment, text);
    }
    Txn.executeWrite(dataset, () -> dataset.getNamedModel(ONTOLOGY_GRAPH).add(large));

    final var failure =
        assertThrows(
            QueryLimitExceededException.class,
            () ->
                service()
                    .queryServedGraph(
                        request("SELECT ?s ?c WHERE { ?s <" + RDFS.comment + "> ?c } LIMIT 2000"),
                        served,
                        System.nanoTime()));

    assertTrue(failure.getMessage().contains("maximum response size"), failure.getMessage());
  }

  @Test
  void readsWithWhatIsLeftOfTheCallersTimeout() {
    final long startedTwoSecondsAgo = System.nanoTime() - TimeUnit.SECONDS.toNanos(2);

    service().queryServedGraph(request("ASK {}").withTimeout(5_000), served, startedTwoSecondsAgo);

    assertTrue(served.timeouts().getLast() <= 3_000, served.timeouts().toString());
  }

  @Test
  void refusesARequestWhoseTimeoutIsSpentBeforeReadingTheStore() {
    final long startedTenSecondsAgo = System.nanoTime() - TimeUnit.SECONDS.toNanos(10);

    assertThrows(
        QueryTimeoutException.class,
        () ->
            service()
                .queryServedGraph(
                    request("ASK {}").withTimeout(5_000), served, startedTenSecondsAgo));

    assertEquals(0, served.reads().get());
  }

  private static Model parse(final QueryResult result) {
    final Model model = ModelFactory.createDefaultModel();
    RDFParser.fromString(result.body(), RDFLanguages.contentTypeToLang(result.mediaType()))
        .parse(model);
    return model;
  }

  private OntologySparqlQueryService localService() {
    final Model copy = ModelFactory.createDefaultModel().add(ontology);
    return new OntologySparqlQueryService((id, relations) -> copy, new SparqlFederationGuard(null));
  }

  private static OntologySparqlQueryService service() {
    return new OntologySparqlQueryService(
        (id, relations) -> {
          throw new AssertionError("the served-graph path must not materialize a model");
        },
        new SparqlFederationGuard(null));
  }

  private static SparqlQuery request(final String query) {
    return new SparqlQuery().withQuery(query);
  }

  /** Reads the way Fuseki answers: the store evaluates the query, including its FROM clause. */
  record TdbGraph(String graphUri, Dataset dataset, AtomicInteger reads, List<Long> timeouts)
      implements ServedGraph {
    @Override
    public void read(
        final Query query, final long timeoutMillis, final Consumer<QueryExecution> reader) {
      reads.incrementAndGet();
      timeouts.add(timeoutMillis);
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
