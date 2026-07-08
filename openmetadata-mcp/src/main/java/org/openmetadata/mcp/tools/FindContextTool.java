package org.openmetadata.mcp.tools;

import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_BASIC;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.util.McpParams;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.aicontext.AIContextFinder;
import org.openmetadata.service.aicontext.AIContextFinder.CandidateAsset;
import org.openmetadata.service.aicontext.AIContextFinder.FoundContext;
import org.openmetadata.service.aicontext.AIContextMarkdown;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
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
  private static final List<String> KNOWLEDGE_TYPES =
      List.of(Entity.GLOSSARY_TERM, Entity.METRIC, Entity.PAGE);

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
      authorizeKnowledgeAccess(authorizer, securityContext);
      String format = (String) params.getOrDefault("format", "markdown");
      int size = Math.min(Math.max(McpParams.getInt(params, "size", DEFAULT_SIZE), 1), MAX_SIZE);
      LOG.info("Finding company context for query: {}, format: {}", query, format);
      SubjectContext subjectContext = DefaultAuthorizer.getSubjectContext(securityContext);
      FoundContext found = new AIContextFinder(subjectContext).find(query, size);
      result = render(filterCandidates(found, authorizer, securityContext), format);
    }
    return result;
  }

  private void authorizeKnowledgeAccess(
      Authorizer authorizer, CatalogSecurityContext securityContext) {
    for (String knowledgeType : KNOWLEDGE_TYPES) {
      authorizer.authorize(
          securityContext,
          new OperationContext(knowledgeType, VIEW_ALL),
          new ResourceContext<>(knowledgeType));
    }
  }

  /**
   * Drops candidate assets the caller cannot view. Glossary-routed candidates are already
   * RBAC-filtered by the subject-scoped search; this guards the relationship-routed ones
   * (metric APPLIED_TO, page HAS), which are read straight from the entity-relationship table.
   */
  private FoundContext filterCandidates(
      FoundContext found, Authorizer authorizer, CatalogSecurityContext securityContext) {
    List<CandidateAsset> visible = new ArrayList<>();
    for (CandidateAsset asset : found.candidateAssets()) {
      if (canView(asset, authorizer, securityContext)) {
        visible.add(asset);
      }
    }
    return new FoundContext(found.items(), visible);
  }

  private boolean canView(
      CandidateAsset asset, Authorizer authorizer, CatalogSecurityContext securityContext) {
    boolean visible = false;
    try {
      authorizer.authorize(
          securityContext,
          new OperationContext(asset.entityType(), VIEW_BASIC),
          new ResourceContext<>(asset.entityType(), null, asset.fullyQualifiedName()));
      visible = true;
    } catch (Exception e) {
      LOG.debug(
          "Dropping candidate asset {} not viewable by caller: {}",
          asset.fullyQualifiedName(),
          e.getMessage());
    }
    return visible;
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
