package org.openmetadata.service.resources.services.messaging;

import org.openmetadata.schema.api.services.CreateMessagingService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.service.mapper.EntityMapper;

public class MessagingServiceMapper
    implements EntityMapper<MessagingService, CreateMessagingService> {
  @Override
  public MessagingService createToEntity(CreateMessagingService create, String user) {
    return copy(new MessagingService(), create, user)
        .withConnection(create.getConnection())
        .withServiceType(create.getServiceType())
        .withIngestionRunner(create.getIngestionRunner());
  }
}
