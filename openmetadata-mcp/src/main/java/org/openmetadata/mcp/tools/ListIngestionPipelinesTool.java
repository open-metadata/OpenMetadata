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
    authorize(authorizer, securityContext);
    int limit = CommonUtils.parseLimit(params, "limit", 10);
    LOG.info(
        "Listing ingestion pipelines — service: {}, pipelineType: {}, limit: {}",
        params.get("service"),
        params.get("pipelineType"),
        limit);
    return fetchAndClean(params, limit);
  }

  private static void authorize(Authorizer authorizer, CatalogSecurityContext securityContext) {
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.INGESTION_PIPELINE, MetadataOperation.VIEW_BASIC),
        new ResourceContext<>(Entity.INGESTION_PIPELINE));
  }

  private static Map<String, Object> fetchAndClean(Map<String, Object> params, int limit)
      throws IOException {
    IngestionPipelineRepository repo =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
    ListFilter filter = buildFilter(params);
    String after = (String) params.get("after");
    var resultList =
        repo.listAfter(null, repo.getFields("sourceConfig,pipelineType"), filter, limit, after);
    Map<String, Object> response = JsonUtils.getMap(resultList);
    stripVerboseFields(response);
    return response;
  }

  private static ListFilter buildFilter(Map<String, Object> params) {
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    String service = (String) params.get("service");
    String pipelineType = (String) params.get("pipelineType");
    if (service != null && !service.isBlank()) filter.addQueryParam("service", service);
    if (pipelineType != null && !pipelineType.isBlank())
      filter.addQueryParam("pipelineType", pipelineType);
    return filter;
  }

  private static void stripVerboseFields(Map<String, Object> response) {
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
