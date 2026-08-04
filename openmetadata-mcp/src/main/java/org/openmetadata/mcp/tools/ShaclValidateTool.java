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

import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.RdfValidationService;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/** Runs SHACL validation against an entity subgraph or an explicitly requested full graph. */
public class ShaclValidateTool extends RdfMcpTool<RdfValidationService.ValidationResult> {

  public ShaclValidateTool() {
    super();
  }

  ShaclValidateTool(Supplier<RdfRepository> repositorySupplier) {
    super(repositorySupplier);
  }

  @Override
  public RdfValidationService.ValidationResult execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    McpToolParameters parameters = McpToolParameters.from(params);
    RdfRepository repository = repository();
    Optional<String> entityUri = resolveEntityUri(parameters, repository.getBaseUri());
    requireExplicitFullGraph(parameters, entityUri);

    return new RdfValidationService(repository)
        .validate(entityUri.orElse(null), parameters.optionalString("format"));
  }

  private static Optional<String> resolveEntityUri(McpToolParameters parameters, String baseUri) {
    String explicitUri = parameters.optionalString("entityUri");
    Optional<McpEntityReference> entity = McpEntityReference.optional(parameters);
    if (!McpToolParameters.isBlank(explicitUri) && entity.isPresent()) {
      throw new IllegalArgumentException(
          "Use either 'entityUri' or 'entityId' with 'entityType', not both");
    }
    return McpToolParameters.isBlank(explicitUri)
        ? entity.map(reference -> reference.uri(baseUri))
        : Optional.of(explicitUri);
  }

  private static void requireExplicitFullGraph(
      McpToolParameters parameters, Optional<String> entityUri) {
    if (entityUri.isEmpty() && !parameters.booleanValue("fullGraph")) {
      throw new IllegalArgumentException(
          "Full-graph SHACL validation requires fullGraph=true because it loads the entire triplestore into memory");
    }
  }
}
