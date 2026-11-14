package org.openmetadata.sdk.services.dataassets;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
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

  private static final ObjectMapper STATUS_OBJECT_MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

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
    String encodedFqn;
    try {
      encodedFqn = java.net.URLEncoder.encode(fqn, "UTF-8").replace("+", "%20");
    } catch (java.io.UnsupportedEncodingException e) {
      encodedFqn = fqn;
    }
    String path = basePath + "/" + encodedFqn + "/status";
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
    ListResponse<PipelineStatus> page;
    do {
      page = listPipelineStatuses(fqn, startTs, endTs, params);
      statuses.addAll(page.getData());
      params.setAfter(page.getPaging() == null ? null : page.getPaging().getAfter());
    } while (page.getData().size() == MAX_STATUS_PAGE_SIZE && params.getAfter() != null);
    return new ListResponse<>(statuses);
  }

  /** One page of statuses between {@code startTs} and {@code endTs}, newest first. */
  public ListResponse<PipelineStatus> listPipelineStatuses(
      String fqn, Long startTs, Long endTs, ListParams params) throws OpenMetadataException {
    String encodedFqn;
    try {
      encodedFqn = java.net.URLEncoder.encode(fqn, "UTF-8").replace("+", "%20");
    } catch (java.io.UnsupportedEncodingException e) {
      encodedFqn = fqn;
    }
    String path = basePath + "/" + encodedFqn + "/status?startTs=" + startTs + "&endTs=" + endTs;
    RequestOptions options = RequestOptions.builder().queryParams(params.toQueryParams()).build();
    String json = httpClient.executeForString(HttpMethod.GET, path, null, options);
    try {
      ResultList<PipelineStatus> result =
          STATUS_OBJECT_MAPPER.readValue(json, new TypeReference<ResultList<PipelineStatus>>() {});
      return new ListResponse<>(result);
    } catch (Exception e) {
      throw new OpenMetadataException(
          "Failed to deserialize pipeline status list response: " + e.getMessage(), e);
    }
  }

  public Pipeline addBulkPipelineStatus(String fqn, List<PipelineStatus> statuses)
      throws OpenMetadataException {
    String encodedFqn;
    try {
      encodedFqn = java.net.URLEncoder.encode(fqn, "UTF-8").replace("+", "%20");
    } catch (java.io.UnsupportedEncodingException e) {
      encodedFqn = fqn;
    }
    String path = basePath + "/" + encodedFqn + "/status/bulk";
    return httpClient.execute(HttpMethod.PUT, path, statuses, Pipeline.class);
  }
}
