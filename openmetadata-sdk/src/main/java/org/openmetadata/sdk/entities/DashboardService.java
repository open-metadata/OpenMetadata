package org.openmetadata.sdk.entities;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.sdk.client.OpenMetadata;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.models.ListParams;
import org.openmetadata.sdk.models.ListResponse;

public class DashboardService extends org.openmetadata.schema.entity.services.DashboardService {

  public static DashboardService create(
      org.openmetadata.schema.entity.services.DashboardService entity)
      throws OpenMetadataException {
    return (DashboardService) OpenMetadata.client().dashboardServices().create(entity);
  }

  public static DashboardService retrieve(String id) throws OpenMetadataException {
    return (DashboardService) OpenMetadata.client().dashboardServices().get(id);
  }

  public static DashboardService retrieve(UUID id) throws OpenMetadataException {
    return retrieve(id.toString());
  }

  public static DashboardService retrieveByName(String name) throws OpenMetadataException {
    return (DashboardService) OpenMetadata.client().dashboardServices().getByName(name);
  }

  public static DashboardService update(
      String id, org.openmetadata.schema.entity.services.DashboardService patch)
      throws OpenMetadataException {
    return (DashboardService) OpenMetadata.client().dashboardServices().patch(id, patch);
  }

  public static void delete(String id, boolean recursive, boolean hardDelete)
      throws OpenMetadataException {
    Map<String, String> params = new HashMap<>();
    params.put("recursive", String.valueOf(recursive));
    params.put("hardDelete", String.valueOf(hardDelete));
    OpenMetadata.client().dashboardServices().delete(id, params);
  }

  public static ListResponse<org.openmetadata.schema.entity.services.DashboardService> list()
      throws OpenMetadataException {
    return OpenMetadata.client().dashboardServices().list();
  }

  public static ListResponse<org.openmetadata.schema.entity.services.DashboardService> list(
      ListParams params) throws OpenMetadataException {
    return OpenMetadata.client().dashboardServices().list(params);
  }
}
