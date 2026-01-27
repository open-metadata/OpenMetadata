package org.openmetadata.sdk.services.services;

import java.util.UUID;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.services.connections.TestConnectionResult;
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

  /**
   * Add test connection result to a database service.
   *
   * @param id Service ID
   * @param testConnectionResult Test connection result to add
   * @return Updated database service
   * @throws OpenMetadataException if request fails
   */
  public org.openmetadata.schema.entity.services.DatabaseService addTestConnectionResult(
      UUID id, TestConnectionResult testConnectionResult) throws OpenMetadataException {
    return addTestConnectionResult(id.toString(), testConnectionResult);
  }

  /**
   * Add test connection result to a database service.
   *
   * @param id Service ID as string
   * @param testConnectionResult Test connection result to add
   * @return Updated database service
   * @throws OpenMetadataException if request fails
   */
  public org.openmetadata.schema.entity.services.DatabaseService addTestConnectionResult(
      String id, TestConnectionResult testConnectionResult) throws OpenMetadataException {
    String path = basePath + "/" + id + "/testConnectionResult";
    return httpClient.execute(
        HttpMethod.PUT,
        path,
        testConnectionResult,
        org.openmetadata.schema.entity.services.DatabaseService.class);
  }
}
