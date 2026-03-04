package org.openmetadata.sdk.api;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;

public class LineageAPI {

  public static class LineageNode {
    public String id;
    public String fqn;
    public String entityType;
    public String displayName;
    public Map<String, Object> properties;
  }

  public static class LineageEdge {
    public LineageNode fromEntity;
    public LineageNode toEntity;
    public String lineageDetails;
    public String sqlQuery;
  }

  public static class LineageGraph {
    public List<LineageNode> nodes;
    public List<LineageEdge> edges;
    public int upstreamDepth;
    public int downstreamDepth;
  }

  public static class LineageRequest {
    public String entityId;
    public String entityType;
    public int upstreamDepth = 1;
    public int downstreamDepth = 1;
    public boolean includeDeleted = false;

    public static LineageRequest builder() {
      return new LineageRequest();
    }

    public LineageRequest withEntity(String id, String type) {
      this.entityId = id;
      this.entityType = type;
      return this;
    }

    public LineageRequest withDepth(int upstream, int downstream) {
      this.upstreamDepth = upstream;
      this.downstreamDepth = downstream;
      return this;
    }

    public LineageRequest includeDeleted(boolean include) {
      this.includeDeleted = include;
      return this;
    }
  }

  public static String getLineage(String entity) throws OpenMetadataException {
    return OpenMetadata.client().lineage().getLineage(entity);
  }

  public static String getLineage(String entity, String upstreamDepth, String downstreamDepth)
      throws OpenMetadataException {
    return OpenMetadata.client().lineage().getLineage(entity, upstreamDepth, downstreamDepth);
  }

  public static String getEntityLineage(String entityType, String entityId)
      throws OpenMetadataException {
    return OpenMetadata.client().lineage().getEntityLineage(entityType, entityId);
  }

  public static String getEntityLineage(
      String entityType, String entityId, String upstreamDepth, String downstreamDepth)
      throws OpenMetadataException {
    return OpenMetadata.client()
        .lineage()
        .getEntityLineage(entityType, entityId, upstreamDepth, downstreamDepth);
  }

  public static String addLineage(Object lineageRequest) throws OpenMetadataException {
    return OpenMetadata.client().lineage().addLineage(lineageRequest);
  }

  public static String deleteLineage(String fromEntity, String toEntity)
      throws OpenMetadataException {
    return OpenMetadata.client().lineage().deleteLineage(fromEntity, toEntity);
  }

  public static String exportLineage(
      String fqn, String type, String upstreamDepth, String downstreamDepth)
      throws OpenMetadataException {
    return OpenMetadata.client().lineage().exportLineage(fqn, type, upstreamDepth, downstreamDepth);
  }

  public static CompletableFuture<String> getLineageAsync(String entity) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            return getLineage(entity);
          } catch (OpenMetadataException e) {
            throw new RuntimeException(e);
          }
        });
  }

  public static CompletableFuture<String> addLineageAsync(Object lineageRequest) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            return addLineage(lineageRequest);
          } catch (OpenMetadataException e) {
            throw new RuntimeException(e);
          }
        });
  }

  public static CompletableFuture<String> deleteLineageAsync(String fromEntity, String toEntity) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            return deleteLineage(fromEntity, toEntity);
          } catch (OpenMetadataException e) {
            throw new RuntimeException(e);
          }
        });
  }
}
