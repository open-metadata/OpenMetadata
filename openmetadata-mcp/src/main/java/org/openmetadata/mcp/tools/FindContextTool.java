package org.openmetadata.mcp.tools;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.util.McpParams;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.aicontext.AIContextFinder;
import org.openmetadata.service.aicontext.AIContextFinder.FoundContext;
import org.openmetadata.service.aicontext.AIContextMarkdown;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

/**
 * Mode B of the AI Context Platform. Given a business question with no chosen asset, semantically
 * searches the company-knowledge layer (glossary terms, metrics, Context Center articles) and
 * returns the relevant definitions together with the candidate data assets each concept routes to.
 * The agent then hands those candidate FQNs to {@code get_asset_context} to pull full asset context.
 */
@Slf4j
public class FindContextTool implements McpTool {
  private static final int DEFAULT_SIZE = 10;
  private static final int MAX_SIZE = 50;
  private static final String FORMAT_JSON = "json";

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    String query = (String) params.get("query");
    Map<String, Object> result;
    if (query == null || query.isBlank()) {
      result = Map.of("error", "'query' parameter is required");
    } else {
      String format = (String) params.getOrDefault("format", "markdown");
      int size = Math.min(Math.max(McpParams.getInt(params, "size", DEFAULT_SIZE), 1), MAX_SIZE);
      LOG.info("Finding company context for query: {}, format: {}", query, format);
      FoundContext found = new AIContextFinder().find(query, size);
      result = render(found, format);
    }
    return result;
  }

  private Map<String, Object> render(FoundContext found, String format) {
    Map<String, Object> result;
    if (found.isEmpty()) {
      result =
          Map.of(
              "items",
              List.of(),
              "candidateAssets",
              List.of(),
              "message",
              "No company knowledge found for this query.");
    } else if (FORMAT_JSON.equalsIgnoreCase(format)) {
      result = JsonUtils.getMap(found);
    } else {
      result = Map.of("format", "markdown", "content", AIContextMarkdown.renderFound(found));
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
    throw new UnsupportedOperationException("FindContextTool does not require limit validation.");
  }
}
