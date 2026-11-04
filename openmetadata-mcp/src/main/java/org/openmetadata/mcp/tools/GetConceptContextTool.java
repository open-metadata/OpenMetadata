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

import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.aicontext.AIContextBuilder;
import org.openmetadata.service.aicontext.AIContextMarkdown;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/** Resolves a glossary term or metric using the same authorized context builder as REST. */
public class GetConceptContextTool implements TypedMcpTool<Object> {
  private static final String FORMAT_MARKDOWN = "markdown";
  private static final Set<String> CONCEPT_TYPES = Set.of(Entity.GLOSSARY_TERM, Entity.METRIC);
  private static final Set<String> FORMATS = Set.of(FORMAT_MARKDOWN, AIContextMarkdown.FORMAT_JSON);

  record Parameters(String entityType, String fqn, String format, String query) {
    static Parameters from(Map<String, Object> values) {
      McpToolParameters params = McpToolParameters.from(values);
      String entityType = params.requiredString("entityType");
      String fqn = params.requiredString("fqn");
      String format = params.optionalString("format");
      format = format == null ? FORMAT_MARKDOWN : format;
      if (!CONCEPT_TYPES.contains(entityType) || !FORMATS.contains(format)) {
        throw new IllegalArgumentException(
            "entityType must be glossaryTerm or metric, and format must be markdown or json");
      }
      return new Parameters(entityType, fqn, format, params.optionalString("query"));
    }
  }

  private record MarkdownContent(String format, String content) {}

  @Override
  public Object execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> values) {
    Parameters params = Parameters.from(values);
    authorizer.authorize(
        securityContext,
        new OperationContext(params.entityType(), MetadataOperation.VIEW_ALL),
        new ResourceContext<>(params.entityType(), null, params.fqn()));
    AIContext context =
        new AIContextBuilder(params.entityType(), params.fqn())
            .withSecurity(authorizer, securityContext)
            .withQuery(params.query())
            .build();
    return AIContextMarkdown.FORMAT_JSON.equals(params.format())
        ? context
        : new MarkdownContent(FORMAT_MARKDOWN, AIContextMarkdown.render(context));
  }

  @Override
  public Object execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    return execute(authorizer, securityContext, params);
  }
}
