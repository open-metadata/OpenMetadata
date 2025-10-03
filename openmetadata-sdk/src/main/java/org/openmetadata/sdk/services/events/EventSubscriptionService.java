package org.openmetadata.sdk.services.events;

import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.services.EntityServiceBase;

public class EventSubscriptionService
    extends EntityServiceBase<org.openmetadata.schema.entity.events.EventSubscription> {

  public EventSubscriptionService(HttpClient httpClient) {
    super(httpClient, "/v1/events/subscriptions");
  }

  @Override
  protected Class<org.openmetadata.schema.entity.events.EventSubscription> getEntityClass() {
    return org.openmetadata.schema.entity.events.EventSubscription.class;
  }
}
