package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class StorageService extends org.openmetadata.schema.entity.services.StorageService {

  public static StorageService create(org.openmetadata.schema.entity.services.StorageService entity)
      throws OpenMetadataException {
    return (StorageService) OpenMetadata.client().storageServices().create(entity);
  }

  public static StorageService retrieve(String id) throws OpenMetadataException {
    return (StorageService) OpenMetadata.client().storageServices().get(id);
  }

  public static StorageService retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static StorageService retrieveByName(String name) throws OpenMetadataException {
    return (StorageService) OpenMetadata.client().storageServices().getByName(name);
  }

  public static StorageService update(
      String id, org.openmetadata.schema.entity.services.StorageService patch)
      throws OpenMetadataException {
    return (StorageService) OpenMetadata.client().storageServices().patch(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().storageServices().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.entity.services.StorageService> list()
      throws OpenMetadataException {
    return OpenMetadata.client().storageServices().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.services.StorageService> list(
      ListParams params) throws OpenMetadataException {
    return OpenMetadata.client().storageServices().list(params);
  }
}
