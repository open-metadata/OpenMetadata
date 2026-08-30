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

import com.fasterxml.jackson.annotation.JsonInclude;
import java.io.ByteArrayOutputStream;
import java.io.StringReader;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RiotException;
import org.apache.jena.shacl.ValidationReport;

/** Fetches an RDF scope, validates it with SHACL, and serializes the report. */
public final class RdfValidationService {

  static final long DEFAULT_MAX_FULL_GRAPH_TRIPLES = 100_000;
  private final RdfRepository repository;
  private final long maxFullGraphTriples;

  public RdfValidationService(RdfRepository repository) {
    this(repository, DEFAULT_MAX_FULL_GRAPH_TRIPLES);
  }

  RdfValidationService(RdfRepository repository, long maxFullGraphTriples) {
    this.repository = Objects.requireNonNull(repository);
    if (maxFullGraphTriples < 1) {
      throw new IllegalArgumentException("maxFullGraphTriples must be positive");
    }
    this.maxFullGraphTriples = maxFullGraphTriples;
  }

  public ValidationResult validate(String requestedEntityUri, String requestedFormat) {
    ensureAvailable();
    String entityUri = validateEntityUri(requestedEntityUri);
    RdfSerializationFormat format = validationFormat(requestedFormat);
    Model data = fetchData(entityUri);
    ValidationResult result;
    try {
      ValidationReport report = RdfShaclValidator.validate(data);
      result = ValidationResult.from(entityUri, format, report);
    } finally {
      data.close();
    }
    return result;
  }

  private void ensureAvailable() {
    if (!repository.isEnabled()) {
      throw new IllegalStateException("RDF repository is not enabled on this OpenMetadata server");
    }
  }

  private Model fetchData(String entityUri) {
    ensureFullGraphWithinLimitBeforeFetch(entityUri);
    String query =
        entityUri == null ? fullGraphQuery(maxFullGraphTriples) : describeQuery(entityUri);
    try {
      String turtle =
          SparqlQueryLimits.requireBoundedOutput(
              repository.executeSparqlQueryDirect(query, "turtle"));
      return parseBoundedData(turtle, entityUri);
    } catch (RiotException exception) {
      throw new IllegalStateException("Unable to load RDF data for SHACL validation", exception);
    }
  }

  private void ensureFullGraphWithinLimitBeforeFetch(String entityUri) {
    if (entityUri == null) {
      ensureFullGraphWithinLimit(entityUri, repository.getTripleCount());
    }
  }

  private void ensureFullGraphWithinLimit(String entityUri, long tripleCount) {
    if (entityUri == null && tripleCount > maxFullGraphTriples) {
      throw fullGraphTooLarge(tripleCount);
    }
  }

  private Model parseBoundedData(String turtle, String entityUri) {
    Model data = parseTurtle(turtle, repository.getBaseUri());
    try {
      ensureFullGraphWithinLimit(entityUri, data.size());
      return data;
    } catch (IllegalArgumentException exception) {
      data.close();
      throw exception;
    }
  }

  private IllegalArgumentException fullGraphTooLarge(long tripleCount) {
    return new IllegalArgumentException(
        "Full-graph SHACL validation requires %,d triples, exceeding the in-memory limit of %,d; provide entityUri to validate a bounded subgraph"
            .formatted(tripleCount, maxFullGraphTriples));
  }

  static String fullGraphQuery(long maxFullGraphTriples) {
    return "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o } LIMIT " + (maxFullGraphTriples + 1);
  }

  private static String describeQuery(String entityUri) {
    return "DESCRIBE <" + entityUri + ">";
  }

  static Model parseTurtle(String turtle, String baseUri) {
    Model model = ModelFactory.createDefaultModel();
    try (StringReader reader = new StringReader(Objects.requireNonNullElse(turtle, ""))) {
      RDFDataMgr.read(model, reader, baseUri, Lang.TURTLE);
    } catch (RiotException exception) {
      model.close();
      throw exception;
    }
    return model;
  }

  private static String validateEntityUri(String requestedEntityUri) {
    String entityUri = null;
    if (!isBlank(requestedEntityUri)) {
      entityUri = RdfIriValidator.validateEntityIri(requestedEntityUri);
      if (entityUri == null) {
        throw new IllegalArgumentException("entityUri must be an absolute http(s) IRI");
      }
    }
    return entityUri;
  }

  private static boolean isBlank(String value) {
    return nullOrEmpty(value) || value.isBlank();
  }

  private static RdfSerializationFormat validationFormat(String requestedFormat) {
    RdfSerializationFormat format = RdfSerializationFormat.parse(requestedFormat);
    return format == RdfSerializationFormat.JSON_LD ? format : RdfSerializationFormat.TURTLE;
  }

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record ValidationResult(
      String scope,
      String entityUri,
      boolean conforms,
      int violationCount,
      String format,
      String mediaType,
      String report) {

    private static ValidationResult from(
        String entityUri, RdfSerializationFormat format, ValidationReport validationReport) {
      ByteArrayOutputStream output = new ByteArrayOutputStream();
      RDFDataMgr.write(output, validationReport.getModel(), format.rdfFormat());
      int violationCount =
          nullOrEmpty(validationReport.getEntries()) ? 0 : validationReport.getEntries().size();
      return new ValidationResult(
          entityUri == null ? "full-graph" : "entity",
          entityUri,
          validationReport.conforms(),
          violationCount,
          format.externalName(),
          format.mediaType(),
          output.toString(StandardCharsets.UTF_8));
    }
  }
}
