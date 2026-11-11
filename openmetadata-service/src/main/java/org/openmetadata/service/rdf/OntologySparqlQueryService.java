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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.query.QueryType;
import org.apache.jena.query.ResultSet;
import org.apache.jena.query.ResultSetFormatter;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.reasoner.ReasonerRegistry;
import org.apache.jena.sparql.exec.http.Service;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.service.rdf.SparqlQueryLimits.BoundedOutputStream;
import org.openmetadata.service.rdf.SparqlQueryLimits.QueryLimitExceededException;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;

/** Executes read-only SPARQL against one database-primary ontology model. */
public final class OntologySparqlQueryService {
  static final String SERVED_GRAPH_INFERENCE_MESSAGE =
      "RDFS and OWL inference run in memory, and this ontology is too large for the in-memory"
          + " query budget; query it without inference";

  private final OntologyModelProvider modelProvider;
  private final OntologySparqlQueryValidator queryValidator;

  public OntologySparqlQueryService(final GlossaryOntologyExporter exporter) {
    this(exporter::materialize, new SparqlFederationGuard(null));
  }

  public OntologySparqlQueryService(
      final OntologyModelProvider modelProvider, final SparqlFederationGuard federationGuard) {
    this.modelProvider = Objects.requireNonNull(modelProvider);
    queryValidator = new OntologySparqlQueryValidator(Objects.requireNonNull(federationGuard));
  }

  public QueryResult query(final UUID glossaryId, final SparqlQuery request) {
    final ValidatedQuery validated = validate(request);
    try (final OntologySparqlWorker worker =
        OntologySparqlWorker.acquire(validated.timeoutMillis())) {
      final Model ontology = modelProvider.materialize(glossaryId, true);
      try {
        return new QueryResult(
            worker.execute(ontology, request),
            validated.format().externalName(),
            validated.format().mediaType());
      } finally {
        ontology.close();
      }
    }
  }

  /**
   * Answers over a named graph the triplestore serves, for an ontology too large for the worker.
   * The query's dataset is that graph alone; inference stays local, so it is refused here.
   */
  public QueryResult queryServedGraph(final SparqlQuery request, final ServedGraph served) {
    final ValidatedQuery validated = validate(request);
    if (validated.inference() != Inference.NONE) {
      throw new QueryLimitExceededException(SERVED_GRAPH_INFERENCE_MESSAGE);
    }
    final Query scoped = scopedTo(validated.query(), served.graphUri());
    final ByteArrayOutputStream body = new ByteArrayOutputStream();
    served.read(
        scoped,
        validated.timeoutMillis(),
        execution -> writeBounded(execution, scoped, validated.format(), body));
    return new QueryResult(
        body.toString(StandardCharsets.UTF_8),
        validated.format().externalName(),
        validated.format().mediaType());
  }

  /**
   * Names the graph as both FROM and FROM NAMED: the store's default graph is the union of the
   * dataset's named graphs, so FROM alone would leave the query an empty dataset
   * (ADR:2026-10-11-asserted-only-rdf-reads-name-every-non-inferred-graph).
   */
  public static Query scopedTo(final Query query, final String graphUri) {
    final Query scoped = SparqlQueryLimits.applyResultLimit(query.cloneQuery());
    scoped.addGraphURI(graphUri);
    scoped.addNamedGraphURI(graphUri);
    return scoped;
  }

  private static void writeBounded(
      final QueryExecution execution,
      final Query query,
      final ResultFormat format,
      final OutputStream body) {
    final OutputStream bounded =
        new BoundedOutputStream(
            body, SparqlQueryLimits.MAX_OUTPUT_BYTES, OntologySparqlWorker.OUTPUT_LIMIT_MESSAGE);
    executeByType(execution, query, format, bounded);
  }

  private ValidatedQuery validate(final SparqlQuery request) {
    Objects.requireNonNull(request, "SPARQL request is required");
    final Query query = queryValidator.validate(request.getQuery());
    rejectProtocolDataset(request);
    final ResultFormat format = resultFormat(request.getFormat(), query);
    final int timeoutMillis = timeoutMillis(request.getTimeout());
    final Inference inference = inference(request.getInference());
    return new ValidatedQuery(query, format, timeoutMillis, inference);
  }

  private static void rejectProtocolDataset(final SparqlQuery request) {
    final boolean hasProtocolDataset =
        request.getDefaultGraphUri() != null || !nullOrEmpty(request.getNamedGraphUri());
    if (hasProtocolDataset) {
      throw new IllegalArgumentException(
          "Ontology-scoped SPARQL does not accept FROM or external graph URIs");
    }
  }

