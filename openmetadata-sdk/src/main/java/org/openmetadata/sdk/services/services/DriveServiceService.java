package org.openmetadata.sdk.services.services;

import org.openmetadata.schema.api.services.CreateDriveService;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class DriveServiceService
    extends EntityServiceBase<org.openmetadata.schema.entity.services.DriveService> {

  public DriveServiceService(HttpClient httpClient) {
    super(httpClient, "/v1/services/driveServices");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.services.DriveService> getEntityClass() {
    return org.openmetadata.schema.entity.services.DriveService.class;
  }

  public org.openmetadata.schema.entity.services.DriveService create(CreateDriveService request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST,
        basePath,
        request,
        org.openmetadata.schema.entity.services.DriveService.class);
  }
}
