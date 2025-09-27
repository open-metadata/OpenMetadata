package org.openmetadata.sdk.services.storages;

import org.openmetadata.schema.api.data.CreateContainer;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class ContainerService extends EntityServiceBase<Container> {
  public ContainerService(HttpClient httpClient) {
    super(httpClient, "/v1/containers");
  }

  @Override
  protected Class<Container> getEntityClass() {
    return Container.class;
  }

  // Create container using CreateContainer request
  public Container create(CreateContainer request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, Container.class);
  }
}
