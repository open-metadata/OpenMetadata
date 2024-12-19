package org.openmetadata.service.resources.datainsight;

import org.openmetadata.schema.api.dataInsight.CreateDataInsightChart;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.service.mapper.EntityMapper;

public class DataInsightChartMapper
    implements EntityMapper<DataInsightChart, CreateDataInsightChart> {
  @Override
  public DataInsightChart createToEntity(CreateDataInsightChart create, String user) {
    return copy(new DataInsightChart(), create, user)
        .withName(create.getName())
        .withDescription(create.getDescription())
        .withDataIndexType(create.getDataIndexType())
        .withDimensions(create.getDimensions())
        .withMetrics(create.getMetrics())
        .withDisplayName(create.getDisplayName());
  }
}
