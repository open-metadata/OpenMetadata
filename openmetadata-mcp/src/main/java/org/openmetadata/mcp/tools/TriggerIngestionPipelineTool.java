package org.openmetadata.mcp.tools;

import java.io.IOException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.McpApplicationContext;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.type.EntityReference;
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
    String fqn = (String) params.get("fqn");
    if (fqn == null || fqn.isBlank()) {
      throw new IllegalArgumentException("Parameter 'fqn' is required");
    }

    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.INGESTION_PIPELINE, MetadataOperation.EDIT_ALL),
        new ResourceContext<>(Entity.INGESTION_PIPELINE));

    PipelineServiceClientInterface pipelineServiceClient =
        PipelineServiceClientFactory.createPipelineServiceClient(null);
    if (pipelineServiceClient == null) {
      return Map.of(
          "error",
          "Pipeline service client is not configured. Ensure the ingestion infrastructure is set up.",
          "fqn",
          fqn);
    }

    LOG.info("Triggering ingestion pipeline: {}", fqn);

    IngestionPipeline pipeline =
        (IngestionPipeline)
            Entity.getEntityByName(Entity.INGESTION_PIPELINE, fqn, "*", null);

    // Set the OpenMetadata server connection so the pipeline can call back home
    if (McpApplicationContext.getConfig() != null) {
      pipeline.setOpenMetadataServerConnection(
          new OpenMetadataConnectionBuilder(McpApplicationContext.getConfig()).build());
    }

    EntityReference serviceRef = pipeline.getService();
    Object service = Entity.getEntity(serviceRef, "ingestionRunner", null);

    var response = pipelineServiceClient.runPipeline(pipeline, service);

    LOG.info("Trigger response for pipeline {}: {}", fqn, response);
    return JsonUtils.getMap(response);
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
