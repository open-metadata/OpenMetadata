package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.sdk.client.OpenMetadataClient;

public class DatabaseService extends org.openmetadata.schema.entity.services.DatabaseService {
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
  public static org.openmetadata.schema.entity.services.DatabaseService create(
      CreateDatabaseService request) {
    return getClient().databaseServices().create(request);
  }

  public static org.openmetadata.schema.entity.services.DatabaseService retrieve(String id) {
    return getClient().databaseServices().get(id);
  }

  public static org.openmetadata.schema.entity.services.DatabaseService retrieve(
      String id, String fields) {
    return getClient().databaseServices().get(id, fields);
  }

  public static org.openmetadata.schema.entity.services.DatabaseService retrieveByName(
      String name) {
    return getClient().databaseServices().getByName(name);
  }

  public static org.openmetadata.schema.entity.services.DatabaseService retrieveByName(
      String name, String fields) {
    return getClient().databaseServices().getByName(name, fields);
  }

  public static org.openmetadata.schema.entity.services.DatabaseService update(
      String id, org.openmetadata.schema.entity.services.DatabaseService service) {
    return getClient().databaseServices().update(id, service);
  }

  public static org.openmetadata.schema.entity.services.DatabaseService update(
      org.openmetadata.schema.entity.services.DatabaseService service) {
    if (service.getId() == null) {
      throw new IllegalArgumentException("DatabaseService must have an ID for update");
    }
    return update(service.getId().toString(), service);
  }

  public static void delete(String id) {
    delete(id, false, false);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete) {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    getClient().databaseServices().delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.services.DatabaseService>
      createAsync(CreateDatabaseService request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.services.DatabaseService>
      retrieveAsync(String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }
}
