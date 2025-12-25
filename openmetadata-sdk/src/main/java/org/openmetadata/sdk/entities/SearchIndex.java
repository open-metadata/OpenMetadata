package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.schema.api.data.CreateSearchIndex;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

/**
 * SDK wrapper for SearchIndex operations.
 * This class provides static methods for SearchIndex CRUD operations.
 * It does NOT extend the schema SearchIndex class to avoid naming conflicts.
 */
public class SearchIndex {

  private static OpenMetadataClient defaultClient;

  public static void setDefaultClient(OpenMetadataClient client) {
    defaultClient = client;
  }

  private static OpenMetadataClient getClient() {
    if (defaultClient == null) {
      return OpenMetadata.client();
    }
    return defaultClient;
  }

  // Static methods for CRUD operations
  public static org.openmetadata.schema.entity.data.SearchIndex create(CreateSearchIndex request)
      throws OpenMetadataException {
    return getClient().searchIndexes().create(request);
  }

  public static org.openmetadata.schema.entity.data.SearchIndex retrieve(String id)
      throws OpenMetadataException {
    return getClient().searchIndexes().get(id);
  }

  public static org.openmetadata.schema.entity.data.SearchIndex retrieve(String id, String fields)
      throws OpenMetadataException {
    return getClient().searchIndexes().get(id, fields);
  }

  public static org.openmetadata.schema.entity.data.SearchIndex retrieve(UUID id)
      throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static org.openmetadata.schema.entity.data.SearchIndex retrieveByName(String name)
      throws OpenMetadataException {
    return getClient().searchIndexes().getByName(name);
  }

  public static org.openmetadata.schema.entity.data.SearchIndex retrieveByName(
      String name, String fields) throws OpenMetadataException {
    return getClient().searchIndexes().getByName(name, fields);
  }

  public static org.openmetadata.schema.entity.data.SearchIndex update(
      String id, org.openmetadata.schema.entity.data.SearchIndex patch)
      throws OpenMetadataException {
    return getClient().searchIndexes().update(id, patch);
  }

  public static void delete(String id) throws OpenMetadataException {
    getClient().searchIndexes().delete(id);
  }

  public static void delete(UUID id) throws OpenMetadataException {
    getClient().searchIndexes().delete(id);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    getClient().searchIndexes().delete(id, params);
  }

  // Async delete methods
  public static CompletableFuture<Void> deleteAsync(String id) {
    return getClient().searchIndexes().deleteAsync(id);
  }

  public static CompletableFuture<Void> deleteAsync(UUID id) {
    return getClient().searchIndexes().deleteAsync(id);
  }

  public static CompletableFuture<Void> deleteAsync(
      String id, boolean recursive, boolean hardDelete) {
    return CompletableFuture.runAsync(
        () -> {
          try {
            delete(id, recursive, hardDelete);
          } catch (OpenMetadataException e) {
            throw new RuntimeException(e);
          }
        });
  }

  public static ListResponse<org.openmetadata.schema.entity.data.SearchIndex> list()
      throws OpenMetadataException {
    return getClient().searchIndexes().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.data.SearchIndex> list(
      ListParams params) throws OpenMetadataException {
    return getClient().searchIndexes().list(params);
  }
}
