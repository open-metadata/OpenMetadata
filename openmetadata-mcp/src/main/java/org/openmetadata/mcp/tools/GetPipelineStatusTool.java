package org.openmetadata.mcp.tools;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Slf4j
public class GetPipelineStatusTool implements McpTool {

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    String fqn = requireFqn(params);
    int limit = CommonUtils.parseLimit(params, "limit", 5);
    authorize(authorizer, securityContext);
    LOG.info("Getting pipeline status for FQN: {}, limit: {}", fqn, limit);
    return buildStatusResponse(fqn, limit);
  }

  private static String requireFqn(Map<String, Object> params) {
    String fqn = (String) params.get("fqn");
    if (fqn == null || fqn.isBlank()) {
      throw new IllegalArgumentException("Parameter 'fqn' is required");
    }
    return fqn;
  }

  private static void authorize(Authorizer authorizer, CatalogSecurityContext securityContext) {
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.INGESTION_PIPELINE, MetadataOperation.VIEW_BASIC),
        new ResourceContext<>(Entity.INGESTION_PIPELINE));
  }

  private static Map<String, Object> buildStatusResponse(String fqn, int limit) throws IOException {
    IngestionPipelineRepository repo =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
    IngestionPipeline pipeline =
        (IngestionPipeline) Entity.getEntityByName(Entity.INGESTION_PIPELINE, fqn, "", null);
    var latestStatus = repo.getLatestPipelineStatus(pipeline);
    var recentRuns = repo.listPipelineStatus(fqn, null, null, limit);
    Map<String, Object> response = new HashMap<>();
    response.put("fqn", fqn);
    response.put("pipelineName", pipeline.getName());
    response.put("pipelineType", pipeline.getPipelineType());
    response.put("enabled", pipeline.getEnabled());
    response.put("deployed", pipeline.getDeployed());
    response.put("latestStatus", latestStatus != null ? JsonUtils.getMap(latestStatus) : null);
    response.put("recentRuns", JsonUtils.getMap(recentRuns));
    return response;
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params)
      throws IOException {
    throw new UnsupportedOperationException(
        "GetPipelineStatusTool does not require limit validation.");
  }
}
