package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * SDK wrapper for Classification operations.
 * This class provides static methods for Classification CRUD operations.
 */
public class Classification {
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

  // Static CRUD methods
  public static org.openmetadata.schema.entity.classification.Classification create(
      CreateClassification request) {
    return getClient().classifications().create(request);
  }

  public static org.openmetadata.schema.entity.classification.Classification retrieve(String id) {
    return getClient().classifications().get(id);
  }

  public static org.openmetadata.schema.entity.classification.Classification retrieve(
      String id, String fields) {
    return getClient().classifications().get(id, fields);
  }

  public static org.openmetadata.schema.entity.classification.Classification retrieveByName(
      String name) {
    return getClient().classifications().getByName(name);
  }

  public static org.openmetadata.schema.entity.classification.Classification retrieveByName(
      String name, String fields) {
    return getClient().classifications().getByName(name, fields);
  }

  public static org.openmetadata.schema.entity.classification.Classification update(
      String id, org.openmetadata.schema.entity.classification.Classification entity) {
    return getClient().classifications().update(id, entity);
  }

  public static org.openmetadata.schema.entity.classification.Classification update(
      org.openmetadata.schema.entity.classification.Classification entity) {
    if (entity.getId() == null) {
      throw new IllegalArgumentException("Classification must have an ID for update");
    }
    return update(entity.getId().toString(), entity);
  }

  public static void delete(String id) {
    delete(id, false, false);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete) {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    getClient().classifications().delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.classification.Classification>
      createAsync(CreateClassification request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.classification.Classification>
      retrieveAsync(String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }
}
