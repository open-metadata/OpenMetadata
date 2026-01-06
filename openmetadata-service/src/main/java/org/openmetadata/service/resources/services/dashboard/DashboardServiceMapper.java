package org.openmetadata.service.resources.services.dashboard;

import org.openmetadata.schema.api.services.CreateDashboardService;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.mapper.Mapper;

@Mapper(entityType = Entity.DASHBOARD_SERVICE)
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
