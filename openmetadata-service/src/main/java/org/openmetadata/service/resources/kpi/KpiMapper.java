package org.openmetadata.service.resources.kpi;

import static org.openmetadata.service.util.EntityUtil.getEntityReference;

import org.openmetadata.schema.api.dataInsight.kpi.CreateKpiRequest;
import org.openmetadata.schema.dataInsight.kpi.Kpi;
import org.openmetadata.service.Entity;
import org.openmetadata.service.mapper.EntityMapper;

public class KpiMapper implements EntityMapper<Kpi, CreateKpiRequest> {
  @Override
  public Kpi createToEntity(CreateKpiRequest create, String user) {
    return copy(new Kpi(), create, user)
        .withStartDate(create.getStartDate())
        .withEndDate(create.getEndDate())
        .withTargetValue(create.getTargetValue())
        .withDataInsightChart(
            getEntityReference(
                Entity.DATA_INSIGHT_CUSTOM_CHART, create.getDataInsightChart().value()))
        .withMetricType(create.getMetricType());
  }
}
