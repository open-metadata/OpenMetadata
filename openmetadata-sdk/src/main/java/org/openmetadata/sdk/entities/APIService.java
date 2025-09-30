package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class APIService extends org.openmetadata.schema.entity.services.ApiService {

  public static APIService create(org.openmetadata.schema.entity.services.ApiService entity)
      throws OpenMetadataException {
    return (APIService) OpenMetadata.client().apiServices().create(entity);
  }

  public static APIService retrieve(String id) throws OpenMetadataException {
    return (APIService) OpenMetadata.client().apiServices().get(id);
  }

  public static APIService retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static APIService retrieveByName(String name) throws OpenMetadataException {
    return (APIService) OpenMetadata.client().apiServices().getByName(name);
  }

  public static APIService update(
      String id, org.openmetadata.schema.entity.services.ApiService patch)
      throws OpenMetadataException {
    return (APIService) OpenMetadata.client().apiServices().update(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().apiServices().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.entity.services.ApiService> list()
      throws OpenMetadataException {
    return OpenMetadata.client().apiServices().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.services.ApiService> list(
      ListParams params) throws OpenMetadataException {
    return OpenMetadata.client().apiServices().list(params);
  }
}
