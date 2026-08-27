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

package org.openmetadata.mcp.tools;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.io.IOException;
import java.util.Map;
import java.util.Objects;
import java.util.function.Supplier;
import org.openmetadata.service.rdf.OntologyDocument;
import org.openmetadata.service.rdf.RdfIriValidator;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.RdfSerializationFormat;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/** Returns the canonical ontology or a focused description of one ontology resource. */
public class OntologyDescribeTool extends RdfMcpTool<OntologyDescribeTool.Result> {

  public OntologyDescribeTool() {
    super();
  }

  OntologyDescribeTool(Supplier<RdfRepository> repositorySupplier) {
    super(repositorySupplier);
  }

  /**
   * {@code truncated} / {@code byteCount} mirror {@code SparqlQueryTool.Result}. The full ontology
   * serializes to roughly 65 KB of Turtle, which cleared the dispatch cap only by luck; an ontology
   * that grows past it would have had the entire response replaced by a data-less stub. Prefer
   * {@code resource} for a focused DESCRIBE over pulling the whole document.
   */
  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record Result(
      String scope,
      String resource,
      String format,
      String mediaType,
      String body,
      boolean truncated,
      int byteCount) {
    public Result {
      body = Objects.requireNonNullElse(body, "");
    }
  }

  @Override
  protected Result executeAuthorized(
      final CatalogSecurityContext securityContext, final Map<String, Object> params)
      throws IOException {
    McpToolParameters parameters = McpToolParameters.from(params);
    String resource = parameters.optionalString("resource");
    RdfSerializationFormat format =
        RdfSerializationFormat.parse(parameters.optionalString("format"));

    int maxBytes =
        RdfBody.clamp(
            parameters.integer("maxBytes", RdfBody.MAX_BYTES),
            RdfBody.MIN_BYTES,
            RdfBody.MAX_BYTES);

    return McpToolParameters.isBlank(resource)
        ? fullOntology(format, maxBytes)
        : describe(securityContext, validateResource(resource), format, maxBytes);
  }

  private Result fullOntology(RdfSerializationFormat format, int maxBytes) {
    OntologyDocument.SerializedOntology ontology =
        OntologyDocument.serialize(format.externalName());
    RdfBody.Bounded body = RdfBody.bound(ontology.body(), maxBytes);
    return new Result(
        "full-ontology",
        null,
        ontology.format(),
        ontology.mediaType(),
        body.value(),
        body.truncated(),
        body.byteCount());
  }

  private Result describe(
      CatalogSecurityContext securityContext,
      String resource,
      RdfSerializationFormat format,
      int maxBytes) {
    RdfRepository repository = repository();
    // The guard call stays outside any catch: QueryCapacityException and QueryTimeoutException
    // carry their own 429/503 classification, and folding them into an IllegalStateException here
    // would report a busy or slow triplestore as an opaque server error.
    String response = guardedRead(securityContext, () -> runDescribe(repository, resource, format));
    RdfBody.Bounded body = RdfBody.bound(response, maxBytes);
    return new Result(
        "describe",
        resource,
        format.externalName(),
        format.mediaType(),
        body.value(),
        body.truncated(),
        body.byteCount());
  }

  private static String runDescribe(
      RdfRepository repository, String resource, RdfSerializationFormat format) {
    try {
      return repository.executeSparqlQueryDirect("DESCRIBE <" + resource + ">", format.mediaType());
    } catch (RuntimeException exception) {
      throw new IllegalStateException("Ontology DESCRIBE failed for " + resource, exception);
    }
  }

  private static String validateResource(String requestedResource) {
    String resource = RdfIriValidator.validateEntityIri(requestedResource);
    if (resource == null) {
      throw new IllegalArgumentException("'resource' must be a valid absolute http(s) IRI");
    }
    return resource;
  }
}
