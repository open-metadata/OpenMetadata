package org.openmetadata.mcp.tools;

import java.io.IOException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.McpApplicationContext;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

@Slf4j
public class TriggerIngestionPipelineTool implements McpTool {

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    String fqn = requireFqn(params);
    authorize(authorizer, securityContext);
    PipelineServiceClientInterface client = resolveClient();
    if (client == null) return clientNotConfiguredError(fqn);
    IngestionPipeline pipeline = fetchPipeline(fqn);
    if (!Boolean.TRUE.equals(pipeline.getDeployed())) return notDeployedError(fqn);
    LOG.info("Triggering ingestion pipeline: {}", fqn);
    setupServerConnection(pipeline);
    Object service = Entity.getEntity(pipeline.getService(), "ingestionRunner", null);
    var response = client.runPipeline(pipeline, service);
    LOG.info("Trigger response for pipeline {}: {}", fqn, response);
    return JsonUtils.getMap(response);
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
        new OperationContext(Entity.INGESTION_PIPELINE, MetadataOperation.EDIT_ALL),
        new ResourceContext<>(Entity.INGESTION_PIPELINE));
  }

  private static PipelineServiceClientInterface resolveClient() {
    return PipelineServiceClientFactory.createPipelineServiceClient(null);
  }

  private static Map<String, Object> clientNotConfiguredError(String fqn) {
    return Map.of(
        "error",
        "Pipeline service client is not configured."
            + " Ensure the ingestion infrastructure is set up.",
        "fqn",
        fqn);
  }

  private static Map<String, Object> notDeployedError(String fqn) {
    return Map.of(
        "error",
        "Pipeline '" + fqn + "' is not deployed. Deploy it first before triggering a run.",
        "fqn",
        fqn,
        "deployed",
        false);
  }

  private static IngestionPipeline fetchPipeline(String fqn) throws IOException {
    return (IngestionPipeline) Entity.getEntityByName(Entity.INGESTION_PIPELINE, fqn, "*", null);
  }

  private static void setupServerConnection(IngestionPipeline pipeline) {
    if (McpApplicationContext.getConfig() != null) {
      pipeline.setOpenMetadataServerConnection(
          new OpenMetadataConnectionBuilder(McpApplicationContext.getConfig()).build());
    }
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params)
      throws IOException {
    throw new UnsupportedOperationException(
        "TriggerIngestionPipelineTool does not require limit validation.");
  }
}
