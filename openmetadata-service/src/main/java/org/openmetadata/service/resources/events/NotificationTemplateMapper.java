package org.openmetadata.service.resources.events;

import org.openmetadata.schema.api.events.CreateNotificationTemplate;
import org.openmetadata.schema.entity.events.NotificationTemplate;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.service.mapper.EntityMapper;

public class NotificationTemplateMapper
    implements EntityMapper<NotificationTemplate, CreateNotificationTemplate> {

  @Override
  public NotificationTemplate createToEntity(CreateNotificationTemplate create, String user) {
    NotificationTemplate notificationTemplate =
        copy(new NotificationTemplate(), create, user)
            .withTemplateSubject(create.getTemplateSubject())
            .withTemplateBody(create.getTemplateBody());

    if (notificationTemplate != null) {
      notificationTemplate.withProvider(ProviderType.USER);
    }

    return notificationTemplate;
  }
}
