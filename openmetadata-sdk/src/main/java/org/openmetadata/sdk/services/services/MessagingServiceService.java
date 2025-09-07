package org.openmetadata.sdk.services.services;

import org.openmetadata.sdk.network.HttpClient;
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
}
