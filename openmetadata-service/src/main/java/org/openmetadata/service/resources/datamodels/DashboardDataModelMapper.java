package org.openmetadata.service.resources.datamodels;

import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.resources.databases.DatabaseUtil;
import org.openmetadata.service.util.EntityUtil;

public class DashboardDataModelMapper
    implements EntityMapper<DashboardDataModel, CreateDashboardDataModel> {
  @Override
  public DashboardDataModel createToEntity(CreateDashboardDataModel create, String user) {
    DatabaseUtil.validateColumns(create.getColumns());
    return copy(new DashboardDataModel(), create, user)
        .withService(EntityUtil.getEntityReference(Entity.DASHBOARD_SERVICE, create.getService()))
        .withDataModelType(create.getDataModelType())
        .withSql(create.getSql())
        .withDataModelType(create.getDataModelType())
        .withServiceType(create.getServiceType())
        .withColumns(create.getColumns())
        .withProject(create.getProject())
        .withSourceHash(create.getSourceHash());
  }
}
