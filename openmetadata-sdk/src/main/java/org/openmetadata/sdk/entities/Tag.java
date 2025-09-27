package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.client.OpenMetadataClient;

/**
 * SDK wrapper for Tag operations.
 * This class provides static methods for Tag CRUD operations.
 */
public class Tag {
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
  public static org.openmetadata.schema.entity.classification.Tag create(CreateTag request) {
    // Convert CreateTag to Tag
    org.openmetadata.schema.entity.classification.Tag entity =
        new org.openmetadata.schema.entity.classification.Tag();
    entity.setName(request.getName());
    if (request.getDisplayName() != null) {
      entity.setDisplayName(request.getDisplayName());
    }
    if (request.getDescription() != null) {
      entity.setDescription(request.getDescription());
    }
    if (request.getClassification() != null) {
      entity.setClassification(
          new EntityReference()
              .withFullyQualifiedName(request.getClassification())
              .withType("classification"));
    }
    return getClient().tags().create(entity);
  }

  public static org.openmetadata.schema.entity.classification.Tag retrieve(String id) {
    return getClient().tags().get(id);
  }

  public static org.openmetadata.schema.entity.classification.Tag retrieve(
      String id, String fields) {
    return getClient().tags().get(id, fields);
  }

  public static org.openmetadata.schema.entity.classification.Tag retrieveByName(String name) {
    return getClient().tags().getByName(name);
  }

  public static org.openmetadata.schema.entity.classification.Tag retrieveByName(
      String name, String fields) {
    return getClient().tags().getByName(name, fields);
  }

  public static org.openmetadata.schema.entity.classification.Tag update(
      String id, org.openmetadata.schema.entity.classification.Tag entity) {
    return getClient().tags().update(id, entity);
  }

  public static org.openmetadata.schema.entity.classification.Tag update(
      org.openmetadata.schema.entity.classification.Tag entity) {
    if (entity.getId() == null) {
      throw new IllegalArgumentException("Tag must have an ID for update");
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
    getClient().tags().delete(id, params);
  }

  // Async operations
  public static CompletableFuture<org.openmetadata.schema.entity.classification.Tag> createAsync(
      CreateTag request) {
    return CompletableFuture.supplyAsync(() -> create(request));
  }

  public static CompletableFuture<org.openmetadata.schema.entity.classification.Tag> retrieveAsync(
      String id) {
    return CompletableFuture.supplyAsync(() -> retrieve(id));
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(() -> delete(id, recursive, hardDelete));
  }
}
