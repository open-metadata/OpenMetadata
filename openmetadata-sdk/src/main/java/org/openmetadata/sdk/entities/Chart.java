package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * SDK wrapper for Chart operations.
 * This class provides static methods for Chart CRUD operations.
 */
public class Chart {
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
  public static org.openmetadata.schema.entity.data.Chart create(CreateChart request) {
    return getClient().charts().create(request);
  }

  public static org.openmetadata.schema.entity.data.Chart retrieve(String id) {
    return getClient().charts().get(id);
  }

  public static org.openmetadata.schema.entity.data.Chart retrieve(String id, String fields) {
    return getClient().charts().get(id, fields);
  }

  public static org.openmetadata.schema.entity.data.Chart retrieveByName(String name) {
    return getClient().charts().getByName(name);
  }

  public static org.openmetadata.schema.entity.data.Chart retrieveByName(
      String name, String fields) {
    return getClient().charts().getByName(name, fields);
  }

  public static org.openmetadata.schema.entity.data.Chart update(
      String id, org.openmetadata.schema.entity.data.Chart entity) {
    return getClient().charts().update(id, entity);
  }

  public static org.openmetadata.schema.entity.data.Chart update(
      org.openmetadata.schema.entity.data.Chart entity) {
    if (entity.getId() == null) {
      throw new IllegalArgumentException("Chart must have an ID for update");
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
    getClient().charts().delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.data.Chart> createAsync(
      CreateChart request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.data.Chart> retrieveAsync(
      String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }
}
