package org.openmetadata.mcp.tools;

import static org.openmetadata.schema.type.MetadataOperation.VIEW_BASIC;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.util.McpParams;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.aicontext.AIContextBuilder;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * Progressive disclosure for the AI Context Platform. get_asset_context and find_context return
 * bounded excerpts of attached knowledge (marked {@code contentTruncated}) so a bundle never
 * overwhelms the context window; when the agent needs the detail of one specific item it calls this
 * tool with that item's type and fullyQualifiedName. Without a {@code query} it returns the full
 * body; with a {@code query} it returns only the most relevant passages of a long article, using
 * the dedicated per-chunk embeddings (issue #4789).
 */
@Slf4j
public class GetKnowledgeContentTool implements McpTool {
  private static final int DEFAULT_PASSAGES = 3;
  private static final int MAX_PASSAGES = 10;
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
      authorizer.authorize(
          securityContext,
          new OperationContext(entityType, VIEW_BASIC),
          new ResourceContext<>(entityType, null, fqn));
      result = resolveContent(entityType, fqn, params);
    }
    return result;
  }

  private Map<String, Object> resolveContent(
      String entityType, String fqn, Map<String, Object> params) {
    EntityInterface entity = Entity.getEntityByName(entityType, fqn, "", Include.NON_DELETED);
    String query = (String) params.get("query");
    String format = (String) params.getOrDefault("format", "markdown");
    Map<String, Object> result;
    if (query != null && !query.isBlank() && vectorSearchEnabled()) {
      int size =
          Math.min(Math.max(McpParams.getInt(params, "size", DEFAULT_PASSAGES), 1), MAX_PASSAGES);
      List<String> passages =
          OpenSearchVectorService.getInstance()
              .searchChunksByParent(entity.getId().toString(), query, size);
      result = renderPassages(fqn, passages, format);
    } else {
      result = renderFull(fqn, AIContextBuilder.fullContentOf(entity), format);
    }
    return result;
  }

  private boolean vectorSearchEnabled() {
    return Entity.getSearchRepository().isVectorEmbeddingEnabled()
        && OpenSearchVectorService.getInstance() != null;
  }

  private Map<String, Object> renderFull(String fqn, String content, String format) {
    String body = content == null ? "" : content;
    Map<String, Object> result;
    if (FORMAT_JSON.equalsIgnoreCase(format)) {
      result = Map.of("fullyQualifiedName", fqn, "content", body);
    } else {
      result = Map.of("format", "markdown", "content", body);
    }
    return result;
  }

  private Map<String, Object> renderPassages(String fqn, List<String> passages, String format) {
    Map<String, Object> result;
    if (FORMAT_JSON.equalsIgnoreCase(format)) {
      result = Map.of("fullyQualifiedName", fqn, "passages", passages);
    } else {
      result = Map.of("format", "markdown", "content", String.join("\n\n---\n\n", passages));
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
        "GetKnowledgeContentTool does not require limit validation.");
  }
}
