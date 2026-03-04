package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.services.CreateMlModelService;
import org.openmetadata.sdk.client.OpenMetadataClient;

public class MlModelService extends org.openmetadata.schema.entity.services.MlModelService {
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
  public static org.openmetadata.schema.entity.services.MlModelService create(
      CreateMlModelService request) {
    // Convert CreateMlModelService to MlModelService
    org.openmetadata.schema.entity.services.MlModelService service =
        new org.openmetadata.schema.entity.services.MlModelService();
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
    return getClient().mlModelServices().create(service);
  }

  public static org.openmetadata.schema.entity.services.MlModelService retrieve(String id) {
    return getClient().mlModelServices().get(id);
  }

  public static org.openmetadata.schema.entity.services.MlModelService retrieve(
      String id, String fields) {
    return getClient().mlModelServices().get(id, fields);
  }

  public static org.openmetadata.schema.entity.services.MlModelService retrieveByName(String name) {
    return getClient().mlModelServices().getByName(name);
  }

  public static org.openmetadata.schema.entity.services.MlModelService retrieveByName(
      String name, String fields) {
    return getClient().mlModelServices().getByName(name, fields);
  }

  public static org.openmetadata.schema.entity.services.MlModelService update(
      String id, org.openmetadata.schema.entity.services.MlModelService service) {
    return getClient().mlModelServices().update(id, service);
  }

  public static org.openmetadata.schema.entity.services.MlModelService update(
      org.openmetadata.schema.entity.services.MlModelService service) {
    if (service.getId() == null) {
      throw new IllegalArgumentException("MlModelService must have an ID for update");
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
    getClient().mlModelServices().delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.services.MlModelService>
      createAsync(CreateMlModelService request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.services.MlModelService>
      retrieveAsync(String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }
}
