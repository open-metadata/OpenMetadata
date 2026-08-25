package org.openmetadata.sdk.services.events;

import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class EventSubscriptionService extends EntityServiceBase<EventSubscription> {

  public EventSubscriptionService(HttpClient httpClient) {
    super(httpClient, "/v1/events/subscriptions");
  }

  @Override
  protected Class<EventSubscription> getEntityClass() {
    return EventSubscription.class;
  }

  public EventSubscription create(CreateEventSubscription request) throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, EventSubscription.class);
  }
}
