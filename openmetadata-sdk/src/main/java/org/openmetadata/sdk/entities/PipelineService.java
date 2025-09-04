package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class PipelineService extends org.openmetadata.schema.entity.services.PipelineService {

  public static PipelineService create(
      org.openmetadata.schema.entity.services.PipelineService entity) throws OpenMetadataException {
    return (PipelineService) OpenMetadata.client().pipelineServices().create(entity);
  }

  public static PipelineService retrieve(String id) throws OpenMetadataException {
    return (PipelineService) OpenMetadata.client().pipelineServices().get(id);
  }

  public static PipelineService retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static PipelineService retrieveByName(String name) throws OpenMetadataException {
    return (PipelineService) OpenMetadata.client().pipelineServices().getByName(name);
  }

  public static PipelineService update(
      String id, org.openmetadata.schema.entity.services.PipelineService patch)
      throws OpenMetadataException {
    return (PipelineService) OpenMetadata.client().pipelineServices().patch(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().pipelineServices().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.entity.services.PipelineService> list()
      throws OpenMetadataException {
    return OpenMetadata.client().pipelineServices().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.services.PipelineService> list(
      ListParams params) throws OpenMetadataException {
    return OpenMetadata.client().pipelineServices().list(params);
  }
}
