package org.openmetadata.sdk.services.apiservice;

import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class APICollectionService
    extends EntityServiceBase<org.openmetadata.schema.entity.data.APICollection> {

  public APICollectionService(HttpClient httpClient) {
    super(httpClient, "/v1/apiCollections");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.data.APICollection> getEntityClass() {
    return org.openmetadata.schema.entity.data.APICollection.class;
  }
}
