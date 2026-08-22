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
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/** Returns the canonical ontology or a focused description of one ontology resource. */
public class OntologyDescribeTool extends RdfMcpTool<OntologyDescribeTool.Result> {

  public OntologyDescribeTool() {
    super();
  }

  OntologyDescribeTool(Supplier<RdfRepository> repositorySupplier) {
    super(repositorySupplier);
  }

  @JsonInclude(JsonInclude.Include.NON_NULL)
  public record Result(
      String scope, String resource, String format, String mediaType, String body) {
    public Result {
      body = Objects.requireNonNullElse(body, "");
    }
  }

  @Override
  public Result execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    McpToolParameters parameters = McpToolParameters.from(params);
    String resource = parameters.optionalString("resource");
    RdfSerializationFormat format =
        RdfSerializationFormat.parse(parameters.optionalString("format"));

    return McpToolParameters.isBlank(resource)
        ? fullOntology(format)
        : describe(validateResource(resource), format);
  }

  private Result fullOntology(RdfSerializationFormat format) {
    OntologyDocument.SerializedOntology ontology =
        OntologyDocument.serialize(format.externalName());
    return new Result(
        "full-ontology", null, ontology.format(), ontology.mediaType(), ontology.body());
  }

  private Result describe(String resource, RdfSerializationFormat format) {
    try {
      String body =
          repository().executeSparqlQueryDirect("DESCRIBE <" + resource + ">", format.mediaType());
      return new Result("describe", resource, format.externalName(), format.mediaType(), body);
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