  private static int timeoutMillis(final Integer requested) {
    final int timeout = requested == null ? SparqlQueryLimits.TIMEOUT_MILLIS : requested;
    if (timeout < 1 || timeout > SparqlQueryLimits.TIMEOUT_MILLIS) {
      throw new IllegalArgumentException("SPARQL timeout must be between 1 and 30000 ms");
    }
    return timeout;
  }

  private static Inference inference(final SparqlQuery.Inference requested) {
    final SparqlQuery.Inference effective =
        requested == null ? SparqlQuery.Inference.NONE : requested;
    return switch (effective) {
      case NONE -> Inference.NONE;
      case RDFS -> Inference.RDFS;
      case OWL -> Inference.OWL;
      case CUSTOM -> throw new IllegalArgumentException(
          "Custom inference is available only on the administrator knowledge-graph endpoint");
    };
  }

  private static void executeWithInference(
      final Model ontology, final ValidatedQuery validated, final OutputStream output) {
    final Model queryModel = inferenceModel(ontology, validated.inference());
    try {
      execute(queryModel, validated, output);
    } finally {
      closeDerivedModel(ontology, queryModel);
    }
  }

  private static Model inferenceModel(final Model ontology, final Inference inference) {
    return switch (inference) {
      case NONE -> ontology;
      case RDFS -> ModelFactory.createRDFSModel(ontology);
      case OWL -> ModelFactory.createInfModel(ReasonerRegistry.getOWLMiniReasoner(), ontology);
    };
  }

  private static void closeDerivedModel(final Model ontology, final Model queryModel) {
    if (ontology != queryModel) {
      queryModel.close();
    }
  }

  /**
   * The worker's model is self-contained, so SERVICE stays disabled even if validation allows it.
   */
  private static void execute(
      final Model model, final ValidatedQuery validated, final OutputStream output) {
    final QueryExecution execution =
        QueryExecution.model(model)
            .query(validated.query())
            .set(Service.httpServiceAllowed, false)
            .timeout(validated.timeoutMillis(), TimeUnit.MILLISECONDS)
            .build();
    try (execution) {
      executeByType(execution, validated.query(), validated.format(), output);
    }
  }

  private static void executeByType(
      final QueryExecution execution,
      final Query query,
      final ResultFormat format,
      final OutputStream output) {
    switch (query.queryType()) {
      case SELECT -> requireTupleFormat(format).write(output, execution.execSelect());
      case ASK -> requireTupleFormat(format).write(output, execution.execAsk());
      case CONSTRUCT -> serializeGraph(
          output, execution.execConstruct(), requireGraphFormat(format));
      case DESCRIBE -> serializeGraph(output, execution.execDescribe(), requireGraphFormat(format));
      default -> throw new IllegalArgumentException("Unsupported SPARQL query type");
    }
  }

  private static TupleFormat requireTupleFormat(final ResultFormat format) {
    if (!(format instanceof TupleFormat tupleFormat)) {
      throw new IllegalArgumentException("Tuple queries require a tuple result format");
    }
    return tupleFormat;
  }

  private static GraphFormat requireGraphFormat(final ResultFormat format) {
    if (!(format instanceof GraphFormat graphFormat)) {
      throw new IllegalArgumentException("Graph queries require an RDF result format");
    }
    return graphFormat;
  }

  private static void serializeGraph(
      final OutputStream output, final Model model, final GraphFormat format) {
    try {
      RdfGraphSerializer.write(output, model, format.serialization());
    } finally {
      model.close();
    }
  }

  private static ResultFormat resultFormat(final SparqlQuery.Format requested, final Query query) {
    final boolean graphQuery = isGraphQuery(query.queryType());
    final SparqlQuery.Format effective = requested == null ? defaultFormat(graphQuery) : requested;
    final ResultFormat format = namedFormat(effective);
    if (format.isGraph() != graphQuery) {
      throw new IllegalArgumentException(
          "Format '%s' is not valid for a %s query"
              .formatted(format.externalName(), query.queryType()));
    }
    return format;
  }

  private static boolean isGraphQuery(final QueryType queryType) {
    return queryType == QueryType.CONSTRUCT || queryType == QueryType.DESCRIBE;
  }

  private static SparqlQuery.Format defaultFormat(final boolean graphQuery) {
    return graphQuery ? SparqlQuery.Format.TURTLE : SparqlQuery.Format.JSON;
  }

  private static ResultFormat namedFormat(final SparqlQuery.Format format) {
    return switch (format) {
      case JSON -> TupleFormat.JSON;
      case XML -> TupleFormat.XML;
      case CSV -> TupleFormat.CSV;
      case TSV -> TupleFormat.TSV;
      case TURTLE -> GraphFormat.TURTLE;
      case RDFXML -> GraphFormat.RDF_XML;
      case NTRIPLES -> GraphFormat.N_TRIPLES;
      case JSONLD -> GraphFormat.JSON_LD;
    };
  }

