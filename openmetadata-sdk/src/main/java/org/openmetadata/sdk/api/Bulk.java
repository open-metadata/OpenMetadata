package org.openmetadata.sdk.api;

import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;

/**
 * Static fluent API for bulk operations.
 * Usage: Bulk.create("table", entities)
 */
public class Bulk {
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

  // Bulk create entities
  public static String create(String entityType, List<Object> entities)
      throws OpenMetadataException {
    return getClient().bulk().bulkCreate(entityType, entities);
  }

  // Bulk update entities
  public static String update(String entityType, List<Object> entities)
      throws OpenMetadataException {
    return getClient().bulk().bulkUpdate(entityType, entities);
  }

  // Bulk delete entities
  public static String delete(String entityType, List<String> entityIds)
      throws OpenMetadataException {
    return getClient().bulk().bulkDelete(entityType, entityIds);
  }

  // Bulk add tags
  public static String addTags(String entityType, List<String> entityIds, List<String> tags)
      throws OpenMetadataException {
    return getClient().bulk().bulkAddTags(entityType, entityIds, tags);
  }

  // Bulk remove tags
  public static String removeTags(String entityType, List<String> entityIds, List<String> tags)
      throws OpenMetadataException {
    return getClient().bulk().bulkRemoveTags(entityType, entityIds, tags);
  }

  // Get bulk operation status
  public static String getOperationStatus(String operationId) throws OpenMetadataException {
    return getClient().bulk().getBulkOperationStatus(operationId);
  }

  // Async operations
  public static CompletableFuture<String> createAsync(String entityType, List<Object> entities) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            return create(entityType, entities);
          } catch (OpenMetadataException e) {
            throw new RuntimeException(e);
          }
        });
  }

  public static CompletableFuture<String> updateAsync(String entityType, List<Object> entities) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            return update(entityType, entities);
          } catch (OpenMetadataException e) {
            throw new RuntimeException(e);
          }
        });
  }

  public static CompletableFuture<String> deleteAsync(String entityType, List<String> entityIds) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            return delete(entityType, entityIds);
          } catch (OpenMetadataException e) {
            throw new RuntimeException(e);
          }
        });
  }

  public static CompletableFuture<String> addTagsAsync(
      String entityType, List<String> entityIds, List<String> tags) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            return addTags(entityType, entityIds, tags);
          } catch (OpenMetadataException e) {
            throw new RuntimeException(e);
          }
        });
  }

  public static CompletableFuture<String> removeTagsAsync(
      String entityType, List<String> entityIds, List<String> tags) {
    return CompletableFuture.supplyAsync(
        () -> {
          try {
            return removeTags(entityType, entityIds, tags);
          } catch (OpenMetadataException e) {
            throw new RuntimeException(e);
          }
        });
  }

  // Builder for bulk operations
  public static BulkBuilder builder() {
    return new BulkBuilder();
  }

  public static class BulkBuilder {
    private String entityType;
    private List<Object> entities;
    private List<String> entityIds;
    private List<String> tags;
    private OperationType operationType;

    public enum OperationType {
      CREATE,
      UPDATE,
      DELETE,
      ADD_TAGS,
      REMOVE_TAGS
    }

    public BulkBuilder entityType(String entityType) {
      this.entityType = entityType;
      return this;
    }

    public BulkBuilder entities(List<Object> entities) {
      this.entities = entities;
      return this;
    }

    public BulkBuilder entityIds(List<String> entityIds) {
      this.entityIds = entityIds;
      return this;
    }

    public BulkBuilder tags(List<String> tags) {
      this.tags = tags;
      return this;
    }

    public BulkBuilder forCreate() {
      this.operationType = OperationType.CREATE;
      return this;
    }

    public BulkBuilder forUpdate() {
      this.operationType = OperationType.UPDATE;
      return this;
    }

    public BulkBuilder forDelete() {
      this.operationType = OperationType.DELETE;
      return this;
    }

    public BulkBuilder forAddTags() {
      this.operationType = OperationType.ADD_TAGS;
      return this;
    }

    public BulkBuilder forRemoveTags() {
      this.operationType = OperationType.REMOVE_TAGS;
      return this;
    }

    public String execute() throws OpenMetadataException {
      if (entityType == null) {
        throw new IllegalStateException("Entity type must be set");
      }

      switch (operationType) {
        case CREATE:
          if (entities == null) {
            throw new IllegalStateException("Entities must be set for bulk create");
          }
          return Bulk.create(entityType, entities);
        case UPDATE:
          if (entities == null) {
            throw new IllegalStateException("Entities must be set for bulk update");
          }
          return Bulk.update(entityType, entities);
        case DELETE:
          if (entityIds == null) {
            throw new IllegalStateException("Entity IDs must be set for bulk delete");
          }
          return Bulk.delete(entityType, entityIds);
        case ADD_TAGS:
          if (entityIds == null || tags == null) {
            throw new IllegalStateException("Entity IDs and tags must be set for bulk add tags");
          }
          return Bulk.addTags(entityType, entityIds, tags);
        case REMOVE_TAGS:
          if (entityIds == null || tags == null) {
            throw new IllegalStateException("Entity IDs and tags must be set for bulk remove tags");
          }
          return Bulk.removeTags(entityType, entityIds, tags);
        default:
          throw new IllegalStateException("Operation type must be set");
      }
    }

    public CompletableFuture<String> executeAsync() {
      return CompletableFuture.supplyAsync(
          () -> {
            try {
              return execute();
            } catch (OpenMetadataException e) {
              throw new RuntimeException(e);
            }
          });
    }
  }
}
