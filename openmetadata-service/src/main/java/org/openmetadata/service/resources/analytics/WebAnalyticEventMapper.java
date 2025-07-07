package org.openmetadata.service.resources.analytics;

import org.openmetadata.schema.analytics.WebAnalyticEvent;
import org.openmetadata.schema.api.tests.CreateWebAnalyticEvent;
import org.openmetadata.service.mapper.EntityMapper;

public class WebAnalyticEventMapper
    implements EntityMapper<WebAnalyticEvent, CreateWebAnalyticEvent> {
  @Override
  public WebAnalyticEvent createToEntity(CreateWebAnalyticEvent create, String user) {
    return copy(new WebAnalyticEvent(), create, user)
        .withName(create.getName())
        .withDisplayName(create.getDisplayName())
        .withDescription(create.getDescription())
        .withEventType(create.getEventType());
  }
}
