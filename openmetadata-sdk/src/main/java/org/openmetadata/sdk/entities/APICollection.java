package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class APICollection extends org.openmetadata.schema.entity.data.APICollection {

  public static APICollection create(org.openmetadata.schema.entity.data.APICollection entity)
      throws OpenMetadataException {
    return (APICollection) OpenMetadata.client().apiCollections().create(entity);
  }

  public static APICollection retrieve(String id) throws OpenMetadataException {
    return (APICollection) OpenMetadata.client().apiCollections().get(id);
  }

  public static APICollection retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static APICollection retrieveByName(String name) throws OpenMetadataException {
    return (APICollection) OpenMetadata.client().apiCollections().getByName(name);
  }

  public static APICollection update(
      String id, org.openmetadata.schema.entity.data.APICollection patch)
      throws OpenMetadataException {
    return (APICollection) OpenMetadata.client().apiCollections().update(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().apiCollections().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.entity.data.APICollection> list()
      throws OpenMetadataException {
    return OpenMetadata.client().apiCollections().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.data.APICollection> list(
      ListParams params) throws OpenMetadataException {
    return OpenMetadata.client().apiCollections().list(params);
  }

  // Add async delete for all entities extending EntityServiceBase
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
}
