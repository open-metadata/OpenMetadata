package org.openmetadata.sdk.services.apiservice;

import java.util.List;
import org.openmetadata.schema.api.data.CreateAPICollection;
import org.openmetadata.schema.entity.data.APICollection;
import org.openmetadata.schema.type.api.BulkOperationResult;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
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

  public BulkOperationResult bulkCreateOrUpdate(List<CreateAPICollection> createRequests)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/bulk", createRequests, BulkOperationResult.class);
  }

  public BulkOperationResult bulkCreateOrUpdateAsync(List<CreateAPICollection> createRequests)
      throws OpenMetadataException {
    RequestOptions options = RequestOptions.builder().queryParam("async", "true").build();
    return httpClient.execute(
        HttpMethod.PUT, basePath + "/bulk", createRequests, BulkOperationResult.class, options);
  }
}
