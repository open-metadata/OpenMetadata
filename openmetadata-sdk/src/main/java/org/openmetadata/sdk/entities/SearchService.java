package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class SearchService extends org.openmetadata.schema.entity.services.SearchService {

  public static org.openmetadata.schema.entity.services.SearchService create(
      org.openmetadata.schema.entity.services.SearchService entity) throws OpenMetadataException {
    return OpenMetadata.client().searchServices().create(entity);
  }

  public static org.openmetadata.schema.entity.services.SearchService retrieve(String id)
      throws OpenMetadataException {
    return OpenMetadata.client().searchServices().get(id);
  }

  public static org.openmetadata.schema.entity.services.SearchService retrieve(UUID id)
      throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static org.openmetadata.schema.entity.services.SearchService retrieveByName(String name)
      throws OpenMetadataException {
    return OpenMetadata.client().searchServices().getByName(name);
  }

  public static org.openmetadata.schema.entity.services.SearchService update(
      String id, org.openmetadata.schema.entity.services.SearchService patch)
      throws OpenMetadataException {
    return OpenMetadata.client().searchServices().update(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().searchServices().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.entity.services.SearchService> list()
      throws OpenMetadataException {
    return OpenMetadata.client().searchServices().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.services.SearchService> list(
      ListParams params) throws OpenMetadataException {
    return OpenMetadata.client().searchServices().list(params);
  }
}
