package org.openmetadata.mcp.tools;

import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Slf4j
public class GetEntityTool implements McpTool {

  // Fields to exclude from response to optimize LLM context usage
  // These fields are typically verbose and not useful for LLM understanding
  private static final List<String> EXCLUDE_FIELDS =
      List.of(
          "version",
          "updatedAt",
          "updatedBy",
          "changeDescription",
          "followers",
          "votes",
          "totalVotes",
          "usageSummary",
          "lifeCycle",
          "sourceHash",
          "fqnParts",
          "fqnHash",
          "entityRelationship",
          "processedLineage",
          "upstreamLineage",
          "changeSummary",
          "tierSources",
          "tagSources",
          "descriptionSources",
          "columnDescriptionStatus",
          "descriptionStatus",
          "embeddings",
          "extension");

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    String entityType = (String) params.get("entityType");
    String fqn = (String) params.get("fqn");
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, VIEW_ALL),
        new ResourceContext<>(entityType));
    LOG.info("Getting details for entity type: {}, FQN: {}", entityType, fqn);
    String fields = "*";
    Map<String, Object> entityData =
        JsonUtils.getMap(Entity.getEntityByName(entityType, fqn, fields, null));

    // Clean response to optimize LLM context usage
    return cleanEntityResponse(entityData);
  }

  /**
   * Removes verbose fields from entity response to optimize LLM context. Keeps essential fields
   * while removing metadata that adds little value for LLM understanding.
   */
  private static Map<String, Object> cleanEntityResponse(Map<String, Object> entityData) {
    if (entityData == null) {
      return new HashMap<>();
    }
    Map<String, Object> cleaned = new HashMap<>(entityData);
    EXCLUDE_FIELDS.forEach(cleaned::remove);
    return cleaned;
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params)
      throws IOException {
    throw new UnsupportedOperationException("GetEntityTool does not requires limit validation.");
  }
}
