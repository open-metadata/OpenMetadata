package org.openmetadata.sdk.api;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;

public class BulkAPI {

  public static class BulkRequest {
    public List<Object> entities;
    public String operation;
    public Map<String, Object> options;
  }

  public static class BulkResponse {
    public int successCount;
    public int failureCount;
    public List<BulkResult> results;
  }

  public static class BulkResult {
    public String entityId;
    public String status;
    public String error;
    public Object entity;
  }

  public static String bulkCreate(String entityType, List<Object> entities)
      throws OpenMetadataException {
    return OpenMetadata.client().bulk().bulkCreate(entityType, entities);
  }

  public static String bulkUpdate(String entityType, List<Object> entities)
      throws OpenMetadataException {
    return OpenMetadata.client().bulk().bulkUpdate(entityType, entities);
  }

  public static String bulkDelete(String entityType, List<String> entityIds)
      throws OpenMetadataException {
    return OpenMetadata.client().bulk().bulkDelete(entityType, entityIds);
  }

  public static String getBulkOperationStatus(String operationId) throws OpenMetadataException {
    return OpenMetadata.client().bulk().getBulkOperationStatus(operationId);
  }

  public static CompletableFuture<String> bulkCreateAsync(
      String entityType, List<Object> entities) {
    return OpenMetadata.client().bulk().bulkCreateAsync(entityType, entities);
  }

  public static CompletableFuture<String> bulkUpdateAsync(
      String entityType, List<Object> entities) {
    return OpenMetadata.client().bulk().bulkUpdateAsync(entityType, entities);
  }

  public static CompletableFuture<String> bulkDeleteAsync(
      String entityType, List<String> entityIds) {
    return OpenMetadata.client().bulk().bulkDeleteAsync(entityType, entityIds);
  }

  public static String bulkAddTags(String entityType, List<String> entityIds, List<String> tags)
      throws OpenMetadataException {
    return OpenMetadata.client().bulk().bulkAddTags(entityType, entityIds, tags);
  }

  public static String bulkRemoveTags(String entityType, List<String> entityIds, List<String> tags)
      throws OpenMetadataException {
    return OpenMetadata.client().bulk().bulkRemoveTags(entityType, entityIds, tags);
  }
}
