package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class APIEndpoint extends org.openmetadata.schema.entity.data.APIEndpoint {

  public static APIEndpoint create(org.openmetadata.schema.entity.data.APIEndpoint entity)
      throws OpenMetadataException {
    return (APIEndpoint) OpenMetadata.client().apiEndpoints().create(entity);
  }

  public static APIEndpoint retrieve(String id) throws OpenMetadataException {
    return (APIEndpoint) OpenMetadata.client().apiEndpoints().get(id);
  }

  public static APIEndpoint retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static APIEndpoint retrieveByName(String name) throws OpenMetadataException {
    return (APIEndpoint) OpenMetadata.client().apiEndpoints().getByName(name);
  }

  public static APIEndpoint update(String id, org.openmetadata.schema.entity.data.APIEndpoint patch)
      throws OpenMetadataException {
    return (APIEndpoint) OpenMetadata.client().apiEndpoints().update(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().apiEndpoints().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.entity.data.APIEndpoint> list()
      throws OpenMetadataException {
    return OpenMetadata.client().apiEndpoints().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.data.APIEndpoint> list(
      ListParams params) throws OpenMetadataException {
    return OpenMetadata.client().apiEndpoints().list(params);
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
