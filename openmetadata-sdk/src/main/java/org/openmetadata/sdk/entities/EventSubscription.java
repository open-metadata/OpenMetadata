package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class EventSubscription extends org.openmetadata.schema.entity.events.EventSubscription {

  public static EventSubscription create(
      org.openmetadata.schema.entity.events.EventSubscription entity) throws OpenMetadataException {
    return (EventSubscription) OpenMetadata.client().eventSubscriptions().create(entity);
  }

  public static EventSubscription retrieve(String id) throws OpenMetadataException {
    return (EventSubscription) OpenMetadata.client().eventSubscriptions().get(id);
  }

  public static EventSubscription retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static EventSubscription retrieveByName(String name) throws OpenMetadataException {
    return (EventSubscription) OpenMetadata.client().eventSubscriptions().getByName(name);
  }

  public static EventSubscription update(
      String id, org.openmetadata.schema.entity.events.EventSubscription patch)
      throws OpenMetadataException {
    return (EventSubscription) OpenMetadata.client().eventSubscriptions().update(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().eventSubscriptions().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.entity.events.EventSubscription> list()
      throws OpenMetadataException {
    return OpenMetadata.client().eventSubscriptions().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.events.EventSubscription> list(
      ListParams params) throws OpenMetadataException {
    return OpenMetadata.client().eventSubscriptions().list(params);
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
