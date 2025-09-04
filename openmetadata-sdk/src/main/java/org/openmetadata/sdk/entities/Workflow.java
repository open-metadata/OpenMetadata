package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class Workflow extends org.openmetadata.schema.entity.automations.Workflow {

  public static Workflow create(org.openmetadata.schema.entity.automations.Workflow entity)
      throws OpenMetadataException {
    return (Workflow) OpenMetadata.client().workflows().create(entity);
  }

  public static Workflow retrieve(String id) throws OpenMetadataException {
    return (Workflow) OpenMetadata.client().workflows().get(id);
  }

  public static Workflow retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static Workflow retrieveByName(String name) throws OpenMetadataException {
    return (Workflow) OpenMetadata.client().workflows().getByName(name);
  }

  public static Workflow update(
      String id, org.openmetadata.schema.entity.automations.Workflow patch)
      throws OpenMetadataException {
    return (Workflow) OpenMetadata.client().workflows().patch(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().workflows().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.entity.automations.Workflow> list()
      throws OpenMetadataException {
    return OpenMetadata.client().workflows().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.automations.Workflow> list(
      ListParams params) throws OpenMetadataException {
    return OpenMetadata.client().workflows().list(params);
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
