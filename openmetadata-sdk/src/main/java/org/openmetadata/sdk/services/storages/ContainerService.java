package org.openmetadata.sdk.services.storages;

import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class ContainerService extends EntityServiceBase<Container> {
  public ContainerService(HttpClient httpClient) {
    super(httpClient, "/v1/containers");
  }

  @Override
  protected Class<Container> getEntityClass() {
    return Container.class;
  }
}
