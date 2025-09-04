package org.openmetadata.sdk.services.domains;

import org.openmetadata.sdk.network.HttpClient;
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
}
