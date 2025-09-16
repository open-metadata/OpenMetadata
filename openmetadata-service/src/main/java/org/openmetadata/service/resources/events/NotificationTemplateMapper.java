package org.openmetadata.service.resources.events;

import org.openmetadata.schema.api.events.CreateNotificationTemplate;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.service.mapper.EntityMapper;

public class NotificationTemplateMapper
    implements EntityMapper<NotificationTemplate, CreateNotificationTemplate> {

  @Override
  public NotificationTemplate createToEntity(CreateNotificationTemplate create, String user) {
    return copy(new NotificationTemplate(), create, user)
        .withTemplateBody(create.getTemplateBody());
  }
}
