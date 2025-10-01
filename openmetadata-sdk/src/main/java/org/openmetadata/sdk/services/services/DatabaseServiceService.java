package org.openmetadata.sdk.services.services;

import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class DatabaseServiceService
    extends EntityServiceBase<org.openmetadata.schema.entity.services.DatabaseService> {

  public DatabaseServiceService(HttpClient httpClient) {
    super(httpClient, "/v1/services/databaseServices");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.services.DatabaseService> getEntityClass() {
    return org.openmetadata.schema.entity.services.DatabaseService.class;
  }

  // Create using CreateDatabaseService request
  public org.openmetadata.schema.entity.services.DatabaseService create(
      CreateDatabaseService request) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST,
        basePath,
        request,
        org.openmetadata.schema.entity.services.DatabaseService.class);
  }
}
