/*
 *  Copyright 2025 Collate
 *  Licensed under the Collate Community License, Version 1.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  https://github.com/open-metadata/OpenMetadata/blob/main/ingestion/LICENSE
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.mcp.tools;

import static org.openmetadata.schema.type.MetadataOperation.EDIT_ALL;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/**
 * Triggers an OpenMetadata ingestion pipeline via the same pathway used by the {@code
 * IngestionPipelineResource#triggerIngestion} REST endpoint.
 */
@Slf4j
public class RunIngestionTool implements McpTool {

  private static final String RESOURCE = Entity.INGESTION_PIPELINE;
  private static final String PARAM_FQN = "ingestionPipelineFqn";

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    throw new UnsupportedOperationException("RunIngestionTool requires limit validation.");
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params)
      throws IOException {
    final String fqn = requireString(params, PARAM_FQN);
    if (fqn == null) {
      return errorMap(PARAM_FQN + " is required");
    }

    IngestionPipeline pipeline =
        (IngestionPipeline) Entity.getEntityByName(RESOURCE, fqn, "*", Include.NON_DELETED);
    if (pipeline == null) {
      return errorMap("Pipeline not found: " + fqn);
    }
    if (Boolean.FALSE.equals(pipeline.getEnabled())) {
      return errorMap("Pipeline is disabled: " + fqn);
    }

    OperationContext operationContext = new OperationContext(RESOURCE, EDIT_ALL);
    ResourceContext<IngestionPipeline> resourceContext =
        new ResourceContext<>(RESOURCE, pipeline.getId(), null);
    CreateResourceContext<IngestionPipeline> createResourceContext =
        new CreateResourceContext<>(RESOURCE, pipeline);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    authorizer.authorize(securityContext, operationContext, resourceContext);

    IngestionPipelineRepository repo =
        (IngestionPipelineRepository) Entity.getEntityRepository(RESOURCE);
    PipelineServiceClientInterface client = repo.getPipelineServiceClient();
    if (client == null) {
      return errorMap(
          "Pipeline Service Client is not configured on this server -- cannot trigger ingestions.");
    }

    ServiceEntityInterface service =
        Entity.getEntity(pipeline.getService(), "ingestionRunner", Include.NON_DELETED);

    PipelineServiceClientResponse response;
    try {
      response = client.runPipeline(pipeline, service);
    } catch (Exception exc) {
      LOG.warn("runPipeline failed for {}: {}", fqn, exc.getMessage());
      return errorMap("Trigger failed: " + exc.getMessage());
    }

    Map<String, Object> result = new HashMap<>();
    result.put("pipelineFqn", fqn);
    result.put(
        "state", response.getCode() != null && response.getCode() == 200 ? "triggered" : "error");
    result.put("statusCode", response.getCode());
    result.put("reason", response.getReason() != null ? response.getReason() : "Triggered");
    result.put("platform", response.getPlatform());
    result.put("triggeredAt", System.currentTimeMillis());
    return result;
  }

  private static String requireString(Map<String, Object> params, String key) {
    Object v = params.get(key);
    return (v == null || v.toString().isBlank()) ? null : v.toString().trim();
  }

  private static Map<String, Object> errorMap(String msg) {
    Map<String, Object> m = new HashMap<>();
    m.put("error", msg);
    return m;
  }
}
