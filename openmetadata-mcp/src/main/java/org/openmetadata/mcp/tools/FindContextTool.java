package org.openmetadata.mcp.tools;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.util.McpParams;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.aicontext.AIContextFinder;
import org.openmetadata.service.aicontext.AIContextFinder.FoundContext;
import org.openmetadata.service.aicontext.AIContextFinderAccess;
import org.openmetadata.service.aicontext.AIContextMarkdown;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Mode B of the AI Context Platform. Given a business question with no chosen asset, semantically
 * searches the company-knowledge layer (glossary terms, metrics, Context Center articles) and
 * returns the relevant definitions together with the candidate data assets each concept routes to.
 * The agent then hands those candidate FQNs to {@code get_asset_context} to pull full asset context.
 *
 * <p>Authorization: the caller must hold VIEW_ALL on the knowledge types this tool surfaces
 * (glossary terms, metrics, pages); glossary-routed candidates are RBAC-filtered by threading the
 * caller's subject into the search, and relationship-routed candidates are permission-checked
 * per asset before being returned.
 */
@Slf4j
public class FindContextTool implements McpTool {
  private static final int DEFAULT_SIZE = 10;
  private static final int MAX_SIZE = 50;
  private static final String FORMAT_JSON = "json";
  private static final String NO_RESULTS_MESSAGE = "No company knowledge found for this query.";

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    String query = (String) params.get("query");
    Map<String, Object> result;
    if (query == null || query.isBlank()) {
      result = Map.of("error", "'query' parameter is required");
    } else if (!Entity.getSearchRepository().isVectorEmbeddingEnabled()) {
      result =
          Map.of(
              "error",
              "Semantic search is not enabled. Configure vector embeddings in the OpenMetadata server settings.");
    } else {
      AIContextFinderAccess.authorizeKnowledgeAccess(authorizer, securityContext);
      String format = (String) params.getOrDefault("format", "markdown");
      int size = Math.min(Math.max(McpParams.getInt(params, "size", DEFAULT_SIZE), 1), MAX_SIZE);
      LOG.info("Finding company context for query: {}, format: {}", query, format);
      SubjectContext subjectContext = DefaultAuthorizer.getSubjectContext(securityContext);
      FoundContext found = new AIContextFinder(subjectContext).find(query, size);
      result =
          render(
              AIContextFinderAccess.filterCandidates(found, authorizer, securityContext), format);
    }
    return result;
  }

  private Map<String, Object> render(FoundContext found, String format) {
    Map<String, Object> result;
    if (FORMAT_JSON.equalsIgnoreCase(format)) {
      result =
          found.isEmpty()
              ? Map.of(
                  "items", List.of(), "candidateAssets", List.of(), "message", NO_RESULTS_MESSAGE)
              : JsonUtils.getMap(found);
    } else {
      // Keep the {format, content} shape on the empty case too, so markdown consumers never need
      // a special branch; the message field carries the human-readable reason.
      result =
          found.isEmpty()
              ? Map.of(
                  "format",
                  "markdown",
                  "content",
                  AIContextMarkdown.renderFound(found),
                  "message",
                  NO_RESULTS_MESSAGE)
              : Map.of("format", "markdown", "content", AIContextMarkdown.renderFound(found));
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
