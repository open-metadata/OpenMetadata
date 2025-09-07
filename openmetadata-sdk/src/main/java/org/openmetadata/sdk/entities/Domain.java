package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class Domain extends org.openmetadata.schema.entity.domains.Domain {

  public static Domain create(org.openmetadata.schema.entity.domains.Domain entity)
      throws OpenMetadataException {
    return (Domain) OpenMetadata.client().domains().create(entity);
  }

  public static Domain retrieve(String id) throws OpenMetadataException {
    return (Domain) OpenMetadata.client().domains().get(id);
  }

  public static Domain retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static Domain retrieveByName(String name) throws OpenMetadataException {
    return (Domain) OpenMetadata.client().domains().getByName(name);
  }

  public static Domain update(String id, org.openmetadata.schema.entity.domains.Domain patch)
      throws OpenMetadataException {
    return (Domain) OpenMetadata.client().domains().update(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().domains().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.entity.domains.Domain> list()
      throws OpenMetadataException {
    return OpenMetadata.client().domains().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.domains.Domain> list(ListParams params)
      throws OpenMetadataException {
    return OpenMetadata.client().domains().list(params);
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
