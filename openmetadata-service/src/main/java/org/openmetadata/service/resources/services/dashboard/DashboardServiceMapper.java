package org.openmetadata.service.resources.services.dashboard;

import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.service.mapper.EntityMapper;

public class DashboardServiceMapper
    implements EntityMapper<DashboardService, CreateDashboardService> {
  @Override
  public DashboardService createToEntity(CreateDashboardService create, String user) {
    return copy(new DashboardService(), create, user)
        .withServiceType(create.getServiceType())
        .withConnection(create.getConnection())
        .withIngestionRunner(create.getIngestionRunner());
  }
}
