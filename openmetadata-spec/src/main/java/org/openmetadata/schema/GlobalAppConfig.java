package org.openmetadata.schema;

import java.util.List;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.type.EntityReference;

public interface GlobalAppConfig {
  Object getAppConfiguration();

  Object getPrivateConfiguration();

  AppSchedule getAppSchedule();

  List<EntityReference> getEventSubscriptions();
}
