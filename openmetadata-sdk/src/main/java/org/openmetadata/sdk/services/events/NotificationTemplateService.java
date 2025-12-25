package org.openmetadata.sdk.services.events;

import org.openmetadata.schema.api.events.CreateNotificationTemplate;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.services.EntityServiceBase;

public class NotificationTemplateService extends EntityServiceBase<NotificationTemplate> {

  public NotificationTemplateService(HttpClient httpClient) {
    super(httpClient, "/v1/notificationTemplates");
  }

  @Override
  protected Class<NotificationTemplate> getEntityClass() {
    return NotificationTemplate.class;
  }

  public NotificationTemplate create(CreateNotificationTemplate request)
      throws OpenMetadataException {
    return httpClient.execute(HttpMethod.POST, basePath, request, NotificationTemplate.class);
  }

  public NotificationTemplate createOrUpdate(CreateNotificationTemplate request)
      throws OpenMetadataException {
    return httpClient.execute(HttpMethod.PUT, basePath, request, NotificationTemplate.class);
  }
}
