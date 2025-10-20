package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.services.CreateStorageService;
import org.openmetadata.sdk.client.OpenMetadataClient;

public class StorageService extends org.openmetadata.schema.entity.services.StorageService {
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
  public static org.openmetadata.schema.entity.services.StorageService create(
      CreateStorageService request) {
    // Convert CreateStorageService to StorageService
    org.openmetadata.schema.entity.services.StorageService service =
        new org.openmetadata.schema.entity.services.StorageService();
    service.setName(request.getName());
    if (request.getDisplayName() != null) {
      service.setDisplayName(request.getDisplayName());
    }
    if (request.getDescription() != null) {
      service.setDescription(request.getDescription());
    }
    service.setServiceType(request.getServiceType());
    service.setConnection(request.getConnection());
    if (request.getTags() != null) {
      service.setTags(request.getTags());
    }
    if (request.getOwners() != null) {
      service.setOwners(request.getOwners());
    }
    return getClient().storageServices().create(service);
  }

  public static org.openmetadata.schema.entity.services.StorageService retrieve(String id) {
    return getClient().storageServices().get(id);
  }

  public static org.openmetadata.schema.entity.services.StorageService retrieve(
      String id, String fields) {
    return getClient().storageServices().get(id, fields);
  }

  public static org.openmetadata.schema.entity.services.StorageService retrieveByName(String name) {
    return getClient().storageServices().getByName(name);
  }

  public static org.openmetadata.schema.entity.services.StorageService retrieveByName(
      String name, String fields) {
    return getClient().storageServices().getByName(name, fields);
  }

  public static org.openmetadata.schema.entity.services.StorageService update(
      String id, org.openmetadata.schema.entity.services.StorageService service) {
    return getClient().storageServices().update(id, service);
  }

  public static org.openmetadata.schema.entity.services.StorageService update(
      org.openmetadata.schema.entity.services.StorageService service) {
    if (service.getId() == null) {
      throw new IllegalArgumentException("StorageService must have an ID for update");
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
    getClient().storageServices().delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.services.StorageService>
      createAsync(CreateStorageService request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.services.StorageService>
      retrieveAsync(String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }
}
