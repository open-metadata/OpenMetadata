package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class DatabaseService extends org.openmetadata.schema.entity.services.DatabaseService {

  public static DatabaseService create(
      org.openmetadata.schema.entity.services.DatabaseService entity) throws OpenMetadataException {
    return (DatabaseService) OpenMetadata.client().databaseServices().create(entity);
  }

  public static DatabaseService retrieve(String id) throws OpenMetadataException {
    return (DatabaseService) OpenMetadata.client().databaseServices().get(id);
  }

  public static DatabaseService retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static DatabaseService retrieveByName(String name) throws OpenMetadataException {
    return (DatabaseService) OpenMetadata.client().databaseServices().getByName(name);
  }

  public static DatabaseService update(
      String id, org.openmetadata.schema.entity.services.DatabaseService patch)
      throws OpenMetadataException {
    return (DatabaseService) OpenMetadata.client().databaseServices().patch(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().databaseServices().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.entity.services.DatabaseService> list()
      throws OpenMetadataException {
    return OpenMetadata.client().databaseServices().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.services.DatabaseService> list(
      ListParams params) throws OpenMetadataException {
    return OpenMetadata.client().databaseServices().list(params);
  }
}
