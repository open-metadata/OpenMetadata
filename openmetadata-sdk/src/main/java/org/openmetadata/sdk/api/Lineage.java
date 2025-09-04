package org.openmetadata.sdk.api;

import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;

/**
 * Static fluent API for lineage operations.
 * Usage: Lineage.getLineage("entity")
 */
public class Lineage {
  private static OpenMetadataClient defaultClient;

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      throw new IllegalStateException("Default client not set. Call setDefaultClient() first.");
    }
    return defaultClient;
  }

  // Get lineage
  public static String getLineage(String entity) throws OpenMetadataException {
    return getClient().lineage().getLineage(entity);
  }

  public static String getLineage(String entity, String upstreamDepth, String downstreamDepth)
      throws OpenMetadataException {
    return getClient().lineage().getLineage(entity, upstreamDepth, downstreamDepth);
  }

  // Get entity lineage
  public static String getEntityLineage(String entityType, String entityId)
      throws OpenMetadataException {
    return getClient().lineage().getEntityLineage(entityType, entityId);
  }

  public static String getEntityLineage(
      String entityType, String entityId, String upstreamDepth, String downstreamDepth)
      throws OpenMetadataException {
    return getClient()
        .lineage()
        .getEntityLineage(entityType, entityId, upstreamDepth, downstreamDepth);
  }

  // Add lineage
  public static String addLineage(Object lineageRequest) throws OpenMetadataException {
    return getClient().lineage().addLineage(lineageRequest);
  }

  public static String addLineage(String fromEntityId, String fromEntityType, 
      String toEntityId, String toEntityType) throws OpenMetadataException {
    // Build lineage request
    Map<String, Object> lineageRequest = Map.of(
        "edge", Map.of(
            "fromEntity", Map.of(
                "id", fromEntityId,
                "type", fromEntityType
            ),
            "toEntity", Map.of(
                "id", toEntityId,
                "type", toEntityType
            )
        )
    );
    return addLineage(lineageRequest);
  }

  // Delete lineage
  public static String deleteLineage(String fromEntity, String toEntity)
      throws OpenMetadataException {
    return getClient().lineage().deleteLineage(fromEntity, toEntity);
  }

  // Export lineage
  public static String exportLineage(String entityType, String entityId)
      throws OpenMetadataException {
    return getClient().lineage().exportLineage(entityType, entityId);
  }

  // Async operations
  public static CompletableFuture<String> getLineageAsync(String entity) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return getLineage(entity);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  public static CompletableFuture<String> getEntityLineageAsync(String entityType, String entityId) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return getEntityLineage(entityType, entityId);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  public static CompletableFuture<String> addLineageAsync(Object lineageRequest) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return addLineage(lineageRequest);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  public static CompletableFuture<String> deleteLineageAsync(String fromEntity, String toEntity) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return deleteLineage(fromEntity, toEntity);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  public static CompletableFuture<String> exportLineageAsync(String entityType, String entityId) {
    return CompletableFuture.supplyAsync(() -> {
      try {
        return exportLineage(entityType, entityId);
      } catch (OpenMetadataException e) {
        throw new RuntimeException(e);
      }
    });
  }

  // Builder for lineage queries
  public static LineageBuilder builder() {
    return new LineageBuilder();
  }

  public static class LineageBuilder {
    private String entity;
    private String entityType;
    private String entityId;
    private String upstreamDepth;
    private String downstreamDepth;

    public LineageBuilder entity(String entity) {
      this.entity = entity;
      return this;
    }

    public LineageBuilder entityType(String entityType) {
      this.entityType = entityType;
      return this;
    }

    public LineageBuilder entityId(String entityId) {
      this.entityId = entityId;
      return this;
    }

    public LineageBuilder upstreamDepth(int depth) {
      this.upstreamDepth = String.valueOf(depth);
      return this;
    }

    public LineageBuilder downstreamDepth(int depth) {
      this.downstreamDepth = String.valueOf(depth);
      return this;
    }

    public String execute() throws OpenMetadataException {
      if (entity != null) {
        return Lineage.getLineage(entity, upstreamDepth, downstreamDepth);
      } else if (entityType != null && entityId != null) {
        return Lineage.getEntityLineage(entityType, entityId, upstreamDepth, downstreamDepth);
      } else {
        throw new IllegalStateException("Either entity or entityType/entityId must be set");
      }
    }

    public CompletableFuture<String> executeAsync() {
      return CompletableFuture.supplyAsync(() -> {
        try {
          return execute();
        } catch (OpenMetadataException e) {
          throw new RuntimeException(e);
        }
      });
    }
  }
}