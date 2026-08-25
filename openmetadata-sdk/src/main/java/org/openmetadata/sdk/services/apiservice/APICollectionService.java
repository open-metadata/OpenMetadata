package org.openmetadata.sdk.services.apiservice;

import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class APICollectionService extends EntityServiceBase<APICollection> {

  public APICollectionService(HttpClient httpClient) {
    super(httpClient, "/v1/apiCollections");
  }

  @Override
  protected Class<APICollection> getEntityClass() {
    return APICollection.class;
  }

  public APICollection create(CreateAPICollection request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, APICollection.class);
  }
}
