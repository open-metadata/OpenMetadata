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
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QueryType;
import org.apache.jena.query.ResultSet;
import org.apache.jena.query.ResultSetFormatter;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.reasoner.ReasonerRegistry;
import org.apache.jena.riot.RDFDataMgr;
import org.openmetadata.schema.api.rdf.SparqlQuery;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;

/** Executes read-only SPARQL against one database-primary ontology model. */
public final class OntologySparqlQueryService {
  private final OntologyModelProvider modelProvider;
  private final OntologySparqlQueryValidator queryValidator;

  public OntologySparqlQueryService(final GlossaryOntologyExporter exporter) {
    this(exporter::materialize, new SparqlFederationGuard(null));
  }

  OntologySparqlQueryService(
      final OntologyModelProvider modelProvider, final SparqlFederationGuard federationGuard) {
    this.modelProvider = Objects.requireNonNull(modelProvider);
    queryValidator = new OntologySparqlQueryValidator(Objects.requireNonNull(federationGuard));
  }

  public QueryResult query(final UUID glossaryId, final SparqlQuery request) {
    final ValidatedQuery validated = validate(request);
    final Model ontology = modelProvider.materialize(glossaryId, true);
    try {
      return executeWithInference(ontology, validated);
    } finally {
      ontology.close();
    }
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

  private QueryResult executeWithInference(final Model ontology, final ValidatedQuery validated) {
    final Model queryModel = inferenceModel(ontology, validated.inference());
    try {
      return execute(queryModel, validated);
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

  private static QueryResult execute(final Model model, final ValidatedQuery validated) {
    final QueryExecution execution =
        QueryExecution.model(model)
            .query(validated.query())
            .timeout(validated.timeoutMillis(), TimeUnit.MILLISECONDS)
            .build();
    try (execution) {
      return executeByType(execution, validated.query(), validated.format());
    }
  }

  private static QueryResult executeByType(
      final QueryExecution execution, final Query query, final ResultFormat format) {
    return switch (query.queryType()) {
      case SELECT -> serializeSelect(execution.execSelect(), requireTupleFormat(format));
      case ASK -> serializeAsk(execution.execAsk(), requireTupleFormat(format));
      case CONSTRUCT -> serializeGraph(execution.execConstruct(), requireGraphFormat(format));
      case DESCRIBE -> serializeGraph(execution.execDescribe(), requireGraphFormat(format));
      default -> throw new IllegalArgumentException("Unsupported SPARQL query type");
    };
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

  private static QueryResult serializeSelect(final ResultSet resultSet, final TupleFormat format) {
    final ByteArrayOutputStream output = new ByteArrayOutputStream();
    format.write(output, resultSet);
    return result(output, format);
  }

  private static QueryResult serializeAsk(final boolean value, final TupleFormat format) {
    final ByteArrayOutputStream output = new ByteArrayOutputStream();
    format.write(output, value);
    return result(output, format);
  }

  private static QueryResult serializeGraph(final Model model, final GraphFormat format) {
    final ByteArrayOutputStream output = new ByteArrayOutputStream();
    try {
      RDFDataMgr.write(output, model, format.serialization().rdfFormat());
    } finally {
      model.close();
    }
    return result(output, format);
  }

  private static QueryResult result(final ByteArrayOutputStream output, final ResultFormat format) {
    return new QueryResult(
        SparqlQueryLimits.requireBoundedOutput(output.toString(StandardCharsets.UTF_8)),
        format.externalName(),
        format.mediaType());
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

  record ValidatedQuery(Query query, ResultFormat format, int timeoutMillis, Inference inference) {}

  @FunctionalInterface
  interface OntologyModelProvider {
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

    private void write(final ByteArrayOutputStream output, final ResultSet resultSet) {
      switch (this) {
        case JSON -> ResultSetFormatter.outputAsJSON(output, resultSet);
        case XML -> ResultSetFormatter.outputAsXML(output, resultSet);
        case CSV -> ResultSetFormatter.outputAsCSV(output, resultSet);
        case TSV -> ResultSetFormatter.outputAsTSV(output, resultSet);
      }
    }

    private void write(final ByteArrayOutputStream output, final boolean value) {
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
