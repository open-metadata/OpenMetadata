package org.openmetadata.mcp.tools;

import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;

import java.io.IOException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.aicontext.AIContextBuilder;
import org.openmetadata.service.aicontext.AIContextMarkdown;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * Returns the full AI Context (Context Profile) for a single data asset in one call: the attached
 * business knowledge (glossary terms, Context Center articles) plus the type-specific structural
 * context (for tables: schema, primary/foreign keys, and frequently-joined columns). Agents use this
 * after they have selected an asset to gather the strong, deterministic signals needed for tasks
 * such as SQL generation, instead of stitching several metadata calls together.
 */
@Slf4j
public class GetAssetContextTool implements McpTool {
  private static final String FORMAT_JSON = "json";

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    String entityType = (String) params.get("entityType");
    String fqn = (String) params.get("fqn");
    Map<String, Object> result;
    if (entityType == null || entityType.isBlank() || fqn == null || fqn.isBlank()) {
      result = Map.of("error", "'entityType' and 'fqn' parameters are required");
    } else {
      String format = (String) params.getOrDefault("format", "markdown");
      // Authorize against the specific asset (by FQN), not just the type, so conditional
      // per-entity policies (owner/domain/tag-based rules) are evaluated for this asset.
      authorizer.authorize(
          securityContext,
          new OperationContext(entityType, VIEW_ALL),
          new ResourceContext<>(entityType, null, fqn));
      LOG.info(
          "Assembling AI context for entity type: {}, FQN: {}, format: {}",
          entityType,
          fqn,
          format);
      AIContext context =
          new AIContextBuilder(entityType, fqn).withSecurity(authorizer, securityContext).build();
      result =
          FORMAT_JSON.equalsIgnoreCase(format)
              ? JsonUtils.getMap(context)
              : Map.of("format", "markdown", "content", AIContextMarkdown.render(context));
    }
    return result;
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params)
      throws IOException {
    throw new UnsupportedOperationException(
        "GetAssetContextTool does not require limit validation.");
  }
}
