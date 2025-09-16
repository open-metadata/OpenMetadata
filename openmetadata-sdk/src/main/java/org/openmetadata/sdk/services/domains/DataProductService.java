package org.openmetadata.sdk.services.domains;

import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class DataProductService
    extends EntityServiceBase<org.openmetadata.schema.entity.domains.DataProduct> {

  public DataProductService(HttpClient httpClient) {
    super(httpClient, "/v1/dataProducts");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.domains.DataProduct> getEntityClass() {
    return org.openmetadata.schema.entity.domains.DataProduct.class;
  }

  // Create using CreateDataProduct request
  public org.openmetadata.schema.entity.domains.DataProduct create(CreateDataProduct request)
      throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST,
        basePath,
        request,
        org.openmetadata.schema.entity.domains.DataProduct.class);
  }
}
