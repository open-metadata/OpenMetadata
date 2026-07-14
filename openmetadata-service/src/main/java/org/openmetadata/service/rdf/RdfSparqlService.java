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

import java.util.Arrays;
import java.util.Locale;
import java.util.Objects;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryException;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.query.QueryParseException;
import org.apache.jena.update.UpdateException;
import org.apache.jena.update.UpdateFactory;
import org.openmetadata.service.rdf.federation.SparqlFederationGuard;

/** Coordinates guarded SPARQL reads and validated SPARQL updates. */
public final class RdfSparqlService {

  private final RdfRepository repository;
  private final SparqlFederationGuard federationGuard;

  public RdfSparqlService(RdfRepository repository, SparqlFederationGuard federationGuard) {
    this.repository = Objects.requireNonNull(repository);
    this.federationGuard = Objects.requireNonNull(federationGuard);
  }

  public QueryResult query(String sparql, String requestedFormat, String inferenceLevel) {
    return query(ReadQuery.parse(sparql), requestedFormat, inferenceLevel);
  }

  public QueryResult query(ReadQuery query, String requestedFormat, String inferenceLevel) {
    federationGuard.enforce(query.sparql());
    ResultFormat format = ResultFormat.parse(requestedFormat, query.parsed());
    InferenceLevel inference = InferenceLevel.parse(inferenceLevel);

    return inference == InferenceLevel.NONE
        ? directQuery(query.sparql(), format)
        : inferredQuery(query.sparql(), format, inference.externalName);
  }

  public void update(String sparql) {
    requireQuery(sparql, "SPARQL update body is required");
    try {
      UpdateFactory.create(sparql);
    } catch (QueryParseException | UpdateException exception) {
      throw new IllegalArgumentException(
          "Invalid SPARQL UPDATE: " + exception.getMessage(), exception);
    }
    repository.executeSparqlUpdate(sparql);
  }

  private QueryResult inferredQuery(String sparql, ResultFormat format, String inferenceLevel) {
    RdfRepository.InferenceQueryResult result =
        repository.executeSparqlQueryWithInferenceResult(sparql, format.mediaType, inferenceLevel);
    return new QueryResult(
        result.results(), format.externalName, format.mediaType, result.warning());
  }

  private QueryResult directQuery(String sparql, ResultFormat format) {
    return new QueryResult(
        repository.executeSparqlQuery(sparql, format.mediaType),
        format.externalName,
        format.mediaType,
        null);
  }

  private static Query parseReadOnlyQuery(String sparql) {
    requireQuery(sparql, "SPARQL query is required");
    Query query;
    try {
      query = QueryFactory.create(sparql);
    } catch (QueryException exception) {
      throw new IllegalArgumentException(
          "Invalid SPARQL query: " + exception.getMessage(), exception);
    }
    if (!(query.isSelectType()
        || query.isAskType()
        || query.isDescribeType()
        || query.isConstructType())) {
      throw new IllegalArgumentException("Only read-only SPARQL queries are accepted");
    }
    return query;
  }

  private static void requireQuery(String sparql, String message) {
    if (isBlank(sparql)) {
      throw new IllegalArgumentException(message);
    }
  }

  private static boolean isBlank(String value) {
    return nullOrEmpty(value) || value.isBlank();
  }

  public record QueryResult(String body, String format, String mediaType, String warning) {}

  public record ReadQuery(String sparql, Query parsed) {
    public ReadQuery {
      Objects.requireNonNull(sparql);
      Objects.requireNonNull(parsed);
    }

    public static ReadQuery parse(String sparql) {
      return new ReadQuery(sparql, parseReadOnlyQuery(sparql));
    }
  }

  private enum ResultFormat {
    JSON("json", "application/sparql-results+json", false),
    XML("xml", "application/sparql-results+xml", false),
    CSV("csv", "text/csv", false),
    TSV("tsv", "text/tab-separated-values", false),
    TURTLE("turtle", "text/turtle", true),
    RDF_XML("rdfxml", "application/rdf+xml", true),
    N_TRIPLES("ntriples", "application/n-triples", true),
    JSON_LD("jsonld", "application/ld+json", true);

    private final String externalName;
    private final String mediaType;
    private final boolean graphFormat;

    ResultFormat(String externalName, String mediaType, boolean graphFormat) {
      this.externalName = externalName;
      this.mediaType = mediaType;
      this.graphFormat = graphFormat;
    }

    private static ResultFormat parse(String requestedFormat, Query query) {
      boolean graphQuery = query.isConstructType() || query.isDescribeType();
      ResultFormat format =
          isBlank(requestedFormat) ? defaultFor(graphQuery) : named(requestedFormat);
      if (format.graphFormat != graphQuery) {
        throw new IllegalArgumentException(
            "Format '%s' is not valid for a %s query"
                .formatted(format.externalName, query.queryType()));
      }
      return format;
    }

    private static ResultFormat defaultFor(boolean graphQuery) {
      return graphQuery ? TURTLE : JSON;
    }

    private static ResultFormat named(String requestedFormat) {
      String normalized = requestedFormat.trim().toLowerCase(Locale.ROOT).replace("-", "");
      return Arrays.stream(values())
          .filter(format -> format.externalName.equals(normalized))
          .findFirst()
          .orElseThrow(
              () ->
                  new IllegalArgumentException(
                      "Unsupported SPARQL result format: " + requestedFormat));
    }
  }

  private enum InferenceLevel {
    NONE("none"),
    RDFS("rdfs"),
    OWL("owl"),
    CUSTOM("custom");

    private final String externalName;

    InferenceLevel(String externalName) {
      this.externalName = externalName;
    }

    private static InferenceLevel parse(String requestedLevel) {
      if (isBlank(requestedLevel)) {
        return NONE;
      }
      return Arrays.stream(values())
          .filter(level -> level.externalName.equalsIgnoreCase(requestedLevel.trim()))
          .findFirst()
          .orElseThrow(
              () ->
                  new IllegalArgumentException(
                      "Unsupported SPARQL inference level: " + requestedLevel));
    }
  }
}
