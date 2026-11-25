package org.openmetadata.sdk.services.dataassets;

import com.fasterxml.jackson.core.type.TypeReference;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.sdk.services.EntityServiceBase;

public class PipelineService extends EntityServiceBase<Pipeline> {
  /**
   * The largest page of statuses the server returns
   * (ADR:2026-11-05-pipeline-entity-status-reads-hold-at-most-one-page).
   */
  private static final int MAX_STATUS_PAGE_SIZE = 1000;

  private static final TypeReference<ResultList<PipelineStatus>> PIPELINE_STATUS_LIST_TYPE =
      new TypeReference<>() {};

  public PipelineService(HttpClient httpClient) {
    super(httpClient, "/v1/pipelines");
  }

  @Override
  protected Class<Pipeline> getEntityClass() {
    return Pipeline.class;
  }

  // Create using CreatePipeline request
  public Pipeline create(CreatePipeline request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Pipeline.class);
  }

  public Pipeline addPipelineStatus(String fqn, PipelineStatus status)
      throws OpenMetadataException {
    String path = basePath + "/" + encodeFqn(fqn) + "/status";
    return httpClient.execute(HttpMethod.PUT, path, status, Pipeline.class);
  }

  /**
   * Every status between {@code startTs} and {@code endTs}, newest first. The server returns at
   * most one page per request, so this follows the paging cursor to the end of the range.
   */
  public ListResponse<PipelineStatus> listPipelineStatuses(String fqn, Long startTs, Long endTs)
      throws OpenMetadataException {
    List<PipelineStatus> statuses = new ArrayList<>();
    ListParams params = new ListParams().setLimit(MAX_STATUS_PAGE_SIZE);
    String previousAfter = null;
    while (true) {
      ListResponse<PipelineStatus> page = listPipelineStatuses(fqn, startTs, endTs, params);
      List<PipelineStatus> pageData = page.getData();
      if (pageData != null && !pageData.isEmpty()) {
        statuses.addAll(pageData);
      }
      String nextAfter = page.getPaging() == null ? null : page.getPaging().getAfter();
      if (pageData == null
          || pageData.size() < MAX_STATUS_PAGE_SIZE
          || nextAfter == null
          || nextAfter.isBlank()
          || nextAfter.equals(previousAfter)) {
        break;
      }
      previousAfter = nextAfter;
      params.setAfter(nextAfter);
    }
    return new ListResponse<>(statuses);
  }

  /** One page of statuses between {@code startTs} and {@code endTs}, newest first. */
  public ListResponse<PipelineStatus> listPipelineStatuses(
      String fqn, Long startTs, Long endTs, ListParams params) throws OpenMetadataException {
    String path = basePath + "/" + encodeFqn(fqn) + "/status";
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();
    if (params != null) {
      optionsBuilder.queryParams(params.toQueryParams());
    }
    if (startTs != null) {
      optionsBuilder.queryParam("startTs", String.valueOf(startTs));
    }
    if (endTs != null) {
      optionsBuilder.queryParam("endTs", String.valueOf(endTs));
    }
    ResultList<PipelineStatus> result =
        httpClient.executeForType(
            HttpMethod.GET, path, null, PIPELINE_STATUS_LIST_TYPE, optionsBuilder.build());
    return new ListResponse<>(result);
  }

  public Pipeline addBulkPipelineStatus(String fqn, List<PipelineStatus> statuses)
      throws OpenMetadataException {
    String path = basePath + "/" + encodeFqn(fqn) + "/status/bulk";
    return httpClient.execute(HttpMethod.PUT, path, statuses, Pipeline.class);
  }

  private static String encodeFqn(String fqn) {
    return URLEncoder.encode(fqn, StandardCharsets.UTF_8).replace("+", "%20");
  }
}
