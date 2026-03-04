package org.openmetadata.sdk.services.services;

import org.openmetadata.schema.api.services.CreateMessagingService;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class MessagingServiceService
    extends EntityServiceBase<org.openmetadata.schema.entity.services.MessagingService> {

  public MessagingServiceService(HttpClient httpClient) {
    super(httpClient, "/v1/services/messagingServices");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.services.MessagingService> getEntityClass() {
    return org.openmetadata.schema.entity.services.MessagingService.class;
  }

  // Create using CreateMessagingService request
  public org.openmetadata.schema.entity.services.MessagingService create(
      CreateMessagingService request) throws OpenMetadataException {
    return httpClient.execute(
        HttpMethod.POST,
        basePath,
        request,
        org.openmetadata.schema.entity.services.MessagingService.class);
  }
}
