package org.openmetadata.sdk.services.lineage;

import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

public class LineageAPI {
  private final HttpClient httpClient;

  public LineageAPI(HttpClient httpClient) {
    this.httpClient = httpClient;
  }

  public String getLineage(String entity, String upstreamDepth, String downstreamDepth)
      throws OpenMetadataException {
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();

    if (upstreamDepth != null) optionsBuilder.queryParam("upstreamDepth", upstreamDepth);
    if (downstreamDepth != null) optionsBuilder.queryParam("downstreamDepth", downstreamDepth);

    return httpClient.executeForString(
        HttpMethod.GET, "/v1/lineage/" + entity, null, optionsBuilder.build());
  }

  public String getLineage(String entity) throws OpenMetadataException {
    return getLineage(entity, null, null);
  }

  public String addLineage(Object lineageRequest) throws OpenMetadataException {
    return httpClient.executeForString(HttpMethod.PUT, "/v1/lineage", lineageRequest);
  }

  public String deleteLineage(String fromEntity, String toEntity) throws OpenMetadataException {
    RequestOptions options =
        RequestOptions.builder().queryParam("edge", fromEntity + "," + toEntity).build();

    return httpClient.executeForString(HttpMethod.DELETE, "/v1/lineage", null, options);
  }

  public String getEntityLineage(String entityType, String entityId) throws OpenMetadataException {
    return getEntityLineage(entityType, entityId, null, null);
  }

  public String getEntityLineage(
      String entityType, String entityId, String upstreamDepth, String downstreamDepth)
      throws OpenMetadataException {

    RequestOptions.Builder optionsBuilder = RequestOptions.builder();

    if (upstreamDepth != null) optionsBuilder.queryParam("upstreamDepth", upstreamDepth);
    if (downstreamDepth != null) optionsBuilder.queryParam("downstreamDepth", downstreamDepth);

    return httpClient.executeForString(
        HttpMethod.GET,
        String.format("/v1/lineage/%s/%s", entityType, entityId),
        null,
        optionsBuilder.build());
  }

  public String exportLineage(String entityType, String entityId) throws OpenMetadataException {
    return httpClient.executeForString(
        HttpMethod.GET, String.format("/v1/lineage/%s/%s/export", entityType, entityId), null);
  }
}
