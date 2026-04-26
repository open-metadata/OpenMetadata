package org.openmetadata.mcp.tools;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Slf4j
public class ListIngestionPipelinesTool implements McpTool {

  private static final List<String> EXCLUDE_FIELDS =
      List.of(
          "version",
          "updatedAt",
          "updatedBy",
          "changeDescription",
          "sourceHash",
          "openMetadataServerConnection",
          "airflowConfig");

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    String service = (String) params.get("service");
    String pipelineType = (String) params.get("pipelineType");
    String after = (String) params.get("after");
    int limit = CommonUtils.parseLimit(params, "limit", 10);

    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.INGESTION_PIPELINE, MetadataOperation.VIEW_BASIC),
        new ResourceContext<>(Entity.INGESTION_PIPELINE));

    LOG.info(
        "Listing ingestion pipelines — service: {}, pipelineType: {}, limit: {}",
        service,
        pipelineType,
        limit);

    IngestionPipelineRepository repository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    ListFilter filter = new ListFilter(Include.NON_DELETED);
    if (service != null && !service.isBlank()) {
      filter.addQueryParam("service", service);
    }
    if (pipelineType != null && !pipelineType.isBlank()) {
      filter.addQueryParam("pipelineType", pipelineType);
    }

    var resultList =
        repository.listAfter(
            null, repository.getFields("sourceConfig,pipelineType"), filter, limit, after);

    Map<String, Object> response = JsonUtils.getMap(resultList);
    if (response.get("data") instanceof List<?> pipelines) {
      pipelines.forEach(
          p -> {
            if (p instanceof Map<?, ?> pipeline) {
              @SuppressWarnings("unchecked")
              Map<String, Object> m = (Map<String, Object>) pipeline;
              EXCLUDE_FIELDS.forEach(m::remove);
            }
          });
    }
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
        "ListIngestionPipelinesTool does not require limit validation.");
  }
}
