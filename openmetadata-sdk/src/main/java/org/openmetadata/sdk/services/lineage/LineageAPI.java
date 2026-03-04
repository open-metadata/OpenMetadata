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
    // Expects format: "entityType:entityId" for both fromEntity and toEntity
    // API endpoint: DELETE /v1/lineage/{fromType}/{fromId}/{toType}/{toId}
    String[] fromParts = fromEntity.split(":", 2);
    String[] toParts = toEntity.split(":", 2);

    if (fromParts.length != 2 || toParts.length != 2) {
      throw new OpenMetadataException("Invalid entity format. Expected 'entityType:entityId'");
    }

    String path =
        String.format(
            "/v1/lineage/%s/%s/%s/%s", fromParts[0], fromParts[1], toParts[0], toParts[1]);

    return httpClient.executeForString(HttpMethod.DELETE, path, null);
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

  public String exportLineage(String fqn, String type, String upstreamDepth, String downstreamDepth)
      throws OpenMetadataException {
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();
    optionsBuilder.queryParam("fqn", fqn);
    optionsBuilder.queryParam("type", type);
    if (upstreamDepth != null) optionsBuilder.queryParam("upstreamDepth", upstreamDepth);
    if (downstreamDepth != null) optionsBuilder.queryParam("downstreamDepth", downstreamDepth);

    return httpClient.executeForString(
        HttpMethod.GET, "/v1/lineage/export", null, optionsBuilder.build());
  }

  public String getLineageByName(
      String entityType, String fqn, String upstreamDepth, String downstreamDepth)
      throws OpenMetadataException {
    RequestOptions.Builder optionsBuilder = RequestOptions.builder();

    if (upstreamDepth != null) optionsBuilder.queryParam("upstreamDepth", upstreamDepth);
    if (downstreamDepth != null) optionsBuilder.queryParam("downstreamDepth", downstreamDepth);

    return httpClient.executeForString(
        HttpMethod.GET,
        String.format("/v1/lineage/%s/name/%s", entityType, encodePathSegment(fqn)),
        null,
        optionsBuilder.build());
  }

  private String encodePathSegment(String segment) {
    try {
      return java.net.URLEncoder.encode(segment, "UTF-8").replace("+", "%20");
    } catch (java.io.UnsupportedEncodingException e) {
      return segment;
    }
  }
}
