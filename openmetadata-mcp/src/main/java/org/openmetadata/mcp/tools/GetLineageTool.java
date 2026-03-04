package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.io.IOException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.LineageRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Slf4j
public class GetLineageTool implements McpTool {

  // Defaults matching ai-platform GetLineageTool.kt for consistency
  private static final int DEFAULT_DEPTH = 3;
  // Maximum depth to prevent exponential response growth (lineage graphs can explode)
  private static final int MAX_DEPTH = 10;

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    if (nullOrEmpty(params)) {
      throw new IllegalArgumentException("Parameters cannot be null or empty");
    }
    String entityType = (String) params.get("entityType");
    String fqn = (String) params.get("fqn");

    if (nullOrEmpty(entityType) || nullOrEmpty(fqn)) {
      throw new IllegalArgumentException("Parameters 'entityType' and 'fqn' are required");
    }

    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC),
        new ResourceContext<>(entityType));

    // Parse and validate upstream depth with default and max limits
    int upstreamDepth = parseDepthParameter(params.get("upstreamDepth"), DEFAULT_DEPTH);
    // Parse and validate downstream depth with default and max limits
    int downstreamDepth = parseDepthParameter(params.get("downstreamDepth"), DEFAULT_DEPTH);

    LOG.info(
        "Getting lineage for entity type: {}, FQN: {}, upstreamDepth: {}, downstreamDepth: {}",
        entityType,
        fqn,
        upstreamDepth,
        downstreamDepth);

    return JsonUtils.getMap(
        new LineageRepository().getByName(entityType, fqn, upstreamDepth, downstreamDepth));
  }

  /**
   * Parses depth parameter with default value and enforces maximum limit to prevent excessive
   * response sizes that could overwhelm LLM context.
   */
  private static int parseDepthParameter(Object depthObj, int defaultValue) {
    if (depthObj == null) {
      return Math.min(Math.max(defaultValue, 1), MAX_DEPTH);
    }
    int depth = defaultValue;
    if (depthObj instanceof Number number) {
      depth = number.intValue();
    } else if (depthObj instanceof String string) {
      try {
        depth = Integer.parseInt(string);
      } catch (NumberFormatException e) {
        depth = defaultValue;
      }
    }
    // Enforce maximum depth to prevent exponential response growth
    return Math.min(Math.max(depth, 1), MAX_DEPTH);
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params)
      throws IOException {
    throw new UnsupportedOperationException("GetLineageTool does not support limits enforcement.");
  }
}
