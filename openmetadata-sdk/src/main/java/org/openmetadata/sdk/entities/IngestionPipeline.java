package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class IngestionPipeline
    extends org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline {

  public static IngestionPipeline create(
      org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline entity)
      throws OpenMetadataException {
    return (IngestionPipeline) OpenMetadata.client().ingestionPipelines().create(entity);
  }

  public static IngestionPipeline retrieve(String id) throws OpenMetadataException {
    return (IngestionPipeline) OpenMetadata.client().ingestionPipelines().get(id);
  }

  public static IngestionPipeline retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static IngestionPipeline retrieveByName(String name) throws OpenMetadataException {
    return (IngestionPipeline) OpenMetadata.client().ingestionPipelines().getByName(name);
  }

  public static IngestionPipeline update(
      String id, org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline patch)
      throws OpenMetadataException {
    return (IngestionPipeline) OpenMetadata.client().ingestionPipelines().update(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().ingestionPipelines().delete(id, params);
  }

  public static ListResponse<
          org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline>
      list() throws OpenMetadataException {
    return OpenMetadata.client().ingestionPipelines().list();
  }

  public static ListResponse<
          org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline>
      list(ListParams params) throws OpenMetadataException {
    return OpenMetadata.client().ingestionPipelines().list(params);
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
