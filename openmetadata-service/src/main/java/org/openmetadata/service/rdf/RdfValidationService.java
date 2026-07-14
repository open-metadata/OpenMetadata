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

  private static final String FULL_GRAPH_QUERY = "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }";
  private final RdfRepository repository;

  public RdfValidationService(RdfRepository repository) {
    this.repository = Objects.requireNonNull(repository);
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
    String query = entityUri == null ? FULL_GRAPH_QUERY : "DESCRIBE <" + entityUri + ">";
    try {
      String turtle = repository.executeSparqlQueryDirect(query, "text/turtle");
      return parseTurtle(turtle, repository.getBaseUri());
    } catch (RiotException exception) {
      throw new IllegalStateException("Unable to load RDF data for SHACL validation", exception);
    }
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
