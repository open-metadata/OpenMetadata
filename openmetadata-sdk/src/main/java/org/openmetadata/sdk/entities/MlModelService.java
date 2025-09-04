package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class MlModelService extends org.openmetadata.schema.entity.services.MlModelService {

  public static MlModelService create(org.openmetadata.schema.entity.services.MlModelService entity)
      throws OpenMetadataException {
    return (MlModelService) OpenMetadata.client().mlModelServices().create(entity);
  }

  public static MlModelService retrieve(String id) throws OpenMetadataException {
    return (MlModelService) OpenMetadata.client().mlModelServices().get(id);
  }

  public static MlModelService retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static MlModelService retrieveByName(String name) throws OpenMetadataException {
    return (MlModelService) OpenMetadata.client().mlModelServices().getByName(name);
  }

  public static MlModelService update(
      String id, org.openmetadata.schema.entity.services.MlModelService patch)
      throws OpenMetadataException {
    return (MlModelService) OpenMetadata.client().mlModelServices().patch(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().mlModelServices().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.entity.services.MlModelService> list()
      throws OpenMetadataException {
    return OpenMetadata.client().mlModelServices().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.services.MlModelService> list(
      ListParams params) throws OpenMetadataException {
    return OpenMetadata.client().mlModelServices().list(params);
  }
}
