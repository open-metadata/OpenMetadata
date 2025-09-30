package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class MetadataService extends org.openmetadata.schema.entity.services.MetadataService {

  public static MetadataService create(
      org.openmetadata.schema.entity.services.MetadataService entity) throws OpenMetadataException {
    return (MetadataService) OpenMetadata.client().metadataServices().create(entity);
  }

  public static MetadataService retrieve(String id) throws OpenMetadataException {
    return (MetadataService) OpenMetadata.client().metadataServices().get(id);
  }

  public static MetadataService retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static MetadataService retrieveByName(String name) throws OpenMetadataException {
    return (MetadataService) OpenMetadata.client().metadataServices().getByName(name);
  }

  public static MetadataService update(
      String id, org.openmetadata.schema.entity.services.MetadataService patch)
      throws OpenMetadataException {
    return (MetadataService) OpenMetadata.client().metadataServices().update(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().metadataServices().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.entity.services.MetadataService> list()
      throws OpenMetadataException {
    return OpenMetadata.client().metadataServices().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.services.MetadataService> list(
      ListParams params) throws OpenMetadataException {
    return OpenMetadata.client().metadataServices().list(params);
  }
}
