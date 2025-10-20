package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class DataProduct extends org.openmetadata.schema.entity.domains.DataProduct {

  public static DataProduct create(org.openmetadata.schema.entity.domains.DataProduct entity)
      throws OpenMetadataException {
    return (DataProduct) OpenMetadata.client().dataProducts().create(entity);
  }

  public static DataProduct retrieve(String id) throws OpenMetadataException {
    return (DataProduct) OpenMetadata.client().dataProducts().get(id);
  }

  public static DataProduct retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static DataProduct retrieveByName(String name) throws OpenMetadataException {
    return (DataProduct) OpenMetadata.client().dataProducts().getByName(name);
  }

  public static DataProduct update(
      String id, org.openmetadata.schema.entity.domains.DataProduct patch)
      throws OpenMetadataException {
    return (DataProduct) OpenMetadata.client().dataProducts().update(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().dataProducts().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.entity.domains.DataProduct> list()
      throws OpenMetadataException {
    return OpenMetadata.client().dataProducts().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.domains.DataProduct> list(
      ListParams params) throws OpenMetadataException {
    return OpenMetadata.client().dataProducts().list(params);
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
