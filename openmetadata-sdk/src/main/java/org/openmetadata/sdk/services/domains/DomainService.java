package org.openmetadata.sdk.services.domains;

import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class DomainService
    extends EntityServiceBase<org.openmetadata.schema.entity.domains.Domain> {

  public DomainService(HttpClient httpClient) {
    super(httpClient, "/v1/domains");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.domains.Domain> getEntityClass() {
    return org.openmetadata.schema.entity.domains.Domain.class;
  }
}
