package org.openmetadata.service.resources.charts;

import static org.openmetadata.service.util.EntityUtil.getEntityReferences;

import org.openmetadata.schema.api.data.CreateChart;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;
import org.openmetadata.service.util.EntityUtil;

public class ChartMapper implements EntityMapper<Chart, CreateChart> {
  @Override
  public Chart createToEntity(CreateChart create, String user) {
    return copy(new Chart(), create, user)
        .withService(EntityUtil.getEntityReference(Entity.DASHBOARD_SERVICE, create.getService()))
        .withChartType(create.getChartType())
        .withSourceUrl(create.getSourceUrl())
        .withSourceHash(create.getSourceHash())
        .withDashboards(getEntityReferences(Entity.DASHBOARD, create.getDashboards()));
  }
}