  public record QueryResult(String body, String format, String mediaType) {}

  private record ValidatedQuery(
      Query query, ResultFormat format, int timeoutMillis, Inference inference) {}

  public static final class Worker {
    private Worker() {}

    public static void main(final String[] arguments) throws IOException {
      final Path directory = Path.of(arguments[0]);
      try {
        executeRequest(directory);
        OntologySparqlWorker.writeStatus(directory, OntologySparqlWorker.Status.SUCCESS, "");
      } catch (final StackOverflowError error) {
        OntologySparqlWorker.writeStatus(
            directory,
            OntologySparqlWorker.Status.LIMIT,
            "SPARQL query exceeds the execution stack budget");
      } catch (final RuntimeException exception) {
        OntologySparqlWorker.writeFailure(directory, exception);
      }
    }

    private static void executeRequest(final Path directory) throws IOException {
      final Model model = ModelFactory.createDefaultModel();
      try (final DataInputStream input = OntologySparqlWorker.openInput(directory);
          final OutputStream output = OntologySparqlWorker.openOutput(directory)) {
        final SparqlQuery request = OntologySparqlWorker.readRequest(input);
        final Query query =
            SparqlQueryLimits.applyResultLimit(QueryFactory.create(request.getQuery()));
        final ValidatedQuery validated =
            new ValidatedQuery(
                query,
                resultFormat(request.getFormat(), query),
                timeoutMillis(request.getTimeout()),
                inference(request.getInference()));
        OntologySparqlWorker.readModel(directory, input, model);
        executeWithInference(model, validated, output);
      } finally {
        model.close();
      }
    }
  }

  /** A named graph the triplestore serves, read through a streaming query execution. */
  public interface ServedGraph {
    String graphUri();

    void read(Query query, long timeoutMillis, Consumer<QueryExecution> reader);
  }

  @FunctionalInterface
  public interface OntologyModelProvider {
    Model materialize(UUID glossaryId, boolean includeRelations);
  }

  private enum Inference {
    NONE,
    RDFS,
    OWL
  }

  private sealed interface ResultFormat permits TupleFormat, GraphFormat {
    String externalName();

    String mediaType();

    boolean isGraph();
  }

  private enum TupleFormat implements ResultFormat {
    JSON("json", "application/sparql-results+json"),
    XML("xml", "application/sparql-results+xml"),
    CSV("csv", "text/csv"),
    TSV("tsv", "text/tab-separated-values");

    private final String externalName;
    private final String mediaType;

    TupleFormat(final String externalName, final String mediaType) {
      this.externalName = externalName;
      this.mediaType = mediaType;
    }

    private void write(final OutputStream output, final ResultSet resultSet) {
      switch (this) {
        case JSON -> ResultSetFormatter.outputAsJSON(output, resultSet);
        case XML -> ResultSetFormatter.outputAsXML(output, resultSet);
        case CSV -> ResultSetFormatter.outputAsCSV(output, resultSet);
        case TSV -> ResultSetFormatter.outputAsTSV(output, resultSet);
      }
    }

    private void write(final OutputStream output, final boolean value) {
      switch (this) {
        case JSON -> ResultSetFormatter.outputAsJSON(output, value);
        case XML -> ResultSetFormatter.outputAsXML(output, value);
        case CSV -> ResultSetFormatter.outputAsCSV(output, value);
        case TSV -> ResultSetFormatter.outputAsTSV(output, value);
      }
    }

    @Override
    public String externalName() {
      return externalName;
    }

    @Override
    public String mediaType() {
      return mediaType;
    }

    @Override
    public boolean isGraph() {
      return false;
    }
  }

  private enum GraphFormat implements ResultFormat {
    TURTLE(RdfSerializationFormat.TURTLE),
    RDF_XML(RdfSerializationFormat.RDF_XML),
    N_TRIPLES(RdfSerializationFormat.N_TRIPLES),
    JSON_LD(RdfSerializationFormat.JSON_LD);

    private final RdfSerializationFormat serialization;

    GraphFormat(final RdfSerializationFormat serialization) {
      this.serialization = serialization;
    }

    private RdfSerializationFormat serialization() {
      return serialization;
    }

    @Override
    public String externalName() {
      return serialization.externalName();
    }

    @Override
    public String mediaType() {
      return serialization.mediaType();
    }

    @Override
    public boolean isGraph() {
      return true;
    }
  }
}
